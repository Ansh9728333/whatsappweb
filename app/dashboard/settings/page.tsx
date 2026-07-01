import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings — Whatsify" };

export default async function SettingsPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const account = await prisma.whatsAppAccount.findUnique({
    where: { customerId: session.customerId },
    select: {
      phoneNumber: true,
      phoneNumberId: true,
      wabaId: true,
      displayName: true,
      status: true,
      webhookVerified: true,
    },
  });

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
      initialAccount={account as any}
      user={user!}
      customer={customer as any}
    />
  );
}
