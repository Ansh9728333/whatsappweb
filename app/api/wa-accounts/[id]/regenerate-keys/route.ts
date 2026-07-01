import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.customerId || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id, customerId: session.customerId },
    });

    if (!account) {
      return NextResponse.json({ error: "WhatsApp Account not found" }, { status: 404 });
    }

    // Generate new keys
    const rawApiKey = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
    const apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
    const apiKeyPreview = `${rawApiKey.substring(0, 12)}...${rawApiKey.substring(rawApiKey.length - 4)}`;

    const rawApiSecret = `wf_sec_${crypto.randomBytes(32).toString("hex")}`;
    const apiSecretHash = crypto.createHash("sha256").update(rawApiSecret).digest("hex");
    const apiSecretPreview = `${rawApiSecret.substring(0, 12)}...${rawApiSecret.substring(rawApiSecret.length - 4)}`;

    // Update WhatsAppAccount
    await prisma.whatsAppAccount.update({
      where: { id },
      data: {
        apiKeyHash,
        apiKeyPreview,
        apiSecretHash,
        apiSecretPreview,
      },
    });

    // Replace the ApiKey in the ApiKey table
    await prisma.apiKey.deleteMany({
      where: { whatsappAccountId: id },
    });

    await prisma.apiKey.create({
      data: {
        customerId: session.customerId,
        userId: session.userId,
        whatsappAccountId: id,
        name: `Key for ${account.phoneNumber}`,
        keyHash: apiKeyHash,
        keyPreview: apiKeyPreview,
        secretHash: apiSecretHash,
        secretPreview: apiSecretPreview,
        isActive: true,
      },
    });

    return NextResponse.json({
      apiKey: rawApiKey,
      apiSecret: rawApiSecret,
    });
  } catch (err: any) {
    console.error("Regenerate keys error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
