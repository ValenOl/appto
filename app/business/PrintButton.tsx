'use client';

export function PrintButton() {
  function handlePrint() {
    const el = document.getElementById('dictamen-formal');
    if (!el) return;

    const win = window.open('', '_blank');
    if (!win) return;

    // Copy all <style> and <link rel="stylesheet"> from the current page so
    // Tailwind classes and CSS custom properties resolve correctly.
    const headStyles = Array.from(
      document.head.querySelectorAll<HTMLElement>('style, link[rel="stylesheet"]')
    ).map(n => n.outerHTML).join('\n');

    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  ${headStyles}
  <style>
    /* margin:0 removes Chrome's URL/page-number header+footer area */
    @page { margin: 0; size: A4 portrait; }
    body  { padding: 1.5cm; margin: 0; background: white; }
    button { display: none !important; }
  </style>
</head>
<body>
  ${el.outerHTML}
  <script>
    window.onload = function () {
      window.print();
      window.addEventListener('afterprint', function () { window.close(); });
    };
  <\/script>
</body>
</html>`);

    win.document.close();
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
