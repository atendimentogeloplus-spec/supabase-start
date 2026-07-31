import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { Transaction, formatBRL } from "./useFinanceData";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const PARCELA_RE = /^(.*)\s\((\d+)\/(\d+)\)\s*$/;

interface DividaGroup {
  key: string;
  baseDescription: string;
  category: string;
  totalParcelas: number;
  valorParcela: number;
  parcelaAtual: number;
  parcelasPagas: number;
  parcelasRestantes: number;
  totalPago: number;
  totalRestante: number;
  totalGeral: number;
  proximaData: string | null;
  paymentMethod: string;
  txs: Transaction[];
}

type PayableRow = { description: string; amount: number; due_date: string; category: string | null; payment_method: string | null; status: string };

export default function Dividas({ transactions }: { transactions: Transaction[] }) {
  const [payables, setPayables] = useState<PayableRow[]>([]);

  useEffect(() => {
    supabase.from("fin_payables" as any)
      .select("description,amount,due_date,category,payment_method,status")
      .then(({ data }) => setPayables(((data || []) as unknown) as PayableRow[]));
  }, [transactions]);

  const groups = useMemo<DividaGroup[]>(() => {
    const map = new Map<string, Array<{ description: string; amount: number; date: string; status: string; category: string; payment_method: string; source: "tx" | "pay" }>>();
    const push = (row: { description: string; amount: number; date: string; status: string; category: string; payment_method: string; source: "tx" | "pay" }) => {
      const m = row.description.match(PARCELA_RE);
      if (!m) return;
      const base = m[1].trim();
      const total = m[3];
      const key = `${base}||${total}||${Number(row.amount).toFixed(2)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    };
    transactions.forEach(t => {
      if (t.type !== "saida") return;
      push({ description: t.description, amount: Number(t.amount), date: t.date, status: t.status, category: t.category, payment_method: t.payment_method, source: "tx" });
    });
    payables.forEach(p => {
      push({ description: p.description, amount: Number(p.amount), date: p.due_date, status: p.status === "pago" ? "realizado" : "previsto", category: p.category || "", payment_method: p.payment_method || "", source: "pay" });
    });


    const today = new Date().toISOString().slice(0, 10);
    const arr: DividaGroup[] = [];
    map.forEach((txs, key) => {
      const parts = key.split("||");
      const base = parts[0];
      const totalParcelas = Number(parts[1]);
      const valorParcela = Number(parts[2]);

      const parcelas = txs
        .map(t => {
          const m = t.description.match(PARCELA_RE)!;
          return { tx: t, num: Number(m[2]) };
        })
        .sort((a, b) => a.num - b.num);

      const pagas = parcelas.filter(p => p.tx.status === "realizado" || p.tx.date <= today).length;
      const restantesArr = parcelas.filter(p => p.tx.status === "previsto" && p.tx.date > today);
      const restantesCount = restantesArr.length || Math.max(0, totalParcelas - pagas);
      const proxima = restantesArr[0] || parcelas.find(p => p.tx.status === "previsto");
      const parcelaAtual = proxima ? proxima.num : Math.min(totalParcelas, pagas + 1);

      arr.push({
        key,
        baseDescription: base,
        category: txs[0].category,
        totalParcelas,
        valorParcela,
        parcelaAtual,
        parcelasPagas: pagas,
        parcelasRestantes: restantesCount,
        totalPago: pagas * valorParcela,
        totalRestante: restantesCount * valorParcela,
        totalGeral: totalParcelas * valorParcela,
        proximaData: proxima ? proxima.tx.date : null,
        paymentMethod: txs[0].payment_method,
        txs: [],
      });
    });

    return arr.sort((a, b) => (b.totalRestante - a.totalRestante));
  }, [transactions, payables]);

  const totalDividas = groups.reduce((a, g) => a + g.totalRestante, 0);
  const totalPago = groups.reduce((a, g) => a + g.totalPago, 0);
  const totalGeral = groups.reduce((a, g) => a + g.totalGeral, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-red-500/40 bg-red-50 dark:bg-red-950/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-red-700 dark:text-red-400">Dívida Total (a vencer)</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-red-600">{formatBRL(totalDividas)}</span></CardContent>
        </Card>
        <Card className="border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-emerald-700 dark:text-emerald-400">Total Já Pago</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold text-emerald-600">{formatBRL(totalPago)}</span></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Geral das Dívidas</CardTitle></CardHeader>
          <CardContent><span className="text-2xl font-bold">{formatBRL(totalGeral)}</span></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Dívidas Parceladas ({groups.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {groups.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              Nenhuma dívida parcelada encontrada. Crie um lançamento recorrente com parcela inicial/final para acompanhar aqui.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 pr-3">Descrição</th>
                    <th className="py-2 pr-3">Categoria</th>
                    <th className="py-2 pr-3">Parcela</th>
                    <th className="py-2 pr-3 text-right">Valor Parcela</th>
                    <th className="py-2 pr-3">Próx. Vencimento</th>
                    <th className="py-2 pr-3 text-right">Já Pago</th>
                    <th className="py-2 pr-3 text-right">A Pagar</th>
                    <th className="py-2 text-right">Total Dívida</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <tr key={g.key} className="border-b">
                      <td className="py-2 pr-3 font-medium">{g.baseDescription}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{g.category}</td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline">{g.parcelaAtual}/{g.totalParcelas}</Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">{formatBRL(g.valorParcela)}</td>
                      <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                        {g.proximaData ? format(parseISO(g.proximaData), "dd/MM/yy") : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-emerald-600">{formatBRL(g.totalPago)}</td>
                      <td className="py-2 pr-3 text-right font-semibold text-red-600">{formatBRL(g.totalRestante)}</td>
                      <td className="py-2 text-right font-bold">{formatBRL(g.totalGeral)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold bg-muted/40">
                    <td className="py-2 pr-3" colSpan={5}>TOTAL</td>
                    <td className="py-2 pr-3 text-right text-emerald-600">{formatBRL(totalPago)}</td>
                    <td className="py-2 pr-3 text-right text-red-600">{formatBRL(totalDividas)}</td>
                    <td className="py-2 text-right">{formatBRL(totalGeral)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
