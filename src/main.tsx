import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { LangProvider } from "./i18n";
import { SettingsProvider } from "./settings";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LangProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </LangProvider>
  </React.StrictMode>,
);
