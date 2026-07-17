"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart2,
  Play,
  Pause,
  Trash2,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

type Recipient = {
  id: string;
  name: string | null;
  phoneNumber: string | null;
  normalizedPhone: string | null;
  status: string;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  messageRendered: string | null;
  sentAt: string | null;
  assignedSessionId: string | null;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  messageType: string;
  messageBody: string | null;
  mediaUrl: string | null;
  totalRecipients: number;
  validRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  repliedCount: number;
  failedCount: number;
  skippedCount: number;
  minDelay: number;
  maxDelay: number;
  sleepEnabled: boolean;
  messagesBeforeSleep: number;
  sleepDurationMinutes: number;
  timezone: string;
  createdAt: string;
  scheduledAt?: string | null;
  recipients: Recipient[];
  senders: { phoneNumber: string }[];
  files: { originalFileName: string }[];
};

const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  RUNNING: "bg-blue-50 text-blue-700 border-blue-100 animate-pulse",
  QUEUED: "bg-indigo-50 text-indigo-700 border-indigo-100 animate-pulse",
  SCHEDULED: "bg-yellow-50 text-yellow-700 border-yellow-100",
  DRAFT: "bg-slate-50 text-slate-600 border-slate-100",
  FAILED: "bg-red-50 text-red-700 border-red-100",
  PAUSED: "bg-orange-50 text-orange-700 border-orange-100",
  CANCELLED: "bg-slate-50 text-slate-400 border-slate-100",
};

const recipientStatusColors: Record<string, string> = {
  PENDING: "text-slate-500 bg-slate-100 dark:bg-slate-800",
  PROCESSING: "text-blue-500 bg-blue-50 dark:bg-blue-900/10 animate-pulse",
  SENT: "text-blue-600 bg-blue-100 dark:bg-blue-950/20",
  DELIVERED: "text-emerald-600 bg-emerald-100 dark:bg-emerald-950/20",
  READ: "text-purple-600 bg-purple-100 dark:bg-purple-950/20",
  REPLIED: "text-teal-600 bg-teal-100 dark:bg-teal-950/20",
  FAILED: "text-red-600 bg-red-100 dark:bg-red-950/20",
  SKIPPED: "text-slate-400 bg-slate-50 dark:bg-slate-800/40",
  CANCELLED: "text-slate-400 bg-slate-50 dark:bg-slate-850",
};

export default function CampaignProgressPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const campaignId = params.id;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Load Campaign data
  async function loadCampaign(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) throw new Error("Failed to load campaign data");
      const data = await res.json();
      setCampaign(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load campaign details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Refresh every 5 seconds if running or queued
  useEffect(() => {
    loadCampaign();
    const interval = setInterval(() => {
      if (campaign?.status === "RUNNING" || campaign?.status === "QUEUED") {
        loadCampaign(true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [campaign?.status]);

  // Actions
  async function handleAction(action: string) {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to execute action");
      const data = await res.json();
      toast.success(`Campaign ${action}ed successfully`);
      loadCampaign(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to execute action");
    }
  }

  // Export report as CSV
  function exportReport() {
    if (!campaign) return;
    const headers = ["Name", "Phone", "Status", "Sent At", "Retry Count", "Error Message"];
    const rows = campaign.recipients.map((r) => [
      r.name || "",
      r.phoneNumber || "",
      r.status,
      r.sentAt ? new Date(r.sentAt).toLocaleString() : "",
      r.retryCount.toString(),
      r.errorMessage || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((x) => `"${x.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Campaign_Report_${campaign.name.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Filter recipients
  const filteredRecipients = useMemo(() => {
    if (!campaign) return [];
    return campaign.recipients.filter((r) => {
      const nameMatch = (r.name || "").toLowerCase().includes(search.toLowerCase());
      const phoneMatch = (r.phoneNumber || "").includes(search);
      const matchesSearch = nameMatch || phoneMatch;

      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [campaign, search, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <RefreshCw className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center p-10 bg-white dark:bg-slate-900 border rounded-2xl">
        <AlertTriangle size={40} className="mx-auto text-red-500 mb-2" />
        <h3 className="font-bold text-slate-800 dark:text-white">Campaign not found</h3>
        <p className="text-slate-400 text-sm mt-1">Please verify the URL or link is correct.</p>
        <Link href="/dashboard/campaigns" className="inline-flex mt-4 text-emerald-500 hover:underline text-sm font-semibold">
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const processedCount = campaign.sentCount + campaign.failedCount + campaign.skippedCount;
  const progressPercent = campaign.totalRecipients > 0
    ? Math.round((processedCount / campaign.totalRecipients) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/campaigns"
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{campaign.name}</h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  statusColors[campaign.status] ?? "bg-slate-100 text-slate-500"
                }`}
              >
                {campaign.status}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">Created: {new Date(campaign.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadCampaign(true)}
            disabled={refreshing}
            className="p-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          </button>

          {campaign.status === "RUNNING" && (
            <button
              onClick={() => handleAction("pause")}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
            >
              <Pause size={14} />
              Pause
            </button>
          )}

          {campaign.status === "PAUSED" && (
            <button
              onClick={() => handleAction("resume")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors"
            >
              <Play size={14} />
              Resume
            </button>
          )}

          {(campaign.status === "RUNNING" || campaign.status === "PAUSED" || campaign.status === "QUEUED") && (
            <button
              onClick={() => handleAction("cancel")}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-colors"
            >
              <Trash2 size={14} />
              Cancel
            </button>
          )}

          {campaign.failedCount > 0 && (
            <button
              onClick={() => handleAction("retry")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={14} />
              Retry Failed
            </button>
          )}

          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors"
          >
            <Download size={14} />
            Export Report
          </button>
        </div>
      </div>

      {/* Progress Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Campaign Progress</span>
          <span className="text-slate-500 font-bold">{progressPercent}% ({processedCount} / {campaign.totalRecipients} processed)</span>
        </div>
        <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-white">{campaign.totalRecipients}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-emerald-500">Delivered / Read</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600">{campaign.deliveredCount + campaign.readCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-red-500">Failed</p>
          <p className="text-2xl font-bold mt-1 text-red-600">{campaign.failedCount}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-2xl shadow-sm text-center">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider text-slate-400">Skipped</p>
          <p className="text-2xl font-bold mt-1 text-slate-500">{campaign.skippedCount}</p>
        </div>
      </div>

      {/* Recipient Logs Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-b border-slate-50 dark:border-slate-800">
          <h3 className="font-bold text-slate-900 dark:text-white self-start sm:self-auto">Recipient Logs</h3>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
              />
            </div>

            {/* Status select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="SENT">Sent</option>
              <option value="DELIVERED">Delivered</option>
              <option value="READ">Read</option>
              <option value="REPLIED">Replied</option>
              <option value="FAILED">Failed</option>
              <option value="SKIPPED">Skipped</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Sender Session</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Sent At</th>
                <th className="px-6 py-4">Retry</th>
                <th className="px-6 py-4">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-600 dark:text-slate-300">
              {filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No recipient log records match the filters.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                      {r.name || "—"}
                    </td>
                    <td className="px-6 py-4 font-mono">{r.phoneNumber || "—"}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{r.assignedSessionId ? r.assignedSessionId.slice(0, 15) : "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded font-semibold uppercase tracking-wider text-[10px] ${
                          recipientStatusColors[r.status] ?? "text-slate-500"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{r.retryCount}</td>
                    <td className="px-6 py-4 text-red-500 max-w-xs truncate" title={r.errorMessage || ""}>
                      {r.errorMessage || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
