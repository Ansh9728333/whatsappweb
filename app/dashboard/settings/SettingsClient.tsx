"use client";

import { useState } from "react";
import { Settings, Shield, Phone, Loader2, Key } from "lucide-react";
import { toast } from "sonner";

type WAAccount = {
  phoneNumber: string;
  phoneNumberId: string;
  wabaId: string;
  displayName?: string | null;
  status: string;
  webhookVerified: boolean;
} | null;

type User = {
  name: string;
  email: string;
};

type Customer = {
  businessName: string;
  plan?: { name: string; messageLimit: number; priceMonthly: number } | null;
};

interface Props {
  initialAccount: WAAccount;
  user: User;
  customer: Customer;
}

export default function SettingsClient({ initialAccount, user, customer }: Props) {
  const [activeTab, setActiveTab] = useState<"profile" | "whatsapp">("profile");
  const [account, setAccount] = useState<WAAccount>(initialAccount);
  const [loading, setLoading] = useState(false);

  // Profile fields
  const [profileForm, setProfileForm] = useState({
    name: user.name,
    businessName: customer.businessName,
    currentPassword: "",
    newPassword: "",
  });

  // WhatsApp configuration fields
  const [waForm, setWaForm] = useState({
    phoneNumber: account?.phoneNumber ?? "",
    phoneNumberId: account?.phoneNumberId ?? "",
    wabaId: account?.wabaId ?? "",
    accessToken: "",
    displayName: account?.displayName ?? "",
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

  async function handleWASubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waForm),
      });
      if (!res.ok) throw new Error("Failed to save credentials");
      const updated = await res.json();
      setAccount(updated);
      toast.success("WhatsApp cloud credentials verified & connected");
    } catch {
      toast.error("Failed to connect account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-500 mt-1">Configure your business and WhatsApp settings</p>
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "profile"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Settings size={16} /> Business Profile
        </button>
        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === "whatsapp"
              ? "border-emerald-500 text-emerald-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Phone size={16} /> WhatsApp Cloud API
        </button>
      </div>

      {activeTab === "profile" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main profile form */}
          <div className="md:col-span-2 space-y-6">
            <form onSubmit={handleProfileSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-4">
              <h2 className="font-bold text-slate-950 dark:text-white">General Information</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                  <input
                    value={profileForm.name}
                    onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Name</label>
                  <input
                    value={profileForm.businessName}
                    onChange={(e) => setProfileForm((p) => ({ ...p, businessName: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <h2 className="font-bold text-slate-950 dark:text-white pt-4">Change Password</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm((p) => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                  <input
                    type="password"
                    value={profileForm.newPassword}
                    onChange={(e) => setProfileForm((p) => ({ ...p, newPassword: e.target.value }))}
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : "Save Changes"}
              </button>
            </form>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5">
              <h3 className="font-bold text-slate-900 dark:text-white mb-3">Your Plan</h3>
              {customer.plan ? (
                <div>
                  <p className="text-xl font-bold text-emerald-600">${customer.plan.priceMonthly}/mo</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">{customer.plan.name} Plan</p>
                  <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Message limit:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{customer.plan.messageLimit.toLocaleString()} / mo</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No active plan.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleWASubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${account?.status === "CONNECTED" ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700"}`}>
              <Shield size={20} />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Status: {account?.status === "CONNECTED" ? "Connected" : "Disconnected"}
              </p>
              <p className="text-xs text-slate-400">
                Configure your official Meta WhatsApp Business Cloud API credentials below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">WhatsApp Phone Number</label>
              <input
                value={waForm.phoneNumber}
                onChange={(e) => setWaForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                required
                placeholder="+1 555-0100"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Display Name</label>
              <input
                value={waForm.displayName}
                onChange={(e) => setWaForm((p) => ({ ...p, displayName: e.target.value }))}
                placeholder="Acme Support"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone Number ID (phone_number_id)</label>
              <input
                value={waForm.phoneNumberId}
                onChange={(e) => setWaForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
                required
                placeholder="10984728194"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">WhatsApp Business Account ID (waba_id)</label>
              <input
                value={waForm.wabaId}
                onChange={(e) => setWaForm((p) => ({ ...p, wabaId: e.target.value }))}
                required
                placeholder="20938472018"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Permanent Access Token (System User / Developer Token)</label>
            <input
              type="password"
              value={waForm.accessToken}
              onChange={(e) => setWaForm((p) => ({ ...p, accessToken: e.target.value }))}
              placeholder={account?.status === "CONNECTED" ? "••••••••••••••••••••" : "EAAG..."}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-400">
              Only enter this if you wish to configure your own Meta account. Leave blank to use our managed platform gateway.
            </p>
          </div>

          {account?.webhookVerified && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-100 dark:border-slate-700 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Webhook configuration</p>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Webhook URL:</span>
                <span className="font-mono text-emerald-600 font-semibold select-all">https://yourdomain.com/api/webhook/whatsapp</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Verify Token:</span>
                <span className="font-mono text-emerald-600 font-semibold select-all">whatsify_verify_token_123</span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : "Verify & Connect Account"}
          </button>
        </form>
      )}
    </div>
  );
}
