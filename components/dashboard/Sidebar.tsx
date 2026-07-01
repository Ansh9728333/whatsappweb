"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Megaphone,
  Key,
  Settings,
  BookOpen,
  ShieldCheck,
  BarChart3,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  Zap,
  LogOut,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/actions/auth";

interface NavItem {
  label: string;
  icon?: React.ElementType;
  href?: string;
  children?: NavItem[];
  adminOnly?: boolean;
}

const navConfig: { section: string; items: NavItem[]; adminOnly?: boolean }[] = [
  {
    section: "MAIN",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    section: "MESSAGING",
    items: [
      { label: "WhatsApp", icon: Phone, href: "/dashboard/whatsapp" },
      { label: "Contacts", icon: Users, href: "/dashboard/contacts" },
      { label: "Templates", icon: FileText, href: "/dashboard/templates" },
      { label: "Inbox", icon: MessageSquare, href: "/dashboard/inbox" },
      { label: "Campaigns", icon: Megaphone, href: "/dashboard/campaigns" },
    ],
  },
  {
    section: "DEVELOPER",
    items: [
      { label: "API Keys", icon: Key, href: "/dashboard/api-keys" },
      { label: "API Docs", icon: BookOpen, href: "/dashboard/docs/api" },
    ],
  },
  {
    section: "ACCOUNT",
    items: [
      { label: "Settings", icon: Settings, href: "/dashboard/settings" },
    ],
  },
  {
    section: "ADMIN",
    adminOnly: true,
    items: [
      { label: "Overview", icon: BarChart3, href: "/dashboard/admin", adminOnly: true },
      { label: "Customers", icon: ShieldCheck, href: "/dashboard/admin/customers", adminOnly: true },
      { label: "Plans", icon: FileText, href: "/dashboard/admin/plans", adminOnly: true },
    ],
  },
];

interface NavItemComponentProps {
  item: NavItem;
  depth?: number;
  pathname: string;
  isAdmin: boolean;
}

function NavItemComponent({ item, depth = 0, pathname, isAdmin }: NavItemComponentProps) {
  if (item.adminOnly && !isAdmin) return null;

  const isActive = item.href ? pathname === item.href : false;
  const hasChildren = item.children && item.children.length > 0;

  const isChildActive = (items: NavItem[]): boolean => {
    return items.some(
      (child) =>
        (child.href && pathname.startsWith(child.href)) ||
        (child.children && isChildActive(child.children))
    );
  };

  const [expanded, setExpanded] = useState(
    hasChildren ? isChildActive(item.children!) : false
  );

  const Icon = item.icon;
  const paddingLeft = depth === 0 ? "pl-3" : "pl-8";

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "w-full flex items-center justify-between py-2 pr-3 text-sm transition-all duration-200 rounded-lg",
            paddingLeft,
            "text-emerald-100/70 hover:text-white hover:bg-white/10",
            isChildActive(item.children!) && "text-white"
          )}
        >
          <span className="flex items-center gap-2.5">
            {Icon && <Icon size={16} className="flex-shrink-0" />}
            <span className="font-medium">{item.label}</span>
          </span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {expanded && (
          <div className="mt-0.5">
            {item.children!.map((child) => (
              <NavItemComponent key={child.label} item={child} depth={depth + 1} pathname={pathname} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.href) {
    const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 py-2 pr-3 text-sm font-medium transition-all duration-200 rounded-lg",
          paddingLeft,
          active
            ? "bg-white/15 text-white shadow-sm"
            : "text-emerald-100/70 hover:text-white hover:bg-white/10"
        )}
      >
        {Icon && <Icon size={16} className="flex-shrink-0" />}
        <span>{item.label}</span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
      </Link>
    );
  }

  return null;
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  isAdmin?: boolean;
}

export default function Sidebar({ mobileOpen, onMobileClose, isAdmin = false }: SidebarProps) {
  const pathname = usePathname();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-teal-700 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg tracking-wider block leading-none">WhatsApp System</span>
            <span className="text-emerald-400/60 text-[10px] tracking-wider">Business Platform</span>
          </div>
        </div>
        <button onClick={onMobileClose} className="lg:hidden text-emerald-200 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1 scrollbar-thin">
        {navConfig.map(({ section, items, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <div key={section} className="mb-3">
              <p className="px-3 py-1 text-[10px] font-bold text-emerald-300/50 tracking-[0.15em] uppercase">
                {section}
              </p>
              <div className="space-y-0.5 mt-1">
                {items.map((item) => (
                  <NavItemComponent key={item.label} item={item} pathname={pathname} isAdmin={isAdmin} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-2 px-3 text-emerald-300/50 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>All systems operational</span>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-emerald-100/60 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-200"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex flex-col fixed left-0 top-0 h-screen z-30"
        style={{ width: "260px", background: "linear-gradient(180deg, #00635d 0%, #004d49 100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex" onClick={onMobileClose}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="relative z-50 flex flex-col h-screen w-[260px] shadow-2xl"
            style={{ background: "linear-gradient(180deg, #00635d 0%, #004d49 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="lg:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <Menu size={20} />
    </button>
  );
}
