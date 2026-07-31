import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Leads";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/leads")({
  head: () => ({
    meta: [
      { title: "Leads | Gelo Plus" },
      { name: "description", content: "Gestão de Leads no sistema Gelo Plus." },
      { property: "og:title", content: "Leads | Gelo Plus" },
      { property: "og:description", content: "Gestão de Leads no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="leads">
      <Page />
    </RequireTab>
  ),
});
