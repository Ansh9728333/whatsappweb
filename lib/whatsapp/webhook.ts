import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

interface WebhookChange {
  value: WebhookValue;
  field: string;
}

interface WebhookValue {
  messaging_product: string;
  metadata: { display_phone_number: string; phone_number_id: string };
  contacts?: { profile: { name: string }; wa_id: string }[];
  messages?: IncomingMessage[];
  statuses?: MessageStatus[];
}

interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string };
}

interface MessageStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: { code: number; title: string }[];
}

/**
 * Verify the webhook challenge from Meta.
 */
export function verifyWebhook(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && token === verifyToken) {
    return challenge;
  }
  return null;
}

/**
 * Verify the HMAC-SHA256 signature from Meta.
 */
export function verifySignature(
  rawBody: string,
  signature: string
): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) return false; // Skip verification if not configured (dev mode)
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  return signature === `sha256=${expected}`;
}

/**
 * Main webhook event handler — routes to appropriate sub-handlers.
 */
export async function handleWebhookEvent(
  payload: WhatsAppWebhookPayload
): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const value = change.value;
      const phoneNumberId = value.metadata.phone_number_id;

      // Find customer by phone number ID
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: { phoneNumberId },
        select: { customerId: true },
      });

      if (value.messages) {
        for (const message of value.messages) {
          await handleMessageReceived(message, value, waAccount?.customerId, phoneNumberId);
        }
      }

      if (value.statuses) {
        for (const status of value.statuses) {
          await handleStatusUpdate(status);
        }
      }
    }
  }
}

async function handleMessageReceived(
  message: IncomingMessage,
  value: WebhookValue,
  customerId: string | undefined,
  phoneNumberId: string
): Promise<void> {
  if (!customerId) return;

  const senderPhone = message.from;
  const contactInfo = value.contacts?.[0];
  const senderName = contactInfo?.profile.name ?? senderPhone;

  // Upsert contact
  const contact = await prisma.contact.upsert({
    where: { customerId_phone: { customerId, phone: senderPhone } },
    update: {},
    create: { customerId, name: senderName, phone: senderPhone },
  });

  // Upsert conversation
  const conversation = await prisma.conversation.upsert({
    where: { customerId_contactId: { customerId, contactId: contact.id } },
    update: { lastMessageAt: new Date(), unreadCount: { increment: 1 }, isOpen: true },
    create: { customerId, contactId: contact.id, unreadCount: 1 },
  });

  // Get message content
  let content: Record<string, unknown> = {};
  let msgType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" = "TEXT";

  if (message.type === "text" && message.text) {
    content = { text: message.text.body };
    msgType = "TEXT";
  } else if (message.type === "image") {
    content = { mediaId: message.image?.id, mimeType: message.image?.mime_type };
    msgType = "IMAGE";
  }

  // Save message
  await prisma.message.create({
    data: {
      customerId,
      conversationId: conversation.id,
      metaMessageId: message.id,
      direction: "INBOUND",
      type: msgType,
      status: "DELIVERED",
      toPhone: phoneNumberId,
      fromPhone: senderPhone,
      content: content as any,
      sentAt: new Date(parseInt(message.timestamp) * 1000),
    },
  });
}

async function handleStatusUpdate(status: MessageStatus): Promise<void> {
  const statusMap: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
    sent: "SENT",
    delivered: "DELIVERED",
    read: "READ",
    failed: "FAILED",
  };

  const newStatus = statusMap[status.status];
  if (!newStatus) return;

  const updateData: Record<string, unknown> = { status: newStatus };
  const timestamp = new Date(parseInt(status.timestamp) * 1000);

  if (newStatus === "SENT") updateData.sentAt = timestamp;
  if (newStatus === "DELIVERED") updateData.deliveredAt = timestamp;
  if (newStatus === "READ") updateData.readAt = timestamp;
  if (newStatus === "FAILED") {
    updateData.failedAt = timestamp;
    updateData.errorMessage = status.errors?.[0]?.title;
  }

  await prisma.message.updateMany({
    where: { metaMessageId: status.id },
    data: updateData,
  });

  // Update campaign recipient if applicable
  const message = await prisma.message.findFirst({
    where: { metaMessageId: status.id },
    select: { campaignId: true, toPhone: true },
  });

  if (message?.campaignId) {
    const recipientStatus: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
      SENT: "SENT",
      DELIVERED: "DELIVERED",
      READ: "READ",
      FAILED: "FAILED",
    };
    await prisma.campaignRecipient.updateMany({
      where: { campaignId: message.campaignId, phone: status.recipient_id },
      data: { status: recipientStatus[newStatus] },
    });

    // Update campaign counters
    if (newStatus === "DELIVERED") {
      await prisma.campaign.update({
        where: { id: message.campaignId },
        data: { deliveredCount: { increment: 1 } },
      });
    } else if (newStatus === "READ") {
      await prisma.campaign.update({
        where: { id: message.campaignId },
        data: { readCount: { increment: 1 } },
      });
    } else if (newStatus === "FAILED") {
      await prisma.campaign.update({
        where: { id: message.campaignId },
        data: { failedCount: { increment: 1 } },
      });
    }
  }
}
