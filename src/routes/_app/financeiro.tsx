import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Financeiro";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro | Gelo Plus" },
      { name: "description", content: "Gestão de Financeiro no sistema Gelo Plus." },
      { property: "og:title", content: "Financeiro | Gelo Plus" },
      { property: "og:description", content: "Gestão de Financeiro no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="financeiro">
      <Page />
    </RequireTab>
  ),
});
