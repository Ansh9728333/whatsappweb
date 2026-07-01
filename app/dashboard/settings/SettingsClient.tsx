"use client";

import { useState } from "react";
import { Settings, Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

type User = {
  name: string;
  email: string;
};

type Customer = {
  businessName: string;
  plan?: { name: string; messageLimit: number; priceMonthly: number } | null;
};

interface Props {
  user: User;
  customer: Customer;
}

export default function SettingsClient({ user, customer }: Props) {
  const [loading, setLoading] = useState(false);

  // Profile fields
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    businessName: customer.businessName,
    currentPassword: "",
    newPassword: "",
  });

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to update profile");
      toast.success("Profile updated successfully");
      setProfileForm((p) => ({ ...p, currentPassword: "", newPassword: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your business profile settings</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Full Name</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Business Name</label>
              <input
                type="text"
                required
                value={profileForm.businessName}
                onChange={(e) => setProfileForm({ ...profileForm, businessName: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Current Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={profileForm.currentPassword}
                onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">New Password (Optional)</label>
              <input
                type="password"
                placeholder="Leave blank to keep current"
                value={profileForm.newPassword}
                onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-medium px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* Plan Details Info */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-start gap-4">
        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
          <Settings size={20} />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 dark:text-white">Current Pricing Plan</h4>
          <p className="text-xs text-slate-500 mt-1">
            You are on the <span className="font-semibold text-emerald-600">{customer.plan?.name || "Starter"} Plan</span> (Limit: {customer.plan?.messageLimit.toLocaleString() || "1,000"} messages/month).
          </p>
        </div>
      </div>
    </div>
  );
}
