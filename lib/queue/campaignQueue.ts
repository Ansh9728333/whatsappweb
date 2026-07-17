import { Queue } from "bullmq";
import redis from "./redis";

export interface CampaignJobData {
  campaignId: string;
  recipientId: string;
  customerId: string;
  to: string;
  templateName: string;
  language: string;
  variables: Record<string, string>; // { "1": "John", "2": "value" }
}

export const campaignQueue = new Queue<CampaignJobData>("campaign-messages", {
  connection: redis as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // 5s → 10s → 20s
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

/**
 * Enqueue all recipients for a campaign.
 * Calculates randomized delay and campaign sleep periods dynamically.
 */
export async function enqueueCampaign(
  campaign: {
    id: string;
    customerId: string;
    recipients: { id: string; phone: string; variables: Record<string, string> }[];
    templateName: string;
    language: string;
  }
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const dbCampaign = await prisma.campaign.findUnique({
    where: { id: campaign.id },
  });

  const minDelay = dbCampaign?.minDelay ?? 5;
  const maxDelay = dbCampaign?.maxDelay ?? 10;
  const sleepEnabled = dbCampaign?.sleepEnabled ?? false;
  const messagesBeforeSleep = dbCampaign?.messagesBeforeSleep ?? 50;
  const sleepDurationMinutes = dbCampaign?.sleepDurationMinutes ?? 10;

  let currentDelayMs = 0;

  const jobs = campaign.recipients.map((recipient, index) => {
    // 1. Calculate randomized delay
    const randomDelaySec = Math.random() * (maxDelay - minDelay) + minDelay;
    currentDelayMs += randomDelaySec * 1000;

    // 2. Add campaign sleep duration if applicable
    if (sleepEnabled && index > 0 && index % messagesBeforeSleep === 0) {
      currentDelayMs += sleepDurationMinutes * 60 * 1000;
    }

    return {
      name: "send-template",
      data: {
        campaignId: campaign.id,
        recipientId: recipient.id,
        customerId: campaign.customerId,
        to: recipient.phone,
        templateName: campaign.templateName,
        language: campaign.language,
        variables: recipient.variables,
      } satisfies CampaignJobData,
      opts: {
        delay: Math.round(currentDelayMs),
        jobId: `campaign-${campaign.id}-${recipient.id}`, // Prevent duplicate sends
      },
    };
  });

  await campaignQueue.addBulk(jobs);
}
