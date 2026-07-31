import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Sales";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/sales")({
  head: () => ({
    meta: [
      { title: "Sales | Gelo Plus" },
      { name: "description", content: "Gestão de Sales no sistema Gelo Plus." },
      { property: "og:title", content: "Sales | Gelo Plus" },
      { property: "og:description", content: "Gestão de Sales no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="sales">
      <Page />
    </RequireTab>
  ),
});
