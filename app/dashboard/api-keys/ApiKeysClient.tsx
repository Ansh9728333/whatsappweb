"use client";

import { useState } from "react";
import { Key, Plus, Copy, Trash2, Check, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type ApiKey = {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
};

export default function ApiKeysClient({ initialKeys }: { initialKeys: ApiKey[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<{ id: string; rawKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setKeys(p => [{ id: data.id, name: data.name, keyPrefix: data.keyPrefix, isActive: true, lastUsedAt: null, createdAt: data.createdAt }, ...p]);
      setRevealedKey({ id: data.id, rawKey: data.rawKey });
      setNewKeyName("");
      setShowCreate(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Revoke this API key? Any apps using it will stop working.")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    setKeys(p => p.map(k => k.id === id ? { ...k, isActive: false } : k));
    toast.success("API key revoked");
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    toast.success("Key copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
          <p className="text-slate-500 mt-1">Manage your customer API keys for programmatic access</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all shadow-sm">
          <Plus size={15} /> Generate Key
        </button>
      </div>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800 mb-1">⚠️ Copy your API key now — it won&apos;t be shown again</p>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 text-xs bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 text-amber-900 font-mono break-all">{revealedKey.rawKey}</code>
                <button onClick={() => copyKey(revealedKey.rawKey)} className="flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-400 transition-colors">
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button onClick={() => setRevealedKey(null)} className="mt-2 text-xs text-amber-600 hover:underline">I&apos;ve saved my key, dismiss</button>
            </div>
          </div>
        </div>
      )}

      {/* Keys list */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        {keys.length === 0 ? (
          <div className="p-12 text-center">
            <Key size={36} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No API keys yet</p>
            <p className="text-slate-400 text-sm mt-1">Generate a key to start using the API</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Key</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Last Used</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{key.name}</p>
                    <p className="text-xs text-slate-400">{new Date(key.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-1 rounded">{key.keyPrefix}••••••••••••••••</code>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      key.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {key.isActive ? <CheckCircle2 size={11} /> : null}
                      {key.isActive ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-slate-400">
                      {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : "Never"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {key.isActive && (
                      <button onClick={() => handleRevoke(key.id)} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors">
                        <Trash2 size={13} /> Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Generate API Key</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Key Name</label>
                <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} required placeholder="Production Key" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                <button type="submit" disabled={creating} className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-60">
                  {creating ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
