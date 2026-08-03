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
          <div className="bg-muted p-2 rounded">Fluxo de Caixa: 1.031</div>
          <div className="bg-muted p-2 rounded">Transações: 675</div>
          <div className="bg-muted p-2 rounded">Contas a Pagar: 1.149</div>
          <div className="bg-muted p-2 rounded">Contas a Receber: 150</div>
        </div>
        <p className="text-sm font-medium text-destructive">
          Financeiro também está todo errado.
        </p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Verifique se as transações e o fluxo de caixa batem com o esperado. O sistema importou 3.000+ registros financeiros do backup.
        </p>
      </div>
    </div>
  );
}
