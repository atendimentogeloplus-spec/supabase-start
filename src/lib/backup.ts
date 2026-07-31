import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const TABLES = ["clients", "products", "price_tables", "sales", "sale_items", "stock_entries"] as const;

async function fetchAllTables() {
  const result: Record<string, any[]> = {};
  for (const table of TABLES) {
    const { data } = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(10000);
    result[table] = data || [];
  }
  return result;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function toCsvString(rows: any[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(
      headers.map((h) => {
        const val = row[h] ?? "";
        const str = String(val);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      }).join(",")
    );
  }
  return lines.join("\n");
}

export async function downloadBackup() {
  const data = await fetchAllTables();
  const dateStr = format(new Date(), "yyyy-MM-dd_HHmm");

  // Excel with multiple sheets
  const wb = XLSX.utils.book_new();
  for (const table of TABLES) {
    const ws = XLSX.utils.json_to_sheet(data[table]);
    XLSX.utils.book_append_sheet(wb, ws, table);
  }
  const excelBuf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(new Blob([excelBuf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `backup_${dateStr}.xlsx`);

  // CSV (all tables concatenated with headers)
  const csvParts: string[] = [];
  for (const table of TABLES) {
    if (data[table].length > 0) {
      csvParts.push(`=== ${table.toUpperCase()} ===`);
      csvParts.push(toCsvString(data[table]));
      csvParts.push("");
    }
  }
  triggerDownload(new Blob([csvParts.join("\n")], { type: "text/csv;charset=utf-8" }), `backup_${dateStr}.csv`);
}
