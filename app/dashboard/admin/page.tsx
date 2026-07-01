import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Users, MessageSquare, Megaphone, TrendingUp } from "lucide-react";

export const metadata = { title: "Admin Overview — Whatsify" };

export default async function AdminPage() {
  await requireAdmin();

  const [totalCustomers, activeCustomers, pendingCustomers, totalMessages, activeCampaigns, plans] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { status: "ACTIVE" } }),
    prisma.customer.count({ where: { status: "PENDING" } }),
    prisma.message.count({ where: { direction: "OUTBOUND" } }),
    prisma.campaign.count({ where: { status: "RUNNING" } }),
    prisma.plan.findMany({ orderBy: { priceMonthly: "asc" } }),
  ]);

  const recentCustomers = await prisma.customer.findMany({
    include: { user: { select: { name: true, email: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    SUSPENDED: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Platform Overview</h1>
        <p className="text-slate-500 mt-1">Admin control panel</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Customers", value: totalCustomers, sub: `${activeCustomers} active, ${pendingCustomers} pending`, icon: Users, color: "bg-gradient-to-br from-blue-500 to-indigo-600" },
          { label: "Total Messages Sent", value: totalMessages.toLocaleString(), icon: MessageSquare, color: "bg-gradient-to-br from-emerald-500 to-teal-600" },
          { label: "Active Campaigns", value: activeCampaigns, icon: Megaphone, color: "bg-gradient-to-br from-purple-500 to-pink-600" },
          { label: "Active Plans", value: plans.filter((p: any) => p.isActive).length, icon: TrendingUp, color: "bg-gradient-to-br from-orange-500 to-amber-600" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                {stat.sub && <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>}
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color}`}>
                <stat.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Recent Customers</h2>
          <div className="space-y-3">
            {recentCustomers.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{c.businessName}</p>
                  <p className="text-xs text-slate-400">{c.user.email}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColors[c.status] ?? "bg-slate-100 text-slate-500"}`}>{c.status}</span>
                  {c.plan && <p className="text-xs text-slate-400 mt-0.5">{c.plan.name}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
          <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Plans</h2>
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{plan.name}</p>
                  <p className="text-xs text-slate-400">{plan.messageLimit.toLocaleString()} messages/month</p>
                </div>
                <p className="font-bold text-emerald-600">${plan.priceMonthly}/mo</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
