import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptToken } from "@/lib/whatsapp/client";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.whatsAppAccount.findUnique({
    where: { customerId: session.customerId },
    select: {
      phoneNumber: true,
      phoneNumberId: true,
      wabaId: true,
      displayName: true,
      status: true,
      webhookVerified: true,
      // Never return encryptedToken!
    },
  });

  return NextResponse.json(account);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { phoneNumber, phoneNumberId, wabaId, accessToken, displayName } =
    body as {
      phoneNumber: string;
      phoneNumberId: string;
      wabaId: string;
      accessToken?: string;
      displayName?: string;
    };

  const encryptedToken = accessToken ? encryptToken(accessToken) : undefined;

  const account = await prisma.whatsAppAccount.upsert({
    where: { customerId: session.customerId },
    update: {
      phoneNumber,
      phoneNumberId,
      wabaId,
      displayName,
      ...(encryptedToken && { encryptedToken }),
      status: "CONNECTED",
    },
    create: {
      customerId: session.customerId,
      phoneNumber,
      phoneNumberId,
      wabaId,
      displayName,
      encryptedToken,
      status: "CONNECTED",
    },
    select: {
      phoneNumber: true,
      phoneNumberId: true,
      wabaId: true,
      displayName: true,
      status: true,
    },
  });

  return NextResponse.json(account);
}
