'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface SearchFormProps {
  defaultCuit?:    string
  defaultGarante?: string
  defaultIncome?:  string
  queriesUsed:     number
  monthlyQuota:    number
}

export function SearchForm({
  defaultCuit    = '',
  defaultGarante = '',
  defaultIncome  = '',
  queriesUsed,
  monthlyQuota,
}: SearchFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const quotaRemaining = Math.max(0, monthlyQuota - queriesUsed)
  const quotaPercent   = monthlyQuota > 0
    ? Math.min(100, Math.round((queriesUsed / monthlyQuota) * 100))
    : 0
  const quotaCritical  = quotaPercent >= 80

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd      = new FormData(e.currentTarget)
    const params  = new URLSearchParams()
    const cuit    = (fd.get('cuit')    as string).replace(/\D/g, '')
    const garante = (fd.get('garante') as string).replace(/\D/g, '')
    const income  = (fd.get('income')  as string).replace(/\D/g, '')
    if (cuit)    params.set('cuit',    cuit)
    if (garante) params.set('garante', garante)
    if (income)  params.set('income',  income)
    startTransition(() => {
      router.push(`/business?${params.toString()}`)
    })
  }

  return (
    <form
      id="search-form"
      onSubmit={handleSubmit}
      className="relative bg-white border border-slate-200 rounded-2xl overflow-hidden"
    >
      {/* Loading bar — top of card */}
      <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden">
        {isPending && (
          <div
            className="h-full animate-pulse"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          />
        )}
      </div>

      <div className="px-8 py-7 flex flex-col gap-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="cuit-input"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              TITULAR
            </label>
            <input
              id="cuit-input"
              type="text"
              name="cuit"
              defaultValue={defaultCuit}
              disabled={isPending}
              placeholder="DNI o CUIL sin guiones"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                disabled:opacity-40
                transition-colors
              "
            />
            <p className="text-xs font-light text-slate-400 tracking-wide">
              DNI o CUIL sin guiones.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="garante-input"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              GARANTE <span className="font-light normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id="garante-input"
              type="text"
              name="garante"
              defaultValue={defaultGarante}
              disabled={isPending}
              placeholder="DNI o CUIL sin guiones"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                disabled:opacity-40
                transition-colors
              "
            />
            <p className="text-xs font-light text-slate-400 tracking-wide">
              Co-firmante o avalista de la operación.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="income-input"
              className="text-[10px] font-black tracking-[0.35em] text-slate-400 uppercase"
            >
              INGRESO MENSUAL <span className="font-light normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id="income-input"
              type="number"
              name="income"
              min="0"
              defaultValue={defaultIncome}
              disabled={isPending}
              placeholder="ARS"
              className="
                w-full text-2xl font-light text-slate-800 bg-transparent
                border-0 border-b-2 border-slate-200
                py-3 px-0
                placeholder:text-slate-300
                focus:outline-none focus:border-slate-700
                disabled:opacity-40
                transition-colors
              "
            />
            <p className="text-xs font-light text-slate-400 tracking-wide">
              Para calcular ratio deuda / ingreso.
            </p>
          </div>
        </div>

        {/* Footer row: quota + submit */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">

          {/* Quota indicator */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span
                className="text-[10px] font-black tracking-[0.2em] uppercase"
                style={quotaCritical ? { color: '#dc2626' } : { color: '#94a3b8' }}
              >
                {quotaRemaining} AUDITORÍAS DISPONIBLES
              </span>
              <span
                className="text-[9px] font-light tracking-widest text-slate-300"
                style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
              >
                {queriesUsed} / {monthlyQuota}
              </span>
            </div>
            <div className="w-48 h-0.5 bg-slate-100">
              <div
                className="h-0.5 transition-all duration-500"
                style={{
                  width:           `${quotaPercent}%`,
                  backgroundColor: quotaCritical ? '#dc2626' : 'var(--color-secondary)',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="
              shrink-0 px-10 py-4 rounded-xl
              text-[11px] font-black tracking-[0.25em] text-white
              hover:opacity-90 active:opacity-80
              disabled:opacity-60 disabled:cursor-not-allowed
              transition-opacity cursor-pointer
            "
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            {isPending ? 'CONSULTANDO...' : 'CONSULTAR'}
          </button>
        </div>
      </div>
    </form>
  )
}
