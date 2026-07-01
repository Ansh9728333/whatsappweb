"use client";

import { useState, useEffect } from "react";
import {
  Moon,
  Sun,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Building2,
  Zap,
} from "lucide-react";
import { MobileMenuButton } from "./Sidebar";
import { logoutAction } from "@/app/actions/auth";
import Link from "next/link";

interface TopbarProps {
  onMobileMenuOpen: () => void;
  darkMode: boolean;
  onDarkModeToggle: () => void;
}

type ProfileData = {
  user: { name: string; email: string; role: string };
  customer?: { businessName: string; messagesUsed: number } | null;
};

export default function Topbar({
  onMobileMenuOpen,
  darkMode,
  onDarkModeToggle,
}: TopbarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetch("/api/settings/profile")
      .then((r) => r.json())
      .then((res) => {
        if (res.user) setData(res);
      })
      .catch(console.error);
  }, []);

  const name = data?.user?.name ?? "User";
  const email = data?.user?.email ?? "";
  const role = data?.user?.role ?? "CUSTOMER";
  const businessName = data?.customer?.businessName ?? "Whatsify Business";
  const messagesUsed = data?.customer?.messagesUsed ?? 0;

  return (
    <header className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Mobile menu + Greeting */}
        <div className="flex items-center gap-4">
          <MobileMenuButton onClick={onMobileMenuOpen} />
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Hello, {name} 👋
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Here&apos;s what&apos;s happening today.
            </p>
          </div>
        </div>

        {/* Right: Wallet/Usage + Business + Dark mode + Profile */}
        <div className="flex items-center gap-3">
          {/* Messages Usage Counter */}
          {role === "CUSTOMER" && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5">
              <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">
                Usage
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {messagesUsed.toLocaleString()} msgs
              </span>
            </div>
          )}

          {/* Business Name */}
          {role === "CUSTOMER" && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Building2 size={13} className="text-slate-400" />
              <span className="font-semibold max-w-[180px] truncate">
                {businessName}
              </span>
            </div>
          )}

          {/* Dark Mode Toggle */}
          <button
            onClick={onDarkModeToggle}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-all duration-200"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850 transition-all duration-200"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-xs font-semibold text-slate-950 dark:text-white leading-none">
                  {name}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5 capitalize">
                  {role.toLowerCase()}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 transition-transform duration-200 ${
                  profileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white">
                      {name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {email}
                    </p>
                  </div>
                  {role === "CUSTOMER" && (
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User size={14} />
                      My Profile
                    </Link>
                  )}
                  {role === "CUSTOMER" && (
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings size={14} />
                      Settings
                    </Link>
                  )}
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors text-left"
                      >
                        <LogOut size={14} />
                        Sign Out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
