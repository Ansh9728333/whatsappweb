import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "wf_live_";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { customerId: session.customerId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      isActive: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      // Never return keyHash
    },
  });

  return NextResponse.json(keys);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name } = body as { name: string };

  if (!name || name.trim().length < 1) {
    return NextResponse.json({ error: "Key name is required" }, { status: 400 });
  }

  // Check limit (max 5 keys)
  const count = await prisma.apiKey.count({ where: { customerId: session.customerId } });
  if (count >= 5) {
    return NextResponse.json({ error: "Maximum 5 API keys allowed. Revoke an existing key first." }, { status: 400 });
  }

  // Generate raw key
  const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: {
      customerId: session.customerId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      isActive: true,
    },
  });

  // Return the raw key ONCE — it cannot be retrieved again
  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    rawKey, // Only returned on creation!
    createdAt: apiKey.createdAt,
  }, { status: 201 });
}
