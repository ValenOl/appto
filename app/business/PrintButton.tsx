'use client';

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="
        shrink-0 px-6 py-3
        text-[10px] font-black tracking-[0.25em] text-slate-500 uppercase
        border border-slate-200
        hover:border-slate-400 hover:text-slate-900
        transition-colors cursor-pointer
      "
    >
      [ IMPRIMIR DICTAMEN ]
    </button>
  );
}
