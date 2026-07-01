import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await request.json();
  const { status, planId } = body as { status?: string; planId?: string };
  const updated = await prisma.customer.update({
    where: { id },
    data: {
      ...(status && { status: status as "ACTIVE" | "SUSPENDED" | "PENDING" }),
      ...(planId && { planId }),
    },
    include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
  });
  return NextResponse.json(updated);
}
