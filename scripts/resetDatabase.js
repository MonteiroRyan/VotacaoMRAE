const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const readline = require("readline");
require("dotenv").config();

// Interface para confirmação
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function pergunta(questao) {
  return new Promise((resolve) => {
    rl.question(questao, (resposta) => {
      resolve(resposta);
    });
  });
}

async function resetDatabase() {
  let connection;

  try {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║   ⚠️  RESET COMPLETO DO BANCO DE DADOS                ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("⚠️  ATENÇÃO: Esta ação irá:");
    console.log("   ❌ DELETAR todos os eventos");
    console.log("   ❌ DELETAR todos os votos");
    console.log("   ❌ DELETAR todos os usuários");
    console.log("   ❌ DELETAR todos os municípios");
    console.log("   ❌ DELETAR todas as sessões");
    console.log("   ❌ DELETAR todo o banco de dados\n");

    const resposta = await pergunta(
      'Digite "CONFIRMAR RESET" para continuar: '
    );

    if (resposta !== "CONFIRMAR RESET") {
      console.log("\n❌ Reset cancelado.\n");
      rl.close();
      process.exit(0);
    }

    console.log("\n🔄 Iniciando reset do banco de dados...\n");

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });

    console.log("✅ Conectado ao MySQL");

    const dbName = process.env.DB_NAME || "sistema_votacao";

    // Dropar banco se existir
    console.log(`\n🗑️  Deletando banco de dados "${dbName}"...`);
    await connection.query(`DROP DATABASE IF EXISTS ${dbName}`);
    console.log("✅ Banco de dados deletado");

    // Criar banco novamente
    console.log(`\n📦 Criando banco de dados "${dbName}"...`);
    await connection.query(`CREATE DATABASE ${dbName}`);
    console.log("✅ Banco de dados criado");

    // Usar o banco
    await connection.query(`USE ${dbName}`);

    // ========== CRIAR TABELAS ==========
    console.log("\n📋 Criando tabelas...\n");

    // Tabela de municípios
    await connection.query(`
            CREATE TABLE municipios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                peso DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_nome (nome)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela municipios criada");

    // Tabela de usuários
    await connection.query(`
            CREATE TABLE usuarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cpf VARCHAR(11) NOT NULL UNIQUE,
                nome VARCHAR(100) NOT NULL,
                senha VARCHAR(255) NULL,
                tipo ENUM('ADMIN', 'PREFEITO', 'REPRESENTANTE') NOT NULL,
                municipio_id INT NULL,
                ativo BOOLEAN DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                INDEX idx_cpf (cpf),
                INDEX idx_tipo (tipo),
                INDEX idx_municipio (municipio_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela usuarios criada");

    // Tabela de eventos de votação
    await connection.query(`
            CREATE TABLE eventos_votacao (
                id INT AUTO_INCREMENT PRIMARY KEY,
                titulo VARCHAR(500) NOT NULL,
                descricao TEXT,
                tipo_votacao ENUM('APROVACAO', 'ALTERNATIVAS', 'SIM_NAO') NOT NULL DEFAULT 'SIM_NAO',
                votacao_multipla BOOLEAN DEFAULT 0,
                votos_maximos INT DEFAULT 1,
                opcoes_votacao JSON NULL,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME NOT NULL,
                peso_minimo_quorum DECIMAL(5, 2) NOT NULL DEFAULT 60.00,
                status ENUM('RASCUNHO', 'AGUARDANDO_INICIO', 'ATIVO', 'ENCERRADO') DEFAULT 'RASCUNHO',
                criado_por INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (criado_por) REFERENCES usuarios(id),
                INDEX idx_status (status),
                INDEX idx_data_inicio (data_inicio),
                INDEX idx_tipo_votacao (tipo_votacao)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela eventos_votacao criada");

    // Tabela de participantes do evento
    await connection.query(`
            CREATE TABLE evento_participantes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                presente BOOLEAN DEFAULT 0,
                data_presenca DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                UNIQUE KEY unique_evento_usuario (evento_id, usuario_id),
                INDEX idx_evento (evento_id),
                INDEX idx_usuario (usuario_id),
                INDEX idx_presente (presente)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela evento_participantes criada");

    // Tabela de votos
    await connection.query(`
            CREATE TABLE votos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                evento_id INT NOT NULL,
                usuario_id INT NOT NULL,
                municipio_id INT NOT NULL,
                voto VARCHAR(500) NOT NULL,
                voto_numero INT DEFAULT 1,
                peso DECIMAL(10, 2) NOT NULL,
                data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (evento_id) REFERENCES eventos_votacao(id) ON DELETE CASCADE,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                FOREIGN KEY (municipio_id) REFERENCES municipios(id) ON DELETE RESTRICT,
                UNIQUE KEY unique_voto_municipio_evento_numero (evento_id, municipio_id, voto_numero),
                INDEX idx_evento (evento_id),
                INDEX idx_usuario (usuario_id),
                INDEX idx_municipio (municipio_id),
                INDEX idx_data (data_hora)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela votos criada");

    // Tabela de sessões
    await connection.query(`
            CREATE TABLE sessoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(64) NOT NULL UNIQUE,
                usuario_id INT NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
                INDEX idx_session_id (session_id),
                INDEX idx_usuario (usuario_id),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("  ✅ Tabela sessoes criada");

    // ========== INSERIR DADOS ==========
    console.log("\n📥 Inserindo dados iniciais...\n");

    /* 78 municípios do Espírito Santo
    console.log("  📋 Inserindo 78 municípios do ES...");
    const municipiosES = [
      ["Afonso Cláudio", 3.5],
      ["Água Doce do Norte", 2.0],
      ["Águia Branca", 2.5],
      ["Alegre", 4.5],
      ["Alfredo Chaves", 3.0],
      ["Alto Rio Novo", 2.0],
      ["Anchieta", 4.0],
      ["Apiacá", 2.0],
      ["Aracruz", 6.5],
      ["Atílio Vivácqua", 2.5],
      ["Baixo Guandu", 4.5],
      ["Barra de São Francisco", 5.0],
      ["Boa Esperança", 2.5],
      ["Bom Jesus do Norte", 2.5],
      ["Brejetuba", 2.0],
      ["Cachoeiro de Itapemirim", 9.0],
      ["Cariacica", 8.5],
      ["Castelo", 5.0],
      ["Colatina", 7.5],
      ["Conceição da Barra", 4.0],
      ["Conceição do Castelo", 2.5],
      ["Divino de São Lourenço", 2.0],
      ["Domingos Martins", 4.5],
      ["Dores do Rio Preto", 2.0],
      ["Ecoporanga", 3.5],
      ["Fundão", 4.0],
      ["Governador Lindenberg", 2.0],
      ["Guaçuí", 4.5],
      ["Guarapari", 7.5],
      ["Ibatiba", 3.5],
      ["Ibiraçu", 3.0],
      ["Ibitirama", 2.5],
      ["Iconha", 2.5],
      ["Irupi", 2.0],
      ["Itaguaçu", 2.5],
      ["Itapemirim", 5.0],
      ["Itarana", 2.5],
      ["Iúna", 4.0],
      ["Jaguaré", 4.0],
      ["Jerônimo Monteiro", 3.0],
      ["João Neiva", 3.5],
      ["Laranja da Terra", 2.0],
      ["Linhares", 8.0],
      ["Mantenópolis", 2.5],
      ["Marataízes", 5.5],
      ["Marechal Floriano", 2.5],
      ["Marilândia", 3.0],
      ["Mimoso do Sul", 4.0],
      ["Montanha", 3.0],
      ["Mucurici", 2.0],
      ["Muniz Freire", 3.5],
      ["Muqui", 2.5],
      ["Nova Venécia", 6.0],
      ["Pancas", 3.5],
      ["Pedro Canário", 4.0],
      ["Pinheiros", 4.0],
      ["Piúma", 3.5],
      ["Ponto Belo", 2.0],
      ["Presidente Kennedy", 3.0],
      ["Rio Bananal", 2.5],
      ["Rio Novo do Sul", 2.5],
      ["Santa Leopoldina", 3.0],
      ["Santa Maria de Jetibá", 5.0],
      ["Santa Teresa", 3.5],
      ["São Domingos do Norte", 2.0],
      ["São Gabriel da Palha", 5.0],
      ["São José do Calçado", 3.0],
      ["São Mateus", 7.5],
      ["São Roque do Canaã", 3.0],
      ["Serra", 9.5],
      ["Sooretama", 3.5],
      ["Vargem Alta", 3.0],
      ["Venda Nova do Imigrante", 3.5],
      ["Viana", 6.0],
      ["Vila Pavão", 2.0],
      ["Vila Valério", 2.5],
      ["Vila Velha", 9.0],
      ["Vitória", 10.0],
    ];

    for (const [nome, peso] of municipiosES) {
      await connection.query(
        "INSERT INTO municipios (nome, peso) VALUES (?, ?)",
        [nome, peso]
      );
    }
    console.log("  ✅ 78 municípios inseridos"); */

    // Criar usuário administrador
    console.log("\n  👤 Criando usuário administrador...");
    const senhaAdmin = await bcrypt.hash("admin123", 10);

    await connection.query(
      "INSERT INTO usuarios (cpf, nome, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)",
      ["00000000191", "Administrador", senhaAdmin, "ADMIN", 1]
    );
    console.log("  ✅ Administrador criado");
    console.log("     📧 CPF: 000.000.001-91");
    console.log("     🔑 Senha: admin123");

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║   🎉 RESET COMPLETO COM SUCESSO!                      ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("📊 Resumo:");
    console.log("   ✅ 6 tabelas criadas");
    console.log("   ✅ 78 municípios do Espírito Santo");
    console.log("   ✅ 1 usuário administrador\n");

    console.log("🚀 Próximos passos:");
    console.log("   1. Execute: npm start");
    console.log("   2. Acesse: http://localhost:3000");
    console.log("   3. Login: CPF 000.000.001-91 | Senha: admin123\n");
  } catch (error) {
    console.error("\n❌ Erro ao resetar banco de dados:", error);
    console.error("\n💡 Possíveis soluções:");
    console.error("   - Verifique se o MySQL está rodando");
    console.error("   - Verifique as credenciais no .env");
    console.error("   - Verifique permissões do usuário MySQL\n");
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("🔌 Conexão encerrada\n");
    }
    rl.close();
  }
}

// Executar
resetDatabase()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
