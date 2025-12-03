const getPool = () => {
  if (global.pool) return global.pool;
  const { pool } = require("../server");
  return pool;
};

const eventoController = {
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
          message: "Tipo de votação inválido",
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

      const quorumMinimo = peso_minimo_quorum || 50.0;

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
          quorumMinimo,
          usuario.id,
        ]
      );

      const eventoId = resultado.insertId;

      // Cadastrar TODOS os usuários ativos automaticamente
      const [usuariosAtivos] = await pool.query(
        `SELECT id FROM usuarios 
         WHERE ativo = 1 
         AND tipo IN ('PREFEITO', 'REPRESENTANTE', 'GOVERNADOR', 'SECRETARIO')`
      );

      if (usuariosAtivos.length > 0) {
        const values = usuariosAtivos.map((u) => [eventoId, u.id]);
        await pool.query(
          "INSERT INTO evento_participantes (evento_id, usuario_id) VALUES ?",
          [values]
        );
      }

      return res.json({
        success: true,
        message: `Evento criado com sucesso! ${usuariosAtivos.length} participantes cadastrados automaticamente.`,
        evento: {
          id: eventoId,
          titulo,
          tipo_votacao,
          votacao_multipla: isVotacaoMultipla,
          votos_maximos: maxVotos,
          status: "RASCUNHO",
          total_participantes: usuariosAtivos.length,
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

  async listarEventos(req, res) {
    const pool = getPool();

    try {
      const usuario = req.usuario;

      let query = `
        SELECT 
          e.*,
          u.nome as criador_nome,
          COUNT(DISTINCT ep.usuario_id) as total_participantes,
          COUNT(DISTINCT CASE WHEN ep.presente = 1 THEN ep.usuario_id END) as total_presentes,
          COUNT(DISTINCT v.municipio_id) as total_votos,
          SUM(CASE WHEN ep. presente = 1 THEN COALESCE(m.peso, 0) ELSE 0 END) as peso_presentes,
          SUM(COALESCE(m.peso, 0)) as peso_total,
          CASE 
            WHEN NOW() < e.data_inicio THEN 'ANTES_PERIODO'
            WHEN NOW() > e.data_fim THEN 'APOS_PERIODO'
            ELSE 'DENTRO_PERIODO'
          END as periodo_status
        FROM eventos_votacao e
        INNER JOIN usuarios u ON e.criado_por = u.id
        LEFT JOIN evento_participantes ep ON e.id = ep.evento_id
        LEFT JOIN usuarios pu ON ep.usuario_id = pu.id
        LEFT JOIN municipios m ON pu.municipio_id = m.id
        LEFT JOIN votos v ON e.id = v.evento_id
      `;

      if (usuario.tipo !== "ADMIN") {
        query += ` WHERE ep.usuario_id = ?`;
      }

      query += ` GROUP BY e.id ORDER BY e.created_at DESC`;

      const [eventos] =
        usuario.tipo === "ADMIN"
          ? await pool.query(query)
          : await pool.query(query, [usuario.id]);

      eventos.forEach((e) => {
        const pesoPresente = parseFloat(e.peso_presentes || 0);
        const pesoTotal = parseFloat(e.peso_total || 0);
        e.percentual_quorum =
          pesoTotal > 0 ? ((pesoPresente / pesoTotal) * 100).toFixed(2) : 0;
      });

      return res.json({
        success: true,
        eventos,
      });
    } catch (error) {
      console.error("Erro ao listar eventos:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao listar eventos: " + error.message,
      });
    }
  },

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

      if (evento.opcoes_votacao) {
        try {
          if (typeof evento.opcoes_votacao === "string") {
            if (evento.opcoes_votacao.trim().startsWith("[")) {
              evento.opcoes_votacao = JSON.parse(evento.opcoes_votacao);
            } else {
              evento.opcoes_votacao = evento.opcoes_votacao
                .split(",")
                .map((s) => s.trim());
            }
          }
        } catch (parseError) {
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
      }

      const [participantes] = await pool.query(
        `
        SELECT ep.*, u.nome, u.cpf, u.tipo, m.nome as municipio_nome, COALESCE(m.peso, 0) as peso
        FROM evento_participantes ep
        INNER JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE ep.evento_id = ?
        ORDER BY ep.presente DESC, u.nome
      `,
        [id]
      );

      const pesoTotal = participantes.reduce(
        (sum, p) => sum + parseFloat(p.peso || 0),
        0
      );
      const pesoPresente = participantes
        .filter((p) => p.presente)
        .reduce((sum, p) => sum + parseFloat(p.peso || 0), 0);

      evento.peso_total = pesoTotal;
      evento.peso_presentes = pesoPresente;
      evento.percentual_quorum =
        pesoTotal > 0 ? ((pesoPresente / pesoTotal) * 100).toFixed(2) : 0;

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

  async iniciarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [evento] = await pool.query(
        "SELECT status FROM eventos_votacao WHERE id = ?",
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      if (evento[0].status !== "RASCUNHO") {
        return res.status(400).json({
          success: false,
          message: "Apenas eventos em rascunho podem ser iniciados",
        });
      }

      await pool.query("UPDATE eventos_votacao SET status = ?  WHERE id = ?", [
        "AGUARDANDO_INICIO",
        id,
      ]);

      return res.json({
        success: true,
        message: "Evento iniciado!  Aguardando liberação para votação.",
      });
    } catch (error) {
      console.error("Erro ao iniciar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao iniciar evento: " + error.message,
      });
    }
  },

  async liberarVotacao(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [eventos] = await pool.query(
        `
        SELECT 
          e.*,
          SUM(CASE WHEN ep. presente = 1 THEN COALESCE(m.peso, 0) ELSE 0 END) as peso_presentes,
          SUM(COALESCE(m.peso, 0)) as peso_total
        FROM eventos_votacao e
        LEFT JOIN evento_participantes ep ON e.id = ep.evento_id
        LEFT JOIN usuarios u ON ep.usuario_id = u.id
        LEFT JOIN municipios m ON u.municipio_id = m.id
        WHERE e.id = ?
        GROUP BY e.id
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

      if (evento.status !== "AGUARDANDO_INICIO") {
        return res.status(400).json({
          success: false,
          message: "Apenas eventos aguardando início podem ser liberados",
        });
      }

      const pesoPresente = parseFloat(evento.peso_presentes || 0);
      const pesoTotal = parseFloat(evento.peso_total || 0);
      const percentualQuorum =
        pesoTotal > 0 ? (pesoPresente / pesoTotal) * 100 : 0;

      if (percentualQuorum <= 50) {
        return res.status(400).json({
          success: false,
          message: `Quórum insuficiente!  Necessário > 50% do peso total.  Atual: ${percentualQuorum.toFixed(
            2
          )}% (${pesoPresente}/${pesoTotal})`,
        });
      }

      await pool.query("UPDATE eventos_votacao SET status = ? WHERE id = ?", [
        "ATIVO",
        id,
      ]);

      return res.json({
        success: true,
        message: `Votação liberada com sucesso! Quórum: ${percentualQuorum.toFixed(
          2
        )}%`,
        quorum: {
          peso_presente: pesoPresente,
          peso_total: pesoTotal,
          percentual: percentualQuorum.toFixed(2),
        },
      });
    } catch (error) {
      console.error("Erro ao liberar votação:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao liberar votação: " + error.message,
      });
    }
  },

  async encerrarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [evento] = await pool.query(
        "SELECT status FROM eventos_votacao WHERE id = ?",
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      if (evento[0].status === "ENCERRADO") {
        return res.status(400).json({
          success: false,
          message: "Evento já está encerrado",
        });
      }

      await pool.query("UPDATE eventos_votacao SET status = ? WHERE id = ?", [
        "ENCERRADO",
        id,
      ]);

      return res.json({
        success: true,
        message: "Evento encerrado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao encerrar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao encerrar evento: " + error.message,
      });
    }
  },

  async deletarEvento(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [evento] = await pool.query(
        "SELECT status FROM eventos_votacao WHERE id = ?",
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      if (evento[0].status !== "RASCUNHO") {
        return res.status(400).json({
          success: false,
          message: "Apenas eventos em rascunho podem ser deletados",
        });
      }

      await pool.query("DELETE FROM eventos_votacao WHERE id = ?", [id]);

      return res.json({
        success: true,
        message: "Evento deletado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao deletar evento:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao deletar evento: " + error.message,
      });
    }
  },

  async exportarCSV(req, res) {
    const pool = getPool();

    try {
      const { id } = req.params;

      const [evento] = await pool.query(
        "SELECT * FROM eventos_votacao WHERE id = ?",
        [id]
      );

      if (evento.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Evento não encontrado",
        });
      }

      const [votos] = await pool.query(
        `
        SELECT 
          m.nome as municipio,
          m.peso,
          u.nome as votante,
          v.voto,
          v.data_hora
        FROM votos v
        INNER JOIN municipios m ON v.municipio_id = m. id
        INNER JOIN usuarios u ON v.usuario_id = u.id
        WHERE v.evento_id = ?
        ORDER BY m.nome, v.voto_numero
      `,
        [id]
      );

      let csv = "Município,Peso,Votante,Voto,Data/Hora\n";
      votos.forEach((v) => {
        csv += `"${v.municipio}","${v.peso}","${v.votante}","${
          v.voto
        }","${new Date(v.data_hora).toLocaleString("pt-BR")}"\n`;
      });

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="votacao_${id}_${Date.now()}.csv"`
      );
      res.send("\ufeff" + csv);
    } catch (error) {
      console.error("Erro ao exportar CSV:", error);
      return res.status(500).json({
        success: false,
        message: "Erro ao exportar CSV: " + error.message,
      });
    }
  },
};

module.exports = eventoController;
