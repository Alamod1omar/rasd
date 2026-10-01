import { api } from '@/lib/api';
import { SalesRequest, ShortageRequest } from '@/types';

const SAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39" width="11" height="11" fill="currentColor" style="display:inline-block; vertical-align:-0.14em; margin-right:3px;"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z" /><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z" /></svg>`;

function formatPrintDate(d: string | Date | undefined): string {
  if (!d) return '-';
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function printHtml(htmlContent: string) {
  try {
    let iframe = document.getElementById('rasd-print-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'rasd-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();
      setTimeout(() => {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      }, 300);
      return;
    }
  } catch (err) {
    console.warn('Iframe print failed, falling back to window popup', err);
  }

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  }
}

export function generateSalesPrintHtml(request: SalesRequest, canViewAmounts: boolean = true): string {
  const items = request.items || [];
  const totalItems = items.length;
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);
  const totalAmount = items.reduce(
    (sum, it) => sum + Number(it.quantity || 0) * Number(it.unitPrice || 0),
    0
  );

  const rows = items
    .map((it, idx) => {
      const qty = Number(it.quantity || 0);
      const price = Number(it.unitPrice || 0);
      const lineTotal = qty * price;
      return `
      <tr class="border-b">
        <td class="text-center font-mono py-1.5 px-1.5 border-l">${idx + 1}</td>
        <td class="text-center font-mono font-bold py-1.5 px-1.5 border-l" dir="ltr">${it.partNumberSnapshot || ''}</td>
        <td class="text-right py-1.5 px-2 border-l">${it.partNameSnapshot || ''}</td>
        <td class="text-center font-bold py-1.5 px-1.5 border-l">${it.brandSnapshot || ''}</td>
        <td class="text-center font-mono font-bold py-1.5 px-1.5 border-l">${qty}</td>
        ${canViewAmounts ? `
        <td class="text-center font-mono py-1.5 px-1.5 border-l">
          <span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">
            <span>${price.toFixed(2)}</span>
            ${SAR_SVG}
          </span>
        </td>
        <td class="text-center font-mono font-bold py-1.5 px-1.5 border-l">
          <span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">
            <span>${lineTotal.toFixed(2)}</span>
            ${SAR_SVG}
          </span>
        </td>` : ''}
        <td class="text-right py-1.5 px-2 border-l">${it.soldTo || 'عميل نقدي'}</td>
        <td class="text-right py-1.5 px-2">${it.createdByFullName || '—'}</td>
      </tr>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>طلب بيع - ${request.documentNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      direction: rtl;
    }
    .container {
      width: 100%;
      max-width: 100%;
    }
    .header-title {
      text-align: center;
      margin: 0 0 6px 0;
      padding: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }
    .divider {
      border-bottom: 1px solid #cbd5e1;
      margin: 6px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 4px;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-top: 6px;
      font-size: 10.5px;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      padding: 6px 4px;
      border-bottom: 1px solid #cbd5e1;
      border-left: 1px solid #cbd5e1;
      text-align: center;
    }
    th:last-child {
      border-left: none;
    }
    td {
      padding: 5px 4px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    td:last-child {
      border-left: none;
    }
    tr {
      page-break-inside: avoid;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 700; }
    tfoot td {
      background-color: #f8fafc;
      border-top: 2px solid #94a3b8;
      font-weight: 800;
      padding: 7px 10px;
    }
    .tfoot-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="header-title">كشف المنتجات المباعة بغير فاتورة</h1>
    <div class="divider"></div>

    <div class="meta-row">
      <div>
        <span class="font-bold">رقم الطلب: </span>
        <span class="font-mono font-bold" dir="ltr">${request.documentNumber}</span>
      </div>
      <div>
        <span class="font-bold">التاريخ: </span>
        <span class="font-mono">${formatPrintDate(request.businessDate)}</span>
      </div>
      <div>
        <span class="font-bold">الفرع: </span>
        <span>${request.branchName || 'الرئيسي'}</span>
      </div>
    </div>
    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          ${canViewAmounts ? `
          <th style="width: 4%;">م</th>
          <th style="width: 15%;">رقم القطعة</th>
          <th style="width: 21%; text-align: right;">اسم القطعة</th>
          <th style="width: 9%;">الماركة</th>
          <th style="width: 7%;">الكمية</th>
          <th style="width: 10%;">
            <span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">
              <span>سعر الوحدة</span>
              ${SAR_SVG}
            </span>
          </th>
          <th style="width: 11%;">
            <span style="display:inline-flex; align-items:center; justify-content:center; gap:3px;">
              <span>الإجمالي</span>
              ${SAR_SVG}
            </span>
          </th>
          <th style="width: 11%; text-align: right;">لمن تم البيع</th>
          <th style="width: 12%; text-align: right;">بواسطة</th>
          ` : `
          <th style="width: 5%;">م</th>
          <th style="width: 18%;">رقم القطعة</th>
          <th style="width: 29%; text-align: right;">اسم القطعة</th>
          <th style="width: 12%;">الماركة</th>
          <th style="width: 10%;">الكمية</th>
          <th style="width: 13%; text-align: right;">لمن تم البيع</th>
          <th style="width: 13%; text-align: right;">بواسطة</th>
          `}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="${canViewAmounts ? 9 : 7}">
            <div class="tfoot-content">
              <div>
                <span>إجمالي الأصناف: </span>
                <span class="font-mono">${totalItems}</span>
              </div>
              <div>
                <span>إجمالي الكمية: </span>
                <span class="font-mono">${totalQty}</span>
              </div>
              ${canViewAmounts ? `
              <div style="display:flex; align-items:center; gap:4px;">
                <span>إجمالي القيمة: </span>
                <span style="display:inline-flex; align-items:center; gap:3px;" class="font-mono font-bold">
                  <span>${totalAmount.toFixed(2)}</span>
                  ${SAR_SVG}
                </span>
              </div>` : ''}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</body>
</html>`;
}

export function generateShortagePrintHtml(request: ShortageRequest): string {
  const items = request.items || [];
  const totalItems = items.length;
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0);

  const rows = items
    .map((it, idx) => {
      const qty = Number(it.quantity || 0);
      return `
      <tr class="border-b">
        <td class="text-center font-mono py-1.5 px-1.5 border-l">${idx + 1}</td>
        <td class="text-center font-mono font-bold py-1.5 px-2 border-l" dir="ltr">${it.partNumberSnapshot || ''}</td>
        <td class="text-right py-1.5 px-2 border-l">${it.partNameSnapshot || ''}</td>
        <td class="text-center font-bold py-1.5 px-2 border-l">${it.brandSnapshot || ''}</td>
        <td class="text-center font-mono font-bold py-1.5 px-2 border-l">${qty}</td>
        <td class="text-right py-1.5 px-2 border-l">${it.note || '—'}</td>
        <td class="text-right py-1.5 px-2">${it.createdByFullName || '—'}</td>
      </tr>
    `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>طلب نواقص - ${request.documentNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #ffffff;
      direction: rtl;
    }
    .container {
      width: 100%;
      max-width: 100%;
    }
    .header-title {
      text-align: center;
      margin: 0 0 6px 0;
      padding: 0;
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
    }
    .divider {
      border-bottom: 1px solid #cbd5e1;
      margin: 6px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 4px;
    }
    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      margin-top: 6px;
      font-size: 10.5px;
    }
    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      padding: 6px 4px;
      border-bottom: 1px solid #cbd5e1;
      border-left: 1px solid #cbd5e1;
      text-align: center;
    }
    th:last-child {
      border-left: none;
    }
    td {
      padding: 5px 4px;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #cbd5e1;
      vertical-align: middle;
    }
    td:last-child {
      border-left: none;
    }
    tr {
      page-break-inside: avoid;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .font-bold { font-weight: 700; }
    tfoot td {
      background-color: #f8fafc;
      border-top: 2px solid #94a3b8;
      font-weight: 800;
      padding: 7px 10px;
    }
    .tfoot-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="header-title">كشف طلب قطع ناقصة</h1>
    <div class="divider"></div>

    <div class="meta-row">
      <div>
        <span class="font-bold">رقم الطلب: </span>
        <span class="font-mono font-bold" dir="ltr">${request.documentNumber}</span>
      </div>
      <div>
        <span class="font-bold">التاريخ: </span>
        <span class="font-mono">${formatPrintDate(request.businessDate)}</span>
      </div>
      <div>
        <span class="font-bold">الفرع: </span>
        <span>${request.branchName || 'الرئيسي'}</span>
      </div>
    </div>
    <div class="divider"></div>

    <table>
      <thead>
        <tr>
          <th style="width: 5%;">م</th>
          <th style="width: 18%;">رقم القطعة</th>
          <th style="width: 27%; text-align: right;">اسم القطعة</th>
          <th style="width: 12%;">الماركة</th>
          <th style="width: 12%;">الكمية المطلوبة</th>
          <th style="width: 13%; text-align: right;">الملاحظات</th>
          <th style="width: 13%; text-align: right;">بواسطة</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="7">
            <div class="tfoot-content">
              <div>
                <span>إجمالي الأصناف: </span>
                <span class="font-mono">${totalItems}</span>
              </div>
              <div>
                <span>إجمالي القطع المطلوبة: </span>
                <span class="font-mono">${totalQty}</span>
              </div>
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</body>
</html>`;
}

export async function quickPrintSalesOrder(
  orderOrId: string | SalesRequest,
  canViewAmounts: boolean = true
): Promise<void> {
  let order: SalesRequest;
  if (typeof orderOrId === 'string') {
    order = await api.get<SalesRequest>(`/sales/${orderOrId}`);
  } else {
    order = orderOrId;
  }
  const html = generateSalesPrintHtml(order, canViewAmounts);
  printHtml(html);
}

export async function quickPrintShortageOrder(orderOrId: string | ShortageRequest): Promise<void> {
  let order: ShortageRequest;
  if (typeof orderOrId === 'string') {
    order = await api.get<ShortageRequest>(`/shortages/${orderOrId}`);
  } else {
    order = orderOrId;
  }
  const html = generateShortagePrintHtml(order);
  printHtml(html);
}
