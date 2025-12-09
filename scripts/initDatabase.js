const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function initDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
    });

    console.log("✅ Conectado ao MySQL");

    // Criar banco de dados
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || "mrae"}`
    );
    console.log("✅ Banco de dados criado/verificado");

    // Usar o banco
    await connection.query(`USE ${process.env.DB_NAME || "mrae"}`);

    // ========== CRIAR TABELAS ==========

    // Tabela de municípios
    await connection.query(`
            CREATE TABLE IF NOT EXISTS municipios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                peso DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_nome (nome)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    console.log("✅ Tabela municipios criada");

    // Tabela de usuários
    await connection.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
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
    console.log("✅ Tabela usuarios criada");

    // Tabela de eventos de votação (SEM BINARIO, COM votacao_multipla e votos_maximos)
    await connection.query(`
            CREATE TABLE IF NOT EXISTS eventos_votacao (
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
    console.log(
      "✅ Tabela eventos_votacao criada (sem BINARIO, com votacao_multipla)"
    );

    // Tabela de participantes do evento
    await connection.query(`
            CREATE TABLE IF NOT EXISTS evento_participantes (
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
    console.log("✅ Tabela evento_participantes criada");

    // Tabela de votos (com suporte a múltiplos votos por município via voto_numero)
    await connection.query(`
            CREATE TABLE IF NOT EXISTS votos (
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
    console.log(
      "✅ Tabela votos criada (com suporte a votacao multipla via voto_numero)"
    );

    // Tabela de sessões
    await connection.query(`
            CREATE TABLE IF NOT EXISTS sessoes (
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
    console.log("✅ Tabela sessoes criada");

    // ========== INSERIR DADOS ==========

    console.log("\n📋 Inserindo municípios do Espírito Santo...");

    /* 78 municípios do Espírito Santo com pesos
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

    let inseridos = 0;
    for (const [nome, peso] of municipiosES) {
      try {
        await connection.query(
          "INSERT IGNORE INTO municipios (nome, peso) VALUES (?, ?)",
          [nome, peso]
        );
        inseridos++;
      } catch (error) {
        console.error(`Erro ao inserir ${nome}:`, error.message);
      }
    }
    console.log(`✅ ${inseridos} municípios do Espírito Santo inseridos`); */

    // Criar usuário administrador padrão
    console.log("\n👤 Criando usuário administrador...");
    const senhaAdmin = await bcrypt.hash("admin123", 10);

    try {
      await connection.query(
        "INSERT IGNORE INTO usuarios (cpf, nome, senha, tipo, ativo) VALUES (?, ?, ?, ?, ?)",
        ["00000000191", "Administrador", senhaAdmin, "ADMIN", 1]
      );
      console.log("✅ Usuário administrador criado");
      console.log("   📧 CPF: 000.000.001-91");
      console.log("   🔑 Senha: admin123");
    } catch (error) {
      console.log("⚠️  Usuário administrador já existe");
    }

    console.log("   3. Acesse: http://localhost:3000");
    console.log("   4. Login admin: CPF 000.000.001-91 | Senha: admin123");
    console.log("\n💡 Dica: Para recriar o banco execute: npm run reset-db");
  } catch (error) {
    console.error("\n❌ Erro ao inicializar banco de dados:", error);
    console.error("\n💡 Dicas de solução:");
    console.error("   - Verifique se o MySQL está rodando");
    console.error("   - Verifique as credenciais no arquivo .env");
    console.error("   - Verifique as permissões do usuário MySQL");
    console.error("   - Execute: npm run check-db (para diagnóstico)");
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log("\n🔌 Conexão com MySQL encerrada");
    }
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = initDatabase;
