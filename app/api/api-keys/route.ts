import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const keys = await prisma.apiKey.findMany({
      where: { customerId: session.customerId },
      include: {
        whatsappAccount: {
          select: {
            phoneNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(keys);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, whatsappAccountId, ipWhitelist } = body as {
      name: string;
      whatsappAccountId: string;
      ipWhitelist?: string;
    };

    if (!name || name.trim().length < 1) {
      return NextResponse.json({ error: "Key name is required" }, { status: 400 });
    }

    if (!whatsappAccountId) {
      return NextResponse.json({ error: "WhatsApp Account selection is required" }, { status: 400 });
    }

    // Verify WhatsApp Account belongs to this customer
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: whatsappAccountId, customerId: session.customerId },
    });

    if (!account) {
      return NextResponse.json({ error: "Selected WhatsApp Account not found" }, { status: 404 });
    }

    // Generate keys
    const rawKey = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPreview = `${rawKey.substring(0, 12)}...${rawKey.substring(rawKey.length - 4)}`;

    const rawSecret = `wf_sec_${crypto.randomBytes(32).toString("hex")}`;
    const secretHash = crypto.createHash("sha256").update(rawSecret).digest("hex");
    const secretPreview = `${rawSecret.substring(0, 12)}...${rawSecret.substring(rawSecret.length - 4)}`;

    // Create the ApiKey
    const apiKey = await prisma.apiKey.create({
      data: {
        customerId: session.customerId,
        userId: session.userId,
        whatsappAccountId,
        name: name.trim(),
        keyHash,
        keyPreview,
        secretHash,
        secretPreview,
        ipWhitelist: ipWhitelist || null,
        isActive: true,
      },
    });

    // Also update WhatsAppAccount keys for backward compatibility
    await prisma.whatsAppAccount.update({
      where: { id: whatsappAccountId },
      data: {
        apiKeyHash: keyHash,
        apiKeyPreview: keyPreview,
        apiSecretHash: secretHash,
        apiSecretPreview: secretPreview,
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      name: apiKey.name,
      keyPreview: apiKey.keyPreview,
      secretPreview: apiKey.secretPreview,
      rawKey,     // Only returned on creation
      rawSecret,  // Only returned on creation
      createdAt: apiKey.createdAt,
    }, { status: 201 });
  } catch (err: any) {
    console.error("Create API Key error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
