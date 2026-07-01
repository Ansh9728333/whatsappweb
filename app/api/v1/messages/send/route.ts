import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateApiKey,
  isWithinLimit,
  unauthorizedResponse,
  limitExceededResponse,
} from "@/lib/api-middleware";
import { sendEngineMessage } from "@/lib/whatsapp/engine";
import { prisma } from "@/lib/prisma";

const SendMessageSchema = z.object({
  to: z.string().min(7, "Phone number is required"),
  message: z.string().min(1, "Message content is required"),
  type: z.enum(["text"]).default("text"),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate API Key and Secret
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  // 2. Check Plan Limit
  if (!isWithinLimit(ctx)) return limitExceededResponse();

  // 3. Validate Body
  try {
    const body = await request.json();
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { to, message } = parsed.data;

    // Fetch the connected WhatsApp number to return in the 'from' field
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: { engineSessionId: ctx.engineSessionId },
      select: { phoneNumber: true },
    });

    // 4. Send Message via WhatsApp Web Engine
    const result = await sendEngineMessage(ctx.engineSessionId, to, message);

    // 5. Log Message in Database
    const messageLog = await prisma.message.create({
      data: {
        customerId: ctx.customerId,
        metaMessageId: result.messageId, // Use engine message ID
        direction: "OUTBOUND",
        type: "TEXT",
        status: "SENT",
        toPhone: to,
        fromPhone: waAccount?.phoneNumber || "unknown",
        content: { text: message } as any,
        sentAt: new Date(),
      },
    });

    // 6. Increment Messages Used
    await prisma.usageLog.create({
      data: {
        customerId: ctx.customerId,
        messageId: messageLog.id,
        type: "TEXT",
        cost: 0.005,
      },
    });

    await prisma.customer.update({
      where: { id: ctx.customerId },
      data: { messagesUsed: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      from: waAccount?.phoneNumber || "unknown",
      to,
      status: "sent",
    });
  } catch (err: any) {
    console.error("Public send API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
