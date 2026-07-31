import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Reports";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports | Gelo Plus" },
      { name: "description", content: "Gestão de Reports no sistema Gelo Plus." },
      { property: "og:title", content: "Reports | Gelo Plus" },
      { property: "og:description", content: "Gestão de Reports no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="reports">
      <Page />
    </RequireTab>
  ),
});
