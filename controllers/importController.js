const XLSX = require("xlsx");
const { validarCPF } = require("../utils/validarCPF");

const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require("../server");
  return pool;
};

function limparCPF(cpf) {
  if (!cpf) return "";
  return cpf.toString().replace(/\D/g, "");
}

function formatarErro(linha, campo, mensagem) {
  return {
    linha,
    campo,
    mensagem,
  };
}

const importController = {
  async processarPlanilha(req, res) {
    const pool = getPool();

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nenhum arquivo foi enviado",
        });
      }

      // Ler arquivo Excel
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const dados = XLSX.utils.sheet_to_json(worksheet);

      console.log(`📋 Processando ${dados.length} linhas da planilha`);

      // Validar e processar dados
      const erros = [];
      const usuarios = [];
      const municipiosNovos = new Set();

      // Buscar municípios existentes
      const [municipiosExistentes] = await pool.query(
        "SELECT nome, peso FROM municipios"
      );
      const municipiosMap = new Map(
        municipiosExistentes.map((m) => [m.nome.toUpperCase(), m.peso])
      );

      for (let i = 0; i < dados.length; i++) {
        const linha = i + 2; // +2 porque linha 1 é cabeçalho e array começa em 0
        const row = dados[i];

        // Validar campos obrigatórios
        if (!row.cpf) {
          erros.push(formatarErro(linha, "cpf", "CPF é obrigatório"));
          continue;
        }

        if (!row.nome) {
          erros.push(formatarErro(linha, "nome", "Nome é obrigatório"));
          continue;
        }

        if (!row.tipo) {
          erros.push(
            formatarErro(
              linha,
              "tipo",
              "Tipo é obrigatório (PREFEITO ou REPRESENTANTE)"
            )
          );
          continue;
        }

        if (!row.municipio) {
          erros.push(
            formatarErro(linha, "municipio", "Município é obrigatório")
          );
          continue;
        }

        // Validar CPF
        const cpfLimpo = limparCPF(row.cpf);
        if (!validarCPF(cpfLimpo)) {
          erros.push(formatarErro(linha, "cpf", `CPF inválido: ${row.cpf}`));
          continue;
        }

        // Validar tipo
        const tipoUpper = row.tipo.toString().toUpperCase().trim();
        if (!["PREFEITO", "REPRESENTANTE"].includes(tipoUpper)) {
          erros.push(
            formatarErro(
              linha,
              "tipo",
              `Tipo inválido: ${row.tipo}. Use PREFEITO ou REPRESENTANTE`
            )
          );
          continue;
        }

        // Verificar duplicados na planilha
        const duplicado = usuarios.find((u) => u.cpf === cpfLimpo);
        if (duplicado) {
          erros.push(
            formatarErro(
              linha,
              "cpf",
              `CPF duplicado na planilha (linha ${duplicado.linha})`
            )
          );
          continue;
        }

        // Adicionar município novo se não existir
        const municipioNome = row.municipio.toString().trim();
        const municipioUpper = municipioNome.toUpperCase();

        let pesoMunicipio = row.peso ? parseFloat(row.peso) : 1.0;

        if (!municipiosMap.has(municipioUpper)) {
          municipiosNovos.add(
            JSON.stringify({ nome: municipioNome, peso: pesoMunicipio })
          );
        }

        // Adicionar usuário válido
        usuarios.push({
          linha,
          cpf: cpfLimpo,
          nome: row.nome.toString().trim(),
          tipo: tipoUpper,
          municipio: municipioNome,
          peso: pesoMunicipio,
          ativo:
            row.ativo !== undefined
              ? row.ativo === true ||
                row.ativo === 1 ||
                row.ativo === "SIM" ||
                row.ativo === "sim" ||
                row.ativo === "Sim"
              : true,
        });
      }

      // Converter Set para Array de objetos
      const municipiosNovosArray = Array.from(municipiosNovos).map((m) =>
        JSON.parse(m)
      );

      // Retornar preview para confirmação
      return res.json({
        success: true,
        preview: {
          totalLinhas: dados.length,
          usuariosValidos: usuarios.length,
          erros: erros.length,
          municipiosNovos: municipiosNovosArray,
          usuarios: usuarios, // ENVIAR TODOS OS USUÁRIOS
          todosErros: erros,
        },
      });
    } catch (error) {
      console.error("Erro ao processar planilha:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao processar planilha: " + error.message,
      });
    }
  },

  async importarDados(req, res) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      const { usuarios, municipiosNovos } = req.body;

      console.log("📥 Iniciando importação:", {
        totalUsuarios: usuarios?.length || 0,
        totalMunicipios: municipiosNovos?.length || 0,
      });

      await connection.beginTransaction();

      let municipiosCriados = 0;
      let usuariosCriados = 0;
      let usuariosAtualizados = 0;
      const errosImportacao = [];

      // 1. Criar municípios novos
      if (municipiosNovos && municipiosNovos.length > 0) {
        for (const municipio of municipiosNovos) {
          try {
            // Verificar se existe
            const [existe] = await connection.query(
              "SELECT id FROM municipios WHERE UPPER(nome) = UPPER(?)",
              [municipio.nome]
            );

            if (existe.length === 0) {
              await connection.query(
                "INSERT INTO municipios (nome, peso) VALUES (?, ?)",
                [municipio.nome, municipio.peso || 1.0]
              );
              municipiosCriados++;
              console.log(`✅ Município criado: ${municipio.nome}`);
            } else {
              console.log(`ℹ️  Município já existe: ${municipio.nome}`);
            }
          } catch (error) {
            console.error(
              `❌ Erro ao criar município ${municipio.nome}:`,
              error
            );
            errosImportacao.push({
              tipo: "municipio",
              nome: municipio.nome,
              erro: error.message,
            });
          }
        }
      }

      // 2. Importar usuários
      if (usuarios && usuarios.length > 0) {
        for (const usuario of usuarios) {
          try {
            // Buscar ID do município
            const [municipio] = await connection.query(
              "SELECT id FROM municipios WHERE UPPER(nome) = UPPER(?)",
              [usuario.municipio]
            );

            if (municipio.length === 0) {
              errosImportacao.push({
                linha: usuario.linha,
                cpf: usuario.cpf,
                erro: `Município não encontrado: ${usuario.municipio}`,
              });
              console.error(
                `❌ Município não encontrado para CPF ${usuario.cpf}: ${usuario.municipio}`
              );
              continue;
            }

            const municipioId = municipio[0].id;

            // Verificar se usuário já existe
            const [usuarioExiste] = await connection.query(
              "SELECT id FROM usuarios WHERE cpf = ?",
              [usuario.cpf]
            );

            if (usuarioExiste.length > 0) {
              // Atualizar
              await connection.query(
                `UPDATE usuarios 
                 SET nome = ?, tipo = ?, municipio_id = ?, ativo = ?
                 WHERE cpf = ?`,
                [
                  usuario.nome,
                  usuario.tipo,
                  municipioId,
                  usuario.ativo ? 1 : 0,
                  usuario.cpf,
                ]
              );
              usuariosAtualizados++;
              console.log(
                `✅ Usuário atualizado: ${usuario.nome} (${usuario.cpf})`
              );
            } else {
              // Inserir novo
              await connection.query(
                `INSERT INTO usuarios (cpf, nome, tipo, municipio_id, ativo)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                  usuario.cpf,
                  usuario.nome,
                  usuario.tipo,
                  municipioId,
                  usuario.ativo ? 1 : 0,
                ]
              );
              usuariosCriados++;
              console.log(
                `✅ Usuário criado: ${usuario.nome} (${usuario.cpf})`
              );
            }
          } catch (error) {
            console.error(`❌ Erro ao importar usuário ${usuario.cpf}:`, error);
            errosImportacao.push({
              linha: usuario.linha,
              cpf: usuario.cpf,
              nome: usuario.nome,
              erro: error.message,
            });
          }
        }
      }

      await connection.commit();

      console.log("✅ Importação concluída:", {
        municipiosCriados,
        usuariosCriados,
        usuariosAtualizados,
        erros: errosImportacao.length,
      });

      return res.json({
        success: true,
        message: "Importação concluída com sucesso",
        resultado: {
          municipiosCriados,
          usuariosCriados,
          usuariosAtualizados,
          erros: errosImportacao.length,
          detalhesErros: errosImportacao,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Erro ao importar dados:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao importar dados: " + error.message,
      });
    } finally {
      connection.release();
    }
  },

  async baixarModelo(req, res) {
    try {
      // Criar modelo de planilha
      const dados = [
        {
          cpf: "12345678901",
          nome: "João da Silva",
          tipo: "PREFEITO",
          municipio: "Vitória",
          peso: 10.0,
          ativo: "SIM",
        },
        {
          cpf: "98765432109",
          nome: "Maria Santos",
          tipo: "REPRESENTANTE",
          municipio: "Vitória",
          peso: 10.0,
          ativo: "SIM",
        },
        {
          cpf: "11122233344",
          nome: "Pedro Oliveira",
          tipo: "PREFEITO",
          municipio: "Serra",
          peso: 9.5,
          ativo: "SIM",
        },
        {
          cpf: "55566677788",
          nome: "Ana Costa",
          tipo: "REPRESENTANTE",
          municipio: "Serra",
          peso: 9.5,
          ativo: "SIM",
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(dados);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Usuários");

      // Ajustar largura das colunas
      worksheet["!cols"] = [
        { wch: 15 }, // cpf
        { wch: 30 }, // nome
        { wch: 15 }, // tipo
        { wch: 25 }, // municipio
        { wch: 10 }, // peso
        { wch: 10 }, // ativo
      ];

      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=modelo_importacao_usuarios.xlsx"
      );
      res.send(buffer);
    } catch (error) {
      console.error("Erro ao gerar modelo:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao gerar modelo: " + error.message,
      });
    }
  },
};

module.exports = importController;
