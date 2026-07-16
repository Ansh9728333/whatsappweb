import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headerSecret = request.headers.get("x-engine-secret");
  const engineSecret = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";
  if (headerSecret !== engineSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, data } = await request.json();
    if (!sessionId || !data) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find the account by engineSessionId
    const account = await prisma.whatsAppAccount.findFirst({
      where: { engineSessionId: sessionId }
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found for session" }, { status: 404 });
    }

    await prisma.whatsAppSession.upsert({
      where: { sessionId },
      update: { data, status: "ACTIVE" },
      create: {
        whatsappAccountId: account.id,
        sessionId,
        data,
        status: "ACTIVE"
      }
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to save session credentials:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const headerSecret = request.headers.get("x-engine-secret");
  const engineSecret = process.env.WHATSAPP_ENGINE_SECRET || "super-engine-secret";
  if (headerSecret !== engineSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");

  // 1. Load single session if sessionId is provided
  if (sessionId) {
    try {
      const session = await prisma.whatsAppSession.findUnique({
        where: { sessionId }
      });

      if (!session) {
        return NextResponse.json({ data: null });
      }

      return NextResponse.json({ data: session.data });
    } catch (err: any) {
      console.error("Failed to load session credentials:", err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // 2. Otherwise list all active sessions
  try {
    const sessions = await prisma.whatsAppSession.findMany({
      where: { status: "ACTIVE" },
      select: { sessionId: true }
    });
    return NextResponse.json({ sessions: sessions.map(s => s.sessionId) });
  } catch (err: any) {
    console.error("Failed to list active sessions:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
