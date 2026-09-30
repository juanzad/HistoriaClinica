import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import helmet from "helmet";

dotenv.config();

// Sirve la app: en desarrollo con Vite, en producción desde dist/. No tiene rutas de API:
// la app no envía datos de salud a ningún servicio de IA.
async function startServer() {
  const app = express();
  const PORT = 3000;
  const isProduction = process.env.NODE_ENV === "production";

  app.disable("x-powered-by");

  // Cabeceras de seguridad. La CSP solo se aplica en producción porque Vite
  // inyecta scripts inline en desarrollo.
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "https://apis.google.com"],
              styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
              imgSrc: ["'self'", "data:", "blob:", "https:"],
              fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
              connectSrc: [
                "'self'",
                "https://*.googleapis.com",
                "https://*.firebaseio.com",
                "wss://*.firebaseio.com",
                "https://*.firebaseapp.com",
              ],
              frameSrc: ["'self'", "https://*.firebaseapp.com", "https://accounts.google.com"],
              objectSrc: ["'none'"],
              frameAncestors: ["'self'", "https://aistudio.google.com", "https://*.aistudio.google.com"],
            },
          }
        : false,
      // Se usa frame-ancestors de la CSP en su lugar: AI Studio muestra la app en un iframe.
      xFrameOptions: false,
      // Necesario para el popup de inicio de sesión con Google.
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    })
  );

  // Vite middleware for development
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
