/**
 * printService.ts
 * Dedicated service for A4 PDF Document printing & preview generation.
 */

export function triggerNotePrint(noteEl: HTMLElement, activeThemeId: string): void {
  if (!noteEl) return;

  const isInsideSidePanel = window.self !== window.top || window.location.hash.includes('sidepanel');

  if (isInsideSidePanel) {
    let printIframe = document.getElementById('note-print-iframe') as HTMLIFrameElement;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'note-print-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);
    }

    const doc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(generatePrintDocumentHtml(noteEl.innerHTML, activeThemeId));
      doc.close();

      setTimeout(() => {
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
        } catch (err) {
          console.error('Iframe print error:', err);
        }
      }, 500);
    }
  } else {
    const printWindow = window.open('', '_blank', 'width=1000,height=900,menubar=no,toolbar=no,location=no,status=no');
    if (!printWindow) {
      window.print();
      return;
    }

    const html = generatePrintDocumentHtml(noteEl.innerHTML, activeThemeId, true);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    const doPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (err) {
        console.error('Print trigger failed:', err);
      }
    };

    setTimeout(() => {
      const topPrintBtn = printWindow.document.getElementById('top-print-btn');
      const floatingPrintBtn = printWindow.document.getElementById('floating-print-btn');
      const topCloseBtn = printWindow.document.getElementById('top-close-btn');

      if (topPrintBtn) topPrintBtn.onclick = doPrint;
      if (floatingPrintBtn) floatingPrintBtn.onclick = doPrint;
      if (topCloseBtn) topCloseBtn.onclick = () => printWindow.close();

      doPrint();
    }, 450);
  }
}

export function generatePrintDocumentHtml(
  contentHtml: string,
  activeThemeId: string,
  includeActionBars = false
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouTube Notes - Document View</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=DM+Mono:ital,wght@0,400;0,500;1,400&family=Inter:wght@400;500;600;700&family=Manrope:wght@600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,600;0,6..72,700;1,6..72,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <style>
    :root {
      --note-primary: #78350f;
      --note-secondary: #f59e0b;
      --note-accent: #b45309;
      --note-banner-bg: #78350f;
      --note-underline: #fde68a;
    }
    body.theme-cobalt {
      --note-primary: #1e3a8a;
      --note-secondary: #3b82f6;
      --note-accent: #1d4ed8;
      --note-banner-bg: #1e3a8a;
      --note-underline: #bfdbfe;
    }
    body.theme-emerald {
      --note-primary: #14532d;
      --note-secondary: #10b981;
      --note-accent: #047857;
      --note-banner-bg: #14532d;
      --note-underline: #a7f3d0;
    }
    body.theme-coral {
      --note-primary: #7c2d12;
      --note-secondary: #f97316;
      --note-accent: #c2410c;
      --note-banner-bg: #7c2d12;
      --note-underline: #fed7aa;
    }
    body.theme-violet {
      --note-primary: #6a1b9a;
      --note-secondary: #a855f7;
      --note-accent: #7e22ce;
      --note-banner-bg: #6a1b9a;
      --note-underline: #f3e8ff;
    }

    * { box-sizing: border-box; }
    body {
      font-family: 'Crimson Pro', Georgia, serif;
      font-size: 15.5px;
      line-height: 1.68;
      color: #1a1a1a;
      background: #f1f5f9;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 99999;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 16px rgba(0,0,0,0.25);
      font-family: 'Inter', system-ui, sans-serif;
    }
    .print-action-btn {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13.5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .close-action-btn {
      background: #1e293b;
      color: #cbd5e1;
      border: 1px solid #334155;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .floating-print-action-btn {
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 999999;
      background: #0f172a;
      color: #ffffff;
      border: 2px solid #f59e0b;
      padding: 12px 20px;
      border-radius: 50px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }
    .note-content {
      width: 100% !important;
      max-width: 210mm !important;
      margin: 24px auto !important;
      background: #ffffff !important;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08) !important;
      border: 1px solid #e2e8f0 !important;
      padding: 36px 40px !important;
      border-radius: 12px !important;
      box-sizing: border-box !important;
    }
    .note-cover {
      text-align: center;
      padding: 40px 20px 30px;
      border-bottom: 2px solid var(--note-secondary);
      margin-bottom: 30px;
    }
    .note-cover h1 {
      font-family: 'Cinzel', serif;
      font-size: 28px;
      color: var(--note-primary);
      margin: 0 0 10px;
    }
    .note-cover .subtitle {
      font-size: 15px;
      color: #475569;
      margin: 0 0 8px;
    }
    .note-cover .description {
      font-size: 13.5px;
      color: #64748b;
      max-width: 650px;
      margin: 0 auto 16px;
    }
    .note-cover .badge-pill {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 12px;
      background: #f1f5f9;
      color: var(--note-primary);
      border-radius: 50px;
      border: 1px solid var(--note-underline);
    }
    .note-content h2 {
      color: #ffffff;
      background: var(--note-banner-bg);
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 18px;
      margin-top: 28px;
      margin-bottom: 14px;
    }
    .note-content h3 {
      color: var(--note-primary);
      border-bottom: 2px solid var(--note-underline);
      padding-bottom: 4px;
      font-size: 16px;
      margin-top: 20px;
    }
    .callout {
      border-left: 4px solid var(--note-secondary);
      background: #f8fafc;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 8px 8px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 18px 0;
      font-size: 14px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #0f172a;
    }
    pre {
      background: #1e293b;
      color: #f8fafc;
      padding: 14px 16px;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'DM Mono', monospace;
      font-size: 13px;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      margin: 20px auto;
    }

    @media print {
      body { background: #ffffff !important; }
      .no-print, .print-bar, .floating-print-action-btn { display: none !important; }
      .note-content {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        border: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
    }
  </style>
</head>
<body class="theme-${activeThemeId || 'amber'}">
  ${includeActionBars ? `
  <div class="print-bar no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-weight: 800; font-size: 16px; color: #ffffff;">📄 YouTube Notes</span>
      <span style="font-size: 12px; color: #94a3b8; background: #1e293b; padding: 3px 10px; border-radius: 6px;">A4 Document Ready</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px;">
      <button class="print-action-btn" id="top-print-btn">🖨️ Print / Save as PDF</button>
      <button class="close-action-btn" id="top-close-btn">✕ Close</button>
    </div>
  </div>
  <button class="floating-print-action-btn no-print" id="floating-print-btn">🖨️ Print / Save as PDF</button>
  ` : ''}

  <div class="note-content">
    ${contentHtml}
  </div>
</body>
</html>`;
}
