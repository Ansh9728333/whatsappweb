import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CampaignsClient from "./CampaignsClient";

export const metadata = { title: "Campaigns — Whatsify" };

export default async function CampaignsPage() {
  const session = await requireAuth();
  if (!session.customerId) return null;

  const campaigns = await prisma.campaign.findMany({
    where: { customerId: session.customerId },
    include: { template: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <CampaignsClient campaigns={campaigns as any} />;
}
