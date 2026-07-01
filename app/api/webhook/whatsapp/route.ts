import { NextRequest, NextResponse } from "next/server";
import {
  verifyWebhook,
  verifySignature,
  handleWebhookEvent,
  type WhatsAppWebhookPayload,
} from "@/lib/whatsapp/webhook";

// GET — Meta webhook verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode") ?? "";
  const token = searchParams.get("hub.verify_token") ?? "";
  const challenge = searchParams.get("hub.challenge") ?? "";

  const result = verifyWebhook(mode, token, challenge);
  if (result !== null) {
    return new Response(result, { status: 200 });
  }
  return new Response("Verification failed", { status: 403 });
}

// POST — Incoming webhook events
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256") ?? "";

  // Verify signature (optional in dev if APP_SECRET not set)
  if (process.env.META_APP_SECRET && !verifySignature(rawBody, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Process async — return 200 immediately (Meta requires fast response)
  handleWebhookEvent(payload).catch(console.error);

  return new Response("OK", { status: 200 });
}
