let eventos = [];
let usuarios = [];
let municipios = [];

document.addEventListener("DOMContentLoaded", async () => {
  const usuario = await verificarAutenticacao("ADMIN");
  if (!usuario) return;

  document.getElementById("nomeUsuario").textContent = usuario.nome;

  carregarEventos();
  carregarUsuarios();
  carregarMunicipios();

  // Event listeners dos formulários
  document
    .getElementById("formEvento")
    .addEventListener("submit", salvarEvento);
  document
    .getElementById("formUsuario")
    .addEventListener("submit", salvarUsuario);
  document
    .getElementById("formMunicipio")
    .addEventListener("submit", salvarMunicipio);
});

// ========== TABS ==========
function mudarTab(tab) {
  document
    .querySelectorAll(".tab-button")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(`tab-${tab}`).classList.add("active");

  if (tab === "usuarios") {
    carregarUsuarios();
  } else if (tab === "municipios") {
    carregarMunicipios();
  } else if (tab === "eventos") {
    carregarEventos();
  }
}

// ========== EVENTOS ==========
async function carregarEventos() {
  try {
    const response = await request("/eventos");
    eventos = response.eventos;
    renderizarEventos();
  } catch (error) {
    console.error("Erro ao carregar eventos:", error);
    document.getElementById("tabelaEventos").innerHTML =
      '<tr><td colspan="10" class="error">Erro ao carregar eventos</td></tr>';
  }
}

function renderizarEventos() {
  const tbody = document.getElementById("tabelaEventos");

  if (eventos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">Nenhum evento cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = eventos
    .map((e) => {
      const dataInicio = new Date(e.data_inicio).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const dataFim = new Date(e.data_fim).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // ATUALIZADO: Mapa de tipos com descrição das opções especiais
      const tiposVotacao = {
        APROVACAO: "Aprovação (+ Voto Nulo/Abstenção)",
        ALTERNATIVAS: "Alternativas",
        SIM_NAO: "Sim/Não (+ Voto Nulo/Abstenção)",
      };

      let tipoTexto = tiposVotacao[e.tipo_votacao] || e.tipo_votacao;
      if (e.votacao_multipla) {
        tipoTexto += ` <span style="color: var(--info-color); font-weight: bold;">(Múltipla: ${e.votos_maximos})</span>`;
      }

      const pesoPresente = parseFloat(e.peso_presentes || 0);
      const percentualQuorum =
        e.total_participantes > 0
          ? ((pesoPresente / e.total_participantes) * 100).toFixed(1)
          : 0;

      let badgeStatus = "";
      let acoes = "";

      switch (e.status) {
        case "RASCUNHO":
          badgeStatus =
            '<span class="badge badge-info"><i class="fas fa-file-alt"></i> Rascunho</span>';
          acoes = `
                  <button onclick="iniciarEvento(${e.id})" class="btn btn-sm btn-success" title="Iniciar Evento">
                      <i class="fas fa-play"></i>
                  </button>
              `;
          break;
        case "AGUARDANDO_INICIO":
          badgeStatus =
            '<span class="badge badge-warning"><i class="fas fa-clock"></i> Aguardando Liberação</span>';
          acoes = `
                  <button onclick="liberarVotacao(${e.id})" class="btn btn-sm btn-success" title="Liberar Votação">
                      <i class="fas fa-unlock"></i> Liberar
                  </button>
              `;
          break;
        case "ATIVO":
          badgeStatus =
            '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Votação Ativa</span>';
          acoes = `
                  <button onclick="encerrarEvento(${e.id})" class="btn btn-sm btn-danger" title="Encerrar">
                      <i class="fas fa-stop"></i>
                  </button>
              `;
          break;
        case "ENCERRADO":
          badgeStatus =
            '<span class="badge badge-danger"><i class="fas fa-stop-circle"></i> Encerrado</span>';
          acoes = `
                  <a href="/api/eventos/${e.id}/exportar-csv" class="btn btn-sm btn-success" title="Baixar CSV" download>
                      <i class="fas fa-download"></i> CSV
                  </a>
              `;
          break;
      }

      let alertaPeriodo = "";
      if (e.periodo_status === "ANTES_PERIODO") {
        alertaPeriodo =
          '<br><small style="color: var(--warning-color);"><i class="fas fa-clock"></i> Antes do período</small>';
      } else if (e.periodo_status === "APOS_PERIODO") {
        alertaPeriodo =
          '<br><small style="color: var(--danger-color);"><i class="fas fa-exclamation-triangle"></i> Período encerrado</small>';
      }

      return `
          <tr>
              <td>${e.id}</td>
              <td style="max-width: 300px; white-space: normal;">${
                e.titulo
              }</td>
              <td>${tipoTexto}</td>
              <td>${dataInicio}${alertaPeriodo}</td>
              <td>${dataFim}</td>
              <td>${e.total_participantes || 0}</td>
              <td>${
                e.total_presentes || 0
              }<br><small>(${percentualQuorum}% peso)</small></td>
              <td>${e.total_votos || 0}</td>
              <td>${badgeStatus}</td>
              <td class="table-actions">
                  <button onclick="verDetalhesEvento(${
                    e.id
                  })" class="btn btn-sm btn-secondary" title="Ver Detalhes">
                      <i class="fas fa-eye"></i>
                  </button>
                  ${acoes}
                  ${
                    e.status === "RASCUNHO"
                      ? `
                      <button onclick="deletarEvento(${e.id})" class="btn btn-sm btn-danger" title="Deletar">
                          <i class="fas fa-trash"></i>
                      </button>
                  `
                      : ""
                  }
              </td>
          </tr>
      `;
    })
    .join("");
}

function abrirModalEvento() {
  document.getElementById("tituloModalEvento").innerHTML =
    '<i class="fas fa-calendar-plus"></i> Novo Evento de Votação';
  document.getElementById("formEvento").reset();
  document.getElementById("eventoId").value = "";

  const agora = new Date();
  const dataInicio = new Date(agora.getTime() + 60 * 60 * 1000);
  const dataFim = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  document.getElementById("eventoDataInicio").value = dataInicio
    .toISOString()
    .slice(0, 16);
  document.getElementById("eventoDataFim").value = dataFim
    .toISOString()
    .slice(0, 16);

  document.getElementById("grupoOpcoesVotacao").style.display = "none";
  document.getElementById("grupoVotacaoMultipla").style.display = "none";

  // Limpar lista de opções
  document.getElementById("listaOpcoesVotacao").innerHTML = "";

  carregarUsuariosParaEvento();
  document.getElementById("modalEvento").classList.add("show");
}

function fecharModalEvento() {
  document.getElementById("modalEvento").classList.remove("show");
}

function toggleOpcoesVotacao() {
  const tipo = document.getElementById("eventoTipoVotacao").value;
  const grupoOpcoes = document.getElementById("grupoOpcoesVotacao");
  const grupoMultipla = document.getElementById("grupoVotacaoMultipla");

  if (tipo === "ALTERNATIVAS") {
    grupoOpcoes.style.display = "block";
    grupoMultipla.style.display = "block";

    document.getElementById("eventoVotacaoMultipla").checked = true;
    document.getElementById("eventoVotacaoMultipla").disabled = false;
    document.getElementById("grupoVotosMaximos").style.display = "block";

    const listaOpcoes = document.getElementById("listaOpcoesVotacao");
    if (listaOpcoes.children.length === 0) {
      adicionarOpcaoVotacao();
      adicionarOpcaoVotacao();
    }
  } else {
    grupoOpcoes.style.display = "none";
    grupoMultipla.style.display = "none";
    document.getElementById("eventoVotacaoMultipla").checked = false;
    document.getElementById("eventoVotacaoMultipla").disabled = false;
  }
}

function toggleVotosMaximos() {
  const checkbox = document.getElementById("eventoVotacaoMultipla");
  const grupo = document.getElementById("grupoVotosMaximos");
  grupo.style.display = checkbox.checked ? "block" : "none";
}

function adicionarOpcaoVotacao() {
  const lista = document.getElementById("listaOpcoesVotacao");
  const index = lista.children.length + 1;

  const div = document.createElement("div");
  div.className = "opcao-votacao-row";
  div.style.display = "flex";
  div.style.gap = "0.5rem";
  div.style.marginBottom = "0.5rem";
  div.innerHTML = `
        <input type="text" class="opcao-votacao-input" placeholder="Opção ${index} (ex: João Silva, Maria Santos, etc)" style="flex: 1;">
        <button type="button" onclick="removerOpcaoVotacao(this)" class="btn btn-danger btn-sm">
            <i class="fas fa-times"></i>
        </button>
    `;
  lista.appendChild(div);
}

function removerOpcaoVotacao(btn) {
  btn.parentElement.remove();
}

async function carregarUsuariosParaEvento() {
  try {
    const response = await request("/admin/usuarios");
    const usuariosAtivos = response.usuarios.filter(
      (u) => u.ativo && u.tipo !== "ADMIN"
    );

    const lista = document.getElementById("listaParticipantes");
    lista.innerHTML = usuariosAtivos
      .map(
        (u) => `
            <label style="display: block; padding: 0.5rem; border-bottom: 1px solid var(--border);">
                <input type="checkbox" name="participantes" value="${u.id}">
                ${u.nome} - ${u.municipio_nome || "Sem município"} (${u.tipo})
            </label>
        `
      )
      .join("");
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
  }
}

async function salvarEvento(e) {
  e.preventDefault();

  const titulo = document.getElementById("eventoTitulo").value;
  const descricao = document.getElementById("eventoDescricao").value;
  const tipo_votacao = document.getElementById("eventoTipoVotacao").value;
  const data_inicio = document.getElementById("eventoDataInicio").value;
  const data_fim = document.getElementById("eventoDataFim").value;
  const peso_minimo_quorum = parseFloat(
    document.getElementById("eventoPesoQuorum").value
  );

  let votacao_multipla = false;
  let votos_maximos = 1;
  let opcoes_votacao = null;

  if (tipo_votacao === "ALTERNATIVAS") {
    votacao_multipla = document.getElementById("eventoVotacaoMultipla").checked;
    votos_maximos =
      parseInt(document.getElementById("eventoVotosMaximos").value) || 1;

    const inputs = document.querySelectorAll(".opcao-votacao-input");
    opcoes_votacao = Array.from(inputs)
      .map((input) => input.value.trim())
      .filter((v) => v);

    if (opcoes_votacao.length < 2) {
      mostrarMensagem(
        "mensagemEvento",
        "Para votação por alternativas, forneça pelo menos 2 opções (candidatos/alternativas)",
        "error"
      );
      return;
    }

    if (!votacao_multipla) {
      const confirmar = await confirmCustom(
        "Para votação por alternativas, é recomendado permitir votação múltipla.\n\nDeseja continuar com voto único?",
        "Atenção",
        "warning"
      );
      if (!confirmar) return;
    }
  }

  const checkboxes = document.querySelectorAll(
    'input[name="participantes"]:checked'
  );
  const participantes = Array.from(checkboxes).map((cb) => parseInt(cb.value));

  if (participantes.length === 0) {
    mostrarMensagem(
      "mensagemEvento",
      "Selecione pelo menos um participante",
      "error"
    );
    return;
  }

  try {
    const response = await request("/eventos", {
      method: "POST",
      body: JSON.stringify({
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
      }),
    });

    if (response.success) {
      mostrarMensagem("mensagemEvento", response.message, "success");
      setTimeout(() => {
        fecharModalEvento();
        carregarEventos();
      }, 1500);
    }
  } catch (error) {
    mostrarMensagem("mensagemEvento", error.message, "error");
  }
}

async function verDetalhesEvento(id) {
  try {
    console.log("Carregando detalhes do evento:", id);

    const response = await request(`/eventos/${id}`);
    console.log("Resposta completa:", response);

    if (!response.success || !response.evento) {
      throw new Error("Dados do evento inválidos");
    }

    const evento = response.evento;

    const dataInicio = new Date(evento.data_inicio).toLocaleString("pt-BR");
    const dataFim = new Date(evento.data_fim).toLocaleString("pt-BR");

    const presentes = evento.participantes
      ? evento.participantes.filter((p) => p.presente)
      : [];
    const ausentes = evento.participantes
      ? evento.participantes.filter((p) => !p.presente)
      : [];

    const pesoPresente = presentes.reduce(
      (sum, p) => sum + parseFloat(p.peso || 0),
      0
    );
    const pesoTotal = evento.participantes
      ? evento.participantes.reduce(
          (sum, p) => sum + parseFloat(p.peso || 0),
          0
        )
      : 0;
    const percentualPeso =
      pesoTotal > 0 ? ((pesoPresente / pesoTotal) * 100).toFixed(2) : 0;

    // ATUALIZADO: Mapa de tipos de votação
    const tiposVotacao = {
      APROVACAO: "Votação por Aprovação",
      ALTERNATIVAS: "Votação por Alternativas",
      SIM_NAO: "Votação Sim/Não",
    };

    let opcoesHTML = "";
    if (evento.opcoes_votacao) {
      let opcoes = evento.opcoes_votacao;

      if (typeof opcoes === "string") {
        try {
          opcoes = JSON.parse(opcoes);
        } catch (e) {
          opcoes = opcoes
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      }

      if (Array.isArray(opcoes) && opcoes.length > 0) {
        // ATUALIZADO: Separar opções normais de especiais
        const opcoesEspeciais = ["Voto Nulo ou Branco", "Abstenção"];
        const opcoesNormais = opcoes.filter(
          (op) => !opcoesEspeciais.includes(op)
        );
        const opcoesEspeciaisFiltradas = opcoes.filter((op) =>
          opcoesEspeciais.includes(op)
        );

        opcoesHTML = "<p><strong>Opções de Votação:</strong></p>";

        if (opcoesNormais.length > 0) {
          opcoesHTML += '<ul style="margin-bottom: 1rem;">';
          opcoesHTML += opcoesNormais
            .map((op) => `<li><i class="fas fa-check"></i> ${op}</li>`)
            .join("");
          opcoesHTML += "</ul>";
        }

        if (opcoesEspeciaisFiltradas.length > 0) {
          opcoesHTML +=
            '<p style="margin-top: 1rem;"><strong>Opções Especiais:</strong></p>';
          opcoesHTML +=
            '<ul style="background: var(--warning-light); padding: 1rem; border-radius: var(--radius); border-left: 3px solid var(--warning-color);">';
          opcoesHTML += opcoesEspeciaisFiltradas
            .map(
              (op) =>
                `<li><i class="fas fa-exclamation-triangle"></i> ${op}</li>`
            )
            .join("");
          opcoesHTML += "</ul>";
        }
      }
    }

    let votacaoMultiplaHTML = "";
    if (evento.votacao_multipla) {
      votacaoMultiplaHTML = `
              <p style="background: var(--info-light); padding: 0.75rem; border-radius: var(--radius); border-left: 3px solid var(--info-color);">
                  <i class="fas fa-check-double"></i> <strong>Votação Múltipla:</strong> Sim (Máximo ${evento.votos_maximos} votos por município)
              </p>
          `;
    }

    // ATUALIZADO: Badge de status com cores
    let badgeStatusHTML = "";
    switch (evento.status) {
      case "RASCUNHO":
        badgeStatusHTML =
          '<span class="badge badge-info"><i class="fas fa-draft"></i> Rascunho</span>';
        break;
      case "AGUARDANDO_INICIO":
        badgeStatusHTML =
          '<span class="badge badge-warning"><i class="fas fa-clock"></i> Aguardando Liberação</span>';
        break;
      case "ATIVO":
        badgeStatusHTML =
          '<span class="badge badge-success"><i class="fas fa-check-circle"></i> Votação Ativa</span>';
        break;
      case "ENCERRADO":
        badgeStatusHTML =
          '<span class="badge badge-danger"><i class="fas fa-stop-circle"></i> Encerrado</span>';
        break;
    }

    const conteudo = `
          <div style="margin-bottom: 1.5rem;">
              <h3 style="color: var(--primary-color); margin-bottom: 1rem; font-size: 1.3rem; line-height: 1.4;">${
                evento.titulo
              }</h3>
              <p><strong>Descrição:</strong> ${
                evento.descricao || "Sem descrição"
              }</p>
              
              <div style="margin: 1.5rem 0;">
                  <p><strong>Tipo de Votação:</strong> ${
                    tiposVotacao[evento.tipo_votacao] || evento.tipo_votacao
                  }</p>
                  ${votacaoMultiplaHTML}
                  ${opcoesHTML}
              </div>

              <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid var(--border);">

              <p><strong>Status:</strong> ${badgeStatusHTML}</p>
              <p><strong>Data Início:</strong> ${dataInicio}</p>
              <p><strong>Data Fim:</strong> ${dataFim}</p>
              <p><strong>Quórum Mínimo (Peso):</strong> ${
                evento.peso_minimo_quorum
              }%</p>
              <p><strong>Quórum Atual:</strong> 
                  <span style="font-size: 1.2rem; font-weight: bold; color: ${
                    percentualPeso >= evento.peso_minimo_quorum
                      ? "var(--success-color)"
                      : "var(--danger-color)"
                  }">
                      ${percentualPeso}%
                  </span> 
                  (${pesoPresente.toFixed(2)} de ${pesoTotal.toFixed(2)})
                  ${
                    percentualPeso >= evento.peso_minimo_quorum
                      ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i>'
                      : '<i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i>'
                  }
              </p>
              <p><strong>Criado por:</strong> ${evento.criador_nome}</p>
          </div>

          <h4 style="color: var(--success-color); margin-bottom: 0.5rem;">
              <i class="fas fa-user-check"></i> Presentes (${
                presentes.length
              }) - Peso: ${pesoPresente.toFixed(2)}
          </h4>
          <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem; max-height: 200px; overflow-y: auto;">
              ${
                presentes.length > 0
                  ? presentes
                      .map(
                        (
                          p
                        ) => `<li style="padding: 0.5rem; background: var(--success-light); margin-bottom: 0.25rem; border-radius: var(--radius);">
                      <i class="fas fa-check-circle" style="color: var(--success-color);"></i> ${
                        p.nome
                      } - ${p.municipio_nome || "N/A"} (Peso: ${p.peso})
                  </li>`
                      )
                      .join("")
                  : "<li>Nenhum participante presente ainda</li>"
              }
          </ul>

          <h4 style="color: var(--danger-color); margin-bottom: 0.5rem;">
              <i class="fas fa-user-times"></i> Ausentes (${ausentes.length})
          </h4>
          <ul style="list-style: none; padding: 0; max-height: 200px; overflow-y: auto;">
              ${
                ausentes.length > 0
                  ? ausentes
                      .map(
                        (
                          p
                        ) => `<li style="padding: 0.5rem; background: var(--light); margin-bottom: 0.25rem; border-radius: var(--radius);">
                      <i class="fas fa-times-circle" style="color: var(--danger-color);"></i> ${
                        p.nome
                      } - ${p.municipio_nome || "N/A"} (Peso: ${p.peso})
                  </li>`
                      )
                      .join("")
                  : "<li>Todos confirmaram presença</li>"
              }
          </ul>
      `;

    document.getElementById("conteudoDetalhesEvento").innerHTML = conteudo;
    document.getElementById("modalDetalhesEvento").classList.add("show");
  } catch (error) {
    console.error("Erro detalhado ao carregar evento:", error);
    await alertCustom(
      "Não foi possível carregar os detalhes do evento.\n\n" + error.message,
      "Erro ao Carregar",
      "error"
    );
  }
}

function fecharModalDetalhesEvento() {
  document.getElementById("modalDetalhesEvento").classList.remove("show");
}

async function iniciarEvento(id) {
  const confirmar = await confirmCustom(
    "Deseja INICIAR este evento?\n\nO evento ficará aguardando liberação para votação.",
    "Iniciar Evento",
    "question"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/eventos/${id}/iniciar`, {
      method: "POST",
    });

    if (response.success) {
      await alertCustom(response.message, "Sucesso", "success");
      carregarEventos();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}

async function liberarVotacao(id) {
  const confirmar = await confirmCustom(
    "Deseja LIBERAR a votação?\n\nParticipantes presentes poderão votar imediatamente.",
    "Liberar Votação",
    "warning"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/eventos/${id}/liberar`, {
      method: "POST",
    });

    if (response.success) {
      await alertCustom(response.message, "Sucesso", "success");
      carregarEventos();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}

async function encerrarEvento(id) {
  const confirmar = await confirmCustom(
    "Deseja ENCERRAR este evento?\n\nEsta ação não pode ser desfeita.",
    "Encerrar Evento",
    "danger"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/eventos/${id}/encerrar`, {
      method: "POST",
    });

    if (response.success) {
      await alertCustom(response.message, "Sucesso", "success");
      carregarEventos();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}

async function deletarEvento(id) {
  const confirmar = await confirmCustom(
    "Tem certeza que deseja deletar este evento?\n\nTodos os dados serão perdidos!",
    "Deletar Evento",
    "danger"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/eventos/${id}`, {
      method: "DELETE",
    });

    if (response.success) {
      await alertCustom(response.message, "Sucesso", "success");
      carregarEventos();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}

// ========== USUÁRIOS ==========
async function carregarUsuarios() {
  try {
    const response = await request("/admin/usuarios");
    usuarios = response.usuarios;
    renderizarUsuarios();
  } catch (error) {
    console.error("Erro ao carregar usuários:", error);
    document.getElementById("tabelaUsuarios").innerHTML =
      '<tr><td colspan="7" class="error">Erro ao carregar usuários</td></tr>';
  }
}

function renderizarUsuarios() {
  const tbody = document.getElementById("tabelaUsuarios");

  if (usuarios.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7">Nenhum usuário cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = usuarios
    .map(
      (u) => `
        <tr>
            <td>${formatarCPF(u.cpf)}</td>
            <td>${u.nome}</td>
            <td><span class="badge badge-${
              u.tipo === "ADMIN" ? "danger" : "info"
            }">${u.tipo}</span></td>
            <td>${u.municipio_nome || "-"}</td>
            <td>${u.peso || "-"}</td>
            <td><span class="badge badge-${u.ativo ? "success" : "danger"}">${
        u.ativo ? "Ativo" : "Inativo"
      }</span></td>
            <td class="table-actions">
                <button onclick="editarUsuario(${
                  u.id
                })" class="btn btn-sm btn-secondary" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletarUsuario(${
                  u.id
                })" class="btn btn-sm btn-danger" title="Deletar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

function abrirModalUsuario() {
  document.getElementById("tituloModalUsuario").innerHTML =
    '<i class="fas fa-user-plus"></i> Novo Usuário';
  document.getElementById("formUsuario").reset();
  document.getElementById("usuarioId").value = "";
  document.getElementById("usuarioAtivo").checked = true;

  document.getElementById("grupoSenha").style.display = "none";
  document.getElementById("grupoMunicipio").style.display = "none";

  carregarMunicipiosParaUsuario();
  document.getElementById("modalUsuario").classList.add("show");
}

function fecharModalUsuario() {
  document.getElementById("modalUsuario").classList.remove("show");
}

async function carregarMunicipiosParaUsuario() {
  try {
    const response = await request("/admin/municipios");
    const select = document.getElementById("usuarioMunicipio");
    select.innerHTML =
      '<option value="">Selecione...</option>' +
      response.municipios
        .map(
          (m) => `<option value="${m.id}">${m.nome} (Peso: ${m.peso})</option>`
        )
        .join("");
  } catch (error) {
    console.error("Erro ao carregar municípios:", error);
  }
}

function toggleCamposUsuario() {
  const tipo = document.getElementById("usuarioTipo").value;
  const grupoSenha = document.getElementById("grupoSenha");
  const grupoMunicipio = document.getElementById("grupoMunicipio");
  const senhaInput = document.getElementById("usuarioSenha");
  const municipioSelect = document.getElementById("usuarioMunicipio");

  if (tipo === "ADMIN") {
    grupoSenha.style.display = "block";
    grupoMunicipio.style.display = "none";
    senhaInput.required = !document.getElementById("usuarioId").value;
    municipioSelect.required = false;
  } else if (tipo === "PREFEITO" || tipo === "REPRESENTANTE") {
    grupoSenha.style.display = "none";
    grupoMunicipio.style.display = "block";
    senhaInput.required = false;
    municipioSelect.required = true;
  } else {
    grupoSenha.style.display = "none";
    grupoMunicipio.style.display = "none";
  }
}

async function editarUsuario(id) {
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return;

  document.getElementById("tituloModalUsuario").innerHTML =
    '<i class="fas fa-user-edit"></i> Editar Usuário';
  document.getElementById("usuarioId").value = usuario.id;
  document.getElementById("usuarioCpf").value = formatarCPF(usuario.cpf);
  document.getElementById("usuarioNome").value = usuario.nome;
  document.getElementById("usuarioTipo").value = usuario.tipo;
  document.getElementById("usuarioAtivo").checked = usuario.ativo;

  await carregarMunicipiosParaUsuario();

  if (usuario.municipio_id) {
    document.getElementById("usuarioMunicipio").value = usuario.municipio_id;
  }

  toggleCamposUsuario();
  document.getElementById("modalUsuario").classList.add("show");
}

async function salvarUsuario(e) {
  e.preventDefault();

  const id = document.getElementById("usuarioId").value;
  const cpf = limparCPF(document.getElementById("usuarioCpf").value);
  const nome = document.getElementById("usuarioNome").value;
  const tipo = document.getElementById("usuarioTipo").value;
  const senha = document.getElementById("usuarioSenha").value;
  const municipio_id =
    document.getElementById("usuarioMunicipio").value || null;
  const ativo = document.getElementById("usuarioAtivo").checked;

  if (!validarCPF(cpf)) {
    mostrarMensagem("mensagemUsuario", "CPF inválido", "error");
    return;
  }

  try {
    const url = id ? `/admin/usuarios/${id}` : "/admin/usuarios";
    const method = id ? "PUT" : "POST";

    const data = { cpf, nome, tipo, ativo };

    if (tipo === "ADMIN" && senha) {
      data.senha = senha;
    }

    if ((tipo === "PREFEITO" || tipo === "REPRESENTANTE") && municipio_id) {
      data.municipio_id = parseInt(municipio_id);
    }

    const response = await request(url, {
      method,
      body: JSON.stringify(data),
    });

    if (response.success) {
      mostrarMensagem("mensagemUsuario", response.message, "success");
      setTimeout(() => {
        fecharModalUsuario();
        carregarUsuarios();
      }, 1500);
    }
  } catch (error) {
    mostrarMensagem("mensagemUsuario", error.message, "error");
  }
}

async function deletarUsuario(id) {
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) return;

  const confirmar = await confirmCustom(
    `Tem certeza que deseja deletar o usuário "${usuario.nome}"?\n\nATENÇÃO: Se este usuário votou, os votos também serão removidos!`,
    "Deletar Usuário",
    "danger"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/admin/usuarios/${id}`, {
      method: "DELETE",
    });

    if (response.success) {
      let mensagem = response.message;
      if (response.votosRemovidos > 0) {
        mensagem += `\n\n${response.votosRemovidos} voto(s) foram removidos.`;
      }
      await alertCustom(mensagem, "Sucesso", "success");
      carregarUsuarios();
      carregarEventos();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}

// ========== MUNICÍPIOS ==========
async function carregarMunicipios() {
  try {
    const response = await request("/admin/municipios");
    municipios = response.municipios;
    renderizarMunicipios();
  } catch (error) {
    console.error("Erro ao carregar municípios:", error);
    document.getElementById("tabelaMunicipios").innerHTML =
      '<tr><td colspan="3" class="error">Erro ao carregar municípios</td></tr>';
  }
}

function renderizarMunicipios() {
  const tbody = document.getElementById("tabelaMunicipios");

  if (municipios.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3">Nenhum município cadastrado</td></tr>';
    return;
  }

  tbody.innerHTML = municipios
    .map(
      (m) => `
        <tr>
            <td>${m.nome}</td>
            <td>${m.peso}</td>
            <td class="table-actions">
                <button onclick="editarMunicipio(${m.id})" class="btn btn-sm btn-secondary" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="deletarMunicipio(${m.id})" class="btn btn-sm btn-danger" title="Deletar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `
    )
    .join("");
}

function abrirModalMunicipio() {
  document.getElementById("tituloModalMunicipio").innerHTML =
    '<i class="fas fa-city"></i> Novo Município';
  document.getElementById("formMunicipio").reset();
  document.getElementById("municipioId").value = "";
  document.getElementById("modalMunicipio").classList.add("show");
}

function fecharModalMunicipio() {
  document.getElementById("modalMunicipio").classList.remove("show");
}

async function editarMunicipio(id) {
  const municipio = municipios.find((m) => m.id === id);
  if (!municipio) return;

  document.getElementById("tituloModalMunicipio").innerHTML =
    '<i class="fas fa-city"></i> Editar Município';
  document.getElementById("municipioId").value = municipio.id;
  document.getElementById("municipioNome").value = municipio.nome;
  document.getElementById("municipioPeso").value = municipio.peso;
  document.getElementById("modalMunicipio").classList.add("show");
}

async function salvarMunicipio(e) {
  e.preventDefault();

  const id = document.getElementById("municipioId").value;
  const nome = document.getElementById("municipioNome").value;
  const peso = parseFloat(document.getElementById("municipioPeso").value);

  try {
    const url = id ? `/admin/municipios/${id}` : "/admin/municipios";
    const method = id ? "PUT" : "POST";

    const response = await request(url, {
      method,
      body: JSON.stringify({ nome, peso }),
    });

    if (response.success) {
      mostrarMensagem("mensagemMunicipio", response.message, "success");
      setTimeout(() => {
        fecharModalMunicipio();
        carregarMunicipios();
      }, 1500);
    }
  } catch (error) {
    mostrarMensagem("mensagemMunicipio", error.message, "error");
  }
}

async function deletarMunicipio(id) {
  const confirmar = await confirmCustom(
    "Tem certeza que deseja deletar este município?",
    "Deletar Município",
    "danger"
  );

  if (!confirmar) return;

  try {
    const response = await request(`/admin/municipios/${id}`, {
      method: "DELETE",
    });

    if (response.success) {
      await alertCustom(response.message, "Sucesso", "success");
      carregarMunicipios();
    }
  } catch (error) {
    await alertCustom(error.message, "Erro", "error");
  }
}
