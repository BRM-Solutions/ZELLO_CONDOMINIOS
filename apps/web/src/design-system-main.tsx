import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppToaster } from "./components/ui/AppToaster";
import { BrandingProvider } from "./contexts/BrandingContext";
import DesignSystemPage from "./pages/DesignSystemPage";
import "./tokens.css";
import "./styles.css";

// Entrada só de desenvolvimento (não entra no build): mostra a vitrine sem login nem Supabase.
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <BrandingProvider>
        <DesignSystemPage />
        <AppToaster />
      </BrandingProvider>
    </BrowserRouter>
  </StrictMode>,
);
