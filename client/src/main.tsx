import { createRoot } from "react-dom/client";
import App from "./App-simple";
import "./index.css";

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registrado com sucesso: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration falhou: ', registrationError);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
