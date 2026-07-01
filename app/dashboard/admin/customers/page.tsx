import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminCustomersClient from "./AdminCustomersClient";

export const metadata = { title: "Customers — Admin — WhatsApp System" };

export default async function AdminCustomersPage() {
  await requireAdmin();

  const customers = await prisma.customer.findMany({
    include: {
      user: { select: { name: true, email: true } },
      plan: { select: { name: true, priceMonthly: true } },
      whatsAppAccount: { select: { phoneNumber: true, status: true } },
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: "asc" } });

  return <AdminCustomersClient customers={customers as any} plans={plans} />;
}
