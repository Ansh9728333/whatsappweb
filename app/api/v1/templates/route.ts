import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, unauthorizedResponse } from "@/lib/api-middleware";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const ctx = await validateApiKey(request);
  if (!ctx) return unauthorizedResponse();

  const templates = await prisma.messageTemplate.findMany({
    where: { customerId: ctx.customerId, status: "APPROVED" },
    select: { id: true, name: true, language: true, category: true, bodyText: true, variables: true, status: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(templates);
}
