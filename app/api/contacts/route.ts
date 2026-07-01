import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateContactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  email: z.string().email().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  customAttributes: z.record(z.string(), z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  const where: Record<string, unknown> = {
    customerId: session.customerId,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    }),
    ...(tag && {
      contactTags: { some: { tag: { name: tag } } },
    }),
  };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { contactTags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contact.count({ where }),
  ]);

  return NextResponse.json({ contacts, total, page, limit });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, phone, email, notes, tags, customAttributes } = parsed.data;

  const existing = await prisma.contact.findUnique({
    where: { customerId_phone: { customerId: session.customerId, phone } },
  });
  if (existing) {
    return NextResponse.json({ error: "A contact with this phone number already exists." }, { status: 409 });
  }

  const contact = await prisma.contact.create({
    data: {
      customerId: session.customerId,
      name,
      phone,
      email,
      notes,
      customAttributes: (customAttributes ?? {}) as any,
      ...(tags && tags.length > 0 && {
        contactTags: {
          create: tags.map((tagId) => ({ tagId })),
        },
      }),
    },
    include: { contactTags: { include: { tag: true } } },
  });

  return NextResponse.json(contact, { status: 201 });
}
