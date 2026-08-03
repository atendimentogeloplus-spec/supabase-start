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
      <p className="text-lg">vou trazer um arquivo csv aqui do meu banco de dados, voce consegue puxar ?</p>
    </div>
  );
}
