const crypto = require("crypto");

function generateSecureSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

function rotateSession(req, res, next) {
  // Rotacionar session ID a cada 30 minutos
  const sessionAge = Date.now() - new Date(req.session?.created_at).getTime();
  const thirtyMinutes = 30 * 60 * 1000;

  if (sessionAge > thirtyMinutes) {
    // Criar nova sessão
    const newSessionId = generateSecureSessionId();
    // Atualizar no banco...
  }

  next();
}

module.exports = { generateSecureSessionId, rotateSession };
