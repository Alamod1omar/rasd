/**
 * Utility to export tabular data to an Excel-compatible file (.csv with UTF-8 BOM)
 * The UTF-8 BOM (\uFEFF) ensures Microsoft Excel properly renders Arabic characters without question marks or corruption.
 */

export function exportTableToExcel(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
) {
  const sanitize = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    let str = String(val).replace(/"/g, '""');
    // If string contains comma, newline, or quotes, wrap in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      str = `"${str}"`;
    }
    return str;
  };

  const headerLine = headers.map(sanitize).join(',');
  const rowLines = rows.map((r) => r.map(sanitize).join(','));
  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportDetailsToExcel(
  filename: string,
  title: string,
  metadata: { label: string; value: string | number }[],
  headers: string[],
  items: (string | number | undefined | null)[][],
  summary?: { label: string; value: string | number }[],
) {
  const sanitize = (val: string | number | undefined | null): string => {
    if (val === undefined || val === null) return '';
    let str = String(val).replace(/"/g, '""');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      str = `"${str}"`;
    }
    return str;
  };

  const lines: string[] = [];
  lines.push(`"${title}"`);
  lines.push('');

  // Metadata block
  for (const meta of metadata) {
    lines.push(`${sanitize(meta.label)},${sanitize(meta.value)}`);
  }
  lines.push('');

  // Table Headers
  lines.push(headers.map(sanitize).join(','));

  // Items
  for (const item of items) {
    lines.push(item.map(sanitize).join(','));
  }

  // Summary
  if (summary && summary.length > 0) {
    lines.push('');
    for (const s of summary) {
      lines.push(`,,,${sanitize(s.label)},${sanitize(s.value)}`);
    }
  }

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
