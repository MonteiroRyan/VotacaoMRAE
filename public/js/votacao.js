console.log("=== VOTACAO.JS CARREGADO ===");

let eventoAtual = null;
let votosSelecionados = [];

document.addEventListener("DOMContentLoaded", async () => {
  console.log("=== DOM LOADED ===");

  try {
    const usuario = await verificarAutenticacao();
    console.log("Usuario autenticado:", usuario);
    if (!usuario) return;

    if (usuario.tipo === "ADMIN") {
      await alertCustom(
        "Administradores não podem votar",
        "Acesso Negado",
        "error"
      );
      window.location.href = "/admin.html";
      return;
    }

    document.getElementById("nomeUsuario").textContent = usuario.nome;
    document.getElementById("infoNome").textContent = usuario.nome;
    document.getElementById("infoCpf").textContent = formatarCPF(usuario.cpf);
    document.getElementById("infoMunicipio").textContent =
      usuario.municipio_nome || "N/A";
    document.getElementById("infoPeso").textContent = usuario.peso || "N/A";

    const urlParams = new URLSearchParams(window.location.search);
    const eventoId = urlParams.get("evento");

    if (!eventoId) {
      await alertCustom("Evento não especificado", "Erro", "error");
      window.location.href = "/eventos.html";
      return;
    }

    await carregarEvento(eventoId);
    await verificarSeJaVotou(eventoId);
  } catch (e) {
    console.error("Erro inicializando votacao.js:", e);
  }
});

async function carregarEvento(eventoId) {
  try {
    console.log("Carregando evento:", eventoId);
    const response = await request(`/eventos/${eventoId}`);
    console.log("Resposta do evento:", response);

    if (!response.success || !response.evento) {
      throw new Error("Resposta inválida do servidor");
    }

    eventoAtual = response.evento;

    document.getElementById("infoEvento").textContent = eventoAtual.titulo;

    // Verificar período
    if (eventoAtual.periodo_status === "ANTES_PERIODO") {
      await alertCustom(
        `Este evento ainda não iniciou.\n\nData de início: ${new Date(
          eventoAtual.data_inicio
        ).toLocaleString("pt-BR")}`,
        "Evento Não Iniciado",
        "warning"
      );
      window.location.href = "/eventos.html";
      return;
    }

    if (eventoAtual.periodo_status === "APOS_PERIODO") {
      await alertCustom(
        `Este evento já encerrou.\n\nData de fim: ${new Date(
          eventoAtual.data_fim
        ).toLocaleString("pt-BR")}`,
        "Evento Encerrado",
        "warning"
      );
      window.location.href = "/eventos.html";
      return;
    }

    console.log("Status do evento:", eventoAtual.status);
    if (eventoAtual.status !== "ATIVO") {
      await alertCustom(
        "A votação ainda não foi liberada pelo administrador.\n\nAguarde a liberação para votar.",
        "Votação Não Liberada",
        "warning"
      );
      window.location.href = `/eventos.html`;
      return;
    }

    const usuario = getUsuario();
    console.log("Usuário atual:", usuario);

    const participante = eventoAtual.participantes.find(
      (p) => p.usuario_id === usuario.id
    );
    console.log("Participante encontrado:", participante);

    if (!participante) {
      await alertCustom(
        "Você não está cadastrado neste evento",
        "Acesso Negado",
        "error"
      );
      window.location.href = `/eventos.html`;
      return;
    }

    if (!participante.presente) {
      await alertCustom(
        "Sua presença não foi confirmada automaticamente.\n\nContate o administrador.",
        "Presença Necessária",
        "warning"
      );
      window.location.href = `/eventos.html`;
      return;
    }

    // ATUALIZADO: Garantir opções como array com novas opções padrão
    if (
      !eventoAtual.opcoes_votacao ||
      eventoAtual.opcoes_votacao.length === 0
    ) {
      console.error("Opções de votação não disponíveis");

      switch (eventoAtual.tipo_votacao) {
        case "APROVACAO":
          eventoAtual.opcoes_votacao = [
            "Aprovar",
            "Reprovar",
            "Voto Nulo ou Branco",
            "Abstenção",
          ];
          break;
        case "SIM_NAO":
          eventoAtual.opcoes_votacao = [
            "SIM",
            "NÃO",
            "Voto Nulo ou Branco",
            "Abstenção",
          ];
          break;
        case "ALTERNATIVAS":
          eventoAtual.opcoes_votacao = ["Voto Nulo ou Branco", "Abstenção"];
          break;
      }
      console.log("Opções padrão definidas:", eventoAtual.opcoes_votacao);
    }

    renderizarOpcoesVoto();
  } catch (error) {
    console.error("Erro ao carregar evento:", error);
    await alertCustom(
      "Erro ao carregar evento:\n\n" + error.message,
      "Erro",
      "error"
    );
    window.location.href = "/eventos.html";
  }
}

function renderizarOpcoesVoto() {
  const container = document.getElementById("opcoesVoto");

  if (!container) {
    console.error("Elemento opcoesVoto não encontrado no DOM");
    return;
  }

  if (!eventoAtual || !eventoAtual.opcoes_votacao) {
    container.innerHTML =
      '<p class="error">Erro: Opções de votação não disponíveis</p>';
    return;
  }

  let opcoes;
  if (Array.isArray(eventoAtual.opcoes_votacao)) {
    opcoes = eventoAtual.opcoes_votacao;
  } else if (typeof eventoAtual.opcoes_votacao === "string") {
    try {
      opcoes = JSON.parse(eventoAtual.opcoes_votacao);
    } catch (e) {
      console.error("Erro ao fazer parse das opções:", e);
      opcoes = eventoAtual.opcoes_votacao
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
    }
  } else {
    console.error(
      "Tipo de opções inválido:",
      typeof eventoAtual.opcoes_votacao
    );
    opcoes = [];
  }

  console.log("Opções a renderizar:", opcoes);

  if (opcoes.length === 0) {
    container.innerHTML =
      '<p class="error">Erro: Nenhuma opção de votação disponível</p>';
    return;
  }

  const isMultipla =
    eventoAtual.votacao_multipla === 1 || eventoAtual.votacao_multipla === true;
  const maxVotos = eventoAtual.votos_maximos || 1;

  // Atualizar instruções
  const instrucaoEl = document.getElementById("instrucaoVoto");
  if (instrucaoEl) {
    if (isMultipla) {
      instrucaoEl.innerHTML = `
              <i class="fas fa-info-circle"></i> <strong>Votacao Multipla:</strong> 
              Voce pode selecionar ate <strong>${maxVotos}</strong> opcao(oes).
              <br>
              <i class="fas fa-exclamation-triangle"></i> <strong>ATENCAO:</strong> Apenas 1 voto por municipio.
              <br>
              <i class="fas fa-ban"></i> Ao selecionar "Voto Nulo ou Branco" ou "Abstencao", nao sera possivel votar em candidatos.
          `;
    } else {
      instrucaoEl.innerHTML = `
              <i class="fas fa-info-circle"></i> <strong>Instrucao:</strong>
              Selecione sua opcao e confirme.
              <br>
              <i class="fas fa-exclamation-triangle"></i> <strong>ATENCAO:</strong> Apenas 1 voto por municipio.
          `;
    }
  }

  if (isMultipla && eventoAtual.tipo_votacao === "ALTERNATIVAS") {
    const opcoesEspeciais = ["Voto Nulo ou Branco", "Abstenção"];
    const opcoesNormais = opcoes.filter((op) => !opcoesEspeciais.includes(op));
    const opcoesEspeciaisFiltradas = opcoes.filter((op) =>
      opcoesEspeciais.includes(op)
    );

    container.innerHTML = `
          <div class="opcoes-checkbox-list">
              ${opcoesNormais
                .map((opcao) => {
                  const valorEscapado = ("" + opcao)
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
                  return `
                  <label class="opcao-checkbox-item opcao-normal" data-tipo="normal">
                      <input type="checkbox" name="voto" value="${valorEscapado}" onchange="atualizarSelecao('${valorEscapado}', ${maxVotos})">
                      <span class="checkbox-custom"></span>
                      <span class="opcao-texto">${opcao}</span>
                  </label>
                  `;
                })
                .join("")}
              
              ${
                opcoesEspeciaisFiltradas.length > 0
                  ? '<hr style="margin: 1.5rem 0; border: none; border-top: 2px solid var(--border);">'
                  : ""
              }
              
              ${opcoesEspeciaisFiltradas
                .map((opcao) => {
                  const valorEscapado = ("" + opcao)
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#39;");
                  return `
                  <label class="opcao-checkbox-item opcao-especial" data-tipo="especial" style="background: var(--warning-light); border-color: var(--warning-color);">
                      <input type="checkbox" name="voto" value="${valorEscapado}" onchange="atualizarSelecao('${valorEscapado}', ${maxVotos})">
                      <span class="checkbox-custom"></span>
                      <span class="opcao-texto"><strong>${opcao}</strong></span>
                  </label>
                  `;
                })
                .join("")}
          </div>
          <div style="margin-top: 2rem; text-align: center;">
              <button id="btnConfirmarMultiplos" class="btn btn-success" style="font-size: 1.2rem; padding: 1rem 3rem;">
                  <i class="fas fa-check"></i> Confirmar Voto
              </button>
          </div>
          <p id="contadorVotos" style="text-align: center; margin-top: 1rem; color: var(--gray-dark);">
              <i class="fas fa-vote-yea"></i> 0 de ${maxVotos} opcoes selecionadas
          </p>
      `;

    setTimeout(() => {
      const btn = document.getElementById("btnConfirmarMultiplos");
      if (btn) {
        btn.addEventListener("click", confirmarVotosMultiplos);
      }
    }, 10);
  } else {
    // Votação única: criar botões com EMOJIS ATUALIZADOS
    container.innerHTML = opcoes
      .map((opcao) => {
        const arrayLiteral = JSON.stringify([opcao]);
        const opcaoEscaped = ("" + opcao)
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");

        // ATUALIZADO: Mapa de emojis
        const emoji =
          {
            SIM: "✅",
            NÃO: "❌",
            Aprovar: "👍",
            Reprovar: "👎",
            Abstenção: "⚪",
            "Voto Nulo ou Branco": "⬜",
          }[opcao] || "📋";

        // ATUALIZADO: Mapa de classes
        const classe =
          {
            Sim: "btn-sim",
            Não: "btn-nao",
            SIM: "btn-sim",
            NÃO: "btn-nao",
            Aprovar: "btn-sim",
            Reprovar: "btn-nao",
            Abstenção: "btn-abstencao",
            "Voto Nulo ou Branco": "btn-abstencao",
          }[opcao] || "btn-voto";

        return `
              <button class="btn-voto ${classe}" onclick='votar(${arrayLiteral})'>
                  <span class="emoji">${emoji}</span>
                  <span>${opcaoEscaped}</span>
              </button>
          `;
      })
      .join("");
  }
}

function atualizarSelecao(opcao, maxVotos) {
  const checkboxes = Array.from(
    document.querySelectorAll('input[name="voto"]')
  );
  const checkbox = checkboxes.find((cb) => cb.value === opcao);
  if (!checkbox) return;

  const opcoesEspeciais = ["Voto Nulo ou Branco", "Abstenção"];
  const isOpcaoEspecial = opcoesEspeciais.includes(opcao);

  if (checkbox.checked) {
    // Se é opção especial, desmarcar todas as normais e vice-versa
    if (isOpcaoEspecial) {
      // Desmarcar todas as opções normais
      const opcoesNormais = document.querySelectorAll(
        '.opcao-normal input[type="checkbox"]'
      );
      opcoesNormais.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          const valor = cb.value;
          votosSelecionados = votosSelecionados.filter((v) => v !== valor);
        }
      });

      // Desabilitar opções normais
      desabilitarOpcoesNormais(true);

      // Garantir que só uma opção especial esteja marcada
      const outrasEspeciais = checkboxes.filter(
        (cb) => opcoesEspeciais.includes(cb.value) && cb.value !== opcao
      );
      outrasEspeciais.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          votosSelecionados = votosSelecionados.filter((v) => v !== cb.value);
        }
      });

      votosSelecionados = [opcao];
    } else {
      // É opção normal - desmarcar especiais
      const especiais = checkboxes.filter((cb) =>
        opcoesEspeciais.includes(cb.value)
      );
      especiais.forEach((cb) => {
        if (cb.checked) {
          cb.checked = false;
          votosSelecionados = votosSelecionados.filter((v) => v !== cb.value);
        }
      });

      desabilitarOpcoesNormais(false);

      // Verificar limite
      if (votosSelecionados.length >= maxVotos) {
        checkbox.checked = false;
        alertCustom(
          `Você pode selecionar no máximo ${maxVotos} opção(ões)`,
          "Limite Atingido",
          "warning"
        );
        return;
      }
      votosSelecionados.push(opcao);
    }
  } else {
    // Desmarcar
    votosSelecionados = votosSelecionados.filter((v) => v !== opcao);

    // Se não há mais seleções especiais, reabilitar normais
    const algumEspecialMarcado = checkboxes.some(
      (cb) => opcoesEspeciais.includes(cb.value) && cb.checked
    );
    if (!algumEspecialMarcado) {
      desabilitarOpcoesNormais(false);
    }
  }

  const contador = document.getElementById("contadorVotos");
  if (contador) {
    contador.innerHTML = `<i class="fas fa-vote-yea"></i> ${votosSelecionados.length} de ${maxVotos} opcoes selecionadas`;
  }
}

function desabilitarOpcoesNormais(desabilitar) {
  const opcoesNormais = document.querySelectorAll(".opcao-normal");
  opcoesNormais.forEach((label) => {
    const checkbox = label.querySelector('input[type="checkbox"]');
    if (desabilitar) {
      label.style.opacity = "0.5";
      label.style.pointerEvents = "none";
      label.style.background = "var(--light)";
      checkbox.disabled = true;
    } else {
      label.style.opacity = "1";
      label.style.pointerEvents = "auto";
      label.style.background = "var(--white)";
      checkbox.disabled = false;
    }
  });
}

async function confirmarVotosMultiplos() {
  if (votosSelecionados.length === 0) {
    await alertCustom(
      "Selecione pelo menos uma opção para votar",
      "Nenhuma Opção Selecionada",
      "warning"
    );
    return;
  }

  const maxVotos = eventoAtual.votos_maximos || 1;
  const opcoesEspeciais = ["Voto Nulo ou Branco", "Abstenção"];
  const temOpcaoEspecial = votosSelecionados.some((v) =>
    opcoesEspeciais.includes(v)
  );

  // NOVO: Avisar se não selecionou o máximo (exceto se for voto especial)
  if (!temOpcaoEspecial && votosSelecionados.length < maxVotos) {
    const confirmar = await confirmCustom(
      `Você selecionou ${votosSelecionados.length} de ${maxVotos} opções possíveis.\n\n` +
        `Deseja continuar sem selecionar todas as opções disponíveis?\n\n` +
        `Clique "Cancelar" para voltar e selecionar mais opções.`,
      "Confirmação de Voto",
      "warning"
    );

    if (!confirmar) {
      return;
    }
  }

  await votar(votosSelecionados);
}

// Na função verificarSeJaVotou, adicione:

async function verificarSeJaVotou(eventoId) {
  try {
    console.log("Verificando se já votou no evento:", eventoId);
    const response = await request(`/votos/verificar/${eventoId}`);
    console.log("Resposta verificação voto:", response);

    if (response.jaVotou) {
      document.getElementById("conteudoVotacao").style.display = "none";
      document.getElementById("votoRegistrado").style.display = "block";

      let mensagem = `Seu município já votou neste evento.<br><strong>Voto registrado por:</strong> ${response.votante}`;

      if (response.quantidadeVotos > 1) {
        mensagem += `<br><strong>Quantidade de votos:</strong> ${response.quantidadeVotos}`;
      }

      // NOVO: Indicar se foi outro usuário
      if (response.votouOutroUsuario) {
        mensagem += `<br><br><small style="color: var(--info-color);"><i class="fas fa-info-circle"></i> Este voto foi registrado por outro representante do seu município.</small>`;
      }

      document
        .getElementById("votoRegistrado")
        .querySelector(".success-message p").innerHTML = mensagem;
    }
  } catch (error) {
    console.error("Erro ao verificar voto:", error);
  }
}

async function votar(votosArray) {
  const urlParams = new URLSearchParams(window.location.search);
  const eventoId = urlParams.get("evento");

  console.log("Tentando votar:", votosArray, "no evento:", eventoId);

  const mensagemConfirmacao =
    votosArray.length > 1
      ? `Confirma seus ${votosArray.length} votos?\n\n${votosArray
          .map((v, i) => `${i + 1}. ${v}`)
          .join(
            "\n"
          )}\n\nATENÇÃO: Apenas 1 voto por município!\nEsta ação não pode ser desfeita!`
      : `Confirma seu voto: ${votosArray[0]}?\n\nATENÇÃO: Apenas 1 voto por município!\nEsta ação não pode ser desfeita!`;

  const confirmar = await confirmCustom(
    mensagemConfirmacao,
    "Confirmar Voto",
    "warning"
  );

  if (!confirmar) return;

  try {
    const response = await request("/votos", {
      method: "POST",
      body: JSON.stringify({
        votos: votosArray,
        evento_id: eventoId,
      }),
    });

    console.log("Resposta do voto:", response);

    if (response.success) {
      document.getElementById("conteudoVotacao").style.display = "none";
      document.getElementById("votoRegistrado").style.display = "block";

      await alertCustom(response.message, "Voto Confirmado", "success");
    }
  } catch (error) {
    console.error("Erro ao votar:", error);
    mostrarMensagem("mensagem", error.message, "error");
    await alertCustom(error.message, "Erro ao Votar", "error");
  }
}

function verResultados() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventoId = urlParams.get("evento");
  window.location.href = `/resultados.html?evento=${eventoId}`;
}
