const xss = require("xss");

function sanitizeInput(input) {
  if (typeof input === "string") {
    return xss(input, {
      whiteList: {}, // Não permite nenhuma tag HTML
      stripIgnoreTag: true,
      stripIgnoreTagBody: ["script"],
    });
  }
  return input;
}

function sanitizeObject(obj) {
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      sanitized[key] = sanitizeInput(obj[key]);
    }
  }
  return sanitized;
}

module.exports = { sanitizeInput, sanitizeObject };
