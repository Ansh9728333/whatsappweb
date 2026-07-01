export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEngineSessionStatus } from "@/lib/whatsapp/engine";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const account = await prisma.whatsAppAccount.findFirst({
      where: { id: accountId, customerId: session.customerId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.engineSessionId) {
      return NextResponse.json({ status: "disconnected" });
    }

    // Call Engine status
    const result = await getEngineSessionStatus(account.engineSessionId);
    let statusResponse = {
      status: result.status,
      qrCode: result.qrCode ?? null,
      phoneNumber: result.phoneNumber,
      apiKey: null as string | null,
      apiSecret: null as string | null,
    };

    if (result.status === "connected" && result.phoneNumber) {
      const phoneNumber = result.phoneNumber;
      
      // If it was not already CONNECTED, update state and generate keys
      if (account.status !== "CONNECTED") {
        let rawApiKey = "";
        let rawApiSecret = "";
        let apiKeyHash = account.apiKeyHash;
        let apiKeyPreview = account.apiKeyPreview;
        let apiSecretHash = account.apiSecretHash;
        let apiSecretPreview = account.apiSecretPreview;

        // If keys don't exist, generate them
        if (!apiKeyHash) {
          rawApiKey = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
          apiKeyHash = crypto.createHash("sha256").update(rawApiKey).digest("hex");
          apiKeyPreview = `${rawApiKey.substring(0, 12)}...${rawApiKey.substring(rawApiKey.length - 4)}`;

          rawApiSecret = `wf_sec_${crypto.randomBytes(32).toString("hex")}`;
          apiSecretHash = crypto.createHash("sha256").update(rawApiSecret).digest("hex");
          apiSecretPreview = `${rawApiSecret.substring(0, 12)}...${rawApiSecret.substring(rawApiSecret.length - 4)}`;
        }

        await prisma.whatsAppAccount.update({
          where: { id: account.id },
          data: {
            status: "CONNECTED",
            phoneNumber,
            displayName: account.displayName || `WhatsApp Account ${phoneNumber}`,
            lastConnectedAt: new Date(),
            apiKeyHash,
            apiKeyPreview,
            apiSecretHash,
            apiSecretPreview,
          },
        });

        // Also update or create an API Key record in the ApiKey table for compatibility
        if (rawApiKey) {
          await prisma.apiKey.create({
            data: {
              customerId: session.customerId,
              userId: session.userId,
              whatsappAccountId: account.id,
              name: `Key for ${phoneNumber}`,
              keyHash: apiKeyHash!,
              keyPreview: apiKeyPreview!,
              secretHash: apiSecretHash!,
              secretPreview: apiSecretPreview!,
              isActive: true,
            },
          });

          // Store raw keys in the response to show ONCE in the frontend modal
          statusResponse.apiKey = rawApiKey;
          statusResponse.apiSecret = rawApiSecret;
        }
      }
    } else if (result.status === "expired" || result.status === "disconnected") {
      if (account.status === "CONNECTED") {
        await prisma.whatsAppAccount.update({
          where: { id: account.id },
          data: {
            status: "DISCONNECTED",
            lastDisconnectedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json(statusResponse);
  } catch (err: any) {
    console.error("Link status error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
