require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// ========== SEGURANÇA ==========

// Headers de segurança com CSP corrigido
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        styleSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        scriptSrcElem: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
          "data:",
        ],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    message: "Muitas requisições. Aguarde um momento.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Muitos uploads. Tente novamente em 15 minutos.",
  },
});

// ========== MIDDLEWARES ==========

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Servir arquivos estáticos com headers corretos
app.use(
  express.static("public", {
    setHeaders: (res, path) => {
      if (
        path.endsWith(".woff") ||
        path.endsWith(".woff2") ||
        path.endsWith(".ttf")
      ) {
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    },
  })
);

app.use("/api/", apiLimiter);

// ========== BANCO DE DADOS ==========

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "mrae",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

global.pool = pool;

// Testar conexão
pool
  .getConnection()
  .then((connection) => {
    console.log("✅ Conexão com MySQL estabelecida");
    connection.release();
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar com MySQL:", err);
  });

// ========== ROTAS ==========

const authRoutes = require("./routes/authRoutes");
const eventoRoutes = require("./routes/eventoRoutes");
const votoRoutes = require("./routes/votoRoutes");
const adminRoutes = require("./routes/adminRoutes");
const importRoutes = require("./routes/importRoutes");

// Rotas com rate limiting específico
app.use("/api/auth/login", loginLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/eventos", eventoRoutes);
app.use("/api/votos", votoRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/import/processar", uploadLimiter);
app.use("/api/import", importRoutes);

// Rota de saúde
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Rota raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "", "index.html"));
});

// Tratamento de erros 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Rota não encontrada",
  });
});

// Tratamento de erros gerais
app.use((err, req, res, next) => {
  console.error("Erro:", err);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Erro interno do servidor"
        : err.message,
  });
});

// ========== INICIAR SERVIDOR ==========

const server = app.listen(PORT, () => {
  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║        SISTEMA DE VOTAÇÃO MUNICIPAL - ES              ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  console.log(`🚀 Servidor: http://localhost:${PORT}`);
  console.log(`🔒 Ambiente: ${process.env.NODE_ENV || "development"}`);
  console.log(`🛡️  Segurança:`);
  console.log(`   ✓ Rate Limiting ativado`);
  console.log(`   ✓ Helmet (CSP, HSTS, XSS)`);
  console.log(`   ✓ Validação de inputs`);
  console.log(`   ✓ SQL Injection protection`);
  console.log(`   ✓ CORS configurado`);
  console.log(`\n📱 Acesse: http://localhost:${PORT}`);
  console.log(`\n`);
});

// Limpeza de sessões expiradas (a cada hora)
const authController = require("./controllers/authController");
setInterval(() => {
  authController.limparSessoesExpiradas();
}, 60 * 60 * 1000);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n⚠️  SIGTERM recebido. Encerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor encerrado");
    pool.end(() => {
      console.log("✅ Pool de conexões encerrado");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("\n⚠️  SIGINT recebido. Encerrando servidor...");
  server.close(() => {
    console.log("✅ Servidor encerrado");
    pool.end(() => {
      console.log("✅ Pool de conexões encerrado");
      process.exit(0);
    });
  });
});

module.exports = { pool };
