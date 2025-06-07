import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

function SimpleApp() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Sistema Barbershop
        </h1>
        <p className="text-gray-600 mb-6">
          Aplicação carregada com sucesso!
        </p>
        <button 
          onClick={() => window.location.href = "/login"}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Fazer Login
        </button>
      </div>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <SimpleApp />
    </StrictMode>
  );
}