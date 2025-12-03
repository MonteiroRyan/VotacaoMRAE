const mysql = require("mysql2/promise");
require("dotenv").config();

async function updateSchema() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "sistema_votacao",
    });

    console.log("✅ Conectado ao MySQL\n");

    // 1. Adicionar novos tipos de usuário
    console.log("📋 Atualizando ENUM de tipos de usuário...");
    await connection.query(`
            ALTER TABLE usuarios 
            MODIFY COLUMN tipo ENUM('ADMIN', 'PREFEITO', 'REPRESENTANTE', 'GOVERNADOR', 'SECRETARIO') NOT NULL
        `);
    console.log("✅ Tipos GOVERNADOR e SECRETARIO adicionados\n");

    // 2.  Verificar estrutura
    const [columns] = await connection.query(`
            SHOW COLUMNS FROM usuarios WHERE Field = 'tipo'
        `);
    console.log("📊 Estrutura atualizada:");
    console.table(columns);

    console.log("\n✅ Atualização concluída com sucesso!");
    console.log("\n📝 Novos tipos de usuário disponíveis:");
    console.log("   • ADMIN");
    console.log("   • PREFEITO");
    console.log("   • REPRESENTANTE");
    console.log("   • GOVERNADOR (NOVO)");
    console.log("   • SECRETARIO (NOVO)");
  } catch (error) {
    console.error("\n❌ Erro ao atualizar schema:", error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Conexão encerrada");
    }
  }
}

updateSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
