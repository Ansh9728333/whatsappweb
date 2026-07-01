import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-engine-secret");
  const engineSecret = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";

  if (!secret || secret !== engineSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessionId, from, message, messageId } = body as {
      sessionId: string;
      from: string;
      message: string;
      messageId: string;
    };

    if (!sessionId || !from || !message || !messageId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Find the connected WhatsApp account
    const waAccount = await prisma.whatsAppAccount.findUnique({
      where: { engineSessionId: sessionId },
    });

    if (!waAccount || waAccount.status !== "CONNECTED") {
      return NextResponse.json({ error: "Account not found or not connected" }, { status: 400 });
    }

    const customerId = waAccount.customerId;
    const cleanFrom = from.split("@")[0].replace(/\D/g, "");

    // Log the Webhook payload for audit trail
    await prisma.webhookLog.create({
      data: {
        payload: body as any,
      },
    });

    // 2. Upsert Contact
    const contact = await prisma.contact.upsert({
      where: {
        customerId_phone: {
          customerId,
          phone: cleanFrom,
        },
      },
      update: {},
      create: {
        customerId,
        name: `WhatsApp User ${cleanFrom}`,
        phone: cleanFrom,
      },
    });

    // 3. Upsert Conversation
    const conversation = await prisma.conversation.upsert({
      where: {
        customerId_contactId: {
          customerId,
          contactId: contact.id,
        },
      },
      update: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        isOpen: true,
      },
      create: {
        customerId,
        contactId: contact.id,
        unreadCount: 1,
        isOpen: true,
      },
    });

    // 4. Save Inbound Message
    await prisma.message.create({
      data: {
        customerId,
        conversationId: conversation.id,
        metaMessageId: messageId,
        direction: "INBOUND",
        type: "TEXT",
        status: "DELIVERED",
        toPhone: waAccount.phoneNumber,
        fromPhone: cleanFrom,
        content: { text: message } as any,
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return new Response("Webhook receiver active", { status: 200 });
}
