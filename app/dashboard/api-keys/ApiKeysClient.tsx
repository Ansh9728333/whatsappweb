"use client";

import { useState } from "react";
import { 
  Key, Plus, Copy, Trash2, Check, AlertTriangle, 
  CheckCircle2, Globe, Shield, RefreshCw, X, Edit2, Loader2, Info
} from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  secretPreview?: string | null;
  ipWhitelist?: string | null;
  isActive: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
  whatsappAccount?: {
    phoneNumber: string;
  } | null;
}

interface WhatsAppAccount {
  id: string;
  phoneNumber: string;
}

interface Props {
  initialKeys: ApiKey[];
  whatsappAccounts: WhatsAppAccount[];
}

export default function ApiKeysClient({ initialKeys, whatsappAccounts }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [loading, setLoading] = useState(false);
  
  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<ApiKey | null>(null);
  const [revealedKey, setRevealedKey] = useState<{ rawKey: string; rawSecret: string } | null>(null);

  // Forms state
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedWaId, setSelectedWaId] = useState("");
  const [ipWhitelist, setIpWhitelist] = useState("");

  const [editName, setEditName] = useState("");
  const [editIpWhitelist, setEditIpWhitelist] = useState("");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copy helper
  function copyKey(text: string, type: "key" | "secret") {
    navigator.clipboard.writeText(text);
    setCopiedKey(type);
    toast.success(`${type === "key" ? "API Key" : "Secret Key"} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Create Key
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) {
      return toast.error("Key name is required");
    }
    if (!selectedWaId) {
      return toast.error("Please select a WhatsApp account");
    }

    setLoading(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          whatsappAccountId: selectedWaId,
          ipWhitelist: ipWhitelist.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to generate key");
      }

      const data = await res.json();
      
      // Update local state
      const matchingWa = whatsappAccounts.find(a => a.id === selectedWaId);
      const newKeyObj: ApiKey = {
        id: data.id,
        name: data.name,
        keyPreview: data.keyPreview,
        secretPreview: data.secretPreview,
        ipWhitelist: ipWhitelist.trim() || null,
        isActive: true,
        createdAt: data.createdAt,
        whatsappAccount: matchingWa ? { phoneNumber: matchingWa.phoneNumber } : null,
      };

      setKeys(prev => [newKeyObj, ...prev]);
      setRevealedKey({ rawKey: data.rawKey, rawSecret: data.rawSecret });
      
      // Reset form
      setNewKeyName("");
      setSelectedWaId("");
      setIpWhitelist("");
      setShowCreate(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create key");
    } finally {
      setLoading(false);
    }
  }

  // Update Key
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!showEdit) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/api-keys/${showEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          ipWhitelist: editIpWhitelist.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to update key");
      
      setKeys(prev => prev.map(k => k.id === showEdit.id ? { 
        ...k, 
        name: editName.trim(), 
        ipWhitelist: editIpWhitelist.trim() || null 
      } : k));
      
      toast.success("API Key updated");
      setShowEdit(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update key");
    } finally {
      setLoading(false);
    }
  }

  // Delete/Revoke Key
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this API Key? Any application using it will stop working immediately.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete key");
      
      setKeys(prev => prev.filter(k => k.id !== id));
      toast.success("API Key deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h1>
          <p className="text-slate-500 mt-1">Manage API credentials for connecting external applications to your WhatsApp lines</p>
        </div>
        <button
          onClick={() => {
            setRevealedKey(null);
            setShowCreate(true);
          }}
          disabled={whatsappAccounts.length === 0}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25 transition-all self-start sm:self-auto"
        >
          <Plus size={18} />
          Generate Key
        </button>
      </div>

      {whatsappAccounts.length === 0 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/20 p-4 rounded-xl flex gap-3 text-sm text-amber-800 dark:text-amber-300">
          <Info className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" size={18} />
          <div>
            <span className="font-semibold">No connected WhatsApp accounts found!</span>
            <p className="mt-0.5 text-xs opacity-90">You must connect at least one WhatsApp number under the &quot;WhatsApp&quot; tab before you can generate API Keys for integrations.</p>
          </div>
        </div>
      )}

      {/* Revealed key warning banner */}
      {revealedKey && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200/20 rounded-2xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" size={20} />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-amber-950 dark:text-amber-300">Copy your API Key and Secret now!</h4>
              <p className="text-xs text-amber-800/80 dark:text-amber-400/90 mt-0.5">For security, these keys are shown <b>only once</b> and cannot be recovered if you close this banner.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500">API Key (Bearer Token)</span>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono truncate select-all">{revealedKey.rawKey}</code>
                <button
                  onClick={() => copyKey(revealedKey.rawKey, "key")}
                  className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-400 p-2 rounded-xl transition-colors shrink-0"
                >
                  {copiedKey === "key" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Secret Key */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-500">Secret Key (X-API-Secret)</span>
              <div className="flex gap-2">
                <code className="flex-1 text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono truncate select-all">{revealedKey.rawSecret}</code>
                <button
                  onClick={() => copyKey(revealedKey.rawSecret, "secret")}
                  className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-400 p-2 rounded-xl transition-colors shrink-0"
                >
                  {copiedKey === "secret" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => setRevealedKey(null)}
            className="text-xs font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 underline"
          >
            I have securely saved my keys, dismiss
          </button>
        </div>
      )}

      {/* Keys List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Connected Number</th>
                <th className="px-6 py-4">Key Preview</th>
                <th className="px-6 py-4">IP Addresses</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-600 dark:text-slate-300">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No API keys created yet. Click &quot;Generate Key&quot; to create one.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(k.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white">
                      {k.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                      {k.whatsappAccount?.phoneNumber ? `+${k.whatsappAccount.phoneNumber}` : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-500">
                      {k.keyPreview}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Globe size={13} className="text-slate-400" />
                        <span className="truncate max-w-[150px] font-mono">
                          {k.ipWhitelist || "All IPs allowed"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setShowEdit(k);
                            setEditName(k.name);
                            setEditIpWhitelist(k.ipWhitelist || "");
                          }}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Key Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowCreate(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Generate API Key</h3>
              <p className="text-xs text-slate-400 mt-1">Configure credentials linked to a connected WhatsApp number.</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Key Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Server Integration"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Linked WhatsApp Number</label>
                <select
                  required
                  value={selectedWaId}
                  onChange={(e) => setSelectedWaId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select Account</option>
                  {whatsappAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>+{acc.phoneNumber}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>IP Whitelist (Optional)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Comma-separated IPs</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.1, 10.0.0.1"
                  value={ipWhitelist}
                  onChange={(e) => setIpWhitelist(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium py-2 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Generate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowEdit(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={18} />
            </button>

            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit API Key</h3>
              <p className="text-xs text-slate-400 mt-1">Modify configuration parameters for this API credential.</p>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Key Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">IP Whitelist (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.1, 10.0.0.1"
                  value={editIpWhitelist}
                  onChange={(e) => setEditIpWhitelist(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-150 dark:border-slate-700/60 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEdit(null)}
                  className="flex-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium py-2 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-medium py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 text-sm"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
