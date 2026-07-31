import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Props { year: number }

export default function MonthlyProfitChart({ year }: Props) {
  const { data } = useQuery({
    queryKey: ["monthly-profit-chart", year],
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
      const rows: { mes: string; lucro: number }[] = [];
      for (let mo = 1; mo <= lastMonth; mo++) {
        const get = (g: string) => {
          const k = `${mo}|${g}`;
          return manByMG[k] !== undefined ? manByMG[k] : autoByMG[k] || 0;
        };
        const fat = get("faturamento");
        const desp = expenseGroups.reduce((s, g) => s + get(g), 0);
        rows.push({ mes: MESES[mo - 1], lucro: fat - desp });
      }
      return rows;
    },
    staleTime: 1000 * 60 * 2,
  });

  const rows = data || [];

  return (
    <Card className="p-5">
      <div className="mb-3">
        <div className="text-sm text-muted-foreground">Lucro / Prejuízo mensal — {year}</div>
        <div className="text-xs text-muted-foreground opacity-70">Mesma base do Fechamento (faturamento − despesas)</div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => {
                if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
                return `R$${v}`;
              }}
              width={70}
            />
            <Tooltip
              formatter={(v: any) => [formatBRL(Number(v)), "Resultado"]}
              cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => (
                <Cell key={i} fill={r.lucro < 0 ? "hsl(0 72% 51%)" : "hsl(142 71% 45%)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
