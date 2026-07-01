import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { disconnectEngineSession } from "@/lib/whatsapp/engine";

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.customerId) {
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

    if (account.engineSessionId) {
      try {
        await disconnectEngineSession(account.engineSessionId);
      } catch (e) {
        console.error("Engine disconnect failed:", e);
      }
    }

    const updated = await prisma.whatsAppAccount.update({
      where: { id },
      data: {
        status: "DISCONNECTED",
        lastDisconnectedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Disconnect error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
