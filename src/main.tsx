import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { installCopyGuard } from "./lib/guard";
import { installAudioUnlock } from "./lib/feedback";
import { installPwa } from "./lib/pwa";

installCopyGuard();
installAudioUnlock();
installPwa();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
