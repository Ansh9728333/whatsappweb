import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ApiKeysClient from "./ApiKeysClient";

export const metadata = { title: "API Keys — WhatsApp System" };

export default async function ApiKeysPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const [keys, whatsappAccounts] = await Promise.all([
    prisma.apiKey.findMany({
      where: { customerId: session.customerId },
      include: {
        whatsappAccount: {
          select: {
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.whatsAppAccount.findMany({
      where: { customerId: session.customerId, status: "CONNECTED" },
      select: {
        id: true,
        phoneNumber: true,
      },
    }),
  ]);

  return (
    <ApiKeysClient
      initialKeys={keys as any}
      whatsappAccounts={whatsappAccounts}
    />
  );
}
