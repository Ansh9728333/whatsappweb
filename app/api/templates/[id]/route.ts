import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const template = await prisma.messageTemplate.findFirst({
    where: { id, customerId: session.customerId },
  });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const template = await prisma.messageTemplate.findFirst({ where: { id, customerId: session.customerId } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.messageTemplate.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
