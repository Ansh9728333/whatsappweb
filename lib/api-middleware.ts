import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

export interface ApiAuthContext {
  customerId: string;
  phoneNumberId: string;
  wabaId: string;
  planLimit: number;
  messagesUsed: number;
}

/**
 * Validate Bearer API key and return customer context.
 * Returns null if invalid/unauthorized.
 */
export async function validateApiKey(
  request: NextRequest
): Promise<ApiAuthContext | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7);
  if (!rawKey) return null;

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      customer: {
        include: {
          plan: true,
          whatsAppAccount: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.isActive) return null;
  if (!apiKey.customer || apiKey.customer.status !== "ACTIVE") return null;
  if (!apiKey.customer.whatsAppAccount || apiKey.customer.whatsAppAccount.status !== "CONNECTED") return null;

  // Update last used
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    customerId: apiKey.customerId,
    phoneNumberId: apiKey.customer.whatsAppAccount.phoneNumberId,
    wabaId: apiKey.customer.whatsAppAccount.wabaId,
    planLimit: apiKey.customer.plan?.messageLimit ?? 1000,
    messagesUsed: apiKey.customer.messagesUsed,
  };
}

/**
 * Check if customer is within their plan limit.
 */
export function isWithinLimit(ctx: ApiAuthContext): boolean {
  return ctx.messagesUsed < ctx.planLimit;
}

/**
 * Standard unauthorized response for API.
 */
export function unauthorizedResponse(message = "Invalid or missing API key") {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    { status: 401 }
  );
}

export function limitExceededResponse() {
  return NextResponse.json(
    { error: "Monthly message limit exceeded. Please upgrade your plan.", code: "LIMIT_EXCEEDED" },
    { status: 429 }
  );
}
