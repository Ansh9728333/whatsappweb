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
    const { campaignId, recipientId, customerId, to, templateName, variables } = job.data;

    console.log(`📤 Processing job ${job.id}: ${templateName} → ${to}`);

    let metaMessageId: string | undefined;
    let status: "SENT" | "FAILED" = "SENT";
    let errorMessage: string | undefined;

    try {
      // Check if already sent (idempotency guard)
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: recipientId },
      });

      if (recipient?.status === "SENT" || recipient?.status === "DELIVERED" || recipient?.status === "READ") {
        console.log(`⏭️  Skipping already-sent recipient ${recipientId}`);
        return { skipped: true };
      }

      // 1. Fetch connected WhatsApp Account
      const waAccount = await prisma.whatsAppAccount.findUnique({
        where: { customerId },
        select: { engineSessionId: true, status: true },
      });

      if (!waAccount || waAccount.status !== "CONNECTED" || !waAccount.engineSessionId) {
        throw new Error("WhatsApp account not connected");
      }

      // 2. Fetch template details
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { template: true },
      });

      if (!campaign || !campaign.template) {
        throw new Error("Campaign or template not found");
      }

      // 3. Construct message by substituting variables in the body text
      let messageText = campaign.template.bodyText;
      if (variables) {
        for (const [key, val] of Object.entries(variables)) {
          messageText = messageText.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
        }
      }

      // 4. Send via Engine
      const result = await sendEngineMessage(
        waAccount.engineSessionId,
        to,
        messageText
      );

      metaMessageId = result.messageId;
      console.log(`✅ Sent to ${to}, Engine Message ID: ${metaMessageId}`);
    } catch (err: any) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`❌ Failed to send to ${to}:`, errorMessage);

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
        type: "TEXT",
        status,
        toPhone: to,
        content: { text: variables ? templateName : "" } as any, // Save mapping reference
        errorMessage,
        sentAt: status === "SENT" ? new Date() : undefined,
      },
    });

    // Update recipient
    await prisma.campaignRecipient.update({
      where: { id: recipientId },
      data: {
        status: status === "SENT" ? "SENT" : "FAILED",
        messageId: message.id,
        errorMessage,
        processedAt: new Date(),
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

    // Log usage
    if (status === "SENT") {
      await prisma.usageLog.create({
        data: {
          customerId,
          messageId: message.id,
          type: "TEXT",
          cost: 0.005,
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
