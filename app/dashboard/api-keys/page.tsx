import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ApiKeysClient from "./ApiKeysClient";

export const metadata = { title: "API Keys — Whatsify" };

export default async function ApiKeysPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const keys = await prisma.apiKey.findMany({
    where: { customerId: session.customerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, isActive: true, lastUsedAt: true, createdAt: true },
  });

  return <ApiKeysClient initialKeys={keys as any} />;
}
