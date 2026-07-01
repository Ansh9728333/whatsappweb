import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings — WhatsApp System" };

export default async function SettingsPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: { plan: true },
  });

  return (
    <SettingsClient
      user={user!}
      customer={customer as any}
    />
  );
}
