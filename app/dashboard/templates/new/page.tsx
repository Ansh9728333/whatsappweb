"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

export default function NewTemplatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    language: "en_US",
    category: "MARKETING",
    headerText: "",
    bodyText: "",
    footerText: "",
  });

  // Extract variables like {{1}}, {{2}} from bodyText
  const variables = Array.from(
    new Set([...form.bodyText.matchAll(/\{\{(\d+)\}\}/g)].map((m) => `{{${m[1]}}}`))
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, variables }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Template created and submitted for approval");
      router.push("/dashboard/templates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/templates" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Template</h1>
          <p className="text-slate-500 text-sm">Templates must be approved by Meta before use</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Template Name *</label>
            <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") }))} required placeholder="welcome_message" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
            <p className="mt-1 text-xs text-slate-400">Lowercase, underscores only</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Language</label>
            <select value={form.language} onChange={(e) => setForm(p => ({ ...p, language: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white">
              <option value="en_US">English (US)</option>
              <option value="en_GB">English (UK)</option>
              <option value="hi">Hindi</option>
              <option value="es">Spanish</option>
              <option value="pt_BR">Portuguese (BR)</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
          <div className="flex gap-2">
            {(["MARKETING", "UTILITY", "AUTHENTICATION"] as const).map((cat) => (
              <button key={cat} type="button" onClick={() => setForm(p => ({ ...p, category: cat }))}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  form.category === cat
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-300"
                }`}>{cat}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Header (optional)</label>
          <input value={form.headerText} onChange={(e) => setForm(p => ({ ...p, headerText: e.target.value }))} placeholder="Welcome to {{1}}" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Body *</label>
          <textarea value={form.bodyText} onChange={(e) => setForm(p => ({ ...p, bodyText: e.target.value }))} required rows={5} placeholder="Hi {{1}}, thank you for joining {{2}}..." className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white resize-none" />
          <p className="mt-1 text-xs text-slate-400">Use {`{{1}}`}, {`{{2}}`}, etc. for variables. Detected: <span className="font-mono font-semibold text-emerald-600">{variables.join(", ") || "none"}</span></p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Footer (optional)</label>
          <input value={form.footerText} onChange={(e) => setForm(p => ({ ...p, footerText: e.target.value }))} placeholder="Reply STOP to unsubscribe" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
        </div>

        {/* Preview */}
        {form.bodyText && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">PREVIEW</p>
            <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm p-3 max-w-xs">
              {form.headerText && <p className="text-sm font-bold text-slate-800 mb-1">{form.headerText}</p>}
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{form.bodyText}</p>
              {form.footerText && <p className="text-xs text-slate-500 mt-1">{form.footerText}</p>}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/templates" className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center">Cancel</Link>
          <button type="submit" disabled={loading} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-60">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Submitting...</> : "Submit for Approval"}
          </button>
        </div>
      </form>
    </div>
  );
}
