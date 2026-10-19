import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type ExportCriterion = { label: string; value: string };
export type ExportType = "PDF" | "Excel" | "CSV";

export type ExportColumn<T> = {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
};

export type ExportOptions<T> = {
  type: ExportType;
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  criteria?: ExportCriterion[];
};

const csvEscape = (v: unknown) => {
  const s = v == null ? "" : String(v);
  if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function toCSV<T>(cols: ExportColumn<T>[], rows: T[]): string {
  const header = cols.map((c) => csvEscape(c.header)).join(";");
  const body = rows.map((r) => cols.map((c) => csvEscape(c.accessor(r))).join(";")).join("\n");
  return "\ufeff" + header + "\n" + body;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRows<T>({
  type,
  title,
  filename,
  columns,
  rows,
  criteria = [],
}: ExportOptions<T>) {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `${filename}-${stamp}`;

  if (type === "CSV") {
    const csv = toCSV(columns, rows);
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${base}.csv`);
    return;
  }

  if (type === "Excel") {
    const aoa: (string | number)[][] = [
      [title],
      [`Généré le ${new Date().toLocaleString("fr-FR")}`],
      ...(criteria.length ? [[""], ...criteria.map((c) => [c.label, c.value])] : []),
      [""],
      columns.map((c) => c.header),
      ...rows.map((r) =>
        columns.map((c) => {
          const v = c.accessor(r);
          return v == null ? "" : typeof v === "number" ? v : String(v);
        }),
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    XLSX.writeFile(wb, `${base}.xlsx`);
    return;
  }

  // PDF
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const marginX = 40;
  doc.setFillColor(234, 88, 12);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("FormaCenter", marginX, 34);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(title, doc.internal.pageSize.getWidth() - marginX, 34, { align: "right" });

  let y = 80;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(9);
  doc.text(`Généré le ${new Date().toLocaleString("fr-FR")}`, marginX, y);
  y += 14;

  if (criteria.length) {
    doc.setFont("helvetica", "bold");
    doc.text("Critères :", marginX, y);
    doc.setFont("helvetica", "normal");
    y += 12;
    for (const c of criteria) {
      doc.text(`• ${c.label} : ${c.value}`, marginX + 8, y);
      y += 12;
    }
    y += 4;
  }

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) =>
      columns.map((c) => {
        const v = c.accessor(r);
        return v == null ? "" : String(v);
      }),
    ),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: marginX, right: marginX },
    didDrawPage: () => {
      const pageCount = (
        doc.internal as unknown as { getNumberOfPages: () => number }
      ).getNumberOfPages();
      const pageNum = (
        doc as unknown as { internal: { getCurrentPageInfo: () => { pageNumber: number } } }
      ).internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${pageNum} / ${pageCount}`,
        doc.internal.pageSize.getWidth() - marginX,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" },
      );
    },
  });

  doc.save(`${base}.pdf`);
}
