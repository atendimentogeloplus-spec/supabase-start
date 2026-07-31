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
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { allowed, isLoading } = useUserTabs();

  if (roleLoading || isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  const first = ALL_TABS.find((t) => isAdmin || allowed.has(t.key));
  if (!first) return <PendingApproval />;

  return <Navigate to={first.path} replace />;
}
