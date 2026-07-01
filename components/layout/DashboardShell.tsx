"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Topbar from "@/components/dashboard/Topbar";

export default function DashboardLayout({
  children,
  isAdmin = false,
}: {
  children: React.ReactNode;
  isAdmin?: boolean;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      if (!prev) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return !prev;
    });
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans">
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
          isAdmin={isAdmin}
        />
        <div className="lg:ml-[260px] flex flex-col min-h-screen">
          <Topbar
            onMobileMenuOpen={() => setMobileSidebarOpen(true)}
            darkMode={darkMode}
            onDarkModeToggle={toggleDarkMode}
          />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
