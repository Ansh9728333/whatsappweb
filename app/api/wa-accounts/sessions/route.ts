import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEngineSessionStatus } from "@/lib/whatsapp/engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Fetch the customer's WhatsApp account
    const account = await prisma.whatsAppAccount.findUnique({
      where: { customerId: session.customerId },
    });

    if (!account) {
      return NextResponse.json([]);
    }

    // 2. Fetch all sessions under this account
    const dbSessions = await prisma.whatsAppSession.findMany({
      where: { whatsappAccountId: account.id },
      orderBy: { createdAt: "desc" },
    });

    // 3. For each session, determine the live status and phone number
    const result = await Promise.all(
      dbSessions.map(async (s) => {
        let liveStatus = "disconnected";
        let phoneNumber = s.phoneNumber;

        try {
          const statusRes = await getEngineSessionStatus(s.sessionId);
          liveStatus = statusRes.status;
          if (statusRes.phoneNumber) {
            phoneNumber = statusRes.phoneNumber;
          }
        } catch (e) {}

        // Fallback: if phoneNumber is still not set, try parsing from creds data
        if (!phoneNumber && s.data) {
          try {
            const parsed = JSON.parse(s.data);
            if (parsed.me && parsed.me.id) {
              phoneNumber = parsed.me.id.split(":")[0].split("@")[0];
            }
          } catch (e) {}
        }

        return {
          id: s.id,
          sessionId: s.sessionId,
          phoneNumber: phoneNumber || "Unknown Number",
          status: liveStatus === "connected" ? "connected" : "disconnected",
        };
      })
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("Failed to fetch customer sessions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
