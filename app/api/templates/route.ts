import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateTemplateSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_]+$/, { message: "Name must be lowercase with underscores only" }),
  language: z.string().default("en_US"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).default("MARKETING"),
  headerText: z.string().optional().nullable(),
  bodyText: z.string().min(1),
  footerText: z.string().optional().nullable(),
  buttons: z.array(z.unknown()).optional(),
  variables: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const templates = await prisma.messageTemplate.findMany({
    where: {
      customerId: session.customerId,
      ...(status && { status: status as "APPROVED" }),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(templates);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const template = await prisma.messageTemplate.create({
    data: {
      customerId: session.customerId,
      ...parsed.data,
      buttons: (parsed.data.buttons ?? []) as any,
      variables: (parsed.data.variables ?? []) as any,
      status: "PENDING",
    },
  });

  return NextResponse.json(template, { status: 201 });
}
