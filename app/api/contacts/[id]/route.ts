import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, customerId: session.customerId },
    include: { contactTags: { include: { tag: true } } },
  });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json();
  const contact = await prisma.contact.findFirst({ where: { id, customerId: session.customerId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.contact.update({ where: { id }, data: body });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({ where: { id, customerId: session.customerId } });
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
