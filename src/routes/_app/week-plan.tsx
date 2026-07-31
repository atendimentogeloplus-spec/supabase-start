import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/WeekPlan";
import { RequireTab } from "@/components/RequireTab";

export const Route = createFileRoute("/_app/week-plan")({
  head: () => ({
    meta: [
      { title: "WeekPlan | Gelo Plus" },
      { name: "description", content: "Gestão de WeekPlan no sistema Gelo Plus." },
      { property: "og:title", content: "WeekPlan | Gelo Plus" },
      { property: "og:description", content: "Gestão de WeekPlan no sistema Gelo Plus." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireTab tab="week-plan">
      <Page />
    </RequireTab>
  ),
});
