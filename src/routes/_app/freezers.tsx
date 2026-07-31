import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Freezers";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/freezers")({
  head: () => ({
    meta: [
      { title: "Freezers | Gelo Plus" },
      { name: "description", content: "Gestão de Freezers no sistema Gelo Plus." },
      { property: "og:title", content: "Freezers | Gelo Plus" },
      { property: "og:description", content: "Gestão de Freezers no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="freezers">
      <Page />
    </RequireTab>
  ),
});
