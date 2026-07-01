import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TemplatesClient from "./TemplatesClient";

export const metadata = { title: "Templates — WhatsApp System" };

export default async function TemplatesPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const templates = await prisma.messageTemplate.findMany({
    where: { customerId: session.customerId },
    orderBy: { createdAt: "desc" },
  });

  return <TemplatesClient initialTemplates={templates as any} />;
}
