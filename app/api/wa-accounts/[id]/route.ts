import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { disconnectEngineSession } from "@/lib/whatsapp/engine";

export async function DELETE(
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

    // 1. Terminate engine session
    if (account.engineSessionId) {
      try {
        await disconnectEngineSession(account.engineSessionId);
      } catch (e) {
        console.error("Engine disconnect failed:", e);
      }
    }

    // 2. Delete linked ApiKeys (will cascade delete, but let's do it cleanly)
    await prisma.apiKey.deleteMany({
      where: { whatsappAccountId: account.id },
    });

    // 3. Delete WhatsAppAccount
    await prisma.whatsAppAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
