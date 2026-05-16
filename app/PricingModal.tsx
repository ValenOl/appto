'use client'

import { useState, useEffect, useCallback } from 'react'

const PLANS = [
  {
    key:      'BASICO',
    label:    'BÁSICO',
    price:    '$ 34.900',
    queries:  '30 consultas / mes',
    accent:   false,
    features: [
      'Score BCRA + ΛPPTO',
      'Dictamen formal imprimible',
      'Historial de auditorías',
      'Soporte vía email',
    ],
    href: '/register?plan=BASICO',
    cta:  '[ ELEGIR BÁSICO ]',
  },
  {
    key:      'PRO',
    label:    'PRO',
    price:    '$ 89.900',
    queries:  '150 consultas / mes',
    accent:   true,
    features: [
      'Score BCRA + ΛPPTO',
      'Dictamen formal imprimible',
      'Historial de auditorías',
      'Red de garantías detectadas',
      'Soporte prioritario',
    ],
    href: '/register?plan=PRO',
    cta:  '[ ELEGIR PRO ]',
  },
  {
    key:      'ENTERPRISE',
    label:    'ENTERPRISE',
    price:    '$ 219.000',
    queries:  '500 consultas / mes',
    accent:   false,
    features: [
      'Score BCRA + ΛPPTO',
      'Dictamen formal imprimible',
      'Historial de auditorías',
      'Red de garantías detectadas',
      'Soporte prioritario',
      'Factura a nombre de empresa',
    ],
    href: '/register?plan=ENTERPRISE',
    cta:  '[ ELEGIR ENTERPRISE ]',
  },
]

export function PricingModal() {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, close])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-black tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
      >
        VER PLANES
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          style={{ backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={close}
        >
          <div
            className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col"
            style={{ fontFamily: 'var(--font-geist-sans), Arial, sans-serif' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black tracking-[0.4em] text-slate-400 uppercase">
                  ΛPPTO BUSINESS
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  PLANES CORPORATIVOS
                </h2>
              </div>
              <button
                onClick={close}
                className="text-[10px] font-black tracking-[0.25em] text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
              >
                [ CERRAR ]
              </button>
            </div>

            {/* Plans */}
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-5">
              {PLANS.map((plan) => (
                <div
                  key={plan.key}
                  className="flex flex-col gap-6 p-8"
                  style={
                    plan.accent
                      ? { border: '2px solid var(--color-secondary)' }
                      : { border: '1px solid #e2e8f0' }
                  }
                >
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[9px] font-black tracking-[0.4em] uppercase"
                      style={plan.accent ? { color: 'var(--color-secondary)' } : { color: '#94a3b8' }}
                    >
                      PLAN
                    </span>
                    <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {plan.label}
                    </span>
                    <span
                      className="text-[10px] font-black tracking-[0.2em] text-slate-400 mt-1"
                      style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                    >
                      {plan.queries}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="text-[11px] font-light text-slate-500 tracking-wide"
                        style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                      >
                        — {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex flex-col gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-3xl font-black text-slate-900 tracking-tight leading-none">
                        {plan.price}
                      </span>
                      <span className="text-[10px] font-light text-slate-400 tracking-wide">
                        ARS · ciclo mensual
                      </span>
                    </div>
                    <a
                      href={plan.href}
                      className="block w-full text-center py-3 text-[10px] font-black tracking-[0.25em] uppercase transition-colors"
                      style={
                        plan.accent
                          ? { backgroundColor: 'var(--color-secondary)', color: '#fff' }
                          : { border: '1px solid #e2e8f0', color: '#475569' }
                      }
                    >
                      {plan.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="px-8 py-5 border-t border-slate-100 shrink-0">
              <p className="text-[10px] font-light text-slate-400 leading-relaxed">
                Sin permanencia. Excedente a $1.500 ARS / consulta adicional. La activación queda sujeta a confirmación del pago.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
