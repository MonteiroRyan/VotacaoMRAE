const express = require("express");
const router = express.Router();
const multer = require("multer");
const importController = require("../controllers/importController");
const { verificarAdmin } = require("../middleware/authMiddleware");

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Tipo de arquivo não permitido. Use .xlsx, .xls ou .csv"));
    }
  },
});

// Baixar modelo de planilha
router.get("/modelo", verificarAdmin, importController.baixarModelo);

// Processar planilha (preview)
router.post(
  "/processar",
  verificarAdmin,
  upload.single("arquivo"),
  importController.processarPlanilha
);

// Confirmar importação
router.post("/confirmar", verificarAdmin, importController.importarDados);

module.exports = router;
