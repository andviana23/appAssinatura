import { createRoot } from "react-dom/client";

const App = () => (
  <div style={{
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    fontFamily: "system-ui, sans-serif"
  }}>
    <div style={{
      backgroundColor: "white",
      padding: "2rem",
      borderRadius: "8px",
      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      maxWidth: "400px",
      width: "100%"
    }}>
      <h1 style={{
        fontSize: "1.5rem",
        fontWeight: "bold",
        color: "#1f2937",
        marginBottom: "1rem"
      }}>
        Sistema Barbershop
      </h1>
      <p style={{
        color: "#6b7280",
        marginBottom: "1.5rem"
      }}>
        Aplicação carregada com sucesso!
      </p>
      <button 
        onClick={() => window.location.href = "/login"}
        style={{
          width: "100%",
          backgroundColor: "#3b82f6",
          color: "white",
          fontWeight: "500",
          padding: "0.5rem 1rem",
          borderRadius: "4px",
          border: "none",
          cursor: "pointer",
          transition: "background-color 0.2s"
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
      >
        Fazer Login
      </button>
    </div>
  </div>
);

const root = createRoot(document.getElementById("root")!);
root.render(<App />);