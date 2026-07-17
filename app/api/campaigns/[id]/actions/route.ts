import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { enqueueCampaign } from "@/lib/queue/campaignQueue";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const campaign = await prisma.campaign.findFirst({
    where: { id, customerId: session.customerId },
    include: { senders: true },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const { action } = await request.json();

  try {
    if (action === "pause") {
      await prisma.campaign.update({
        where: { id },
        data: { status: "PAUSED" },
      });
      return NextResponse.json({ success: true, status: "PAUSED" });
    }

    if (action === "resume") {
      // Find all recipients that are still PENDING
      const pendingRecipients = await prisma.campaignRecipient.findMany({
        where: { campaignId: id, status: "PENDING" },
      });

      await prisma.campaign.update({
        where: { id },
        data: { status: "RUNNING" },
      });

      if (pendingRecipients.length > 0) {
        await enqueueCampaign({
          id,
          customerId: campaign.customerId,
          recipients: pendingRecipients.map((r) => ({
            id: r.id,
            phone: r.normalizedPhone || r.phoneNumber || "",
            variables: {
              name: r.name || "",
              phone: r.phoneNumber || "",
              ...(r.customData as Record<string, string>),
            },
          })),
          templateName: "custom_message",
          language: "en",
        });
      }

      return NextResponse.json({ success: true, status: "RUNNING" });
    }

    if (action === "cancel") {
      await prisma.campaign.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      // Mark all pending recipients as CANCELLED
      await prisma.campaignRecipient.updateMany({
        where: { campaignId: id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json({ success: true, status: "CANCELLED" });
    }

    if (action === "retry") {
      // Find all FAILED recipients
      const failedRecipients = await prisma.campaignRecipient.findMany({
        where: { campaignId: id, status: "FAILED" },
      });

      if (failedRecipients.length === 0) {
        return NextResponse.json({ error: "No failed recipients to retry." }, { status: 400 });
      }

      // Mark them back as PENDING
      await prisma.campaignRecipient.updateMany({
        where: { campaignId: id, status: "FAILED" },
        data: { status: "PENDING", retryCount: { increment: 1 }, errorCode: null, errorMessage: null },
      });

      // Update campaign status
      await prisma.campaign.update({
        where: { id },
        data: { status: "RUNNING" },
      });

      // Enqueue them
      await enqueueCampaign({
        id,
        customerId: campaign.customerId,
        recipients: failedRecipients.map((r) => ({
          id: r.id,
          phone: r.normalizedPhone || r.phoneNumber || "",
          variables: {
            name: r.name || "",
            phone: r.phoneNumber || "",
            ...(r.customData as Record<string, string>),
          },
        })),
        templateName: "custom_message",
        language: "en",
      });

      return NextResponse.json({ success: true, status: "RUNNING" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error(`Failed to execute campaign action ${action}:`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
