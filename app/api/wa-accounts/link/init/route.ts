import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { startEngineSession } from "@/lib/whatsapp/engine";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId || !session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get or create WhatsAppAccount for this customer
    let account = await prisma.whatsAppAccount.findUnique({
      where: { customerId: session.customerId },
    });

    const engineSessionId = account?.engineSessionId || `session_${uuidv4().substring(0, 18)}`;

    if (!account) {
      account = await prisma.whatsAppAccount.create({
        data: {
          customerId: session.customerId,
          userId: session.userId,
          phoneNumber: "Pending Link",
          status: "PENDING",
          engineSessionId,
        },
      });
    } else {
      account = await prisma.whatsAppAccount.update({
        where: { id: account.id },
        data: {
          engineSessionId,
          status: "PENDING",
        },
      });
    }

    // 2. Start the connection on the WhatsApp Web QR Engine
    const result = await startEngineSession(engineSessionId);

    // Update account with lastQrAt
    await prisma.whatsAppAccount.update({
      where: { id: account.id },
      data: {
        lastQrAt: new Date(),
      },
    });

    return NextResponse.json({
      accountId: account.id,
      qrCodeDataUrl: result.qrCode, // The QR string
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    console.error("Link init error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
