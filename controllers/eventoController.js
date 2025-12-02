const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require("../server");
  return pool;
};

const eventoController = {
  // Criar evento com votação múltipla
  async criarEvento(req, res) {
    const pool = getPool();

    try {
      const {
        titulo,
        descricao,
        tipo_votacao,
        votacao_multipla,
        votos_maximos,
        opcoes_votacao,
        data_inicio,
        data_fim,
        peso_minimo_quorum,
        participantes,
      } = req.body;
      const usuario = req.usuario;

      if (!titulo || !data_inicio || !data_fim || !tipo_votacao) {
        return res.status(400).json({
          success: false,
          message: "Título, datas e tipo de votação são obrigatórios",
        });
      }

      const tiposValidos = ["APROVACAO", "ALTERNATIVAS", "SIM_NAO"];
      if (!tiposValidos.includes(tipo_votacao)) {
        return res.status(400).json({
          success: false,
          message:
            "Tipo de votação inválido. Use: APROVACAO, ALTERNATIVAS ou SIM_NAO",
        });
      }

      if (tipo_votacao === "ALTERNATIVAS") {
        if (
          !opcoes_votacao ||
          !Array.isArray(opcoes_votacao) ||
          opcoes_votacao.length < 2
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Para votação por alternativas, forneça pelo menos 2 candidatos/opções",
          });
        }
      }

      if (new Date(data_inicio) >= new Date(data_fim)) {
        return res.status(400).json({
          success: false,
          message: "Data de fim deve ser posterior à data de início",
        });
      }

      // Preparar opções de votação
      let opcoesJSON = null;
      const isVotacaoMultipla =
        votacao_multipla === true || votacao_multipla === 1;
      const maxVotos = votos_maximos || 1;

      switch (tipo_votacao) {
        case "APROVACAO":
          opcoesJSON = JSON.stringify([
            "Aprovar",
            "Reprovar",
            "Voto Nulo ou Branco",
            "Abstenção",
          ]);
          break;
        case "SIM_NAO":
          opcoesJSON = JSON.stringify([
            "SIM",
            "NÃO",
            "Voto Nulo ou Branco",
            "Abstenção",
          ]);
          break;
        case "ALTERNATIVAS":
          const opcoesCompletas = [
            ...opcoes_votacao,
            "Voto Nulo ou Branco",
            "Abstenção",
          ];
          opcoesJSON = JSON.stringify(opcoesCompletas);
          break;
      }

      console.log("Salvando opções JSON:", opcoesJSON);

      // Criar evento
      const [resultado] = await pool.query(
        `INSERT INTO eventos_votacao 
         (titulo, descricao, tipo_votacao, votacao_multipla, votos_maximos, opcoes_votacao, 
          data_inicio, data_fim, peso_minimo_quorum, status, criado_por) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'RASCUNHO', ?)`,
        [
          titulo,
          descricao,
          tipo_votacao,
          isVotacaoMultipla ? 1 : 0,
          maxVotos,
          opcoesJSON,
          data_inicio,
          data_fim,
          peso_minimo_quorum || 60.0,
          usuario.id,
        ]
      );

      const eventoId = resultado.insertId;

      // Adicionar participantes
      if (
        participantes &&
        Array.isArray(participantes) &&
        participantes.length > 0
      ) {
        const values = participantes.map((userId) => [eventoId, userId]);
        await pool.query(
          "INSERT INTO evento_participantes (evento_id, usuario_id) VALUES ?",
          [values]
        );
      }

      return res.json({
        success: true,
        message: "Evento criado com sucesso",
        evento: {
          id: eventoId,
          titulo,
          tipo_votacao,
          votacao_multipla: isVotacaoMultipla,
          votos_maximos: maxVotos,
          status: "RASCUNHO",
        },
      });
    } catch (error) {
      console.error("Erro ao criar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao criar evento: " + error.message,
      });
    }
  },

  // Listar eventos (verificando período de datas)
  async listarEventos(req, res) {
    const pool = getPool();

    try {
      const [eventos] = await pool.query(`
        SELECT e.*, u.nome as criador_nome,
               (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id) as total_participantes,
               (SELECT COUNT(*) FROM evento_participantes WHERE evento_id = e.id AND presente = 1) as total_presentes,
               (SELECT SUM(m.peso) FROM evento_participantes ep 
                INNER JOIN usuarios us ON ep.usuario_id = us.id 
                INNER JOIN municipios m ON us.municipio_id = m.id 
                WHERE ep.evento_id = e.id AND ep.presente = 1) as peso_presentes,
               (SELECT COUNT(DISTINCT municipio_id) FROM votos WHERE evento_id = e.id) as total_votos,
               CASE 
                 WHEN NOW() < e.data_inicio THEN 'ANTES_PERIODO'
                 WHEN NOW() > e.data_fim THEN 'APOS_PERIODO'
                 ELSE 'DENTRO_PERIODO'
               END as periodo_status
        FROM eventos_votacao e
        INNER JOIN usuarios u ON e.criado_por = u.id
        ORDER BY e.created_at DESC
      `);

      return res.json({
        success: true,
        eventos,
      });
    } catch (error) {
      console.error("Erro ao listar eventos:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar eventos",
      });
    }
  },

  // Obter detalhes do evento
  async obterEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [eventos] = await pool.query(
        `
        SELECT e.*, u.nome as criador_nome,
               CASE 
                 WHEN NOW() < e.data_inicio THEN 'ANTES_PERIODO'
                 WHEN NOW() > e.data_fim THEN 'APOS_PERIODO'
                 ELSE 'DENTRO_PERIODO'
               END as periodo_status
        FROM eventos_votacao e
        INNER JOIN usuarios u ON e.criado_por = u.id
        WHERE e.id = ?
      `,
        [id]
      );

      if (eventos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      const evento = eventos[0];

      // Parse seguro de JSON - ATUALIZADO com novas opções padrão
      if (evento.opcoes_votacao) {
        try {
          if (typeof evento.opcoes_votacao === "string") {
            if (
              evento.opcoes_votacao.trim().startsWith("[") ||
              evento.opcoes_votacao.trim().startsWith("{")
            ) {
              evento.opcoes_votacao = JSON.parse(evento.opcoes_votacao);
            } else {
              evento.opcoes_votacao = evento.opcoes_votacao
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s);
            }
          }
        } catch (parseError) {
          console.error("Erro ao fazer parse de opcoes_votacao:", parseError);

          switch (evento.tipo_votacao) {
            case "APROVACAO":
              evento.opcoes_votacao = [
                "Aprovar",
                "Reprovar",
                "Voto Nulo ou Branco",
                "Abstenção",
              ];
              break;
            case "SIM_NAO":
              evento.opcoes_votacao = [
                "SIM",
                "NÃO",
                "Voto Nulo ou Branco",
                "Abstenção",
              ];
              break;
            case "ALTERNATIVAS":
              evento.opcoes_votacao = ["Voto Nulo ou Branco", "Abstenção"];
              break;
          }
        }
      } else {
        switch (evento.tipo_votacao) {
          case "APROVACAO":
            evento.opcoes_votacao = [
              "Aprovar",
              "Reprovar",
              "Voto Nulo ou Branco",
              "Abstenção",
            ];
            break;
          case "SIM_NAO":
            evento.opcoes_votacao = [
              "SIM",
              "NÃO",
              "Voto Nulo ou Branco",
              "Abstenção",
            ];
            break;
          case "ALTERNATIVAS":
            evento.opcoes_votacao = ["Voto Nulo ou Branco", "Abstenção"];
            break;
          default:
            evento.opcoes_votacao = [];
        }
      }

      // Buscar participantes
      const [participantes] = await pool.query(
        `
        SELECT ep.*, u.nome, u.cpf, u.tipo, m.nome as municipio_nome, m.peso
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
        ORDER BY ep.presente DESC, u.nome
      `,
        [id]
      );

      return res.json({
        success: true,
        evento: {
          ...evento,
          participantes,
        },
      });
    } catch (error) {
      console.error("Erro ao obter evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao obter evento: " + error.message,
      });
    }
  },

  // Adicionar participantes ao evento
  async adicionarParticipantes(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;
      const { participantes } = req.body;

      if (
        !participantes ||
        !Array.isArray(participantes) ||
        participantes.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Lista de participantes inválida",
        });
      }

      const [eventos] = await pool.query(
        "SELECT id FROM eventos_votacao WHERE id = ?",
        [id]
      );
      if (eventos.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      const values = participantes.map((userId) => [id, userId]);
      await pool.query(
        "INSERT IGNORE INTO evento_participantes (evento_id, usuario_id) VALUES ?",
        [values]
      );

      return res.json({
        success: true,
        message: "Participantes adicionados com sucesso",
      });
    } catch (error) {
      console.error("Erro ao adicionar participantes:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao adicionar participantes",
      });
    }
  },

  // Marcar presença (não é mais necessário, mas manter para compatibilidade)
  async marcarPresenca(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;
      const usuario = req.usuario;

      const [resultado] = await pool.query(
        `UPDATE evento_participantes 
         SET presente = 1, data_presenca = NOW() 
         WHERE evento_id = ? AND usuario_id = ?`,
        [id, usuario.id]
      );

      if (resultado.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: "Você não está cadastrado neste evento",
        });
      }

      const [pesoPresentes] = await pool.query(
        `
        SELECT SUM(m.peso) as peso_total
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        INNER JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ? AND ep.presente = 1
      `,
        [id]
      );

      const [pesoTotal] = await pool.query(
        `
        SELECT SUM(m.peso) as peso_total
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        INNER JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
      `,
        [id]
      );

      const pesoAtual = parseFloat(pesoPresentes[0].peso_total || 0);
      const pesoTotalEvento = parseFloat(pesoTotal[0].peso_total || 0);
      const percentualPeso =
        pesoTotalEvento > 0 ? (pesoAtual / pesoTotalEvento) * 100 : 0;

      const [evento] = await pool.query(
        "SELECT peso_minimo_quorum FROM eventos_votacao WHERE id = ?",
        [id]
      );

      const quorumAtingido = percentualPeso >= evento[0].peso_minimo_quorum;

      return res.json({
        success: true,
        message: "Presença confirmada",
        pesoPresente: pesoAtual,
        pesoTotal: pesoTotalEvento,
        percentualPeso: percentualPeso.toFixed(2),
        quorumMinimo: evento[0].peso_minimo_quorum,
        quorumAtingido,
      });
    } catch (error) {
      console.error("Erro ao marcar presença:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao marcar presença",
      });
    }
  },

  // Iniciar evento (mudança de status para AGUARDANDO_INICIO)
  async iniciarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      // Verificar se está dentro do período
      const [evento] = await pool.query(
        `SELECT *, 
         CASE 
           WHEN NOW() < data_inicio THEN 'ANTES_PERIODO'
           WHEN NOW() > data_fim THEN 'APOS_PERIODO'
           ELSE 'DENTRO_PERIODO'
         END as periodo_status
         FROM eventos_votacao WHERE id = ?`,
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      if (evento[0].periodo_status === "ANTES_PERIODO") {
        return res.status(400).json({
          success: false,
          message:
            "Evento ainda não iniciou. Data de início: " +
            new Date(evento[0].data_inicio).toLocaleString("pt-BR"),
        });
      }

      if (evento[0].periodo_status === "APOS_PERIODO") {
        return res.status(400).json({
          success: false,
          message:
            "Evento já encerrou. Data de fim: " +
            new Date(evento[0].data_fim).toLocaleString("pt-BR"),
        });
      }

      await pool.query(
        "UPDATE eventos_votacao SET status = 'AGUARDANDO_INICIO' WHERE id = ? AND status = 'RASCUNHO'",
        [id]
      );

      return res.json({
        success: true,
        message: "Evento iniciado. Aguardando liberação para votação.",
      });
    } catch (error) {
      console.error("Erro ao iniciar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao iniciar evento",
      });
    }
  },

  // NOVO: Liberar votação (status ATIVO)
  async liberarVotacao(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      // Verificar se está dentro do período
      const [evento] = await pool.query(
        `SELECT *, 
         CASE 
           WHEN NOW() < data_inicio THEN 'ANTES_PERIODO'
           WHEN NOW() > data_fim THEN 'APOS_PERIODO'
           ELSE 'DENTRO_PERIODO'
         END as periodo_status
         FROM eventos_votacao WHERE id = ?`,
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      if (evento[0].periodo_status !== "DENTRO_PERIODO") {
        return res.status(400).json({
          success: false,
          message: "Evento fora do período permitido para votação",
        });
      }

      if (evento[0].status !== "AGUARDANDO_INICIO") {
        return res.status(400).json({
          success: false,
          message:
            'Evento deve estar em status "Aguardando Início" para liberar votação',
        });
      }

      await pool.query(
        "UPDATE eventos_votacao SET status = 'ATIVO' WHERE id = ?",
        [id]
      );

      return res.json({
        success: true,
        message: "Votação liberada! Participantes presentes podem votar agora.",
      });
    } catch (error) {
      console.error("Erro ao liberar votação:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao liberar votação",
      });
    }
  },

  // Encerrar evento
  async encerrarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      await pool.query(
        "UPDATE eventos_votacao SET status = 'ENCERRADO' WHERE id = ?",
        [id]
      );

      return res.json({
        success: true,
        message: "Evento encerrado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao encerrar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao encerrar evento",
      });
    }
  },

  // Deletar evento
  async deletarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      await pool.query("DELETE FROM eventos_votacao WHERE id = ?", [id]);

      return res.json({
        success: true,
        message: "Evento deletado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao deletar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao deletar evento",
      });
    }
  },
  exportarCSV,
};

// Exportar resultados da votação em CSV
async function exportarCSV(req, res) {
  const pool = getPool();

  try {
    const { id } = req.params;

    const [eventos] = await pool.query(
      `
        SELECT e.*, u.nome as criador_nome
        FROM eventos_votacao e
        INNER JOIN usuarios u ON e.criado_por = u.id
        WHERE e.id = ?
      `,
      [id]
    );

    if (eventos.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Evento não encontrado",
      });
    }

    const evento = eventos[0];

    // Parse seguro de opcoes_votacao
    let opcoes = [];
    if (evento.opcoes_votacao) {
      try {
        if (typeof evento.opcoes_votacao === "string") {
          opcoes = JSON.parse(evento.opcoes_votacao);
        } else if (Array.isArray(evento.opcoes_votacao)) {
          opcoes = evento.opcoes_votacao;
        }
      } catch (e) {
        console.error("Erro ao fazer parse de opcoes_votacao:", e);
      }
    }

    const [votos] = await pool.query(
      `
        SELECT v.*, u.nome as usuario_nome, u.cpf, m.nome as municipio_nome, v.voto_numero
        FROM votos v
        INNER JOIN usuarios u ON v.usuario_id = u.id
        INNER JOIN municipios m ON v.municipio_id = m.id
        WHERE v.evento_id = ?
        ORDER BY m.nome, v.voto_numero, v.data_hora
      `,
      [id]
    );

    const [participantes] = await pool.query(
      `
        SELECT u.nome, u.cpf, m.nome as municipio_nome, m.peso, ep.presente, ep.data_presenca
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
        ORDER BY m.nome, u.nome
      `,
      [id]
    );

    // Gerar CSV com BOM UTF-8 para Excel
    let csv = "\uFEFF";

    csv += `RELATORIO DE VOTACAO\n\n`;
    csv += `Titulo;${evento.titulo}\n`;
    csv += `Descricao;${evento.descricao || "N/A"}\n`;
    csv += `Tipo de Votacao;${evento.tipo_votacao}\n`;
    csv += `Votacao Multipla;${
      evento.votacao_multipla
        ? "Sim (Max: " + evento.votos_maximos + ")"
        : "Nao"
    }\n`;
    if (opcoes.length > 0) {
      csv += `Opcoes de Votacao;${opcoes.join(", ")}\n`;
    }
    csv += `Status;${evento.status}\n`;
    csv += `Data Inicio;${new Date(evento.data_inicio).toLocaleString(
      "pt-BR"
    )}\n`;
    csv += `Data Fim;${new Date(evento.data_fim).toLocaleString("pt-BR")}\n`;
    csv += `Quorum Minimo (Peso);${evento.peso_minimo_quorum}%\n`;
    csv += `Criado por;${evento.criador_nome}\n`;
    csv += `Data de Geracao;${new Date().toLocaleString("pt-BR")}\n\n`;

    csv += `PARTICIPANTES\n`;
    csv += `Nome;CPF;Municipio;Peso;Presente;Data Presenca\n`;
    participantes.forEach((p) => {
      csv += `${p.nome};${p.cpf};${p.municipio_nome || "N/A"};${
        p.peso || "N/A"
      };${p.presente ? "Sim" : "Nao"};${
        p.data_presenca
          ? new Date(p.data_presenca).toLocaleString("pt-BR")
          : "N/A"
      }\n`;
    });

    csv += `\n`;

    csv += `VOTOS REGISTRADOS\n`;
    csv += `Municipio;Votante;CPF;Voto;Numero do Voto;Peso;Data/Hora\n`;
    votos.forEach((v) => {
      csv += `${v.municipio_nome};${v.usuario_nome};${v.cpf};${v.voto};${
        v.voto_numero
      };${v.peso};${new Date(v.data_hora).toLocaleString("pt-BR")}\n`;
    });

    csv += `\n`;

    // Agrupar votos por município (para votação múltipla)
    const votosPorMunicipio = {};
    votos.forEach((v) => {
      if (!votosPorMunicipio[v.municipio_nome]) {
        votosPorMunicipio[v.municipio_nome] = [];
      }
      votosPorMunicipio[v.municipio_nome].push(v.voto);
    });

    csv += `RESUMO DE VOTOS POR MUNICIPIO\n`;
    csv += `Municipio;Votos;Quantidade de Votos;Peso Total\n`;
    Object.keys(votosPorMunicipio)
      .sort()
      .forEach((municipio) => {
        const votosDoMunicipio = votos.filter(
          (v) => v.municipio_nome === municipio
        );
        const pesoTotal =
          votosDoMunicipio.reduce((sum, v) => sum + parseFloat(v.peso), 0) /
          votosDoMunicipio.length; // Peso é o mesmo para todos os votos do município
        csv += `${municipio};${votosPorMunicipio[municipio].join(" | ")};${
          votosPorMunicipio[municipio].length
        };${pesoTotal.toFixed(2)}\n`;
      });

    csv += `\n`;

    // Contagem de votos por opção
    const contagemVotos = {};
    votos.forEach((v) => {
      contagemVotos[v.voto] = (contagemVotos[v.voto] || 0) + 1;
    });

    csv += `CONTAGEM POR OPCAO\n`;
    csv += `Opcao;Quantidade de Votos;Percentual\n`;
    const totalVotos = votos.length;
    Object.keys(contagemVotos)
      .sort()
      .forEach((opcao) => {
        const quantidade = contagemVotos[opcao];
        const percentual =
          totalVotos > 0 ? ((quantidade / totalVotos) * 100).toFixed(2) : 0;
        csv += `${opcao};${quantidade};${percentual}%\n`;
      });

    csv += `\n`;

    const totalMunicipiosVotaram = Object.keys(votosPorMunicipio).length;
    const totalParticipantes = participantes.length;
    const totalPresentes = participantes.filter((p) => p.presente).length;
    const pesoTotalVotos = votos.reduce(
      (sum, v) => sum + parseFloat(v.peso),
      0
    );
    const pesoTotalParticipantes = participantes.reduce(
      (sum, p) => sum + parseFloat(p.peso || 0),
      0
    );

    csv += `ESTATISTICAS GERAIS\n`;
    csv += `Total de Participantes Cadastrados;${totalParticipantes}\n`;
    csv += `Total de Presentes;${totalPresentes}\n`;
    csv += `Total de Municipios que Votaram;${totalMunicipiosVotaram}\n`;
    csv += `Total de Votos Registrados;${totalVotos}\n`;
    csv += `Peso Total dos Votos;${pesoTotalVotos.toFixed(2)}\n`;
    csv += `Peso Total dos Participantes;${pesoTotalParticipantes.toFixed(
      2
    )}\n`;
    csv += `Percentual de Participacao (Peso);${
      pesoTotalParticipantes > 0
        ? (
            (pesoTotalVotos / totalPresentes / pesoTotalParticipantes) *
            totalParticipantes *
            100
          ).toFixed(2)
        : 0
    }%\n`;

    const nomeArquivo = `votacao_${evento.titulo.replace(
      /[^a-zA-Z0-9]/g,
      "_"
    )}_${id}_${Date.now()}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${nomeArquivo}"`
    );
    res.send(csv);
  } catch (error) {
    console.error("Erro ao exportar CSV:", error);
    return res.status(500).json({
      success: false,
      message: "Erro ao exportar CSV: " + error.message,
    });
  }
}

module.exports = eventoController;
