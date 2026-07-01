"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { WaAccount } from "@/lib/types";
import { cn } from "@/lib/utils";
import StatusBadge from "./StatusBadge";
import ActionButtons from "./ActionButtons";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

interface WaAccountsTableProps {
  initialAccounts: WaAccount[];
}

type SortKey = keyof Pick<
  WaAccount,
  "createdAt" | "number" | "uniqueId" | "status"
>;
type SortDirection = "asc" | "desc";

export default function WaAccountsTable({
  initialAccounts,
}: WaAccountsTableProps) {
  const [accounts, setAccounts] = useState<WaAccount[]>(initialAccounts);
  const [search, setSearch] = useState("");
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string;
    number: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toggle allow incoming
  const handleToggleIncoming = (id: string) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, allowIncoming: !a.allowIncoming } : a
      )
    );
  };

  // Reconnect account
  const handleReconnect = async (id: string) => {
    await new Promise((r) => setTimeout(r, 1500));
    setAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "Connected" } : a))
    );
  };

  // Delete account
  const handleDeleteRequest = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    if (account) {
      setDeleteDialog({ open: true, id, number: account.number });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    setDeletingId(deleteDialog.id);
    await new Promise((r) => setTimeout(r, 600));
    setAccounts((prev) => prev.filter((a) => a.id !== deleteDialog.id));
    setDeletingId(null);
    setDeleteDialog(null);
  };

  // Sort handler
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setCurrentPage(1);
  };

  // Filtered + sorted data
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts
      .filter(
        (a) =>
          a.number.toLowerCase().includes(q) ||
          a.uniqueId.toLowerCase().includes(q) ||
          a.status.toLowerCase().includes(q) ||
          a.createdAt.toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const av = a[sortKey] as string;
        const bv = b[sortKey] as string;
        const cmp = av.localeCompare(bv);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [accounts, search, sortKey, sortDir]);

  // Pagination
  const totalEntries = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / entriesPerPage));
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginated = filtered.slice(startIndex, startIndex + entriesPerPage);

  const SortIcon = ({ col }: { col: SortKey }) => (
    <ArrowUpDown
      size={13}
      className={cn(
        "ml-1 flex-shrink-0 transition-colors",
        sortKey === col ? "text-teal-600" : "text-gray-300"
      )}
    />
  );

  // Toggle Switch component
  const Toggle = ({
    checked,
    onChange,
    disabled,
  }: {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
  }) => (
    <button
      role="switch"
      aria-checked={checked}
      onClick={!disabled ? onChange : undefined}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1",
        checked
          ? "focus:ring-teal-500"
          : "focus:ring-gray-300",
        disabled && "opacity-50 cursor-not-allowed",
        checked ? "bg-teal-500" : "bg-gray-200 dark:bg-gray-600"
      )}
      style={checked ? { backgroundColor: "#00a99d" } : undefined}
      disabled={disabled}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            WhatsApp Marketing Accounts
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your connected WhatsApp numbers
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
          style={{
            background: "linear-gradient(135deg, #00635d 0%, #00a99d 100%)",
          }}
        >
          <span className="text-lg leading-none font-light">+</span>
          Add WA Account
        </button>
      </div>

      {/* Table Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Show</span>
          <select
            value={entriesPerPage}
            onChange={(e) => {
              setEntriesPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span>entries</span>
        </div>

        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search accounts..."
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all w-56"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80">
              <th
                className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none whitespace-nowrap"
                onClick={() => handleSort("createdAt")}
              >
                <span className="flex items-center">
                  Created At
                  <SortIcon col="createdAt" />
                </span>
              </th>
              <th
                className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none whitespace-nowrap"
                onClick={() => handleSort("number")}
              >
                <span className="flex items-center">
                  Number
                  <SortIcon col="number" />
                </span>
              </th>
              <th
                className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none whitespace-nowrap"
                onClick={() => handleSort("uniqueId")}
              >
                <span className="flex items-center">
                  Unique ID
                  <SortIcon col="uniqueId" />
                </span>
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Allow Incoming
              </th>
              <th
                className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors select-none whitespace-nowrap"
                onClick={() => handleSort("status")}
              >
                <span className="flex items-center">
                  Status
                  <SortIcon col="status" />
                </span>
              </th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center text-gray-400 dark:text-gray-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search size={32} className="opacity-30" />
                    <p className="text-sm">No accounts found</p>
                    {search && (
                      <p className="text-xs">
                        Try a different search term
                      </p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((account, index) => (
                <tr
                  key={account.id}
                  className={cn(
                    "transition-all duration-150 hover:bg-teal-50/30 dark:hover:bg-teal-900/10",
                    index % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50/30 dark:bg-gray-800/50"
                  )}
                >
                  {/* Created At */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-gray-800 dark:text-gray-200 font-medium">
                      {account.createdAt.split(" ")[0]}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {account.createdAt.split(" ").slice(1).join(" ")}
                    </div>
                  </td>

                  {/* Number */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {account.number}
                    </span>
                  </td>

                  {/* Unique ID */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="text-sm text-gray-600 dark:text-gray-400 font-mono"
                      title={account.uniqueId}
                    >
                      {account.uniqueId.length > 16
                        ? account.uniqueId.slice(0, 16) + "..."
                        : account.uniqueId}
                    </span>
                  </td>

                  {/* Allow Incoming Toggle */}
                  <td className="px-6 py-4">
                    <Toggle
                      checked={account.allowIncoming}
                      onChange={() => handleToggleIncoming(account.id)}
                      disabled={account.status === "Disconnected"}
                    />
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={account.status} />
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <ActionButtons
                      uniqueId={account.uniqueId}
                      accountId={account.id}
                      status={account.status}
                      onReconnect={handleReconnect}
                      onDelete={handleDeleteRequest}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {totalEntries === 0
            ? "No entries to show"
            : `Showing ${startIndex + 1} to ${Math.min(
                startIndex + entriesPerPage,
                totalEntries
              )} of ${totalEntries} entries`}
        </p>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronLeft size={13} />
            Previous
          </button>

          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={cn(
                "w-8 h-8 text-xs font-semibold rounded-lg border transition-all duration-200",
                currentPage === page
                  ? "border-transparent text-white shadow-sm"
                  : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700"
              )}
              style={
                currentPage === page
                  ? { backgroundColor: "#00635d" }
                  : undefined
              }
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            Next
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deleteDialog?.open}
        accountNumber={deleteDialog?.number ?? ""}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog(null)}
        loading={!!deletingId}
      />
    </div>
  );
}
