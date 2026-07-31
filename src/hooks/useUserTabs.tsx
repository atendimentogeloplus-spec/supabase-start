import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useUserRole } from "./useUserRole";

export const ALL_TABS = [
  { key: "dashboard", label: "Dashboard", path: "/dashboard" },
  { key: "clients", label: "Clientes", path: "/clients" },
  { key: "products", label: "Produtos", path: "/products" },
  { key: "price-tables", label: "Tabelas de Preço", path: "/price-tables" },
  { key: "stock", label: "Estoque", path: "/stock" },
  { key: "sales", label: "Vendas", path: "/sales" },
  { key: "orders", label: "Pedidos", path: "/orders" },
  { key: "routes", label: "Rotas", path: "/routes" },
  { key: "drivers", label: "Motoristas", path: "/drivers" },
  { key: "reports", label: "Relatórios", path: "/reports" },
  { key: "cash-flow", label: "Fluxo", path: "/cash-flow" },
  { key: "leads", label: "Leads", path: "/leads" },
  { key: "week-plan", label: "Plano da Semana", path: "/week-plan" },
  { key: "fleet", label: "Frota", path: "/fleet" },
  { key: "freezers", label: "Freezers", path: "/freezers" },
  { key: "financeiro", label: "Financeiro", path: "/financeiro" },
] as const;

export type TabKey = (typeof ALL_TABS)[number]["key"];

export function useUserTabs() {
  const { session } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useUserRole();

  const { data: tabs = new Set<string>(), isLoading } = useQuery({
    queryKey: ["user-tab-permissions", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return new Set<string>();
      const { data } = await supabase
        .from("user_tab_permissions")
        .select("tab")
        .eq("user_id", session.user.id);
      return new Set((data || []).map((r: any) => r.tab as string));
    },
    enabled: !!session?.user?.id && !isAdmin,
  });

  const allowed = isAdmin
    ? new Set<string>(ALL_TABS.map((t) => t.key))
    : tabs;

  return {
    allowed,
    isAllowed: (key: string) => allowed.has(key),
    isLoading: roleLoading || (!isAdmin && isLoading),
  };
}
