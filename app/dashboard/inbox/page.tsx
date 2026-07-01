import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InboxClient from "./InboxClient";

export const metadata = { title: "Inbox — WhatsApp System" };

export default async function InboxPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const conversations = await prisma.conversation.findMany({
    where: { customerId: session.customerId },
    include: {
      contact: { select: { name: true, phone: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, direction: true, createdAt: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
  });

  return <InboxClient conversations={conversations as any} />;
}
