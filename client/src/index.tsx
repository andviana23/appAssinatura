import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Sistema Barbershop</h1>
      <p>Aplicação carregada com sucesso!</p>
      <button onClick={() => window.location.href = "/login"}>
        Fazer Login
      </button>
    </div>
  );
}

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}