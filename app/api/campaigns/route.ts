import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { enqueueCampaign } from "@/lib/queue/campaignQueue";

export const dynamic = "force-dynamic";

const CreateCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  senders: z.array(
    z.object({
      sessionId: z.string(),
      phoneNumber: z.string(),
    })
  ).min(1),
  sendingMethod: z.enum(["ROUND_ROBIN", "PRIMARY_FIRST"]).default("ROUND_ROBIN"),
  messageType: z.enum(["TEXT", "IMAGE", "DOCUMENT", "VIDEO"]).default("TEXT"),
  messageBody: z.string().min(1),
  mediaUrl: z.string().optional().nullable(),
  minDelay: z.number().min(3).default(5),
  maxDelay: z.number().default(10),
  sleepEnabled: z.boolean().default(false),
  messagesBeforeSleep: z.number().default(50),
  sleepDurationMinutes: z.number().default(10),
  shortenUrls: z.boolean().default(false),
  scheduleType: z.enum(["NOW", "LATER"]).default("NOW"),
  scheduledAt: z.string().optional().nullable(),
  timezone: z.string().default("Asia/Kolkata"),
  retryEnabled: z.boolean().default(false),
  maxRetries: z.number().default(2),
  file: z.object({
    originalFileName: z.string(),
    fileUrl: z.string().optional().nullable(),
    totalRows: z.number(),
    validRows: z.number(),
    invalidRows: z.number(),
    duplicateRows: z.number(),
    columnMapping: z.record(z.string(), z.any()),
  }).optional().nullable(),
  recipients: z.array(
    z.object({
      name: z.string().optional().nullable(),
      phoneNumber: z.string(),
      normalizedPhone: z.string(),
      customData: z.record(z.string(), z.any()).optional().nullable(),
    })
  ).min(1),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.customerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await prisma.campaign.findMany({
    where: { customerId: session.customerId },
    include: {
      senders: true,
      files: true,
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

  const data = parsed.data;

  // 1. Plan and Limit Validation on Backend
  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: { plan: true },
  });

  if (!customer) {
    return NextResponse.json({ error: "Customer record not found" }, { status: 404 });
  }

  const plan = customer.plan;
  const messageLimit = plan?.messageLimit ?? 1000;
  const contactLimit = plan?.contactLimit ?? 500;
  const sessionLimit = 5; // Default safety session limit

  // Validate monthly message limit
  const activeAndSentCampaignsRecipients = await prisma.campaignRecipient.count({
    where: {
      campaign: { customerId: session.customerId },
      status: { in: ["SENT", "DELIVERED", "READ", "PENDING"] },
    },
  });

  if (customer.messagesUsed + data.recipients.length > messageLimit) {
    return NextResponse.json(
      { error: `Limit Exceeded: This campaign has ${data.recipients.length} recipients, which exceeds your remaining monthly message limit of ${messageLimit - customer.messagesUsed} messages.` },
      { status: 402 }
    );
  }

  // Validate recipients limit per campaign
  if (data.recipients.length > contactLimit) {
    return NextResponse.json(
      { error: `Limit Exceeded: Your plan allows a maximum of ${contactLimit} recipients per campaign.` },
      { status: 402 }
    );
  }

  // Validate connected sessions count
  const activeSessionsCount = await prisma.whatsAppSession.count({
    where: { whatsappAccount: { customerId: session.customerId }, status: "ACTIVE" },
  });

  if (data.senders.length > activeSessionsCount) {
    return NextResponse.json(
      { error: "Validation Error: You selected more senders than you have active connected sessions." },
      { status: 400 }
    );
  }

  const customerId = session.customerId as string;

  // 2. Database Transaction to create Campaign, Senders, File, and Recipients
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create campaign
      const campaign = await tx.campaign.create({
        data: {
          customerId,
          name: data.name,
          messageType: data.messageType,
          messageBody: data.messageBody,
          mediaUrl: data.mediaUrl,
          status: data.scheduleType === "LATER" ? "SCHEDULED" : "QUEUED",
          minDelay: data.minDelay,
          maxDelay: data.maxDelay,
          sleepEnabled: data.sleepEnabled,
          messagesBeforeSleep: data.messagesBeforeSleep,
          sleepDurationMinutes: data.sleepDurationMinutes,
          shortenUrls: data.shortenUrls,
          scheduleType: data.scheduleType,
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          timezone: data.timezone,
          retryEnabled: data.retryEnabled,
          maxRetries: data.maxRetries,
          totalRecipients: data.recipients.length,
          validRecipients: data.recipients.length,
        },
      });

      // Create campaign senders
      await Promise.all(
        data.senders.map((sender, idx) =>
          tx.campaignSender.create({
            data: {
              campaignId: campaign.id,
              sessionId: sender.sessionId,
              phoneNumber: sender.phoneNumber,
              senderOrder: idx + 1,
            },
          })
        )
      );

      // Create campaign file record if present
      if (data.file) {
        await tx.campaignFile.create({
          data: {
            campaignId: campaign.id,
            originalFileName: data.file.originalFileName,
            fileUrl: data.file.fileUrl,
            totalRows: data.file.totalRows,
            validRows: data.file.validRows,
            invalidRows: data.file.invalidRows,
            duplicateRows: data.file.duplicateRows,
            columnMapping: data.file.columnMapping,
          },
        });
      }

      // Create recipients
      await Promise.all(
        data.recipients.map((rec) =>
          tx.campaignRecipient.create({
            data: {
              campaignId: campaign.id,
              name: rec.name || "Recipient",
              phoneNumber: rec.phoneNumber,
              normalizedPhone: rec.normalizedPhone,
              customData: (rec.customData ?? {}) as any,
              status: "PENDING",
            },
          })
        )
      );

      return campaign;
    });

    // 3. Enqueue campaign if scheduled for immediately (Send Now)
    if (result.status === "QUEUED") {
      const fullCampaign = await prisma.campaign.findUnique({
        where: { id: result.id },
        include: {
          recipients: true,
          senders: true,
        },
      });

      if (fullCampaign) {
        // Trigger queue enqueuing
        await enqueueCampaign({
          id: fullCampaign.id,
          customerId: fullCampaign.customerId,
          recipients: fullCampaign.recipients.map((r) => ({
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

        // Set startedAt timestamp
        await prisma.campaign.update({
          where: { id: result.id },
          data: { startedAt: new Date(), status: "RUNNING" },
        });
      }
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create campaign:", err);
    let errMsg = err.message || "An unknown error occurred";
    if (errMsg.includes("Connection is closed") || errMsg.includes("closed") || errMsg.includes("ECONNREFUSED")) {
      errMsg = "Redis is not running. Please start the Redis server (redis-server) locally or configure REDIS_URL in your .env file.";
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
