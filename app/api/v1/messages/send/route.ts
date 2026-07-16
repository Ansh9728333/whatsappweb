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
  message: z.string().optional().default(""),
  type: z.enum(["text", "image", "video", "document", "audio"]).optional().default("text"),
  mediaUrl: z.string().url("Invalid mediaUrl").optional(),
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

    const { to, message, type, mediaUrl } = parsed.data;

    // Fetch the connected WhatsApp number to return in the 'from' field
    const waAccount = await prisma.whatsAppAccount.findFirst({
      where: { engineSessionId: ctx.engineSessionId },
      select: { phoneNumber: true },
    });

    // 4. Send Message via WhatsApp Web Engine
    const result = await sendEngineMessage(
      ctx.engineSessionId,
      to,
      message,
      mediaUrl,
      mediaUrl ? type : undefined
    );

    // Determine message type for DB log
    let dbType: "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" = "TEXT";
    if (mediaUrl) {
      if (type === "image") dbType = "IMAGE";
      else if (type === "video") dbType = "VIDEO";
      else if (type === "audio") dbType = "AUDIO";
      else dbType = "DOCUMENT";
    }

    // 5. Log Message in Database
    const messageLog = await prisma.message.create({
      data: {
        customerId: ctx.customerId,
        metaMessageId: result.messageId, // Use engine message ID
        direction: "OUTBOUND",
        type: dbType,
        status: "SENT",
        toPhone: to,
        fromPhone: waAccount?.phoneNumber || "unknown",
        content: mediaUrl 
          ? { text: message, mediaUrl } 
          : { text: message },
        sentAt: new Date(),
      },
    });

    // 6. Increment Messages Used
    await prisma.usageLog.create({
      data: {
        customerId: ctx.customerId,
        messageId: messageLog.id,
        type: dbType,
        cost: mediaUrl ? 0.01 : 0.005, // Media messages have higher cost
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
