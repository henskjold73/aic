import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { UI_ZOOM } from "@/lib/constants";
import { loadSession } from "@/lib/session";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element #root not found in index.html');
}
const root = ReactDOM.createRoot(container);

// Render everything at UI_ZOOM (see constants.ts) — equivalent to browser zoom.
document.documentElement.style.zoom = String(UI_ZOOM);

// Resolve who is signed in before the first render so pages can read the
// session synchronously. `loadSession` never rejects.
loadSession().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
