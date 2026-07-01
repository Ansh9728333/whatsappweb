import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { rows } = body as { rows: { name: string; phone: string; email?: string }[] };

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No contacts provided" }, { status: 400 });
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.phone || !row.name) { skipped++; continue; }
    try {
      await prisma.contact.upsert({
        where: { customerId_phone: { customerId: session.customerId, phone: row.phone.replace(/\D/g, "") } },
        update: { name: row.name, email: row.email },
        create: {
          customerId: session.customerId,
          name: row.name,
          phone: row.phone.replace(/\D/g, ""),
          email: row.email,
        },
      });
      created++;
    } catch {
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped });
}
