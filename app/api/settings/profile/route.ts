import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(_request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const customer = session.customerId
    ? await prisma.customer.findUnique({
        where: { id: session.customerId },
        include: { plan: { select: { name: true, messageLimit: true, priceMonthly: true } } },
      })
    : null;

  return NextResponse.json({ user, customer });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, businessName, currentPassword, newPassword } = body as {
    name?: string;
    businessName?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  if (newPassword) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const valid = await bcrypt.compare(currentPassword ?? "", user.passwordHash);
    if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: session.userId }, data: { passwordHash: hash } });
  }

  if (name) await prisma.user.update({ where: { id: session.userId }, data: { name } });
  if (businessName && session.customerId) {
    await prisma.customer.update({ where: { id: session.customerId }, data: { businessName } });
  }

  return NextResponse.json({ success: true });
}
