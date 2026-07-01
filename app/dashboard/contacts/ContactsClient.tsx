"use client";

import { useState } from "react";
import {
  Users, Plus, Search, Filter, Upload, Trash2, Phone, Mail, Tag
} from "lucide-react";
import { toast } from "sonner";

type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  createdAt: string;
  contactTags: { tag: { id: string; name: string; color: string } }[];
};

type TagRecord = { id: string; name: string; color: string };

interface Props {
  initialContacts: Contact[];
  tags: TagRecord[];
}

export default function ContactsClient({ initialContacts, tags }: Props) {
  const [contacts, setContacts] = useState(initialContacts);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });
  const [importing, setImporting] = useState(false);

  const filtered = contacts.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    const matchTag =
      !selectedTag ||
      c.contactTags.some((ct) => ct.tag.name === selectedTag);
    return matchSearch && matchTag;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to add contact");
      }
      const created = await res.json();
      setContacts((prev) => [{ ...created, contactTags: [] }, ...prev]);
      setNewContact({ name: "", phone: "", email: "" });
      setShowAddModal(false);
      toast.success("Contact added successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast.success("Contact deleted");
  }

  async function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const rows = text.split("\n").slice(1).map((line) => {
        const parts = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
        return { name: parts[0], phone: parts[1], email: parts[2] };
      }).filter((r) => r.name && r.phone);
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const result = await res.json();
      toast.success(`Imported ${result.created} contacts (${result.skipped} skipped)`);
      // Refresh
      window.location.reload();
    } catch {
      toast.error("CSV import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contacts</h1>
          <p className="text-slate-500 mt-1">{contacts.length} contacts total</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 cursor-pointer transition-colors">
            <Upload size={15} />
            {importing ? "Importing..." : "Import CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} disabled={importing} />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all shadow-sm"
          >
            <Plus size={15} />
            Add Contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone..."
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
        <div className="relative">
          <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 appearance-none"
          >
            <option value="">All Tags</option>
            {tags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Phone</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden md:table-cell">Email</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3 hidden lg:table-cell">Tags</th>
              <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <Users size={32} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-400 text-sm">
                    {search || selectedTag ? "No contacts match your filters." : "No contacts yet. Add one or import a CSV."}
                  </p>
                </td>
              </tr>
            ) : filtered.map((contact) => (
              <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white text-sm">{contact.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                    <Phone size={13} className="text-slate-400" />
                    {contact.phone}
                  </div>
                </td>
                <td className="px-6 py-4 hidden md:table-cell">
                  {contact.email && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <Mail size={13} className="text-slate-400" />
                      {contact.email}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {contact.contactTags.map(({ tag }) => (
                      <span key={tag.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: tag.color + "20", color: tag.color }}>
                        <Tag size={10} />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleDelete(contact.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Contact Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5">Add Contact</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name *</label>
                <input value={newContact.name} onChange={(e) => setNewContact(p => ({ ...p, name: e.target.value }))} required placeholder="John Doe" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                <input value={newContact.phone} onChange={(e) => setNewContact(p => ({ ...p, phone: e.target.value }))} required placeholder="919876543210" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                <input value={newContact.email} onChange={(e) => setNewContact(p => ({ ...p, email: e.target.value }))} type="email" placeholder="john@example.com" className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                <button type="submit" disabled={adding} className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-60">
                  {adding ? "Adding..." : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
