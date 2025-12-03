let chartVotacoesMes, chartTiposVotacao;

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await verificarAutenticacao();
  if (!usuario) return;

  document.getElementById("nomeUsuario").textContent = usuario.nome;

  await carregarEstatisticas();
  inicializarGraficos();
  carregarEventosRecentes();
  iniciarActivityFeed();
});

async function carregarEstatisticas() {
  try {
    const response = await request("/eventos");
    const eventos = response.eventos || [];

    // Eventos ativos
    const eventosAtivos = eventos.filter((e) => e.status === "ATIVO").length;
    document.getElementById("totalEventosAtivos").textContent = eventosAtivos;

    // Total de votos
    const totalVotos = eventos.reduce(
      (sum, e) => sum + (e.total_votos || 0),
      0
    );
    document.getElementById("totalVotos").textContent = totalVotos;

    // Municípios participantes
    const municipiosUnicos = new Set();
    eventos.forEach((e) => {
      if (e.participantes) {
        e.participantes.forEach((p) => {
          if (p.municipio_id) municipiosUnicos.add(p.municipio_id);
        });
      }
    });
    document.getElementById("totalMunicipiosParticipantes").textContent =
      municipiosUnicos.size;

    // Taxa de participação
    let totalParticipantes = 0;
    let totalPresentes = 0;
    eventos.forEach((e) => {
      totalParticipantes += e.total_participantes || 0;
      totalPresentes += e.total_presentes || 0;
    });
    const taxa =
      totalParticipantes > 0
        ? ((totalPresentes / totalParticipantes) * 100).toFixed(1)
        : 0;
    document.getElementById("taxaParticipacao").textContent = taxa + "%";

    animateNumbers();
  } catch (error) {
    console.error("Erro ao carregar estatísticas:", error);
    toast.error("Erro ao carregar estatísticas");
  }
}

function animateNumbers() {
  document.querySelectorAll(".stat-number").forEach((el) => {
    const text = el.textContent;
    const number = parseInt(text) || 0;
    let current = 0;
    const increment = number / 50;
    const timer = setInterval(() => {
      current += increment;
      if (current >= number) {
        el.textContent = text;
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current) + (text.includes("%") ? "%" : "");
      }
    }, 20);
  });
}

function inicializarGraficos() {
  // Gráfico de Votações por Mês
  const ctxMes = document.getElementById("chartVotacoesMes");
  if (ctxMes) {
    chartVotacoesMes = new Chart(ctxMes.getContext("2d"), {
      type: "bar",
      data: {
        labels: [
          "Jan",
          "Fev",
          "Mar",
          "Abr",
          "Mai",
          "Jun",
          "Jul",
          "Ago",
          "Set",
          "Out",
          "Nov",
          "Dez",
        ],
        datasets: [
          {
            label: "Votações",
            data: [12, 19, 15, 25, 22, 30, 28, 35, 32, 38, 42, 45],
            backgroundColor: "rgba(102, 126, 234, 0.8)",
            borderColor: "rgba(102, 126, 234, 1)",
            borderWidth: 2,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(0, 0, 0, 0.05)",
            },
          },
          x: {
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }

  // Gráfico de Tipos de Votação
  const ctxTipos = document.getElementById("chartTiposVotacao");
  if (ctxTipos) {
    chartTiposVotacao = new Chart(ctxTipos.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Sim/Não", "Aprovação", "Alternativas"],
        datasets: [
          {
            data: [45, 30, 25],
            backgroundColor: [
              "rgba(102, 126, 234, 0.8)",
              "rgba(240, 147, 251, 0.8)",
              "rgba(79, 172, 254, 0.8)",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              padding: 15,
              usePointStyle: true,
            },
          },
        },
      },
    });
  }
}

async function carregarEventosRecentes() {
  try {
    const response = await request("/eventos");
    const eventos = (response.eventos || []).slice(0, 5);

    const timeline = document.getElementById("timelineEventos");

    if (eventos.length === 0) {
      timeline.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <h3>Nenhum evento recente</h3>
                    <p>Crie um novo evento para começar</p>
                </div>
            `;
      return;
    }

    timeline.innerHTML = eventos
      .map((e) => {
        const statusClass =
          e.status === "ATIVO"
            ? "success"
            : e.status === "AGUARDANDO_INICIO"
            ? "warning"
            : "";
        const dataInicio = new Date(e.data_inicio).toLocaleString("pt-BR");

        return `
                <div class="timeline-item ${statusClass}">
                    <div class="timeline-content">
                        <h4>${e.titulo}</h4>
                        <p>${e.descricao || "Sem descrição"}</p>
                        <div class="timeline-time">
                            <i class="fas fa-clock"></i>
                            ${dataInicio}
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  } catch (error) {
    console.error("Erro ao carregar eventos recentes:", error);
  }
}

function iniciarActivityFeed() {
  const feed = document.getElementById("activityFeed");

  // Simular atividades em tempo real
  const atividades = [
    {
      usuario: "João Silva",
      acao: 'votou no evento "Eleição 2025"',
      tempo: "2 min atrás",
    },
    {
      usuario: "Maria Santos",
      acao: "confirmou presença",
      tempo: "5 min atrás",
    },
    {
      usuario: "Pedro Oliveira",
      acao: "criou novo evento",
      tempo: "10 min atrás",
    },
    {
      usuario: "Ana Costa",
      acao: 'votou no evento "Aprovação de Projeto"',
      tempo: "15 min atrás",
    },
    {
      usuario: "Carlos Souza",
      acao: "exportou relatório CSV",
      tempo: "20 min atrás",
    },
  ];

  feed.innerHTML = atividades
    .map((a) => {
      const iniciais = a.usuario
        .split(" ")
        .map((n) => n[0])
        .join("");
      return `
            <div class="activity-item fade-in">
                <div class="activity-avatar">${iniciais}</div>
                <div class="activity-content">
                    <p><strong>${a.usuario}</strong> ${a.acao}</p>
                    <small class="activity-time">
                        <i class="fas fa-clock"></i> ${a.tempo}
                    </small>
                </div>
            </div>
        `;
    })
    .join("");

  // Adicionar nova atividade a cada 30 segundos (simulação)
  setInterval(() => {
    const novaAtividade = {
      usuario: "Usuário " + Math.floor(Math.random() * 100),
      acao: "realizou uma ação",
      tempo: "agora",
    };

    const iniciais = novaAtividade.usuario
      .split(" ")
      .map((n) => n[0])
      .join("");
    const html = `
            <div class="activity-item fade-in">
                <div class="activity-avatar">${iniciais}</div>
                <div class="activity-content">
                    <p><strong>${novaAtividade.usuario}</strong> ${novaAtividade.acao}</p>
                    <small class="activity-time">
                        <i class="fas fa-clock"></i> ${novaAtividade.tempo}
                    </small>
                </div>
            </div>
        `;

    feed.insertAdjacentHTML("afterbegin", html);

    // Remover último item se houver mais de 5
    const items = feed.querySelectorAll(". activity-item");
    if (items.length > 5) {
      items[items.length - 1].remove();
    }
  }, 30000);
}
