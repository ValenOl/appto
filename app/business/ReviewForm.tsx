'use client'

import { useActionState } from 'react'
import { saveReview } from '@/app/actions/reviews'
import type { ReviewState } from '@/app/actions/reviews'

export function ReviewForm({
  profileId,
}: {
  profileId: string
}) {
  const [state, action, isPending] = useActionState<ReviewState, FormData>(saveReview, null)

  if (state && 'ok' in state) {
    return (
      <div className="px-10 py-6 border-t border-slate-100">
        <p className="text-[10px] font-black tracking-[0.25em] text-green-600 uppercase">
          Evaluación publicada — tu aporte está en la red.
        </p>
      </div>
    )
  }

  return (
    <div className="px-10 py-7 border-t border-slate-100">
      <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase mb-5">
        DEJAR EVALUACIÓN
      </p>
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="profile_id" value={profileId} />

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">
            Calificación
          </label>
          <select
            name="rating"
            required
            disabled={isPending}
            className="w-48 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-light text-slate-700 bg-white focus:outline-none focus:border-slate-500 transition-colors cursor-pointer disabled:opacity-50"
          >
            <option value="">Seleccioná...</option>
            <option value="5">5 ★ — Excelente</option>
            <option value="4">4 ★ — Bueno</option>
            <option value="3">3 ★ — Regular</option>
            <option value="2">2 ★ — Malo</option>
            <option value="1">1 ★ — Muy malo</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black tracking-[0.25em] text-slate-400 uppercase">
            Comentario{' '}
            <span className="font-light normal-case tracking-normal">(opcional)</span>
          </label>
          <textarea
            name="comment"
            rows={3}
            disabled={isPending}
            placeholder="Describí tu experiencia con este perfil..."
            className="w-full bg-transparent border border-slate-200 px-4 py-3 text-sm font-light text-slate-700 placeholder:text-slate-300 focus:outline-none focus:border-slate-500 resize-none transition-colors disabled:opacity-50"
          />
        </div>

        {state && 'error' in state && (
          <p className="text-xs font-light text-red-600 border border-red-100 bg-red-50 px-4 py-3 rounded-lg">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="self-start px-8 py-3 text-[11px] font-black tracking-[0.2em] text-white hover:opacity-90 active:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          {isPending ? 'ENVIANDO...' : 'PUBLICAR EVALUACIÓN'}
        </button>
      </form>
    </div>
  )
}
