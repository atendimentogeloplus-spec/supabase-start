import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Props { year: number; month: number /* 0-based */ }

export default function MonthProfitCard({ year, month }: Props) {
  const { data } = useQuery({
    queryKey: ["month-profit-card", year, month],
    queryFn: async () => {
      const pad = (n: number) => String(n).padStart(2, "0");
      const mStart = `${year}-${pad(month + 1)}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const mEnd = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

      const [{ data: cats }, { data: ytxs }, { data: yman }, { data: ysales }] = await Promise.all([
        supabase.from("fin_categories").select("name, closing_group").not("closing_group", "is", null),
        supabase
          .from("fin_transactions")
          .select("amount, category, date")
          .gte("date", mStart)
          .lte("date", mEnd)
          .eq("status", "realizado"),
        supabase
          .from("fin_closing_manual" as any)
          .select("year, month, closing_group, amount")
          .eq("year", year)
          .eq("month", month + 1),
        supabase
          .from("sales")
          .select("total, created_at")
          .gte("created_at", `${mStart}T00:00:00`)
          .lte("created_at", `${mEnd}T23:59:59.999`),
      ]);

      const map = new Map<string, string>();
      (cats || []).forEach((c: any) => map.set(c.name, c.closing_group));

      const autoByG: Record<string, number> = {};
      (ytxs || []).forEach((t: any) => {
        const g = map.get(t.category);
        if (!g || g === "faturamento") return;
        autoByG[g] = (autoByG[g] || 0) + Number(t.amount || 0);
      });
      (ysales || []).forEach((s: any) => {
        autoByG["faturamento"] = (autoByG["faturamento"] || 0) + Number(s.total || 0);
      });

      const manByG: Record<string, number> = {};
      (yman || []).forEach((m: any) => {
        manByG[m.closing_group] = Number(m.amount);
      });

      const get = (g: string) => (manByG[g] !== undefined ? manByG[g] : autoByG[g] || 0);
      const expenseGroups = ["custos_fixos", "custos_variaveis", "veiculos", "agua", "luz", "embalagens"];
      const fat = get("faturamento");
      const desp = expenseGroups.reduce((s, g) => s + get(g), 0);
      const lucro = fat - desp;
      return { faturamento: fat, lucro };
    },
    staleTime: 1000 * 60 * 2,
  });

  const lucro = data?.lucro || 0;
  const fat = data?.faturamento || 0;
  const margem = fat > 0 ? (lucro / fat) * 100 : 0;
  const neg = lucro < 0;

  return (
    <Card className={`p-5 ${neg ? "border-red-300 bg-red-50/60" : "border-emerald-300 bg-emerald-50/60"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className={`h-6 w-6 ${neg ? "text-red-600" : "text-emerald-600"}`} />
          <div>
            <div className="text-sm text-muted-foreground">Lucro de {MONTHS[month]} de {year}</div>
            <div className={`text-3xl font-bold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
              {formatBRL(lucro)}
            </div>
            <div className={`mt-1 text-sm font-semibold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
              Margem: {fat > 0 ? margem.toFixed(2).replace(".", ",") + "%" : "—"}
            </div>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground text-right">
          Faturamento do mês: {formatBRL(fat)}
          <br /><span className="opacity-70">Fechamento do mês selecionado</span>
        </div>
      </div>
    </Card>
  );
}
