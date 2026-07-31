import { createFileRoute } from "@tanstack/react-router";
import Admin from "@/pages/Admin";
import { useUserRole } from "@/hooks/useUserRole";
import NotFound from "@/pages/NotFound";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Gelo Plus" },
      { name: "description", content: "Painel administrativo de usuários e permissões da Gelo Plus." },
      { property: "og:title", content: "Administração | Gelo Plus" },
      { property: "og:description", content: "Painel administrativo de usuários e permissões da Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminRoute,
});

function AdminRoute() {
  const { isAdmin, isLoading } = useUserRole();
  if (isLoading) return <p className="text-muted-foreground">Carregando...</p>;
  if (!isAdmin) return <NotFound />;
  return <Admin />;
}
