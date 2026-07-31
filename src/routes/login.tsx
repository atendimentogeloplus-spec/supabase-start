import { createFileRoute, Navigate } from "@tanstack/react-router";
import Auth from "@/pages/Auth";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Gelo Plus" },
      { name: "description", content: "Acesse o sistema de gestão da Gelo Plus." },
      { property: "og:title", content: "Entrar | Gelo Plus" },
      { property: "og:description", content: "Acesse o sistema de gestão da Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (session) return <Navigate to="/" replace />;
  return <Auth />;
}
