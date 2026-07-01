import "dotenv/config";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seed...");

  // ── Plans ──────────────────────────────────────────────────────────────────
  const starterPlan = await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      description: "Perfect for small businesses just getting started",
      priceMonthly: 29,
      messageLimit: 1000,
      contactLimit: 500,
      features: [
        "1,000 messages/month",
        "500 contacts",
        "3 message templates",
        "Basic analytics",
        "Email support",
      ],
    },
  });

  const growthPlan = await prisma.plan.upsert({
    where: { name: "Growth" },
    update: {},
    create: {
      name: "Growth",
      description: "For growing teams with higher volume needs",
      priceMonthly: 79,
      messageLimit: 10000,
      contactLimit: 5000,
      features: [
        "10,000 messages/month",
        "5,000 contacts",
        "Unlimited templates",
        "Campaign automation",
        "Priority support",
        "API access",
        "Webhook support",
      ],
    },
  });

  await prisma.plan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      description: "Unlimited scale for enterprise teams",
      priceMonthly: 199,
      messageLimit: 100000,
      contactLimit: 50000,
      features: [
        "100,000 messages/month",
        "50,000 contacts",
        "Unlimited everything",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantee",
        "White-label option",
      ],
    },
  });

  console.log("✅ Plans created");

  // ── Admin User ─────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@1234", 12);
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@whatsify.local" },
    update: {},
    create: {
      email: "admin@whatsify.local",
      passwordHash: adminPassword,
      name: "Platform Admin",
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user created:", adminUser.email);

  // ── Demo Customer ──────────────────────────────────────────────────────────
  const customerPassword = await bcrypt.hash("Demo@1234", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@acme.com" },
    update: {},
    create: {
      email: "demo@acme.com",
      passwordHash: customerPassword,
      name: "Alex Johnson",
      role: "CUSTOMER",
    },
  });

  const demoCustomer = await prisma.customer.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      businessName: "Acme Corp",
      status: "ACTIVE",
      planId: growthPlan.id,
      messagesUsed: 342,
    },
  });
  console.log("✅ Demo customer created:", demoUser.email);

  // ── Demo WhatsApp Account ──────────────────────────────────────────────────
  await prisma.whatsAppAccount.upsert({
    where: { customerId: demoCustomer.id },
    update: {},
    create: {
      customerId: demoCustomer.id,
      phoneNumber: "+1 555-0100",
      phoneNumberId: "demo_phone_number_id_123",
      wabaId: "demo_waba_id_456",
      businessId: "demo_business_id_789",
      displayName: "Acme Corp Support",
      status: "CONNECTED",
      webhookVerified: true,
    },
  });
  console.log("✅ WhatsApp account created");

  // ── Demo API Key ───────────────────────────────────────────────────────────
  const crypto = await import("crypto");
  const rawKey = `wf_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 12);

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      customerId: demoCustomer.id,
      name: "Production Key",
      keyHash,
      keyPrefix,
      isActive: true,
    },
  });
  console.log("✅ API key created (prefix:", keyPrefix + "...)");

  // ── Tags ───────────────────────────────────────────────────────────────────
  const tagNames = [
    { name: "VIP", color: "#f59e0b" },
    { name: "Lead", color: "#3b82f6" },
    { name: "Customer", color: "#10b981" },
    { name: "Prospect", color: "#8b5cf6" },
    { name: "Newsletter", color: "#ec4899" },
  ];

  const tags: Record<string, { id: string }> = {};
  for (const t of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { customerId_name: { customerId: demoCustomer.id, name: t.name } },
      update: {},
      create: { customerId: demoCustomer.id, ...t },
    });
    tags[t.name] = tag;
  }
  console.log("✅ Tags created");

  // ── Demo Contacts ──────────────────────────────────────────────────────────
  const contactData = [
    { name: "Sarah Chen", phone: "919876543210", email: "sarah@example.com", tagNames: ["VIP", "Customer"] },
    { name: "Michael Torres", phone: "919876543211", email: "michael@example.com", tagNames: ["Lead"] },
    { name: "Priya Sharma", phone: "919876543212", email: "priya@example.com", tagNames: ["Customer", "Newsletter"] },
    { name: "James Wilson", phone: "919876543213", email: "james@example.com", tagNames: ["Prospect"] },
    { name: "Aisha Patel", phone: "919876543214", email: "aisha@example.com", tagNames: ["VIP", "Newsletter"] },
    { name: "Carlos Rodriguez", phone: "919876543215", email: "carlos@example.com", tagNames: ["Customer"] },
    { name: "Emma Thompson", phone: "919876543216", email: "emma@example.com", tagNames: ["Lead", "Prospect"] },
    { name: "Ravi Kumar", phone: "919876543217", email: "ravi@example.com", tagNames: ["VIP"] },
    { name: "Sofia Martinez", phone: "919876543218", email: "sofia@example.com", tagNames: ["Newsletter"] },
    { name: "David Kim", phone: "919876543219", email: "david@example.com", tagNames: ["Customer", "VIP"] },
    { name: "Fatima Al-Rashid", phone: "919876543220", email: "fatima@example.com", tagNames: ["Lead"] },
    { name: "Lucas Oliveira", phone: "919876543221", email: "lucas@example.com", tagNames: ["Prospect"] },
    { name: "Ananya Singh", phone: "919876543222", email: "ananya@example.com", tagNames: ["Customer"] },
    { name: "Noah Williams", phone: "919876543223", email: "noah@example.com", tagNames: ["Newsletter"] },
    { name: "Yuki Tanaka", phone: "919876543224", email: "yuki@example.com", tagNames: ["VIP", "Customer"] },
    { name: "Amara Okafor", phone: "919876543225", email: "amara@example.com", tagNames: ["Lead"] },
    { name: "Daniel Brown", phone: "919876543226", email: "daniel@example.com", tagNames: ["Customer"] },
    { name: "Mei Lin", phone: "919876543227", email: "mei@example.com", tagNames: ["Prospect", "Newsletter"] },
    { name: "Hassan Ali", phone: "919876543228", email: "hassan@example.com", tagNames: ["VIP"] },
    { name: "Isabella Costa", phone: "919876543229", email: "isabella@example.com", tagNames: ["Customer"] },
  ];

  const createdContacts: { id: string }[] = [];
  for (const c of contactData) {
    const contact = await prisma.contact.upsert({
      where: { customerId_phone: { customerId: demoCustomer.id, phone: c.phone } },
      update: {},
      create: {
        customerId: demoCustomer.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        customAttributes: { source: "demo_seed" },
        contactTags: {
          create: c.tagNames.map((tagName) => ({
            tagId: tags[tagName].id,
          })),
        },
      },
    });
    createdContacts.push(contact);
  }
  console.log(`✅ ${contactData.length} demo contacts created`);

  // ── Demo Templates ─────────────────────────────────────────────────────────
  const welcomeTemplate = await prisma.messageTemplate.upsert({
    where: { customerId_name: { customerId: demoCustomer.id, name: "welcome_message" } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      name: "welcome_message",
      language: "en_US",
      category: "MARKETING",
      headerText: "Welcome to {{1}}! 🎉",
      bodyText:
        "Hi {{2}}, thank you for joining us! We're excited to have you on board. Your account is now active and ready to use.\n\nNeed help? Reply to this message anytime.",
      footerText: "Acme Corp — Your trusted partner",
      variables: ["{{1}}", "{{2}}"],
      status: "APPROVED",
    },
  });

  const orderTemplate = await prisma.messageTemplate.upsert({
    where: { customerId_name: { customerId: demoCustomer.id, name: "order_confirmed" } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      name: "order_confirmed",
      language: "en_US",
      category: "UTILITY",
      bodyText:
        "Hi {{1}}, your order #{{2}} has been confirmed! 🛍️\n\nEstimated delivery: {{3}}\n\nTrack your order at: acme.com/track",
      variables: ["{{1}}", "{{2}}", "{{3}}"],
      status: "APPROVED",
    },
  });

  await prisma.messageTemplate.upsert({
    where: { customerId_name: { customerId: demoCustomer.id, name: "flash_sale" } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      name: "flash_sale",
      language: "en_US",
      category: "MARKETING",
      headerText: "⚡ Flash Sale — {{1}} OFF!",
      bodyText:
        "Don't miss out, {{2}}! Our biggest sale of the year is happening NOW.\n\n🔥 Use code: {{3}}\n⏰ Ends in 24 hours\n\nShop now: acme.com/sale",
      footerText: "Reply STOP to unsubscribe",
      variables: ["{{1}}", "{{2}}", "{{3}}"],
      status: "PENDING",
    },
  });
  console.log("✅ Demo templates created");

  // ── Demo Campaign ──────────────────────────────────────────────────────────
  const demoCampaign = await prisma.campaign.create({
    data: {
      customerId: demoCustomer.id,
      templateId: welcomeTemplate.id,
      name: "Welcome Campaign — Q1 2025",
      status: "COMPLETED",
      variableMapping: { "1": "Acme Corp", "2": "name" },
      startedAt: new Date("2025-01-15T10:00:00Z"),
      completedAt: new Date("2025-01-15T10:05:00Z"),
      totalRecipients: 10,
      sentCount: 9,
      deliveredCount: 8,
      readCount: 6,
      failedCount: 1,
    },
  });

  // Campaign recipients
  for (let i = 0; i < 10; i++) {
    const contact = createdContacts[i];
    const statuses = ["DELIVERED", "DELIVERED", "READ", "READ", "READ", "SENT", "DELIVERED", "READ", "FAILED", "READ"];
    await prisma.campaignRecipient.create({
      data: {
        campaignId: demoCampaign.id,
        contactId: contact.id,
        phone: contactData[i].phone,
        variables: { "1": "Acme Corp", "2": contactData[i].name },
        status: statuses[i] as "DELIVERED" | "READ" | "SENT" | "FAILED",
        processedAt: new Date("2025-01-15T10:00:00Z"),
      },
    });
  }
  console.log("✅ Demo campaign created with recipients");

  // ── Demo Conversations & Messages ─────────────────────────────────────────
  const [firstContact, secondContact, thirdContact] = createdContacts;

  const conv1 = await prisma.conversation.upsert({
    where: { customerId_contactId: { customerId: demoCustomer.id, contactId: firstContact.id } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      contactId: firstContact.id,
      lastMessageAt: new Date(),
      unreadCount: 2,
      isOpen: true,
    },
  });

  const conv2 = await prisma.conversation.upsert({
    where: { customerId_contactId: { customerId: demoCustomer.id, contactId: secondContact.id } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      contactId: secondContact.id,
      lastMessageAt: new Date(Date.now() - 3600000),
      unreadCount: 0,
      isOpen: true,
    },
  });

  await prisma.conversation.upsert({
    where: { customerId_contactId: { customerId: demoCustomer.id, contactId: thirdContact.id } },
    update: {},
    create: {
      customerId: demoCustomer.id,
      contactId: thirdContact.id,
      lastMessageAt: new Date(Date.now() - 86400000),
      unreadCount: 1,
      isOpen: false,
    },
  });

  // Messages for conv1
  const msgData = [
    { dir: "INBOUND", content: "Hi, I have a question about my order", minsAgo: 30 },
    { dir: "OUTBOUND", content: "Hello Sarah! Happy to help. What's your order number?", minsAgo: 28 },
    { dir: "INBOUND", content: "It's ORDER-12345. I haven't received it yet.", minsAgo: 25 },
    { dir: "OUTBOUND", content: "Let me check that for you right away!", minsAgo: 24 },
    { dir: "INBOUND", content: "Thank you!", minsAgo: 5 },
    { dir: "INBOUND", content: "Any update?", minsAgo: 2 },
  ];

  for (const m of msgData) {
    await prisma.message.create({
      data: {
        customerId: demoCustomer.id,
        conversationId: conv1.id,
        direction: m.dir as "INBOUND" | "OUTBOUND",
        type: "TEXT",
        status: m.dir === "OUTBOUND" ? "READ" : "DELIVERED",
        toPhone: m.dir === "OUTBOUND" ? contactData[0].phone : "+15550100",
        fromPhone: m.dir === "INBOUND" ? contactData[0].phone : "+15550100",
        content: { text: m.content },
        sentAt: new Date(Date.now() - m.minsAgo * 60000),
      },
    });
  }

  // Messages for conv2
  await prisma.message.create({
    data: {
      customerId: demoCustomer.id,
      conversationId: conv2.id,
      direction: "OUTBOUND",
      type: "TEMPLATE",
      status: "READ",
      toPhone: contactData[1].phone,
      content: { text: "Welcome to Acme Corp, Michael! We're excited to have you." },
      sentAt: new Date(Date.now() - 3660000),
    },
  });

  await prisma.message.create({
    data: {
      customerId: demoCustomer.id,
      conversationId: conv2.id,
      direction: "INBOUND",
      type: "TEXT",
      status: "DELIVERED",
      toPhone: "+15550100",
      fromPhone: contactData[1].phone,
      content: { text: "Thanks! Excited to be here 😊" },
      sentAt: new Date(Date.now() - 3600000),
    },
  });

  console.log("✅ Demo conversations & messages created");

  // ── Usage Logs ─────────────────────────────────────────────────────────────
  for (let i = 0; i < 20; i++) {
    await prisma.usageLog.create({
      data: {
        customerId: demoCustomer.id,
        type: i % 3 === 0 ? "TEMPLATE" : "TEXT",
        cost: 0.005,
        createdAt: new Date(Date.now() - i * 3600000 * 12),
      },
    });
  }
  console.log("✅ Usage logs created");

  // ── Second customer ────────────────────────────────────────────────────────
  const customer2Password = await bcrypt.hash("Test@1234", 12);
  const user2 = await prisma.user.upsert({
    where: { email: "test@techstartup.io" },
    update: {},
    create: {
      email: "test@techstartup.io",
      passwordHash: customer2Password,
      name: "Raj Patel",
      role: "CUSTOMER",
    },
  });

  await prisma.customer.upsert({
    where: { userId: user2.id },
    update: {},
    create: {
      userId: user2.id,
      businessName: "TechStartup Inc",
      status: "PENDING",
      planId: starterPlan.id,
      messagesUsed: 0,
    },
  });
  console.log("✅ Second test customer created");

  console.log("\n🎉 Database seed complete!");
  console.log("\n📋 Demo Credentials:");
  console.log("   Admin:    admin@whatsify.local / Admin@1234");
  console.log("   Customer: demo@acme.com / Demo@1234");
  console.log("   Pending:  test@techstartup.io / Test@1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
