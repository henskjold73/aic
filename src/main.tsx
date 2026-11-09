import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App";
import { loadSession } from "@/lib/session";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element #root not found in index.html');
}
const root = ReactDOM.createRoot(container);

// Resolve who is signed in before the first render so pages can read the
// session synchronously. `loadSession` never rejects.
loadSession().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
