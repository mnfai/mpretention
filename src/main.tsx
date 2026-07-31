import React from "react";
import ReactDOM from "react-dom/client";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import App from "./App";
import "./index.css";

function logCrash(source: string, err: unknown) {
  const text = `--- ${source} ${new Date().toISOString()} ---\n${
    err instanceof Error ? (err.stack ?? err.message) : String(err)
  }\n`;
  writeTextFile("/tmp/mpretention-crash.log", text).catch(() => {});
}

window.addEventListener("error", (e) => logCrash("window.error", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => logCrash("unhandledrejection", e.reason));

try {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (err) {
  logCrash("render-throw", err);
}
