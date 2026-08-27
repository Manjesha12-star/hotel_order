export function printDocument(title: string, bodyHtml: string) {
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>
    *{box-sizing:border-box}
    body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;padding:16px;color:#111;font-size:13px}
    h1{font-size:16px;margin:0 0 2px;text-align:center;letter-spacing:.08em}
    .sub{text-align:center;font-size:11px;margin-bottom:10px}
    hr{border:none;border-top:1px dashed #999;margin:8px 0}
    table{width:100%;border-collapse:collapse}
    td{padding:2px 0;vertical-align:top}
    td.q{width:34px}
    td.p{text-align:right;white-space:nowrap}
    .tot{font-weight:700;font-size:15px}
    .note{font-style:italic;font-size:11px;color:#444}
    .foot{text-align:center;margin-top:12px;font-size:11px}
  </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
