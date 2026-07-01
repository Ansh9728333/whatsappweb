import { Worker } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { sendTemplateMessage, buildTemplateComponents } from "../whatsapp/messages";
import type { CampaignJobData } from "./campaignQueue";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

console.log("🚀 Campaign worker starting...");

const worker = new Worker<CampaignJobData>(
  "campaign-messages",
  async (job) => {
    const { campaignId, recipientId, customerId, phoneNumberId, to, templateName, language, variables } = job.data;

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

      // Get customer's access token
      const waAccount = await prisma.whatsAppAccount.findUnique({
        where: { customerId },
        select: { encryptedToken: true },
      });

      const accessToken =
        waAccount?.encryptedToken
          ? Buffer.from(waAccount.encryptedToken, "base64").toString("utf-8")
          : process.env.META_SYSTEM_USER_TOKEN;

      // Build template components
      const components = buildTemplateComponents(variables);

      // Send message
      const result = await sendTemplateMessage(
        phoneNumberId,
        to,
        templateName,
        language,
        components,
        accessToken
      );

      metaMessageId = result.messages[0]?.id;
      console.log(`✅ Sent to ${to}, Meta ID: ${metaMessageId}`);
    } catch (err) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(`❌ Failed to send to ${to}:`, errorMessage);

      // If this is the final retry, mark as permanently failed
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
        type: "TEMPLATE",
        status,
        toPhone: to,
        content: { templateName, variables },
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
          type: "TEMPLATE",
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
    concurrency: 10, // Process 10 jobs in parallel
    limiter: {
      max: 80,      // Max 80 jobs per window
      duration: 1000, // Per 1 second
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
    include: { _count: { select: { recipients: true } } },
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
