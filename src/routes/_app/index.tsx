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
          Porque meus numeros de agosto estão zerados então ? Em financeiro ?
        </p>
        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-2 max-w-md mx-auto">
          <div className="bg-muted p-2 rounded">Vendas (Agosto/26): 30</div>
          <div className="bg-muted p-2 rounded">Fluxo Caixa (Agosto/26): 20</div>
          <div className="bg-muted p-2 rounded">Transações (Agosto/26): 26</div>
          <div className="bg-muted p-2 rounded">Total Geral Importado: 10.000+</div>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No banco de dados existem registros para agosto de 2026, mas em quantidade muito menor que os meses anteriores do backup.
        </p>
      </div>
    </div>
  );
}
