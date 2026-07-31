import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Stock";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/stock")({
  head: () => ({
    meta: [
      { title: "Stock | Gelo Plus" },
      { name: "description", content: "Gestão de Stock no sistema Gelo Plus." },
      { property: "og:title", content: "Stock | Gelo Plus" },
      { property: "og:description", content: "Gestão de Stock no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="stock">
      <Page />
    </RequireTab>
  ),
});
