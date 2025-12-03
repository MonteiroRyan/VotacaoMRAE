const fs = require("fs");
const path = require("path");

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

function logAudit(tipo, usuario, acao, detalhes, ip) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    tipo,
    usuario: usuario?.nome || "Anônimo",
    usuario_id: usuario?.id || null,
    acao,
    detalhes,
    ip,
  };

  const logFile = path.join(
    logDir,
    `audit-${new Date().toISOString().split("T")[0]}.log`
  );
  fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n");
}

const auditMiddleware = {
  logLogin: (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (data.success && data.usuario) {
        logAudit(
          "LOGIN",
          data.usuario,
          "Login realizado",
          { cpf: data.usuario.cpf },
          req.ip
        );
      } else if (!data.success) {
        logAudit(
          "LOGIN_FAILED",
          null,
          "Tentativa de login falhou",
          { cpf: req.body.cpf },
          req.ip
        );
      }
      return originalJson(data);
    };
    next();
  },

  logVoto: (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (data.success && req.usuario) {
        logAudit(
          "VOTO",
          req.usuario,
          "Voto registrado",
          {
            evento_id: req.body.evento_id,
            quantidade_votos: req.body.votos?.length || 1,
          },
          req.ip
        );
      }
      return originalJson(data);
    };
    next();
  },

  logEventoAction: (acao) => (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (data) {
      if (data.success && req.usuario) {
        logAudit(
          "EVENTO",
          req.usuario,
          acao,
          {
            evento_id: req.params.id || data.evento?.id,
          },
          req.ip
        );
      }
      return originalJson(data);
    };
    next();
  },
};

module.exports = { auditMiddleware, logAudit };
