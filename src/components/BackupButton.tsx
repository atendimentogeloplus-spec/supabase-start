import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/paginate";
import { Button } from "@/components/ui/button";

const TABLES: { name: string; order: string }[] = [
  { name: "profiles", order: "created_at" },
  { name: "user_roles", order: "id" },
  { name: "kanban_columns", order: "position" },
  { name: "sources", order: "name" },
  { name: "settings", order: "key" },
  { name: "leads", order: "created_at" },
  { name: "interactions", order: "created_at" },
  { name: "lead_audit", order: "created_at" },
  { name: "notifications", order: "created_at" },
  { name: "clients", order: "created_at" },
  { name: "products", order: "created_at" },
  { name: "purchase_orders", order: "created_at" },
  { name: "purchase_order_items", order: "id" },
  { name: "stock_movements", order: "created_at" },
  { name: "client_forecasts", order: "client_id" },
];

function cell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function BackupButton() {
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const [{ default: JSZip }, XLSX] = await Promise.all([import("jszip"), import("xlsx")]);
      const data: Record<string, Record<string, unknown>[]> = {};
      for (const t of TABLES) {
        const { data: rows } = await fetchAll((f, to) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from(t.name as any) as any).select("*").order(t.order).range(f, to),
        );
        data[t.name] = rows as Record<string, unknown>[];
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

      const zip = new JSZip();
      for (const [name, rows] of Object.entries(data)) zip.file(`${name}.csv`, "\uFEFF" + toCsv(rows));
      download(await zip.generateAsync({ type: "blob" }), `backup-csv-${stamp}.zip`);

      const wb = XLSX.utils.book_new();
      const summary = Object.entries(data).map(([name, rows]) => ({ tabela: name, registros: rows.length }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "resumo");
      for (const [name, rows] of Object.entries(data)) {
        const flat = rows.map((r) =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v != null && typeof v === "object" ? JSON.stringify(v) : v])),
        );
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), name.slice(0, 31));
      }
      XLSX.writeFile(wb, `backup-${stamp}.xlsx`);
      toast.success("Backup gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar backup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button onClick={run} disabled={busy}>
      <Download className="h-4 w-4" />
      {busy ? "Gerando backup…" : "Fazer backup completo"}
    </Button>
  );
}
