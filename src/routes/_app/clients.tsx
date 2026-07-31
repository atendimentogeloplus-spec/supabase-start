import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Clients";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/clients")({
  head: () => ({
    meta: [
      { title: "Clients | Gelo Plus" },
      { name: "description", content: "Gestão de Clients no sistema Gelo Plus." },
      { property: "og:title", content: "Clients | Gelo Plus" },
      { property: "og:description", content: "Gestão de Clients no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="clients">
      <Page />
    </RequireTab>
  ),
});
