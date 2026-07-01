"use client";

import Link from "next/link";
import { Megaphone, Plus, Users, CheckCircle2, XCircle, Eye, BarChart2 } from "lucide-react";

type Campaign = {
  id: string;
  name: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  createdAt: string;
  scheduledAt?: string | null;
  template?: { name: string } | null;
};

const statusColors: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  RUNNING: "bg-blue-100 text-blue-700 border-blue-200",
  SCHEDULED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  DRAFT: "bg-slate-100 text-slate-600 border-slate-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
  PAUSED: "bg-orange-100 text-orange-700 border-orange-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

export default function CampaignsClient({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campaigns</h1>
          <p className="text-slate-500 mt-1">{campaigns.length} campaigns</p>
        </div>
        <Link href="/dashboard/campaigns/new" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all shadow-sm">
          <Plus size={15} />
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-16 text-center">
          <Megaphone size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No campaigns yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first broadcast campaign</p>
          <Link href="/dashboard/campaigns/new" className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors">
            <Plus size={14} /> New Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const deliveryRate = campaign.totalRecipients > 0
              ? Math.round((campaign.deliveredCount + campaign.readCount) / campaign.totalRecipients * 100)
              : 0;
            return (
              <div key={campaign.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">{campaign.name}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColors[campaign.status] ?? "bg-slate-100 text-slate-500"}`}>{campaign.status}</span>
                    </div>
                    {campaign.template && (
                      <p className="text-xs text-slate-400 mb-3">Template: <span className="font-mono text-slate-600 dark:text-slate-400">{campaign.template.name}</span></p>
                    )}
                    {/* Stats bar */}
                    <div className="flex items-center gap-6 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Users size={12} />{campaign.totalRecipients} recipients</span>
                      <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" />{campaign.deliveredCount} delivered</span>
                      <span className="flex items-center gap-1"><Eye size={12} className="text-purple-500" />{campaign.readCount} read</span>
                      <span className="flex items-center gap-1"><XCircle size={12} className="text-red-400" />{campaign.failedCount} failed</span>
                      <span className="flex items-center gap-1"><BarChart2 size={12} className="text-blue-400" />{deliveryRate}% rate</span>
                    </div>
                    {/* Progress bar */}
                    {campaign.totalRecipients > 0 && (
                      <div className="mt-3 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all" style={{ width: `${deliveryRate}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-slate-400">{new Date(campaign.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
