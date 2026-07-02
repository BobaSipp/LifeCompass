import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// Suppress benign "ResizeObserver loop" errors (emitted by Recharts' ResponsiveContainer).
// Without this they surface as a CRA dev error overlay that flashes before charts render.
const IGNORED = ["ResizeObserver loop", "ResizeObserver loop completed with undelivered notifications"];
const isIgnored = (m) => typeof m === "string" && IGNORED.some((e) => m.includes(e));
window.addEventListener("error", (e) => {
  if (isIgnored(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
    const overlay = document.getElementById("webpack-dev-server-client-overlay");
    if (overlay) overlay.style.display = "none";
  }
});
window.addEventListener("unhandledrejection", (e) => {
  if (isIgnored(e.reason?.message)) {
    e.preventDefault();
    const overlay = document.getElementById("webpack-dev-server-client-overlay");
    if (overlay) overlay.style.display = "none";
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
