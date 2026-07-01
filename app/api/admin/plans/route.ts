import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const plans = await prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const plan = await prisma.plan.create({ data: body });
  return NextResponse.json(plan, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const { id, ...data } = body as { id: string } & Record<string, unknown>;
  const plan = await prisma.plan.update({ where: { id }, data });
  return NextResponse.json(plan);
}
