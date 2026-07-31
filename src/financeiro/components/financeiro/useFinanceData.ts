import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type TxType = "entrada" | "saida";
export type TxStatus = "realizado" | "previsto";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TxType;
  category: string;
  date: string;
  status: TxStatus;
  payment_method: string;
  notes: string | null;
  account?: string | null;
  created_at: string;
}

export type ClosingGroup =
  | "faturamento"
  | "custos_fixos"
  | "custos_variaveis"
  | "veiculos"
  | "agua"
  | "luz"
  | "embalagens"
  | "ativos";

export const CLOSING_GROUPS: { value: ClosingGroup; label: string; type: TxType }[] = [
  { value: "faturamento", label: "Faturamento", type: "entrada" },
  { value: "custos_fixos", label: "Custos Fixos", type: "saida" },
  { value: "custos_variaveis", label: "Custos Variáveis", type: "saida" },
  { value: "veiculos", label: "Gastos com Veículos", type: "saida" },
  { value: "agua", label: "Água", type: "saida" },
  { value: "luz", label: "Luz", type: "saida" },
  { value: "embalagens", label: "Embalagens", type: "saida" },
  { value: "ativos", label: "Compra de Ativos", type: "saida" },
];

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: string;
  closing_group?: ClosingGroup | null;
}

const DEFAULT_CATEGORIES: { name: string; type: TxType; color: string }[] = [
  { name: "Vendas de Gelo", type: "entrada", color: "#16a34a" },
  { name: "Outras Receitas", type: "entrada", color: "#22c55e" },
  { name: "Transferência Recebida", type: "entrada", color: "#10b981" },
  { name: "Matéria-Prima", type: "saida", color: "#dc2626" },
  { name: "Produção", type: "saida", color: "#ef4444" },
  { name: "Entrega/Frete", type: "saida", color: "#f97316" },
  { name: "Salários", type: "saida", color: "#b91c1c" },
  { name: "Aluguel", type: "saida", color: "#991b1b" },
  { name: "Energia", type: "saida", color: "#eab308" },
  { name: "Manutenção", type: "saida", color: "#ea580c" },
  { name: "Impostos", type: "saida", color: "#7f1d1d" },
  { name: "Outras Despesas", type: "saida", color: "#dc2626" },
];

export function useFinanceData() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tx, cat] = await Promise.all([
      supabase.from("fin_transactions").select("*").order("date", { ascending: false }),
      supabase.from("fin_categories").select("*").order("name"),
    ]);
    if (tx.error) toast.error("Erro ao carregar lançamentos");
    if (cat.error) toast.error("Erro ao carregar categorias");

    let cats = (cat.data || []) as Category[];
    if (cats.length === 0) {
      const rows = DEFAULT_CATEGORIES.map(c => ({ ...c, user_id: user.id }));
      const { data: inserted } = await supabase.from("fin_categories").insert(rows).select("*");
      cats = (inserted || []) as Category[];
    }
    setTransactions((tx.data || []) as Transaction[]);
    setCategories(cats);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { transactions, categories, loading, reload, userId: user?.id };
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const PAYMENT_METHODS = ["Caixa", "Inter", "Itaú", "Dinheiro"];
export const ACCOUNTS = PAYMENT_METHODS;
