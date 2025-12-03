const { body, param, validationResult } = require("express-validator");

const validationMiddleware = {
  // Validação de login
  validateLogin: [
    body("cpf")
      .trim()
      .notEmpty()
      .withMessage("CPF é obrigatório")
      .isLength({ min: 11, max: 14 })
      .withMessage("CPF inválido")
      .matches(/^[0-9.-]+$/)
      .withMessage("CPF contém caracteres inválidos"),
    body("senha")
      .optional()
      .isLength({ min: 6, max: 100 })
      .withMessage("Senha deve ter entre 6 e 100 caracteres")
      .trim()
      .escape(),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }
      next();
    },
  ],

  // Validação de criação de usuário
  validateUsuario: [
    body("cpf")
      .trim()
      .notEmpty()
      .withMessage("CPF é obrigatório")
      .isLength({ min: 11, max: 11 })
      .withMessage("CPF deve ter 11 dígitos")
      .isNumeric()
      .withMessage("CPF deve conter apenas números"),
    body("nome")
      .trim()
      .notEmpty()
      .withMessage("Nome é obrigatório")
      .isLength({ min: 3, max: 100 })
      .withMessage("Nome deve ter entre 3 e 100 caracteres")
      .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
      .withMessage("Nome contém caracteres inválidos"),
    body("tipo")
      .trim()
      .notEmpty()
      .withMessage("Tipo é obrigatório")
      .isIn(["ADMIN", "PREFEITO", "REPRESENTANTE"])
      .withMessage("Tipo inválido"),
    body("senha")
      .optional()
      .isLength({ min: 8 })
      .withMessage("Senha deve ter no mínimo 8 caracteres")
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage("Senha deve conter maiúsculas, minúsculas e números"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }
      next();
    },
  ],

  // Validação de evento
  validateEvento: [
    body("titulo")
      .trim()
      .notEmpty()
      .withMessage("Título é obrigatório")
      .isLength({ min: 5, max: 500 })
      .withMessage("Título deve ter entre 5 e 500 caracteres")
      .escape(),
    body("tipo_votacao")
      .notEmpty()
      .withMessage("Tipo de votação é obrigatório")
      .isIn(["APROVACAO", "ALTERNATIVAS", "SIM_NAO"])
      .withMessage("Tipo de votação inválido"),
    body("data_inicio")
      .notEmpty()
      .withMessage("Data de início é obrigatória")
      .isISO8601()
      .withMessage("Data de início inválida"),
    body("data_fim")
      .notEmpty()
      .withMessage("Data de fim é obrigatória")
      .isISO8601()
      .withMessage("Data de fim inválida"),
    body("peso_minimo_quorum")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Quórum deve estar entre 0 e 100"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }
      next();
    },
  ],

  // Validação de voto
  validateVoto: [
    body("votos")
      .isArray({ min: 1 })
      .withMessage("Pelo menos um voto é obrigatório"),
    body("evento_id")
      .notEmpty()
      .withMessage("ID do evento é obrigatório")
      .isInt({ min: 1 })
      .withMessage("ID do evento inválido"),
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
        });
      }
      next();
    },
  ],
};

module.exports = validationMiddleware;
