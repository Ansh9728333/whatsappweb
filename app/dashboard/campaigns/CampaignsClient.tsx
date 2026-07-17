"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  Eye,
  BarChart2,
  Search,
  Filter,
  Calendar,
  Phone,
  MoreVertical,
  Play,
  Pause,
  Trash2,
  Copy,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

type Campaign = {
  id: string;
  name: string;
  status: string;
  messageType: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  scheduledAt?: string | null;
  senders: { phoneNumber: string }[];
  files: { originalFileName: string }[];
};

const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
  RUNNING: "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30",
  QUEUED: "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30",
  SCHEDULED: "bg-yellow-50 text-yellow-700 border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30",
  DRAFT: "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800",
  FAILED: "bg-red-50 text-red-700 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30",
  PAUSED: "bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30",
  CANCELLED: "bg-slate-50 text-slate-400 border-slate-100 dark:bg-slate-900 dark:text-slate-500 dark:border-slate-800",
};

export default function CampaignsClient({ campaigns: initialCampaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL"); // ALL, TODAY, WEEK, MONTH
  const [senderFilter, setSenderFilter] = useState("ALL");
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Extract all unique sender phone numbers for filtering
  const allSenders = useMemo(() => {
    const numbers = new Set<string>();
    campaigns.forEach((c) => {
      c.senders.forEach((s) => numbers.add(s.phoneNumber));
    });
    return Array.from(numbers);
  }, [campaigns]);

  // Actions
  async function handleAction(campaignId: string, action: string) {
    setActiveMenu(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to execute action");
      const data = await res.json();
      toast.success(`Campaign ${action}ed successfully`);
      
      // Update local state
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status: data.status } : c))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to perform action");
    }
  }

  async function handleDelete(campaignId: string) {
    if (!confirm("Are you sure you want to delete this draft campaign?")) return;
    setActiveMenu(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete draft");
      toast.success("Draft deleted successfully");
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  }

  async function handleDuplicate(campaign: Campaign) {
    if (!confirm(`Duplicate campaign "${campaign.name}"?`)) return;
    try {
      // Fetch full campaign details
      const detailRes = await fetch(`/api/campaigns/${campaign.id}`);
      if (!detailRes.ok) throw new Error("Failed to fetch details");
      const details = await detailRes.json();

      const dupRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${details.name} (Copy)`,
          senders: details.senders.map((s: any) => ({ sessionId: s.sessionId, phoneNumber: s.phoneNumber })),
          sendingMethod: details.sendingMethod || "ROUND_ROBIN",
          messageType: details.messageType,
          messageBody: details.messageBody,
          mediaUrl: details.mediaUrl,
          minDelay: details.minDelay,
          maxDelay: details.maxDelay,
          sleepEnabled: details.sleepEnabled,
          messagesBeforeSleep: details.messagesBeforeSleep,
          sleepDurationMinutes: details.sleepDurationMinutes,
          shortenUrls: details.shortenUrls,
          scheduleType: "NOW", // Reset to send now or schedule later manually
          timezone: details.timezone,
          retryEnabled: details.retryEnabled,
          maxRetries: details.maxRetries,
          recipients: details.recipients.map((r: any) => ({
            name: r.name,
            phoneNumber: r.phoneNumber,
            normalizedPhone: r.normalizedPhone,
            customData: r.customData,
          })),
        }),
      });

      if (!dupRes.ok) {
        const error = await dupRes.json();
        throw new Error(error.error || "Failed to duplicate");
      }

      toast.success("Campaign duplicated as Draft");
      router.refresh();
      // Reload page data
      const refreshRes = await fetch("/api/campaigns");
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setCampaigns(data);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate");
    }
  }

  // Filter Logic
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      // Search filter
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;

      // Sender filter
      const matchesSender =
        senderFilter === "ALL" || c.senders.some((s) => s.phoneNumber === senderFilter);

      // Date filter
      let matchesDate = true;
      const createdDate = new Date(c.createdAt);
      const now = new Date();
      if (dateFilter === "TODAY") {
        matchesDate = createdDate.toDateString() === now.toDateString();
      } else if (dateFilter === "WEEK") {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = createdDate >= oneWeekAgo;
      } else if (dateFilter === "MONTH") {
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesDate = createdDate >= oneMonthAgo;
      }

      return matchesSearch && matchesStatus && matchesSender && matchesDate;
    });
  }, [campaigns, search, statusFilter, senderFilter, dateFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="text-slate-500 mt-1">{filteredCampaigns.length} campaigns listed</p>
        </div>
        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-teal-600 transition-all shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20"
        >
          <Plus size={16} />
          Create Campaign
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="QUEUED">Queued</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="RUNNING">Running</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="relative">
          <Calendar size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none cursor-pointer"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Created Today</option>
            <option value="WEEK">Created This Week</option>
            <option value="MONTH">Created This Month</option>
          </select>
        </div>

        {/* Sender Filter */}
        <div className="relative">
          <Phone size={16} className="absolute left-3 top-3.5 text-slate-400" />
          <select
            value={senderFilter}
            onChange={(e) => setSenderFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:text-white appearance-none cursor-pointer"
          >
            <option value="ALL">All Sender Numbers</option>
            {allSenders.map((num) => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Campaigns list */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center shadow-sm">
          <Megaphone size={44} className="mx-auto text-slate-300 dark:text-slate-700 mb-4" />
          <p className="text-slate-600 dark:text-slate-300 font-semibold text-lg">No campaigns found</p>
          <p className="text-slate-400 text-sm mt-1">Try resetting your filters or create a new campaign builder wizard.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCampaigns.map((campaign) => {
            const processedCount = campaign.sentCount + campaign.failedCount;
            const progressRate = campaign.totalRecipients > 0
              ? Math.round((processedCount / campaign.totalRecipients) * 100)
              : 0;

            return (
              <div
                key={campaign.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-6 hover:shadow-md transition-shadow relative"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {campaign.name}
                      </h3>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          statusColors[campaign.status] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {campaign.status}
                      </span>
                      <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded font-medium">
                        {campaign.messageType}
                      </span>
                    </div>

                    {/* Senders list */}
                    <div className="flex items-center gap-2 mb-3 text-xs text-slate-400">
                      <Phone size={12} />
                      <span className="truncate">
                        Senders: {campaign.senders.map((s) => s.phoneNumber).join(", ") || "No senders"}
                      </span>
                    </div>

                    {/* Stats counters */}
                    <div className="flex items-center gap-6 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Users size={13} className="text-slate-400" />
                        {campaign.totalRecipients} recipients
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        {campaign.deliveredCount} delivered
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <Eye size={13} className="text-purple-500" />
                        {campaign.readCount} read
                      </span>
                      <span className="flex items-center gap-1.5 font-medium">
                        <XCircle size={13} className="text-red-500" />
                        {campaign.failedCount} failed
                      </span>
                    </div>

                    {/* Progress bar */}
                    {campaign.status !== "DRAFT" && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                          <span>{processedCount} / {campaign.totalRecipients} processed</span>
                          <span>{progressRate}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                            style={{ width: `${progressRate}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Dropdown */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() =>
                        setActiveMenu(activeMenu === campaign.id ? null : campaign.id)
                      }
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {activeMenu === campaign.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActiveMenu(null)}
                        />
                        <div className="absolute right-0 mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-850">
                          <div className="py-1">
                            <Link
                              href={`/dashboard/campaigns/${campaign.id}`}
                              className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <BarChart2 size={14} />
                              View Progress
                            </Link>
                            <button
                              onClick={() => handleDuplicate(campaign)}
                              className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <Copy size={14} />
                              Duplicate
                            </button>
                          </div>

                          <div className="py-1">
                            {campaign.status === "RUNNING" && (
                              <button
                                onClick={() => handleAction(campaign.id, "pause")}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-orange-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Pause size={14} />
                                Pause Campaign
                              </button>
                            )}
                            {campaign.status === "PAUSED" && (
                              <button
                                onClick={() => handleAction(campaign.id, "resume")}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-emerald-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Play size={14} />
                                Resume Campaign
                              </button>
                            )}
                            {(campaign.status === "RUNNING" || campaign.status === "PAUSED" || campaign.status === "QUEUED") && (
                              <button
                                onClick={() => handleAction(campaign.id, "cancel")}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Trash2 size={14} />
                                Cancel Campaign
                              </button>
                            )}
                            {campaign.status === "DRAFT" && (
                              <button
                                onClick={() => handleDelete(campaign.id)}
                                className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Trash2 size={14} />
                                Delete Draft
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer created date */}
                <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-50 dark:border-slate-800/50 pt-3">
                  <span>Created: {new Date(campaign.createdAt).toLocaleString()}</span>
                  {campaign.scheduledAt && (
                    <span className="flex items-center gap-1 text-yellow-600">
                      <Clock size={11} />
                      Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
