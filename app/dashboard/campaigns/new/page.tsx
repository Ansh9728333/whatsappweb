"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type Template = { id: string; name: string; language: string; category: string; bodyText: string; variables: string[] };
type Contact = { id: string; name: string; phone: string };

const STEPS = ["Template", "Audience", "Variables", "Schedule", "Review"];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    templateId: "",
    selectedContacts: [] as string[],
    variableMapping: {} as Record<string, string>,
    scheduledAt: "",
  });

  const selectedTemplate = templates.find((t) => t.id === form.templateId);
  const selectedContactObjs = contacts.filter((c) => form.selectedContacts.includes(c.id));

  useEffect(() => {
    fetch("/api/templates?status=APPROVED").then((r) => r.json()).then((data) => setTemplates(Array.isArray(data) ? data : []));
    fetch("/api/contacts?limit=200").then((r) => r.json()).then((data) => setContacts(data.contacts ?? []));
  }, []);

  async function handleSubmit() {
    if (!form.name || !form.templateId || form.selectedContacts.length === 0) {
      toast.error("Please complete all required fields");
      return;
    }
    setLoading(true);
    try {
      const recipients = selectedContactObjs.map((c) => ({
        phone: c.phone,
        contactId: c.id,
        variables: form.variableMapping,
      }));
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          templateId: form.templateId,
          variableMapping: form.variableMapping,
          scheduledAt: form.scheduledAt || null,
          recipients,
        }),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      toast.success("Campaign created successfully!");
      router.push("/dashboard/campaigns");
    } catch {
      toast.error("Failed to create campaign");
    } finally {
      setLoading(false);
    }
  }

  const canNext = [
    form.templateId && form.name,
    form.selectedContacts.length > 0,
    true,
    true,
    true,
  ][step];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/campaigns" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft size={18} /></Link>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">New Campaign</h1>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
              i < step ? "bg-emerald-500 text-white" : i === step ? "bg-emerald-500 text-white ring-4 ring-emerald-100" : "bg-slate-100 text-slate-400"
            }`}>
              {i < step ? <Check size={13} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-8 mx-1 transition-all ${i < step ? "bg-emerald-400" : "bg-slate-100"}`} />}
          </div>
        ))}
        <p className="ml-3 text-sm font-medium text-slate-600 dark:text-slate-400">{STEPS[step]}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6">
        {/* Step 0: Template */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Campaign Name *</label>
              <input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Q1 2025 Welcome" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Template *</label>
              {templates.length === 0 ? (
                <p className="text-sm text-slate-400">No approved templates. <Link href="/dashboard/templates/new" className="text-emerald-500 hover:underline">Create one</Link> and wait for approval.</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <button key={t.id} type="button" onClick={() => setForm(p => ({ ...p, templateId: t.id }))} className={`w-full text-left p-3 rounded-xl border transition-all ${
                      form.templateId === t.id ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 dark:border-slate-700 hover:border-emerald-300"
                    }`}>
                      <p className="text-sm font-semibold font-mono text-slate-800 dark:text-white">{t.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{t.bodyText}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Audience */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Select Contacts ({form.selectedContacts.length} selected)</label>
              <button type="button" onClick={() => setForm(p => ({ ...p, selectedContacts: p.selectedContacts.length === contacts.length ? [] : contacts.map(c => c.id) }))} className="text-xs text-emerald-500 hover:underline">
                {form.selectedContacts.length === contacts.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-slate-100 dark:border-slate-800 rounded-xl p-2">
              {contacts.map((c) => (
                <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={form.selectedContacts.includes(c.id)} onChange={(e) => setForm(p => ({ ...p, selectedContacts: e.target.checked ? [...p.selectedContacts, c.id] : p.selectedContacts.filter(id => id !== c.id) }))} className="rounded text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.phone}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Variables */}
        {step === 2 && selectedTemplate && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Map template variables to values. These will be sent to all recipients.</p>
            {selectedTemplate.variables.length === 0 ? (
              <p className="text-sm text-slate-400">This template has no variables.</p>
            ) : selectedTemplate.variables.map((v) => {
              const key = v.replace(/[{}]/g, "");
              return (
                <div key={v}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Variable <span className="font-mono text-emerald-600">{v}</span></label>
                  <input value={form.variableMapping[key] ?? ""} onChange={(e) => setForm(p => ({ ...p, variableMapping: { ...p.variableMapping, [key]: e.target.value } }))} placeholder={`Value for ${v}`} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
                </div>
              );
            })}
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">Choose when to send this campaign.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm(p => ({ ...p, scheduledAt: "" }))} className={`p-4 rounded-xl border text-sm font-medium text-left transition-all ${
                !form.scheduledAt ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700" : "border-slate-200 dark:border-slate-700 text-slate-600 hover:border-emerald-300"
              }`}>
                <p className="font-semibold">Send Now</p>
                <p className="text-xs text-slate-400 mt-0.5">Send immediately after creation</p>
              </button>
              <button type="button" onClick={() => setForm(p => ({ ...p, scheduledAt: new Date(Date.now() + 3600000).toISOString().slice(0, 16) }))} className={`p-4 rounded-xl border text-sm font-medium text-left transition-all ${
                form.scheduledAt ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700" : "border-slate-200 dark:border-slate-700 text-slate-600 hover:border-emerald-300"
              }`}>
                <p className="font-semibold">Schedule</p>
                <p className="text-xs text-slate-400 mt-0.5">Pick a date and time</p>
              </button>
            </div>
            {form.scheduledAt && (
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm(p => ({ ...p, scheduledAt: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">Review Campaign</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Campaign Name</span>
                <span className="font-medium text-slate-900 dark:text-white">{form.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Template</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{selectedTemplate?.name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Recipients</span>
                <span className="font-medium text-slate-900 dark:text-white">{form.selectedContacts.length} contacts</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Schedule</span>
                <span className="font-medium text-slate-900 dark:text-white">{form.scheduledAt ? new Date(form.scheduledAt).toLocaleString() : "Send Now"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <button type="button" onClick={() => setStep(p => p - 1)} className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={15} /> Back
          </button>
        )}
        <div className="flex-1" />
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => setStep(p => p + 1)} disabled={!canNext} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50">
            Next <ArrowRight size={15} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-60">
            {loading ? <><Loader2 size={15} className="animate-spin" /> Launching...</> : <><Check size={15} /> Launch Campaign</>}
          </button>
        )}
      </div>
    </div>
  );
}
