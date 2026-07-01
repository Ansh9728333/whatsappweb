import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateCampaignSchema = z.object({
  name: z.string().min(1),
  templateId: z.string().min(1),
  variableMapping: z.record(z.string(), z.string()).optional(),
  scheduledAt: z.string().optional(),
  recipients: z.array(
    z.object({
      phone: z.string(),
      variables: z.record(z.string(), z.string()).optional(),
      contactId: z.string().optional(),
    })
  ),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { customerId: session.customerId },
    include: {
      template: { select: { name: true, language: true } },
      _count: { select: { recipients: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = CreateCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, templateId, variableMapping, scheduledAt, recipients } = parsed.data;

  const campaign = await prisma.campaign.create({
    data: {
      customerId: session.customerId,
      templateId,
      name,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      variableMapping: (variableMapping ?? {}) as any,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      totalRecipients: recipients.length,
      recipients: {
        create: recipients.map((r) => ({
          phone: r.phone,
          contactId: r.contactId,
          variables: (r.variables ?? {}) as any,
          status: "PENDING",
        })),
      },
    },
    include: { template: { select: { name: true } } },
  });

  return NextResponse.json(campaign, { status: 201 });
}
