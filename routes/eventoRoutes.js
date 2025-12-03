const express = require("express");
const router = express.Router();
const eventoController = require("../controllers/eventoController");
const {
  verificarAutenticacao,
  verificarAdmin,
} = require("../middleware/authMiddleware");

// Listar eventos
router.get("/", verificarAutenticacao, eventoController.listarEventos);

// Obter evento específico
router.get("/:id", verificarAutenticacao, eventoController.obterEvento);

// Criar evento (apenas admin)
router.post("/", verificarAdmin, eventoController.criarEvento);

// Iniciar evento
router.post("/:id/iniciar", verificarAdmin, eventoController.iniciarEvento);

// Liberar votação
router.post("/:id/liberar", verificarAdmin, eventoController.liberarVotacao);

// Encerrar evento
router.post("/:id/encerrar", verificarAdmin, eventoController.encerrarEvento);

// Deletar evento
router.delete("/:id", verificarAdmin, eventoController.deletarEvento);

// Exportar CSV
router.get("/:id/exportar-csv", verificarAdmin, eventoController.exportarCSV);

module.exports = router;
