import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WhatsAppClient from "./WhatsAppClient";

export const metadata = { title: "WhatsApp Accounts — WhatsApp System" };

export default async function WhatsAppAccountsPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const accounts = await prisma.whatsAppAccount.findMany({
    where: { customerId: session.customerId },
    orderBy: { createdAt: "desc" },
  });

  return <WhatsAppClient initialAccounts={accounts as any} />;
}
