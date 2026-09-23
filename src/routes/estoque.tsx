import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque | LeadTrack" },
      { name: "description", content: "Controle de estoque de produtos." },
      { property: "og:title", content: "Estoque | LeadTrack" },
      { property: "og:description", content: "Controle de estoque de produtos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <EstoquePage />
    </AppShell>
  ),
});

function EstoquePage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <p className="text-muted-foreground">Acesso restrito a administradores.</p>;
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Estoque</h1>
      <p className="text-muted-foreground">Área de estoque pronta para receber as funcionalidades.</p>
    </div>
  );
}
