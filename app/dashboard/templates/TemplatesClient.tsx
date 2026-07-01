"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Plus, CheckCircle2, Clock, XCircle, PauseCircle, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  status: string;
  createdAt: string;
  variables: string[];
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  APPROVED: { label: "Approved", icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  PENDING: { label: "Pending", icon: Clock, cls: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  REJECTED: { label: "Rejected", icon: XCircle, cls: "text-red-600 bg-red-50 border-red-200" },
  PAUSED: { label: "Paused", icon: PauseCircle, cls: "text-slate-600 bg-slate-50 border-slate-200" },
  DRAFT: { label: "Draft", icon: FileText, cls: "text-blue-600 bg-blue-50 border-blue-200" },
};

const categoryColors: Record<string, string> = {
  MARKETING: "bg-purple-100 text-purple-700",
  UTILITY: "bg-blue-100 text-blue-700",
  AUTHENTICATION: "bg-orange-100 text-orange-700",
};

export default function TemplatesClient({ initialTemplates }: { initialTemplates: Template[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [preview, setPreview] = useState<Template | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/templates/${id}`, { method: "DELETE" });
    setTemplates((p) => p.filter((t) => t.id !== id));
    toast.success("Template deleted");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Message Templates</h1>
          <p className="text-slate-500 mt-1">{templates.length} templates</p>
        </div>
        <Link href="/dashboard/templates/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all shadow-sm">
          <Plus size={15} />
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">
          <FileText size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No templates yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first message template to get started</p>
          <Link href="/dashboard/templates/new" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors">
            <Plus size={14} /> Create Template
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => {
            const s = statusConfig[template.status] ?? statusConfig.DRAFT;
            const StatusIcon = s.icon;
            return (
              <div key={template.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white font-mono text-sm">{template.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${categoryColors[template.category] ?? "bg-slate-100 text-slate-600"}`}>{template.category}</span>
                      <span className="text-xs text-slate-400">{template.language}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{template.bodyText}</p>
                    {(template.variables as string[]).length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {(template.variables as string[]).map((v) => (
                          <span key={v} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs font-mono">{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
                      <StatusIcon size={12} />{s.label}
                    </span>
                    <button onClick={() => setPreview(template)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Eye size={15} /></button>
                    <button onClick={() => handleDelete(template.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-slate-900 dark:text-white mb-1">{preview.name}</h2>
            <p className="text-xs text-slate-400 mb-4">{preview.category} · {preview.language}</p>
            <div className="bg-[#DCF8C6] rounded-2xl rounded-tl-sm p-4 max-w-xs">
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{preview.bodyText}</p>
            </div>
            <button onClick={() => setPreview(null)} className="mt-4 w-full py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
