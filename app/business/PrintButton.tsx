'use client';

export function PrintButton() {
  function handlePrint() {
    document.body.classList.add('print-dictamen-only');
    window.print();
    // afterprint fires when the dialog closes (print or cancel)
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('print-dictamen-only');
    }, { once: true });
  }

  return (
    <button
      onClick={handlePrint}
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
