import { metaRequest } from "./client";

export interface MetaSendResponse {
  messaging_product: string;
  contacts: { input: string; wa_id: string }[];
  messages: { id: string }[];
}

/**
 * Send a plain text message.
 */
export async function sendTextMessage(
  phoneNumberId: string,
  to: string,
  text: string,
  token?: string
): Promise<MetaSendResponse> {
  return metaRequest<MetaSendResponse>(
    "POST",
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    },
    token
  );
}

/**
 * Send a template message.
 * components: array of header/body/button component objects per Meta spec.
 */
export async function sendTemplateMessage(
  phoneNumberId: string,
  to: string,
  templateName: string,
  language: string,
  components: unknown[] = [],
  token?: string
): Promise<MetaSendResponse> {
  return metaRequest<MetaSendResponse>(
    "POST",
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components,
      },
    },
    token
  );
}

/**
 * Send a media message (image, video, audio, document).
 */
export async function sendMediaMessage(
  phoneNumberId: string,
  to: string,
  mediaType: "image" | "video" | "audio" | "document",
  mediaUrl: string,
  caption?: string,
  token?: string
): Promise<MetaSendResponse> {
  return metaRequest<MetaSendResponse>(
    "POST",
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: mediaType,
      [mediaType]: { link: mediaUrl, ...(caption && { caption }) },
    },
    token
  );
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(
  phoneNumberId: string,
  messageId: string,
  token?: string
): Promise<void> {
  await metaRequest(
    "POST",
    `${phoneNumberId}/messages`,
    {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    },
    token
  );
}

/**
 * Build template components from variable map.
 * variables: { "1": "John", "2": "ORDER-123" }
 */
export function buildTemplateComponents(
  variables: Record<string, string>
): unknown[] {
  const params = Object.values(variables).map((value) => ({
    type: "text",
    text: value,
  }));
  if (params.length === 0) return [];
  return [{ type: "body", parameters: params }];
}
