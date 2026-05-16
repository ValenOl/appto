"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile top bar — visible only below md breakpoint */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-50 flex items-center justify-between px-4"
        style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
      >
        <span className="text-sm font-black tracking-tight text-slate-900">ΛPPTO</span>
        <button
          onClick={() => setOpen(o => !o)}
          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors text-2xl leading-none cursor-pointer"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          {open ? "×" : "≡"}
        </button>
      </div>

      {/* Backdrop — mobile only, behind drawer */}
      {open && (
        <div
          className="md:hidden fixed inset-0 top-14 bg-slate-900/30 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-14 md:top-0 left-0 bottom-0 z-40
          w-60 border-r border-slate-200 bg-white flex flex-col
          transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
      >
        {/* Brand — desktop only (mobile has top bar) */}
        <div className="hidden md:flex flex-col px-7 py-7 border-b border-slate-100 gap-1">
          <span className="text-sm font-black tracking-tight text-slate-900">ΛPPTO</span>
          <p
            className="text-[9px] font-light text-slate-400 tracking-[0.25em] uppercase truncate"
            style={{ fontFamily: "var(--font-geist-mono), monospace" }}
          >
            {companyName}
          </p>
        </div>

        {/* Company name — mobile drawer header */}
        <div className="md:hidden px-5 py-4 border-b border-slate-100">
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
    </>
  );
}
