"use client";

import { useState } from "react";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}>

      {/* ── HEADER ── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="text-xl font-black tracking-tight text-slate-900 select-none">
            ΛPPTO
          </span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-10">
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              Consulta B2B
            </a>
            <a href="#" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              Mi Perfil
            </a>
          </nav>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden text-xs font-black tracking-[0.2em] text-slate-700 hover:text-slate-900 transition-colors"
          >
            {menuOpen ? "CERRAR" : "MENÚ"}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white">
            <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col gap-5">
              <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Consulta B2B
              </a>
              <a href="#" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                Mi Perfil
              </a>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="pt-36 pb-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left column */}
          <div className="flex flex-col gap-8">
            <span className="text-xs font-bold tracking-[0.3em] text-slate-400 uppercase">
              [ SEGURIDAD INSTITUCIONAL ]
            </span>

            <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight text-slate-900">
              Consultá el Riesgo Crediticio al Instante
            </h1>

            <p className="text-lg text-slate-500 leading-relaxed max-w-md">
              Accedé a la información financiera consolidada de personas físicas y
              jurídicas en tiempo real. Tomá decisiones respaldadas por datos
              verificados.
            </p>

            <div className="flex flex-col gap-3 pt-2">
              <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
                ENTIDADES INTEGRADAS
              </span>
              <div className="flex items-center gap-5">
                <span className="text-sm font-bold text-slate-400">BCRA</span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="text-sm font-bold text-slate-400">AFIP</span>
                <span className="w-px h-4 bg-slate-200" />
                <span className="text-sm font-bold text-slate-400">Nosis</span>
              </div>
            </div>
          </div>

          {/* Right column — floating card */}
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-10 flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <label className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">
                CUIT / CUIL
              </label>
              <input
                type="text"
                placeholder="20-12345678-9"
                className="
                  w-full text-3xl font-light text-slate-800 bg-transparent
                  border-0 border-b-2 border-slate-200
                  py-4 px-0
                  placeholder:text-slate-300
                  focus:outline-none focus:border-slate-800
                  transition-colors
                "
              />
            </div>

            <button
              className="
                w-full py-4 px-6 rounded-2xl
                font-bold text-white text-sm tracking-wide
                transition-opacity hover:opacity-90 active:opacity-80
                cursor-pointer
              "
              style={{ backgroundColor: "var(--color-secondary)" }}
            >
              Ejecutar Consulta de Riesgo
            </button>

            <div className="bg-slate-50 rounded-2xl px-5 py-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="font-black text-slate-600">[ i ]</span>
                {" "}Toda la información transmitida está cifrada con TLS 1.3 y
                procesada en servidores de uso exclusivo. No almacenamos datos
                sensibles sin consentimiento explícito del titular.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">

          <div className="mb-14 flex flex-col gap-3">
            <span className="text-[10px] font-black tracking-[0.35em] text-slate-300 uppercase">
              POR QUÉ ΛPPTO
            </span>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Decisiones más rápidas. Menos riesgo.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 01 */}
            <div className="bg-white rounded-3xl p-10 flex flex-col gap-8 border border-slate-100 hover:border-slate-200 transition-colors">
              <span
                className="text-9xl font-black leading-none select-none text-slate-100"
                aria-hidden="true"
              >
                01
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Aprobación en Segundos
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Resultados consolidados en menos de 3 segundos. Sin esperas, sin
                  procesos manuales ni intermediarios.
                </p>
              </div>
            </div>

            {/* 02 */}
            <div className="bg-white rounded-3xl p-10 flex flex-col gap-8 border border-slate-100 hover:border-slate-200 transition-colors">
              <span
                className="text-9xl font-black leading-none select-none text-slate-100"
                aria-hidden="true"
              >
                02
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Análisis de Vínculos Familiares
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Detectamos relaciones patrimoniales y familiares asociadas al CUIT
                  consultado para una visión completa del riesgo.
                </p>
              </div>
            </div>

            {/* 03 */}
            <div className="bg-white rounded-3xl p-10 flex flex-col gap-8 border border-slate-100 hover:border-slate-200 transition-colors">
              <span
                className="text-9xl font-black leading-none select-none text-slate-100"
                aria-hidden="true"
              >
                03
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Score Social Colaborativo
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Un índice construido con datos transaccionales reales, reportes de
                  la red y comportamiento histórico verificado.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3">
          <span className="text-sm font-black text-slate-900">ΛPPTO</span>
          <p className="text-xs text-slate-400">
            © 2026 APPTO. Todos los derechos reservados.
          </p>
        </div>
      </footer>

    </div>
  );
}
