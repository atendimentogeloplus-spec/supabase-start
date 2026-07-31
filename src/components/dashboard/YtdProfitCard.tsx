import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

interface Props { year: number }

export default function YtdProfitCard({ year }: Props) {
  const { data } = useQuery({
    queryKey: ["ytd-profit-card", year],
    queryFn: async () => {
      const today = new Date();
      const yStart = `${year}-01-01`;
      const yEnd =
        year === today.getFullYear()
          ? today.toISOString().slice(0, 10)
          : `${year}-12-31`;

      const [{ data: cats }, { data: ytxs }, { data: yman }, { data: ysales }] = await Promise.all([
        supabase.from("fin_categories").select("name, closing_group").not("closing_group", "is", null),
        supabase
          .from("fin_transactions")
          .select("amount, category, date")
          .gte("date", yStart)
          .lte("date", yEnd)
          .eq("status", "realizado"),
        supabase
          .from("fin_closing_manual" as any)
          .select("year, month, closing_group, amount")
          .eq("year", year),
        supabase
          .from("sales")
          .select("total, created_at")
          .gte("created_at", `${yStart}T00:00:00`)
          .lte("created_at", `${yEnd}T23:59:59.999`),
      ]);

      const map = new Map<string, string>();
      (cats || []).forEach((c: any) => map.set(c.name, c.closing_group));

      const autoByMG: Record<string, number> = {};
      (ytxs || []).forEach((t: any) => {
        const g = map.get(t.category);
        if (!g || g === "faturamento") return;
        const mo = Number((t.date as string).slice(5, 7));
        const k = `${mo}|${g}`;
        autoByMG[k] = (autoByMG[k] || 0) + Number(t.amount || 0);
      });
      // Faturamento vem de sales (mesma lógica de Fechamento)
      (ysales || []).forEach((s: any) => {
        const mo = Number((s.created_at as string).slice(5, 7));
        const k = `${mo}|faturamento`;
        autoByMG[k] = (autoByMG[k] || 0) + Number(s.total || 0);
      });

      const manByMG: Record<string, number> = {};
      (yman || []).forEach((m: any) => {
        manByMG[`${m.month}|${m.closing_group}`] = Number(m.amount);
      });

      const lastMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
      const expenseGroups = ["custos_fixos", "custos_variaveis", "veiculos", "agua", "luz", "embalagens"];
      let totFat = 0;
      let totLucro = 0;
      for (let mo = 1; mo <= lastMonth; mo++) {
        const get = (g: string) => {
          const k = `${mo}|${g}`;
          return manByMG[k] !== undefined ? manByMG[k] : autoByMG[k] || 0;
        };
        const fatM = get("faturamento");
        const despM = expenseGroups.reduce((s, g) => s + get(g), 0);
        totFat += fatM;
        totLucro += fatM - despM;
      }
      return { faturamento: totFat, lucro: totLucro };
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
            <div className="text-sm text-muted-foreground">Lucro acumulado {year} (Jan até hoje)</div>
            <div className={`text-3xl font-bold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
              {formatBRL(lucro)}
            </div>
            <div className={`mt-1 text-sm font-semibold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
              Margem: {fat > 0 ? margem.toFixed(2).replace(".", ",") + "%" : "—"}
            </div>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground text-right">
          Faturamento acumulado: {formatBRL(fat)}
          <br /><span className="opacity-70">Soma de todos os meses do ano</span>
        </div>
      </div>
    </Card>
  );
}
