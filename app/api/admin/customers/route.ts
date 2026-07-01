import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (session?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customers = await prisma.customer.findMany({
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true, priceMonthly: true } },
      whatsAppAccount: { select: { phoneNumber: true, status: true } },
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(customers);
}
