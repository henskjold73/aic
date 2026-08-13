import type { JSX } from "react";
import { inject } from "@vercel/analytics";
import { CalendarPage } from "@/pages/CalendarPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { ReportPage } from "@/pages/ReportPage";
import { TeamCreatePage } from "@/pages/TeamCreatePage";
import { TeamJoinPage } from "@/pages/TeamJoinPage";
import { TeamViewPage } from "@/pages/TeamViewPage";
import { resolveRoute } from "@/router";

inject();

/** Root component — resolves the current path to a page. */
export default function App(): JSX.Element {
  const route = resolveRoute();

  switch (route.kind) {
    case "privacy":
      return <PrivacyPage />;
    case "report":
      return <ReportPage />;
    case "team-create":
      return <TeamCreatePage />;
    case "team-join":
      return <TeamJoinPage teamId={route.teamId} />;
    case "team-view":
      return <TeamViewPage teamId={route.teamId} />;
    case "calendar":
      return <CalendarPage openSyncModal={route.openSyncModal} />;
  }
}
