import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installAuthFetch } from "./lib/auth.ts";
import "./styles.css";

// 所有请求自动带上Admin password (若已Log in)
installAuthFetch();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
