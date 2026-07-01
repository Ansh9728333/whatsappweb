import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Plans — Admin — WhatsApp System" };

export default async function AdminPlansPage() {
  await requireAdmin();

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { customers: true } } },
    orderBy: { priceMonthly: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Plans & Pricing</h1>
        <p className="text-slate-500 mt-1">Manage subscription plans</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan: any) => (
          <div key={plan.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{plan.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${plan.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                {plan.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-3xl font-bold text-emerald-600 mb-1">${plan.priceMonthly}<span className="text-sm font-normal text-slate-400">/mo</span></p>
            <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Messages</span>
                <span className="font-medium text-slate-900 dark:text-white">{plan.messageLimit.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Contacts</span>
                <span className="font-medium text-slate-900 dark:text-white">{plan.contactLimit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customers</span>
                <span className="font-medium text-slate-900 dark:text-white">{plan._count.customers}</span>
              </div>
            </div>
            <ul className="space-y-1.5">
              {(plan.features as string[]).map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
