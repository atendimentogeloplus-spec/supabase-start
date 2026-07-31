import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Products";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/products")({
  head: () => ({
    meta: [
      { title: "Products | Gelo Plus" },
      { name: "description", content: "Gestão de Products no sistema Gelo Plus." },
      { property: "og:title", content: "Products | Gelo Plus" },
      { property: "og:description", content: "Gestão de Products no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="products">
      <Page />
    </RequireTab>
  ),
});
