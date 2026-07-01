import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where: { customerId: ctx.customerId },
      include: { contactTags: { include: { tag: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contact.count({ where: { customerId: ctx.customerId } }),
  ]);

  return NextResponse.json({ contacts, total, page, limit });
}

export async function POST(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  const body = await request.json();
  const { name, phone, email } = body as { name: string; phone: string; email?: string };

  if (!name || !phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const contact = await prisma.contact.upsert({
    where: { customerId_phone: { customerId: ctx.customerId, phone } },
    update: { name, email },
    create: { customerId: ctx.customerId, name, phone, email },
  });

  return NextResponse.json(contact, { status: 201 });
}
