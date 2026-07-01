"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  id: string;
  businessName: string;
  status: string;
  messagesUsed: number;
  createdAt: string;
  user: { name: string; email: string };
  plan?: { name: string; priceMonthly: number } | null;
  whatsAppAccount?: { phoneNumber: string; status: string } | null;
  _count: { campaigns: number };
};

type Plan = { id: string; name: string; priceMonthly: number };

const statusIcons: Record<string, React.ElementType> = {
  ACTIVE: CheckCircle2,
  PENDING: Clock,
  SUSPENDED: XCircle,
};
const statusColors: Record<string, string> = {
  ACTIVE: "text-emerald-600 bg-emerald-50 border-emerald-200",
  PENDING: "text-yellow-600 bg-yellow-50 border-yellow-200",
  SUSPENDED: "text-red-600 bg-red-50 border-red-200",
};

export default function AdminCustomersClient({ customers: initial, plans }: { customers: Customer[]; plans: Plan[] }) {
  const [customers, setCustomers] = useState(initial);
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateCustomer(id: string, data: { status?: string; planId?: string }) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      const updated = await res.json();
      setCustomers(p => p.map(c => c.id === id ? { ...c, ...updated, user: c.user, _count: c._count } : c));
      toast.success("Customer updated");
    } catch {
      toast.error("Failed to update customer");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customers</h1>
        <p className="text-slate-500 mt-1">{customers.length} registered customers</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Customer</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Plan</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Usage</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {customers.map((c) => {
              const StatusIcon = statusIcons[c.status] ?? Clock;
              return (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.businessName}</p>
                    <p className="text-xs text-slate-400">{c.user.email}</p>
                    {c.whatsAppAccount && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone size={10} className="text-slate-400" />
                        <span className="text-xs text-slate-400">{c.whatsAppAccount.phoneNumber}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1 w-fit text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[c.status] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                      <StatusIcon size={11} />{c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <select value={c.plan?.name ?? ""} onChange={(e) => { const plan = plans.find(p => p.name === e.target.value); if (plan) updateCustomer(c.id, { planId: plan.id }); }} disabled={updating === c.id} className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white">
                      {plans.map(p => <option key={p.id} value={p.name}>{p.name} (${p.priceMonthly}/mo)</option>)}
                    </select>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <MessageSquare size={12} />
                      {c.messagesUsed.toLocaleString()} msgs
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {c.status !== "ACTIVE" && (
                        <button onClick={() => updateCustomer(c.id, { status: "ACTIVE" })} disabled={updating === c.id} className="text-xs px-2.5 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50">Approve</button>
                      )}
                      {c.status !== "SUSPENDED" && (
                        <button onClick={() => updateCustomer(c.id, { status: "SUSPENDED" })} disabled={updating === c.id} className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50">Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
