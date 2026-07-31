import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import {
  DollarSign,
  Building2,
  TrendingDown,
  Truck,
  Droplet,
  Zap,
  Package,
  ShoppingBag,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Check,
  X,
  Landmark,

} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ClosingGroup, formatBRL, PAYMENT_METHODS } from "../financeiro/useFinanceData";

type CardDef = {
  key: ClosingGroup;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: "primary" | "warning";
};

const cards: CardDef[] = [
  { key: "faturamento", label: "Faturamento", icon: DollarSign, highlight: "primary" },
  { key: "custos_fixos", label: "Custos Fixos", icon: Building2 },
  { key: "custos_variaveis", label: "Custos Variáveis", icon: TrendingDown },
  { key: "veiculos", label: "Gastos com Veículos", icon: Truck },
  { key: "agua", label: "Água", icon: Droplet },
  { key: "luz", label: "Luz", icon: Zap },
  { key: "embalagens", label: "Embalagens", icon: Package },
  { key: "ativos", label: "Compra de Ativos", icon: ShoppingBag, highlight: "warning" },
];

export default function FechamentoModule() {
  const { user } = useAuth();
  const [computed, setComputed] = useState<Record<string, number>>({});
  const [bankTotals, setBankTotals] = useState<Record<string, number>>({});
  const [bankTxs, setBankTxs] = useState<Array<{ id: string; description: string; category: string; amount: number; date: string; method: string }>>([]);
  const [openBank, setOpenBank] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, number | null>>({});
  const [prevValues, setPrevValues] = useState<Record<string, number>>({});
  const [ytd, setYtd] = useState<{ lucro: number; faturamento: number; ativos: number }>({ lucro: 0, faturamento: 0, ativos: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [monthTxs, setMonthTxs] = useState<Array<{ id: string; category: string; description: string; amount: number; date: string; group: ClosingGroup }>>([]);
  const [openGroup, setOpenGroup] = useState<ClosingGroup | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);


  const [ref, setRef] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const year = ref.getFullYear();
  const month = ref.getMonth() + 1;
  const mesNome = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const mesCap = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);


  const load = async () => {
    if (!user) return;
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end = new Date(year, month, 0).toISOString().slice(0, 10);

    const [{ data: cats }, { data: txs }, { data: man }, { data: salesMonth }] = await Promise.all([
      supabase.from("fin_categories").select("name, closing_group").not("closing_group", "is", null),
      supabase
        .from("fin_transactions")
        .select("id, amount, category, status, description, date, type, payment_method")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "realizado"),

      supabase
        .from("fin_closing_manual" as any)
        .select("closing_group, amount")
        .eq("year", year)
        .eq("month", month),
      supabase
        .from("sales")
        .select("total, created_at")
        .gte("created_at", `${start}T00:00:00`)
        .lte("created_at", `${end}T23:59:59.999`),
    ]);

    const map = new Map<string, ClosingGroup>();
    (cats || []).forEach((c: any) => map.set(c.name, c.closing_group));

    const sums: Record<string, number> = {};
    const list: typeof monthTxs = [];
    (txs || []).forEach((t: any) => {
      const g = map.get(t.category);
      if (!g) return;
      // Faturamento vem automaticamente das vendas (sales); ignora txs desse grupo
      if (g === "faturamento") return;
      sums[g] = (sums[g] || 0) + Number(t.amount || 0);
      list.push({ id: t.id, category: t.category, description: t.description || "(sem descrição)", amount: Number(t.amount || 0), date: t.date, group: g });
    });
    // Faturamento = soma das vendas do mês
    sums["faturamento"] = (salesMonth || []).reduce((a: number, s: any) => a + Number(s.total || 0), 0);
    setComputed(sums);
    setMonthTxs(list);

    // Entradas por banco/conta no mês
    const banks: Record<string, number> = {};
    const bankList: typeof bankTxs = [];
    PAYMENT_METHODS.forEach((m) => { banks[m] = 0; });
    (txs || []).forEach((t: any) => {
      if (t.type !== "entrada") return;
      const key = PAYMENT_METHODS.includes(t.payment_method) ? t.payment_method : "Dinheiro";
      banks[key] += Number(t.amount || 0);
      bankList.push({ id: t.id, description: t.description || "(sem descrição)", category: t.category || "", amount: Number(t.amount || 0), date: t.date, method: key });
    });
    setBankTotals(banks);
    setBankTxs(bankList);



    const mm: Record<string, number | null> = {};
    (man || []).forEach((m: any) => {
      mm[m.closing_group] = Number(m.amount);
    });
    setManual(mm);

    // Mês anterior
    const prevRef = new Date(year, month - 2, 1);
    const prevYear = prevRef.getFullYear();
    const prevMonth = prevRef.getMonth() + 1;
    const prevStart = new Date(prevYear, prevMonth - 1, 1).toISOString().slice(0, 10);
    const prevEnd = new Date(prevYear, prevMonth, 0).toISOString().slice(0, 10);
    const [{ data: prevTxs }, { data: prevMan }, { data: prevSales }] = await Promise.all([
      supabase.from("fin_transactions").select("amount, category").gte("date", prevStart).lte("date", prevEnd).eq("status", "realizado"),
      supabase.from("fin_closing_manual" as any).select("closing_group, amount").eq("year", prevYear).eq("month", prevMonth),
      supabase.from("sales").select("total").gte("created_at", `${prevStart}T00:00:00`).lte("created_at", `${prevEnd}T23:59:59.999`),
    ]);
    const prevAuto: Record<string, number> = {};
    (prevTxs || []).forEach((t: any) => {
      const g = map.get(t.category);
      if (!g || g === "faturamento") return;
      prevAuto[g] = (prevAuto[g] || 0) + Number(t.amount || 0);
    });
    prevAuto["faturamento"] = (prevSales || []).reduce((a: number, s: any) => a + Number(s.total || 0), 0);
    const prevFinal: Record<string, number> = { ...prevAuto };
    (prevMan || []).forEach((m: any) => { prevFinal[m.closing_group] = Number(m.amount); });
    setPrevValues(prevFinal);



    // YTD: Jan 1 do ano selecionado até hoje (ou fim do ano se ano passado)
    const today = new Date();
    const yStart = new Date(year, 0, 1).toISOString().slice(0, 10);
    const yEnd =
      year === today.getFullYear()
        ? today.toISOString().slice(0, 10)
        : new Date(year, 11, 31).toISOString().slice(0, 10);

    const [{ data: ytxs }, { data: yman }, { data: ysales }] = await Promise.all([
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

    // soma automática por mês/grupo
    const autoByMonthGroup: Record<string, number> = {};
    (ytxs || []).forEach((t: any) => {
      const g = map.get(t.category);
      if (!g || g === "faturamento") return;
      const mm2 = Number((t.date as string).slice(5, 7));
      const k = `${mm2}|${g}`;
      autoByMonthGroup[k] = (autoByMonthGroup[k] || 0) + Number(t.amount || 0);
    });
    // Faturamento por mês vem de sales
    (ysales || []).forEach((s: any) => {
      const mm2 = Number((s.created_at as string).slice(5, 7));
      const k = `${mm2}|faturamento`;
      autoByMonthGroup[k] = (autoByMonthGroup[k] || 0) + Number(s.total || 0);
    });

    const manByMonthGroup: Record<string, number> = {};
    (yman || []).forEach((m: any) => {
      manByMonthGroup[`${m.month}|${m.closing_group}`] = Number(m.amount);
    });

    const lastMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
    const expenseGroups = ["custos_fixos", "custos_variaveis", "veiculos", "agua", "luz", "embalagens"];
    let totFat = 0;
    let totLucro = 0;
    let totAtivos = 0;
    for (let mo = 1; mo <= lastMonth; mo++) {
      const get = (g: string) => {
        const k = `${mo}|${g}`;
        return manByMonthGroup[k] !== undefined ? manByMonthGroup[k] : autoByMonthGroup[k] || 0;
      };
      const fatM = get("faturamento");
      const despM = expenseGroups.reduce((s, g) => s + get(g), 0);
      totFat += fatM;
      totLucro += fatM - despM;
      totAtivos += get("ativos");
    }
    setYtd({ faturamento: totFat, lucro: totLucro, ativos: totAtivos });
  };


  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year, month]);

  const shiftMonth = (delta: number) => {
    setRef((r) => new Date(r.getFullYear(), r.getMonth() + delta, 1));
    setEditing(null);
  };


  const valueFor = (k: string) =>
    manual[k] !== undefined && manual[k] !== null ? (manual[k] as number) : computed[k] || 0;

  const lucro = useMemo(
    () =>
      valueFor("faturamento") -
      valueFor("custos_fixos") -
      valueFor("custos_variaveis") -
      valueFor("veiculos") -
      valueFor("agua") -
      valueFor("luz") -
      valueFor("embalagens"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [computed, manual]
  );

  const startEdit = (k: string) => {
    setEditing(k);
    setDraft(String(valueFor(k)).replace(".", ","));
  };

  const saveEdit = async (k: string) => {
    if (!user) return;
    const num = Number(draft.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      toast.error("Valor inválido");
      return;
    }
    const { error } = await supabase.from("fin_closing_manual" as any).upsert(
      { user_id: user.id, year, month, closing_group: k, amount: num },
      { onConflict: "user_id,year,month,closing_group" }
    );
    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    setManual((p) => ({ ...p, [k]: num }));
    setEditing(null);
    toast.success("Salvo");
  };

  const clearManual = async (k: string) => {
    if (!user) return;
    await supabase
      .from("fin_closing_manual" as any)
      .delete()
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("closing_group", k);
    setManual((p) => {
      const n = { ...p };
      delete n[k];
      return n;
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-base font-semibold capitalize">{mesCap}</div>
        <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

        {cards.map((c) => {
          const Icon = c.icon;
          const border =
            c.highlight === "primary"
              ? "border-primary/40 bg-primary/5"
              : c.highlight === "warning"
              ? "border-amber-300 bg-amber-50/60"
              : "";
          const isManual = manual[c.key] !== undefined && manual[c.key] !== null;
          const isEditing = editing === c.key;
          return (
            <Card
              key={c.key}
              className={`p-4 ${border} ${!isEditing ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
              onClick={() => { if (!isEditing) { setExpandedCat(null); setOpenGroup(c.key); } }}
            >

              <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{c.label}</span>
                </div>
                {!isEditing && (
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(c.key); }}
                    className="text-muted-foreground hover:text-foreground"
                    title="Editar manualmente"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="mt-2 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(c.key);
                      if (e.key === "Escape") setEditing(null);
                    }}
                    className="h-9"
                  />
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => saveEdit(c.key)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="mt-2 rounded-md border bg-background px-3 py-2 text-base font-semibold tabular-nums">
                  {formatBRL(valueFor(c.key))}
                </div>
              )}
              {!isEditing && (() => {
                const cur = valueFor(c.key);
                const prev = prevValues[c.key] || 0;
                const isExpense = c.key !== "faturamento";
                if (prev === 0 && cur === 0) return null;
                const diff = prev === 0 ? null : ((cur - prev) / prev) * 100;
                const good = diff === null ? false : (isExpense ? diff < 0 : diff > 0);
                const arrow = diff === null ? "" : diff >= 0 ? "↑" : "↓";
                const color = diff === null ? "text-muted-foreground" : good ? "text-emerald-600" : "text-red-600";
                return (
                  <div className="mt-1.5 text-[11px] leading-tight">
                    <div className={`font-medium ${color}`}>
                      {diff === null ? "sem base anterior" : `${arrow} ${Math.abs(diff).toFixed(1).replace(".", ",")}% vs anterior`}
                    </div>
                    <div className="text-muted-foreground">Mês anterior: {formatBRL(prev)}</div>
                  </div>
                );
              })()}
              {isManual && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); clearManual(c.key); }}
                  className="mt-1 text-[10px] text-muted-foreground hover:text-destructive"
                >
                  manual · usar automático
                </button>
              )}
            </Card>
          );

        })}
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Landmark className="h-4 w-4" /> Entradas por banco · {mesCap}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setOpenBank("__all__")}
            className="text-left rounded-lg border-2 border-emerald-500/40 bg-emerald-50/60 p-3 hover:shadow-md transition-shadow"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Total</div>
            <div className="text-lg font-bold tabular-nums text-emerald-700">
              {formatBRL(Object.values(bankTotals).reduce((a, b) => a + b, 0))}
            </div>
          </button>
          {PAYMENT_METHODS.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setOpenBank(m)}
              className="text-left rounded-lg border bg-background p-3 hover:shadow-md transition-shadow"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m}</div>
              <div className="text-lg font-bold tabular-nums">{formatBRL(bankTotals[m] || 0)}</div>
            </button>
          ))}
        </div>
      </Card>

      <Dialog open={!!openBank} onOpenChange={(o) => { if (!o) setOpenBank(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Entradas {openBank === "__all__" ? "· todos os bancos" : `· ${openBank}`} — {mesCap}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!openBank) return null;
            const items = bankTxs
              .filter((t) => openBank === "__all__" || t.method === openBank)
              .sort((a, b) => a.date.localeCompare(b.date));
            const total = items.reduce((a, b) => a + b.amount, 0);
            if (!items.length) return <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma entrada neste período.</div>;
            return (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="mb-2 text-sm font-semibold">Total: {formatBRL(total)} · {items.length} lançamento(s)</div>
                <div className="divide-y">
                  {items.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{t.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                          {t.category ? ` · ${t.category}` : ""}
                          {openBank === "__all__" ? ` · ${t.method}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 font-semibold tabular-nums">{formatBRL(t.amount)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>



      {(() => {
        const fat = valueFor("faturamento");
        const margem = fat > 0 ? (lucro / fat) * 100 : 0;
        return (
          <Card className={`p-5 ${lucro < 0 ? "border-red-300 bg-red-50/60" : "border-emerald-300 bg-emerald-50/60"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingUp className={`h-6 w-6 ${lucro < 0 ? "text-red-600" : "text-emerald-600"}`} />
                <div>
                  <div className="text-sm text-muted-foreground">Lucro de {mesCap}</div>
                  <div className={`text-3xl font-bold tabular-nums ${lucro < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    {formatBRL(lucro)}
                  </div>
                  <div className={`mt-1 text-sm font-semibold tabular-nums ${lucro < 0 ? "text-red-700" : "text-emerald-700"}`}>
                    Margem: {fat > 0 ? margem.toFixed(2).replace(".", ",") + "%" : "—"}
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground text-right">
                Faturamento − Custos Fixos − Custos Variáveis − Veículos
                <br />− Água − Luz − Embalagens
                <br /><span className="opacity-70">Margem = (Lucro ÷ Faturamento) × 100</span>
              </div>
            </div>
          </Card>
        );
      })()}

      {(() => {
        const margemY = ytd.faturamento > 0 ? (ytd.lucro / ytd.faturamento) * 100 : 0;
        const neg = ytd.lucro < 0;
        return (
          <Card className={`p-5 ${neg ? "border-red-300 bg-red-50/60" : "border-emerald-300 bg-emerald-50/60"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <TrendingUp className={`h-6 w-6 ${neg ? "text-red-600" : "text-emerald-600"}`} />
                <div>
                  <div className="text-sm text-muted-foreground">Lucro acumulado {year} (Jan até hoje)</div>
                  <div className={`text-3xl font-bold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
                    {formatBRL(ytd.lucro)}
                  </div>
                  <div className={`mt-1 text-sm font-semibold tabular-nums ${neg ? "text-red-700" : "text-emerald-700"}`}>
                    Margem: {ytd.faturamento > 0 ? margemY.toFixed(2).replace(".", ",") + "%" : "—"}
                  </div>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground text-right">
                Faturamento acumulado: {formatBRL(ytd.faturamento)}
                <br /><span className="opacity-70">Soma de todos os meses do ano</span>
              </div>
            </div>
          </Card>
        );
      })()}

      <Card className="p-5 border-amber-300 bg-amber-50/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-amber-600" />
            <div>
              <div className="text-sm text-muted-foreground">Compra de Ativos acumulada {year} (Jan até hoje)</div>
              <div className="text-3xl font-bold tabular-nums text-amber-700">
                {formatBRL(ytd.ativos)}
              </div>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-muted-foreground text-right">
            <span className="opacity-70">Soma de todas as compras de ativos do ano</span>
          </div>
        </div>
      </Card>

      <Dialog open={!!openGroup} onOpenChange={(o) => { if (!o) { setOpenGroup(null); setExpandedCat(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {cards.find(c => c.key === openGroup)?.label} — {mesCap}
            </DialogTitle>
          </DialogHeader>
          {(() => {
            if (!openGroup) return null;
            const items = monthTxs.filter(t => t.group === openGroup);
            if (items.length === 0) {
              return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>;
            }
            const byCat = new Map<string, typeof items>();
            items.forEach(t => {
              if (!byCat.has(t.category)) byCat.set(t.category, []);
              byCat.get(t.category)!.push(t);
            });
            const rows = Array.from(byCat.entries())
              .map(([cat, txs]) => ({ cat, txs, total: txs.reduce((s, t) => s + t.amount, 0) }))
              .sort((a, b) => b.total - a.total);
            const grandTotal = rows.reduce((s, r) => s + r.total, 0);
            return (
              <div className="max-h-[60vh] overflow-y-auto">
                <ul className="divide-y">
                  {rows.map(({ cat, txs, total }) => (
                    <li key={cat}>
                      <Collapsible open={expandedCat === cat} onOpenChange={(o) => setExpandedCat(o ? cat : null)}>
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm hover:bg-muted/50 px-2 rounded">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${expandedCat === cat ? "" : "-rotate-90"}`} />
                            <span className="font-medium truncate">{cat}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({txs.length})</span>
                          </div>
                          <span className="font-semibold tabular-nums">{formatBRL(total)}</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="pl-8 pr-2 pb-2 space-y-1">
                            {txs
                              .sort((a, b) => (a.date < b.date ? 1 : -1))
                              .map(t => (
                                <li key={t.id} className="flex items-center justify-between gap-2 text-sm py-1 border-b last:border-b-0 border-dashed">
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate">{t.description}</div>
                                    <div className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}</div>
                                  </div>
                                  <span className="tabular-nums">{formatBRL(t.amount)}</span>
                                </li>
                              ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t mt-2 pt-2 px-2 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatBRL(grandTotal)}</span>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>

  );
}
