import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { config } from "dotenv";

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Configurar sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'trato-barbados-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Create server instance
  const server = app.listen(5000, "0.0.0.0", () => {
    log(`serving on port 5000`);
    
    // Iniciar sincronização automática com Asaas
    iniciarSincronizacaoAutomatica();
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Função para sincronização automática com Asaas
  async function syncAsaasAutomatico() {
    try {
      console.log('🔄 Executando sincronização automática com Asaas...');
      
      const response = await fetch(`http://localhost:5000/api/sync/clientes-asaas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Sincronização automática concluída: ${result.total} clientes processados`);
      } else {
        console.log('❌ Erro na sincronização automática');
      }
    } catch (error) {
      console.log('❌ Erro na sincronização automática:', error);
    }
  }

  // Configurar sincronização automática
  function iniciarSincronizacaoAutomatica() {
    // Sincronizar 30 segundos após iniciar o servidor
    setTimeout(() => {
      syncAsaasAutomatico();
    }, 30000);
    
    // Depois a cada 24 horas
    setInterval(() => {
      syncAsaasAutomatico();
    }, 24 * 60 * 60 * 1000); // 24 horas
    
    console.log('⏰ Sincronização automática configurada para executar a cada 24 horas');
  }

  // Exportar função para usar após criação de assinaturas
  (global as any).triggerAsaasSync = syncAsaasAutomatico;
})();
