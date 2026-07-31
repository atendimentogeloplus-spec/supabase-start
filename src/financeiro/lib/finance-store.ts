import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MonthData {
  revenue: number;
  fixedCosts: number;
  variableCosts: number;
  vehicleExpenses: number;
  water: number;
  electricity: number;
  packaging: number;
  assetPurchases: number;
}

export type YearData = Record<string, MonthData>;

const emptyMonth: MonthData = {
  revenue: 0,
  fixedCosts: 0,
  variableCosts: 0,
  vehicleExpenses: 0,
  water: 0,
  electricity: 0,
  packaging: 0,
  assetPurchases: 0,
};

export const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function getMonthKey(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function calculateProfit(d: MonthData) {
  return d.revenue - d.fixedCosts - d.variableCosts - d.vehicleExpenses - d.water - d.electricity - d.packaging;
}

export function totalCosts(d: MonthData) {
  return d.fixedCosts + d.variableCosts + d.vehicleExpenses + d.water + d.electricity + d.packaging;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function rowToMonthData(row: any): MonthData {
  return {
    revenue: Number(row.revenue) || 0,
    fixedCosts: Number(row.fixed_costs) || 0,
    variableCosts: Number(row.variable_costs) || 0,
    vehicleExpenses: Number(row.vehicle_expenses) || 0,
    water: Number(row.water) || 0,
    electricity: Number(row.electricity) || 0,
    packaging: Number(row.packaging) || 0,
    assetPurchases: Number(row.asset_purchases) || 0,
  };
}

export function useFinanceData(year: number) {
  const { user } = useAuth();
  const [yearData, setYearData] = useState<YearData>({});
  const [loading, setLoading] = useState(true);

  const fetchYear = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const prefix = `${year}-`;
    const { data, error } = await supabase
      .from("fin_monthly_finance")
      .select("*")
      .eq("user_id", user.id)
      .like("month_key", `${prefix}%`);

    if (!error && data) {
      const mapped: YearData = {};
      data.forEach((row) => {
        mapped[row.month_key] = rowToMonthData(row);
      });
      setYearData(mapped);
    }
    setLoading(false);
  }, [user, year]);

  useEffect(() => {
    fetchYear();
  }, [fetchYear]);

  function getMonth(month: number): MonthData {
    return yearData[getMonthKey(year, month)] || { ...emptyMonth };
  }

  async function setMonth(month: number, monthData: MonthData) {
    if (!user) return;
    const key = getMonthKey(year, month);

    setYearData((prev) => ({ ...prev, [key]: monthData }));

    await supabase
      .from("fin_monthly_finance")
      .upsert(
        {
          user_id: user.id,
          month_key: key,
          revenue: monthData.revenue,
          fixed_costs: monthData.fixedCosts,
          variable_costs: monthData.variableCosts,
          vehicle_expenses: monthData.vehicleExpenses,
          water: monthData.water,
          electricity: monthData.electricity,
          packaging: monthData.packaging,
          asset_purchases: monthData.assetPurchases,
        },
        { onConflict: "user_id,month_key" }
      );
  }

  return { getMonth, setMonth, yearData, loading };
}
