import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { sendEngineMessage } from "../whatsapp/engine";
import type { CampaignJobData } from "./campaignQueue";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

console.log("🚀 Campaign worker starting...");

const worker = new Worker<CampaignJobData>(
  "campaign-messages",
  async (job) => {
    const { campaignId, recipientId, customerId, to } = job.data;

    console.log(`📤 Processing job ${job.id} for Campaign ${campaignId} → ${to}`);

    let metaMessageId: string | undefined;
    let status = "SENT";
    let errorMessage: string | undefined;
    let requestPayload: any = {};
    let responsePayload: any = {};
    let activeSenderSessionId: string | null = null;

    try {
      // 1. Idempotency guard: check if already sent
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
      });

      if (!recipient) {
        throw new Error(`Recipient ${recipientId} not found`);
      }

      if (recipient.status === "SENT" || recipient.status === "DELIVERED" || recipient.status === "READ") {
        console.log(`⏭️  Skipping already-sent recipient ${recipientId}`);
        return { skipped: true };
      }

      // 2. Fetch Campaign details with senders
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { senders: true },
      });

      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Pause/Cancel check
      if (campaign.status === "PAUSED") {
        console.log(`⏸️  Campaign ${campaignId} is PAUSED, skipping job.`);
        return { status: "PAUSED" };
      }
      if (campaign.status === "CANCELLED") {
        console.log(`⏹️  Campaign ${campaignId} is CANCELLED, skipping job.`);
        return { status: "CANCELLED" };
      }

      // 3. Resolve Round Robin sender assignment
      const activeSenders = campaign.senders.filter((s) => s.status === "ACTIVE");
      if (activeSenders.length === 0) {
        throw new Error("No active WhatsApp senders assigned to this campaign.");
      }

      // Determine index statelessly by counting preceding recipients
      const precedingCount = await prisma.campaignRecipient.count({
        where: { campaignId, id: { lt: recipientId } },
      });
      const assignedSender = activeSenders[precedingCount % activeSenders.length];
      
      activeSenderSessionId = assignedSender.sessionId;
      let activeSenderPhone = assignedSender.phoneNumber;
      let isReady = false;

      // Import dynamic engine checkers to prevent circular import issues
      const { ensureEngineSessionActive } = await import("../whatsapp/engine");

      // Verify connection of assigned sender
      const isPrimaryReady = await ensureEngineSessionActive(assignedSender.sessionId);
      if (isPrimaryReady) {
        isReady = true;
      } else {
        console.warn(`[Worker] Primary sender ${assignedSender.phoneNumber} disconnected. Seeking fallback...`);
        // Iterate through fallback senders
        for (const fallback of activeSenders) {
          if (fallback.sessionId !== assignedSender.sessionId) {
            const isFallbackReady = await ensureEngineSessionActive(fallback.sessionId);
            if (isFallbackReady) {
              activeSenderSessionId = fallback.sessionId;
              activeSenderPhone = fallback.phoneNumber;
              isReady = true;
              
              // Create Warning Campaign Log
              await prisma.campaignLog.create({
                data: {
                  campaignId,
                  recipientId,
                  sessionId: assignedSender.sessionId,
                  eventType: "WARNING",
                  status: "WARNING",
                  errorMessage: `Sender ${assignedSender.phoneNumber} was disconnected. Message re-routed to connected sender ${fallback.phoneNumber}.`,
                },
              });
              break;
            }
          }
        }
      }

      if (!isReady) {
        // Log critical failure
        await prisma.campaignLog.create({
          data: {
            campaignId,
            recipientId,
            sessionId: assignedSender.sessionId,
            eventType: "ERROR",
            status: "FAILED",
            errorMessage: `Assigned sender ${assignedSender.phoneNumber} is disconnected and no active fallbacks are connected.`,
          },
        });
        throw new Error(`WhatsApp sender ${assignedSender.phoneNumber} is disconnected and no connected fallbacks are available.`);
      }

      // 4. Construct message variables
      let messageText = campaign.messageBody || "";
      const customVars = (recipient.customData as Record<string, string>) || {};
      const variablesMap: Record<string, string> = {
        name: recipient.name || "",
        phone: recipient.phoneNumber || "",
        ...customVars,
      };

      for (const [key, val] of Object.entries(variablesMap)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "gi");
        messageText = messageText.replace(regex, val || "");
      }

      // 5. Send message via Engine
      const mediaTypeParam = campaign.messageType !== "TEXT" ? campaign.messageType.toLowerCase() : undefined;
      requestPayload = {
        sessionId: activeSenderSessionId,
        to,
        message: messageText,
        mediaUrl: campaign.mediaUrl || undefined,
        mediaType: mediaTypeParam,
      };

      const result = await sendEngineMessage(
        activeSenderSessionId,
        to,
        messageText,
        campaign.mediaUrl || undefined,
        mediaTypeParam
      );

      metaMessageId = result.messageId;
      responsePayload = result;
      console.log(`✅ Sent message to ${to} via ${activeSenderPhone}, Engine Message ID: ${metaMessageId}`);

      // Track messages sent per sender
      await prisma.campaignSender.updateMany({
        where: { campaignId, sessionId: activeSenderSessionId },
        data: { messagesSent: { increment: 1 } },
      });

      // Save Success Campaign Log
      await prisma.campaignLog.create({
        data: {
          campaignId,
          recipientId,
          sessionId: activeSenderSessionId,
          eventType: "SEND",
          status: "SENT",
          requestPayload: requestPayload as any,
          responsePayload: responsePayload as any,
        },
      });

    } catch (err: any) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`❌ Failed to send to ${to}:`, errorMessage);

      // Save Error Campaign Log
      await prisma.campaignLog.create({
        data: {
          campaignId,
          recipientId,
          sessionId: activeSenderSessionId || null,
          eventType: "ERROR",
          status: "FAILED",
          requestPayload: requestPayload as any,
          errorMessage,
        },
      });

      // If this is the final retry, update counters
      if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
      } else {
        throw err; // Re-throw to trigger retry
      }
    }

    // Save message record
    const message = await prisma.message.create({
      data: {
        customerId,
        campaignId,
        metaMessageId,
        direction: "OUTBOUND",
        type: requestPayload.mediaUrl ? "IMAGE" : "TEXT",
        status: status === "SENT" ? "SENT" : "FAILED",
        toPhone: to,
        content: { text: requestPayload.message } as any,
        errorMessage,
        sentAt: status === "SENT" ? new Date() : undefined,
      },
    });

    // Update recipient record
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: status === "SENT" ? "SENT" : "FAILED",
        assignedSessionId: activeSenderSessionId || null,
        errorMessage,
        sentAt: status === "SENT" ? new Date() : undefined,
        messageRendered: requestPayload.message || null,
      },
    });

    // Update campaign counters
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount: status === "SENT" ? { increment: 1 } : undefined,
        failedCount: status === "FAILED" ? { increment: 1 } : undefined,
      },
    });

    // Log usage billing
    if (status === "SENT") {
      await prisma.usageLog.create({
        data: {
          customerId,
          messageId: message.id,
          type: requestPayload.mediaUrl ? "MEDIA" : "TEXT",
          cost: requestPayload.mediaUrl ? 0.01 : 0.005,
        },
      });
      await prisma.customer.update({
        where: { id: customerId },
        data: { messagesUsed: { increment: 1 } },
      });
    }

    return { metaMessageId, status };
  },
  {
    connection: redis as any,
    concurrency: 10,
    limiter: {
      max: 80,
      duration: 1000,
    },
  }
);

worker.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Check and mark campaigns complete when all recipients processed
async function checkCampaignCompletion(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) return;

  const processed = campaign.sentCount + campaign.failedCount;
  if (processed >= campaign.totalRecipients && campaign.status === "RUNNING") {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    console.log(`🏁 Campaign ${campaignId} completed`);
  }
}

// Check completion after each job
worker.on("completed", async (job) => {
  await checkCampaignCompletion(job.data.campaignId);
});

console.log("✅ Campaign worker ready");

// Graceful shutdown
process.on("SIGTERM", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});
