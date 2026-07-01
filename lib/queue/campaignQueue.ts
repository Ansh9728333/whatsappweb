import { Queue } from "bullmq";
import redis from "./redis";

export interface CampaignJobData {
  campaignId: string;
  recipientId: string;
  customerId: string;
  phoneNumberId: string;
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
 * Rate-limited to stay within Meta's 80 msg/sec limit.
 */
export async function enqueueCampaign(
  campaign: {
    id: string;
    customerId: string;
    recipients: { id: string; phone: string; variables: Record<string, string> }[];
    templateName: string;
    language: string;
    phoneNumberId: string;
  }
): Promise<void> {
  const jobs = campaign.recipients.map((recipient, index) => ({
    name: "send-template",
    data: {
      campaignId: campaign.id,
      recipientId: recipient.id,
      customerId: campaign.customerId,
      phoneNumberId: campaign.phoneNumberId,
      to: recipient.phone,
      templateName: campaign.templateName,
      language: campaign.language,
      variables: recipient.variables,
    } satisfies CampaignJobData,
    opts: {
      // Stagger jobs: 1 per ~12ms = ~80/sec
      delay: Math.floor(index / 80) * 1000,
      jobId: `campaign-${campaign.id}-${recipient.id}`, // Prevent duplicate sends
    },
  }));

  await campaignQueue.addBulk(jobs);
}
