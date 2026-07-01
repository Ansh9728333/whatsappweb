import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse, isWithinLimit, limitExceededResponse } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  const campaigns = await prisma.campaign.findMany({
    where: { customerId: ctx.customerId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();
  if (!isWithinLimit(ctx)) return limitExceededResponse();

  const body = await request.json();
  const { name, templateId, recipients, variableMapping, scheduledAt } =
    body as {
      name: string;
      templateId: string;
      recipients: { phone: string; variables?: Record<string, string> }[];
      variableMapping?: Record<string, string>;
      scheduledAt?: string;
    };

  if (!name || !templateId || !recipients?.length) {
    return NextResponse.json({ error: "name, templateId, and recipients are required" }, { status: 400 });
  }

  const campaign = await prisma.campaign.create({
    data: {
      customerId: ctx.customerId,
      templateId,
      name,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      variableMapping: (variableMapping ?? {}) as any,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      totalRecipients: recipients.length,
      recipients: {
        create: recipients.map((r) => ({
          phone: r.phone,
          variables: (r.variables ?? {}) as any,
          status: "PENDING",
        })),
      },
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
