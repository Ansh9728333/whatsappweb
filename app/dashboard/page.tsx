import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  MessageSquare,
  Users,
  Megaphone,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";

async function getStats(customerId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    totalContacts,
    totalCampaigns,
    messagesToday,
    deliveredToday,
    failedToday,
    readToday,
    recentMessages,
    recentCampaigns,
  ] = await Promise.all([
    prisma.contact.count({ where: { customerId } }),
    prisma.campaign.count({ where: { customerId } }),
    prisma.message.count({
      where: { customerId, direction: "OUTBOUND", createdAt: { gte: today } },
    }),
    prisma.message.count({
      where: { customerId, direction: "OUTBOUND", status: "DELIVERED", createdAt: { gte: today } },
    }),
    prisma.message.count({
      where: { customerId, direction: "OUTBOUND", status: "FAILED", createdAt: { gte: today } },
    }),
    prisma.message.count({
      where: { customerId, direction: "OUTBOUND", status: "READ", createdAt: { gte: today } },
    }),
    prisma.message.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.campaign.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { template: { select: { name: true } } },
    }),
  ]);

  const deliveryRate =
    messagesToday > 0
      ? Math.round(((deliveredToday + readToday) / messagesToday) * 100)
      : 0;

  return {
    totalContacts,
    totalCampaigns,
    messagesToday,
    deliveredToday,
    failedToday,
    readToday,
    deliveryRate,
    recentMessages,
    recentCampaigns,
  };
}

async function getAdminStats() {
  const [totalCustomers, totalMessages, activeCampaigns, totalRevenue] =
    await Promise.all([
      prisma.customer.count(),
      prisma.message.count({ where: { direction: "OUTBOUND" } }),
      prisma.campaign.count({ where: { status: "RUNNING" } }),
      prisma.billingLog.aggregate({
        where: { status: "PAID" },
        _sum: { amount: true },
      }),
    ]);
  return {
    totalCustomers,
    totalMessages,
    activeCampaigns,
    totalRevenue: totalRevenue._sum.amount ?? 0,
  };
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

const statusConfig: Record<
  string,
  { label: string; icon: React.ElementType; cls: string }
> = {
  SENT: { label: "Sent", icon: CheckCircle2, cls: "text-blue-500" },
  DELIVERED: { label: "Delivered", icon: CheckCircle2, cls: "text-emerald-500" },
  READ: { label: "Read", icon: Eye, cls: "text-purple-500" },
  FAILED: { label: "Failed", icon: XCircle, cls: "text-red-500" },
  QUEUED: { label: "Queued", icon: Clock, cls: "text-yellow-500" },
};

const campaignStatusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700",
  RUNNING: "bg-blue-100 text-blue-700",
  SCHEDULED: "bg-yellow-100 text-yellow-700",
  DRAFT: "bg-slate-100 text-slate-600",
  FAILED: "bg-red-100 text-red-700",
  PAUSED: "bg-orange-100 text-orange-700",
};

export default async function DashboardPage() {
  const session = await requireAuth();

  if (session.role === "ADMIN") {
    const stats = await getAdminStats();
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Platform Overview
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {session.name}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers}
            icon={Users}
            color="bg-gradient-to-br from-blue-500 to-indigo-600"
          />
          <StatCard
            label="Total Messages Sent"
            value={stats.totalMessages.toLocaleString()}
            icon={MessageSquare}
            color="bg-gradient-to-br from-emerald-500 to-teal-600"
          />
          <StatCard
            label="Active Campaigns"
            value={stats.activeCampaigns}
            icon={Megaphone}
            color="bg-gradient-to-br from-purple-500 to-pink-600"
          />
          <StatCard
            label="Total Revenue"
            value={`$${stats.totalRevenue.toFixed(0)}`}
            icon={TrendingUp}
            color="bg-gradient-to-br from-orange-500 to-amber-600"
          />
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <p className="text-slate-500 text-sm">
            Navigate to{" "}
            <span className="font-semibold text-slate-700">
              Admin &rarr; Customers
            </span>{" "}
            to manage customer accounts, or{" "}
            <span className="font-semibold text-slate-700">
              Admin &rarr; Plans
            </span>{" "}
            to manage pricing.
          </p>
        </div>
      </div>
    );
  }

  if (!session.customerId) {
    return (
      <div className="text-slate-500">
        Account setup incomplete. Please contact support.
      </div>
    );
  }

  const stats = await getStats(session.customerId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Welcome back, {session.name}
          </p>
        </div>
        <div className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Messages Today"
          value={stats.messagesToday}
          sub={`${stats.deliveredToday} delivered, ${stats.failedToday} failed`}
          icon={MessageSquare}
          color="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <StatCard
          label="Total Contacts"
          value={stats.totalContacts.toLocaleString()}
          icon={Users}
          color="bg-gradient-to-br from-blue-500 to-indigo-600"
        />
        <StatCard
          label="Total Campaigns"
          value={stats.totalCampaigns}
          icon={Megaphone}
          color="bg-gradient-to-br from-purple-500 to-pink-600"
        />
        <StatCard
          label="Delivery Rate"
          value={`${stats.deliveryRate}%`}
          sub="Today's rate"
          icon={TrendingUp}
          color="bg-gradient-to-br from-orange-500 to-amber-600"
        />
      </div>

      {/* Message status breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Sent", value: stats.messagesToday, color: "bg-blue-50 border-blue-100", textColor: "text-blue-600" },
          { label: "Delivered", value: stats.deliveredToday, color: "bg-emerald-50 border-emerald-100", textColor: "text-emerald-600" },
          { label: "Read", value: stats.readToday, color: "bg-purple-50 border-purple-100", textColor: "text-purple-600" },
          { label: "Failed", value: stats.failedToday, color: "bg-red-50 border-red-100", textColor: "text-red-600" },
        ].map((item: any) => (
          <div key={item.label} className={`rounded-xl border p-4 ${item.color}`}>
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className={`text-2xl font-bold mt-1 ${item.textColor}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Messages */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
            Recent Messages
          </h2>
          {stats.recentMessages.length === 0 ? (
            <p className="text-slate-400 text-sm">No messages yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentMessages.map((msg: any) => {
                const s = statusConfig[msg.status] ?? statusConfig.SENT;
                const StatusIcon = s.icon;
                const content = msg.content as { text?: string };
                return (
                  <div
                    key={msg.id}
                    className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {msg.direction === "OUTBOUND" ? "→ " : "← "}
                        {msg.toPhone}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {content.text?.slice(0, 60) ?? "Media message"}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${s.cls} ml-3`}>
                      <StatusIcon size={13} />
                      {s.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Campaigns */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">
            Recent Campaigns
          </h2>
          {stats.recentCampaigns.length === 0 ? (
            <p className="text-slate-400 text-sm">No campaigns yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentCampaigns.map((campaign: any) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                      {campaign.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {campaign.totalRecipients} recipients
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      campaignStatusColors[campaign.status] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
