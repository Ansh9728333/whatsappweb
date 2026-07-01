import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Deprecated endpoint. Use /api/wa-accounts instead." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Deprecated endpoint. Use /api/wa-accounts instead." }, { status: 410 });
}
