import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ContactsClient from "./ContactsClient";

export const metadata = { title: "Contacts — Whatsify" };

export default async function ContactsPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const [contacts, tags] = await Promise.all([
    prisma.contact.findMany({
      where: { customerId: session.customerId },
      include: { contactTags: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.tag.findMany({
      where: { customerId: session.customerId },
      orderBy: { name: "asc" },
    }),
  ]);

  return <ContactsClient initialContacts={contacts as any} tags={tags} />;
}
