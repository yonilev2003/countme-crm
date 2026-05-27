"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  GanttChart,
  FolderOpen,
  Database,
  MessageSquare,
  Calendar,
  HelpCircle,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/people", label: "אנשים", icon: Users },
  { href: "/tasks", label: "משימות", icon: CheckSquare },
  { href: "/gantt", label: "גאנט", icon: GanttChart },
  { href: "/documents", label: "מסמכים", icon: FolderOpen },
  { href: "/datasets", label: "דאטה", icon: Database },
  { href: "/chat", label: "צ׳אט", icon: MessageSquare },
  { href: "/calendar", label: "יומן", icon: Calendar },
  { href: "/help", label: "עזרה", icon: HelpCircle },
] as const;

export const ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { href: "/admin/users", label: "ניהול משתמשים", icon: ShieldCheck },
] as const;

function NavBody({
  pathname,
  isAdmin,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center border-b border-slate-200 px-6">
        <Link
          href="/tasks"
          className="flex items-center gap-2.5"
          onClick={onNavigate}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
              onClick={onNavigate}
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

        {isAdmin && (
          <>
            <div className="my-1 border-t border-slate-100" />
            {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
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
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3 text-xs text-slate-500">
        הנהלת CountMe • Beta
      </div>
    </>
  );
}

export function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-s border-slate-200 bg-white md:flex md:flex-col">
      <NavBody pathname={pathname} isAdmin={isAdmin} />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed top-0 z-50 flex h-full w-72 flex-col border-s border-slate-200 bg-white shadow-2xl transition-transform md:hidden",
          open ? "translate-x-0" : "translate-x-full",
        )}
        style={{ insetInlineStart: 0 }}
        role="dialog"
        aria-modal="true"
        aria-label="תפריט ניווט"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          aria-label="סגור תפריט"
        >
          <X className="h-5 w-5" />
        </button>
        <NavBody pathname={pathname} isAdmin={isAdmin} onNavigate={onClose} />
      </aside>
    </>
  );
}
