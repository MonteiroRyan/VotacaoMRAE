const mysql = require("mysql2/promise");
require("dotenv").config();

async function checkDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "sistema_votacao",
    });

    console.log("\n✅ Conectado ao MySQL\n");

    // Verificar tabelas
    const [tables] = await connection.query("SHOW TABLES");
    console.log(`📋 Tabelas encontradas: ${tables.length}\n`);

    // Contar registros
    const contagens = await Promise.all([
      connection.query("SELECT COUNT(*) as count FROM municipios"),
      connection.query("SELECT COUNT(*) as count FROM usuarios"),
      connection.query("SELECT COUNT(*) as count FROM eventos_votacao"),
      connection.query("SELECT COUNT(*) as count FROM votos"),
      connection.query("SELECT COUNT(*) as count FROM sessoes"),
    ]);

    console.log("📊 Estatísticas:");
    console.log(`   Municípios: ${contagens[0][0][0].count}`);
    console.log(`   Usuários: ${contagens[1][0][0].count}`);
    console.log(`   Eventos: ${contagens[2][0][0].count}`);
    console.log(`   Votos: ${contagens[3][0][0].count}`);
    console.log(`   Sessões: ${contagens[4][0][0].count}\n`);
  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkDatabase();
