import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const apiCtx = await validateApiKey(request);
  if (!apiCtx) return unauthorizedResponse();

  const { id } = await ctx.params;

  const message = await prisma.message.findFirst({
    where: { id, customerId: apiCtx.customerId },
  });

  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: message.id,
    metaMessageId: message.metaMessageId,
    direction: message.direction,
    type: message.type,
    status: message.status,
    to: message.toPhone,
    content: message.content,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    failedAt: message.failedAt,
    errorMessage: message.errorMessage,
  });
}
