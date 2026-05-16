"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GanttChart,
  FolderOpen,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/people", label: "אנשים", icon: Users },
  { href: "/tasks", label: "משימות", icon: CheckSquare },
  { href: "/gantt", label: "גאנט", icon: GanttChart },
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/chat", label: "צ׳אט", icon: MessageSquare },
  { href: "/calendar", label: "יומן", icon: Calendar },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-s border-slate-200 bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center px-6 border-b border-slate-200">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/countme-logo.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-slate-900">
            הנהלת CountMe
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-700 hover:bg-slate-100",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
        הנהלת CountMe • Beta
      </div>
    </aside>
  );
}
