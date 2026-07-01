import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  
  try {
    const body = await request.json();
    const { name, ipWhitelist } = body as { name?: string; ipWhitelist?: string };

    const key = await prisma.apiKey.findFirst({
      where: { id, customerId: session.customerId },
    });

    if (!key) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : key.name,
        ipWhitelist: ipWhitelist !== undefined ? (ipWhitelist.trim() || null) : key.ipWhitelist,
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Update API Key error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const key = await prisma.apiKey.findFirst({
      where: { id, customerId: session.customerId },
    });

    if (!key) {
      return NextResponse.json({ error: "API Key not found" }, { status: 404 });
    }

    // Completely delete the key
    await prisma.apiKey.delete({
      where: { id },
    });

    // Also clear from WhatsAppAccount if it was the active key
    if (key.whatsappAccountId) {
      const waAccount = await prisma.whatsAppAccount.findFirst({
        where: { id: key.whatsappAccountId, apiKeyHash: key.keyHash },
      });
      if (waAccount) {
        await prisma.whatsAppAccount.update({
          where: { id: key.whatsappAccountId },
          data: {
            apiKeyHash: null,
            apiKeyPreview: null,
            apiSecretHash: null,
            apiSecretPreview: null,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete API Key error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
