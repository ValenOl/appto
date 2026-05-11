"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const NAV_ITEMS = [
  { label: "NUEVA AUDITORÍA",        href: "/business" },
  { label: "HISTORIAL DE CONSULTAS", href: "/business/history" },
  { label: "CONFIGURACIÓN",          href: "/business/settings" },
] as const;

interface SidebarProps {
  companyName: string;
}

export default function Sidebar({ companyName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 shrink-0 min-h-screen border-r border-slate-200 bg-white flex flex-col"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      {/* Brand */}
      <div className="px-7 py-7 border-b border-slate-100 flex flex-col gap-1">
        <span className="text-sm font-black tracking-tight text-slate-900">ΛPPTO</span>
        <p
          className="text-[9px] font-light text-slate-400 tracking-[0.25em] uppercase truncate"
          style={{ fontFamily: "var(--font-geist-mono), monospace" }}
        >
          {companyName}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col px-3 py-5 flex-1 gap-0.5">
        {NAV_ITEMS.map(({ label, href }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`
                px-4 py-3 text-[11px] font-black tracking-[0.2em] transition-colors rounded-sm
                ${isActive
                  ? "text-slate-900 bg-slate-100"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }
              `}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-6 border-t border-slate-100">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left px-4 py-3 text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer rounded-sm hover:bg-slate-50"
          >
            [ CERRAR SESIÓN ]
          </button>
        </form>
      </div>
    </aside>
  );
}
