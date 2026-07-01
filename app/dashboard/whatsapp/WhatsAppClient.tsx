"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Phone, Plus, Loader2, RefreshCw, CheckCircle2, 
  Trash2, LogOut, Copy, Check, ShieldAlert, Key, Lock, Eye, EyeOff
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

interface WhatsAppAccount {
  id: string;
  phoneNumber: string;
  displayName?: string | null;
  status: "CONNECTED" | "DISCONNECTED" | "PENDING";
  apiKeyPreview?: string | null;
  apiSecretPreview?: string | null;
  createdAt: string;
}

interface Props {
  initialAccounts: WhatsAppAccount[];
}

export default function WhatsAppClient({ initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>(initialAccounts);
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"intro" | "qr" | "success">("intro");
  
  // Linking states
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(59);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  const [keysShown, setKeysShown] = useState<{ apiKey: string; apiSecret: string } | null>(null);

  // Copy helpers
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      stopTimer();
    };
  }, []);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Generate QR Code image url from raw text
  useEffect(() => {
    if (qrCodeData) {
      QRCode.toDataURL(qrCodeData)
        .then((url) => setQrImage(url))
        .catch(console.error);
    } else {
      setQrImage(null);
    }
  }, [qrCodeData]);

  // Fetch accounts list
  async function fetchAccounts() {
    try {
      const res = await fetch("/api/wa-accounts");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data);
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Copy text helper
  function handleCopy(text: string, id: string, type: "id" | "key") {
    navigator.clipboard.writeText(text);
    if (type === "id") {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
    }
    toast.success("Copied to clipboard");
  }

  // Initialize linking
  async function handleLinkInit() {
    setLoading(true);
    setCountdown(59);
    setKeysShown(null);
    try {
      const res = await fetch("/api/wa-accounts/link/init", { method: "POST" });
      if (!res.ok) throw new Error("Failed to initialize session");
      
      const data = await res.json();
      setCurrentAccountId(data.accountId);
      setQrCodeData(data.qrCodeDataUrl);
      setModalStep("qr");
      
      // Start Countdown
      startTimer();
      // Start Polling Status
      startPolling(data.accountId);
    } catch (err: any) {
      toast.error(err.message || "Failed to start linking");
    } finally {
      setLoading(false);
    }
  }

  // Start polling connection status
  function startPolling(accountId: string) {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/wa-accounts/link/status?accountId=${accountId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.qrCode) {
          setQrCodeData(data.qrCode);
        }
        
        if (data.status === "connected") {
          stopPolling();
          stopTimer();
          
          if (data.apiKey && data.apiSecret) {
            setKeysShown({ apiKey: data.apiKey, apiSecret: data.apiSecret });
            setModalStep("success");
          } else {
            // Already generated previously, just close
            setShowModal(false);
            toast.success("WhatsApp account connected successfully!");
          }
          fetchAccounts();
        } else if (data.status === "expired") {
          stopPolling();
          stopTimer();
          setQrCodeData(null);
          toast.error("QR Code expired. Please try again.");
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);
  }

  // Start countdown timer
  function startTimer() {
    stopTimer();
    timerIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          stopTimer();
          stopPolling();
          setQrCodeData(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Disconnect session
  async function handleDisconnect(id: string) {
    if (!confirm("Are you sure you want to disconnect this WhatsApp session?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wa-accounts/${id}/disconnect`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("Session disconnected successfully");
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect");
    } finally {
      setLoading(false);
    }
  }

  // Delete account
  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this WhatsApp account? All credentials and sessions will be destroyed.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wa-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("WhatsApp Account deleted");
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  // Regenerate Keys
  async function handleRegenerateKeys(id: string) {
    if (!confirm("Warning: Regenerating keys will revoke existing keys for this number immediately. Continue?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/wa-accounts/${id}/regenerate-keys`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate keys");
      const data = await res.json();
      
      // Open success step showing newly generated keys
      setKeysShown({ apiKey: data.apiKey, apiSecret: data.apiSecret });
      setModalStep("success");
      setShowModal(true);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Accounts</h1>
          <p className="text-slate-500 mt-1">Configure and link your WhatsApp numbers to query the system API</p>
        </div>
        <button
          onClick={() => {
            setModalStep("intro");
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/25 transition-all self-start sm:self-auto"
        >
          <Plus size={18} />
          Add WhatsApp Account
        </button>
      </div>

      {/* Accounts Card List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4">Number</th>
                <th className="px-6 py-4">API Key Preview</th>
                <th className="px-6 py-4">Secret Key Preview</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm text-slate-600 dark:text-slate-300">
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    No WhatsApp accounts connected yet. Click &quot;Add WhatsApp Account&quot; to connect.
                  </td>
                </tr>
              ) : (
                accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                      {new Date(acc.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Phone size={14} />
                      </div>
                      {acc.phoneNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                      {acc.apiKeyPreview || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs">
                      {acc.apiSecretPreview || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        acc.status === "CONNECTED"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          acc.status === "CONNECTED" ? "bg-emerald-500" : "bg-slate-400"
                        }`} />
                        {acc.status === "CONNECTED" ? "Connected" : "Disconnected"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRegenerateKeys(acc.id)}
                          title="Regenerate API Keys"
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          <RefreshCw size={14} />
                        </button>
                        
                        {acc.status === "CONNECTED" && (
                          <button
                            onClick={() => handleDisconnect(acc.id)}
                            title="Disconnect Session"
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          >
                            <LogOut size={14} />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDelete(acc.id)}
                          title="Delete Account"
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

      {/* Add WA Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-2xl p-6 overflow-hidden relative">
            
            {/* Steps Rendering */}
            {modalStep === "intro" && (
              <div className="space-y-6 text-center">
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add WA Account</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    Connect your WhatsApp by clicking the button to display the QRCode then scan it via Link a device button in the app.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLinkInit}
                    disabled={loading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Link
                  </button>
                </div>
              </div>
            )}

            {modalStep === "qr" && (
              <div className="space-y-6 text-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Scan QR Code</h3>
                  <p className="text-xs text-slate-400 mt-1">Open WhatsApp on your phone &rarr; Linked Devices &rarr; Link a device</p>
                </div>
                
                <div className="w-56 h-56 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-slate-800 mx-auto relative overflow-hidden">
                  {qrImage ? (
                    <img src={qrImage} alt="WhatsApp QR Code" className="w-48 h-48" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Loader2 size={32} className="animate-spin text-emerald-500" />
                      <span className="text-xs">Generating QR Code...</span>
                    </div>
                  )}
                </div>

                {qrCodeData && (
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 py-1.5 px-3 rounded-lg inline-block">
                    Time remaining: {countdown} seconds
                  </p>
                )}

                {!qrCodeData && countdown === 0 && (
                  <button
                    onClick={handleLinkInit}
                    className="flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium py-2 px-4 rounded-xl mx-auto text-xs"
                  >
                    <RefreshCw size={14} />
                    Refresh QR Code
                  </button>
                )}

                <button
                  onClick={() => {
                    stopPolling();
                    stopTimer();
                    setShowModal(false);
                  }}
                  className="w-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-medium py-2 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            {modalStep === "success" && keysShown && (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto mb-3">
                    <CheckCircle2 size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Account Linked!</h3>
                  <p className="text-xs text-slate-400 mt-1">Copy and save your API credentials. They are shown <b>only once</b> for security.</p>
                </div>

                <div className="space-y-4">
                  {/* API Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Key size={12} />
                      API Key (Bearer Token)
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono select-all truncate text-slate-700 dark:text-slate-300">
                        {keysShown.apiKey}
                      </div>
                      <button
                        onClick={() => handleCopy(keysShown.apiKey, "apiKey", "key")}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-2.5 rounded-xl transition-colors"
                      >
                        {copiedKey === "apiKey" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* API Secret */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Lock size={12} />
                      API Secret (X-API-Secret)
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono select-all truncate text-slate-700 dark:text-slate-300">
                        {keysShown.apiSecret}
                      </div>
                      <button
                        onClick={() => handleCopy(keysShown.apiSecret, "apiSecret", "key")}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 p-2.5 rounded-xl transition-colors"
                      >
                        {copiedKey === "apiSecret" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200/20 flex gap-2.5">
                    <ShieldAlert className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-normal">
                      Store these keys safely! If you close this window without copying them, they cannot be retrieved again, and you will have to regenerate them.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-xl transition-colors text-sm"
                >
                  I have copied my keys
                </button>
              </div>
            )}
            
          </div>
        </div>
      )}
    </div>
  );
}
