import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, customerId: session.customerId },
    include: {
      template: { select: { name: true, language: true } },
      recipients: { orderBy: { createdAt: "asc" }, take: 100 },
      _count: { select: { recipients: true } },
    },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const campaign = await prisma.campaign.findFirst({ where: { id, customerId: session.customerId } });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();
  const updated = await prisma.campaign.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}
