const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
require("dotenv").config();

async function createSecureAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // Gerar senha forte aleatória
    const senhaAleatoria = crypto.randomBytes(16).toString("hex");
    const senhaHash = await bcrypt.hash(senhaAleatoria, 12);

    await connection.query("UPDATE usuarios SET senha = ? WHERE cpf = ?", [
      senhaHash,
      "00000000191",
    ]);

    console.log("\n✅ Senha do administrador atualizada! ");
    console.log("\n🔐 CREDENCIAIS DO ADMINISTRADOR:");
    console.log("   CPF: 000. 000.001-91");
    console.log(`   SENHA: ${senhaAleatoria}`);
    console.log("\n⚠️  GUARDE ESTA SENHA EM LOCAL SEGURO!\n");
  } catch (error) {
    console.error("Erro:", error);
  } finally {
    await connection.end();
  }
}

createSecureAdmin();
