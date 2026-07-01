import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  validateApiKey,
  isWithinLimit,
  unauthorizedResponse,
  limitExceededResponse,
} from "@/lib/api-middleware";
import { sendTextMessage, sendTemplateMessage, buildTemplateComponents } from "@/lib/whatsapp/messages";
import { prisma } from "@/lib/prisma";

const SendMessageSchema = z.object({
  to: z.string().min(7, "Phone number is required"),
  type: z.enum(["text", "template"]),
  text: z.string().optional(),
  template_name: z.string().optional(),
  language: z.string().default("en_US"),
  variables: z.record(z.string(), z.string()).optional(),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  // 2. Check limits
  if (!isWithinLimit(ctx)) return limitExceededResponse();

  // 3. Validate body
  const body = await request.json();
  const parsed = SendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { to, type, text, template_name, language, variables } = parsed.data;

  let metaMessageId: string | undefined;
  let errorMessage: string | undefined;
  let status: "SENT" | "FAILED" = "SENT";
  let content: Record<string, unknown> = {};

  try {
    if (type === "text") {
      if (!text) throw new Error("text field is required for type=text");
      const result = await sendTextMessage(ctx.phoneNumberId, to, text);
      metaMessageId = result.messages[0]?.id;
      content = { text };
    } else if (type === "template") {
      if (!template_name) throw new Error("template_name is required for type=template");
      const components = variables ? buildTemplateComponents(variables) : [];
      const result = await sendTemplateMessage(ctx.phoneNumberId, to, template_name, language, components);
      metaMessageId = result.messages[0]?.id;
      content = { templateName: template_name, variables };
    }
  } catch (err) {
    status = "FAILED";
    errorMessage = err instanceof Error ? err.message : "Unknown error";
  }

  // 4. Log message
  const message = await prisma.message.create({
    data: {
      customerId: ctx.customerId,
      metaMessageId,
      direction: "OUTBOUND",
      type: type === "template" ? "TEMPLATE" : "TEXT",
      status,
      toPhone: to,
      content: content as any,
      errorMessage,
      sentAt: status === "SENT" ? new Date() : undefined,
    },
  });

  // 5. Log usage
  if (status === "SENT") {
    await prisma.usageLog.create({
      data: {
        customerId: ctx.customerId,
        messageId: message.id,
        type: type.toUpperCase(),
        cost: 0.005,
      },
    });
    await prisma.customer.update({
      where: { id: ctx.customerId },
      data: { messagesUsed: { increment: 1 } },
    });
  }

  return NextResponse.json(
    {
      messageId: message.id,
      metaMessageId,
      status,
      ...(errorMessage && { error: errorMessage }),
    },
    { status: status === "SENT" ? 200 : 422 }
  );
}
