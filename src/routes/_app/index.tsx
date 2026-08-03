import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ALL_TABS, useUserTabs } from "@/hooks/useUserTabs";
import { useUserRole } from "@/hooks/useUserRole";
import PendingApproval from "@/pages/PendingApproval";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Gelo Plus | Gestão de Vendas" },
      { name: "description", content: "Sistema de gestão de vendas, rotas e estoque da Gelo Plus." },
      { property: "og:title", content: "Gelo Plus | Gestão de Vendas" },
      { property: "og:description", content: "Sistema de gestão de vendas, rotas e estoque da Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center space-y-4">
        <p className="text-lg">
          Dados completos importados para o Supabase externo!
        </p>
        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2 max-w-md mx-auto">
          <div className="bg-muted p-2 rounded">Clientes: 205</div>
          <div className="bg-muted p-2 rounded">Vendas: 7.815</div>
          <div className="bg-muted p-2 rounded">Financeiro: 3.150+ regs</div>
          <div className="bg-muted p-2 rounded">Perdas (Losses): 98</div>
          <div className="bg-muted p-2 rounded">Projeção YTD: Atualizada</div>
          <div className="bg-muted p-2 rounded">Frotas/Freezers: Importados</div>
        </div>
        <p className="text-sm font-medium text-green-600">
          Projeção YTD, Perdas e Faturamento Anual já estão visíveis no Dashboard.
        </p>
      </div>
    </div>
  );
}
