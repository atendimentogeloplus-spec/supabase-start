import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Fleet";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/fleet")({
  head: () => ({
    meta: [
      { title: "Fleet | Gelo Plus" },
      { name: "description", content: "Gestão de Fleet no sistema Gelo Plus." },
      { property: "og:title", content: "Fleet | Gelo Plus" },
      { property: "og:description", content: "Gestão de Fleet no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="fleet">
      <Page />
    </RequireTab>
  ),
});
