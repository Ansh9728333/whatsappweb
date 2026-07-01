import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendTextMessage } from "@/lib/whatsapp/messages";
import { getCustomerWAConfig } from "@/lib/whatsapp/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "conversationId required" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, customerId: session.customerId },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark as read
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { conversationId, text } = body as { conversationId: string; text: string };

  if (!conversationId || !text) {
    return NextResponse.json({ error: "conversationId and text are required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, customerId: session.customerId },
    include: { contact: true },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const waConfig = await getCustomerWAConfig(session.customerId);
  let metaMessageId: string | undefined;
  let status: "SENT" | "FAILED" = "SENT";
  let errorMessage: string | undefined;

  if (waConfig) {
    try {
      const result = await sendTextMessage(waConfig.phoneNumberId, conversation.contact.phone, text, waConfig.accessToken);
      metaMessageId = result.messages[0]?.id;
    } catch (err) {
      status = "FAILED";
      errorMessage = err instanceof Error ? err.message : "Send failed";
    }
  } else {
    // Demo mode: message saved without actual send
    status = "SENT";
  }

  const message = await prisma.message.create({
    data: {
      customerId: session.customerId,
      conversationId,
      metaMessageId,
      direction: "OUTBOUND",
      type: "TEXT",
      status,
      toPhone: conversation.contact.phone,
      content: { text },
      errorMessage,
      sentAt: new Date(),
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  });

  return NextResponse.json(message, { status: 201 });
}
