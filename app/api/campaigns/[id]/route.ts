import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, customerId: session.customerId },
    include: {
      senders: true,
      files: true,
      recipients: {
        orderBy: { createdAt: "asc" },
      },
      logs: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, customerId: session.customerId },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  // Only DRAFT campaigns can be deleted
  if (campaign.status !== "DRAFT") {
    return NextResponse.json({ error: "Only Draft campaigns can be deleted." }, { status: 400 });
  }

  await prisma.campaign.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
