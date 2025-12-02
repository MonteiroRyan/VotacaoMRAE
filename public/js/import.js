let arquivoSelecionado = null;
let dadosPreview = null;

function baixarModelo() {
  window.location.href = "/api/import/modelo";
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validar tamanho (5MB)
  if (file.size > 5 * 1024 * 1024) {
    alertCustom("Arquivo muito grande. Tamanho máximo: 5MB", "Erro", "error");
    return;
  }

  // Validar extensão
  const extensoesValidas = [".xlsx", ".xls", ".csv"];
  const extensao = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));

  if (!extensoesValidas.includes(extensao)) {
    alertCustom(
      "Formato de arquivo inválido. Use .xlsx, .xls ou .csv",
      "Erro",
      "error"
    );
    return;
  }

  arquivoSelecionado = file;

  document.getElementById("nomeArquivoTexto").textContent = file.name;
  document.getElementById("nomeArquivo").style.display = "block";
  document.getElementById("btnProcessar").style.display = "inline-block";
  document.querySelector(".upload-placeholder").style.display = "none";
}

function limparArquivo() {
  arquivoSelecionado = null;
  dadosPreview = null;
  document.getElementById("arquivoImport").value = "";
  document.getElementById("nomeArquivo").style.display = "none";
  document.getElementById("btnProcessar").style.display = "none";
  document.querySelector(".upload-placeholder").style.display = "flex";
  document.getElementById("stepPreview").style.display = "none";
  document.getElementById("stepResultado").style.display = "none";
}

async function processarPlanilha() {
  if (!arquivoSelecionado) {
    alertCustom("Selecione um arquivo primeiro", "Atenção", "warning");
    return;
  }

  const formData = new FormData();
  formData.append("arquivo", arquivoSelecionado);

  try {
    const btnProcessar = document.getElementById("btnProcessar");
    btnProcessar.disabled = true;
    btnProcessar.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Processando...';

    const response = await fetch("/api/import/processar", {
      method: "POST",
      headers: {
        "X-Session-ID": getSessionId(),
      },
      body: formData,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message);
    }

    dadosPreview = data.preview;
    console.log("Preview recebido:", dadosPreview);

    renderizarPreview(dadosPreview);

    document.getElementById("stepPreview").style.display = "block";
    document
      .getElementById("stepPreview")
      .scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    console.error("Erro ao processar planilha:", error);
    alertCustom(
      "Erro ao processar planilha:\n\n" + error.message,
      "Erro",
      "error"
    );
  } finally {
    const btnProcessar = document.getElementById("btnProcessar");
    btnProcessar.disabled = false;
    btnProcessar.innerHTML = '<i class="fas fa-cog"></i> Processar Planilha';
  }
}

function renderizarPreview(preview) {
  const container = document.getElementById("previewResultado");

  let html = `
        <div class="stats-grid" style="margin-bottom: 2rem;">
            <div class="stat-card">
                <h3><i class="fas fa-file-alt"></i> Total de Linhas</h3>
                <p class="stat-value">${preview.totalLinhas}</p>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-check-circle"></i> Usuários Válidos</h3>
                <p class="stat-value" style="color: var(--success-color);">${preview.usuariosValidos}</p>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-exclamation-triangle"></i> Erros</h3>
                <p class="stat-value" style="color: var(--danger-color);">${preview.erros}</p>
            </div>
            <div class="stat-card">
                <h3><i class="fas fa-city"></i> Novos Municípios</h3>
                <p class="stat-value" style="color: var(--info-color);">${preview.municipiosNovos.length}</p>
            </div>
        </div>
    `;

  // Municípios novos
  if (preview.municipiosNovos.length > 0) {
    html += `
            <div class="mensagem info" style="margin-bottom: 2rem;">
                <h4><i class="fas fa-city"></i> Novos Municípios que serão criados:</h4>
                <ul style="margin-top: 0.5rem; margin-left: 2rem;">
                    ${preview.municipiosNovos
                      .map((m) => `<li>${m.nome} (Peso: ${m.peso})</li>`)
                      .join("")}
                </ul>
            </div>
        `;
  }

  // Erros
  if (preview.erros > 0) {
    html += `
            <div class="mensagem error" style="margin-bottom: 2rem;">
                <h4><i class="fas fa-exclamation-circle"></i> Erros encontrados (${
                  preview.erros
                }):</h4>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 1rem;">
                    <table style="width: 100%; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: var(--danger-color); color: white;">
                                <th style="padding: 0.5rem;">Linha</th>
                                <th style="padding: 0.5rem;">Campo</th>
                                <th style="padding: 0.5rem;">Erro</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${preview.todosErros
                              .map(
                                (e) => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; text-align: center;">${e.linha}</td>
                                    <td style="padding: 0.5rem;"><strong>${e.campo}</strong></td>
                                    <td style="padding: 0.5rem;">${e.mensagem}</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
                <p style="margin-top: 1rem;"><strong>⚠️ Apenas usuários válidos serão importados. Corrija os erros e faça novo upload se necessário.</strong></p>
            </div>
        `;
  }

  // Preview dos primeiros 10 usuários
  if (preview.usuariosValidos > 0) {
    const usuariosParaMostrar = preview.usuarios.slice(0, 10);
    html += `
            <div class="mensagem success" style="margin-bottom: 2rem;">
                <h4><i class="fas fa-users"></i> Preview dos Usuários (${
                  usuariosParaMostrar.length
                } de ${preview.usuariosValidos}):</h4>
                <div style="max-height: 400px; overflow-y: auto; margin-top: 1rem;">
                    <table style="width: 100%; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: var(--success-color); color: white;">
                                <th style="padding: 0.5rem;">CPF</th>
                                <th style="padding: 0.5rem;">Nome</th>
                                <th style="padding: 0.5rem;">Tipo</th>
                                <th style="padding: 0.5rem;">Município</th>
                                <th style="padding: 0.5rem;">Ativo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${usuariosParaMostrar
                              .map(
                                (u) => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem;">${formatarCPF(
                                      u.cpf
                                    )}</td>
                                    <td style="padding: 0.5rem;">${u.nome}</td>
                                    <td style="padding: 0.5rem;"><span class="badge badge-info">${
                                      u.tipo
                                    }</span></td>
                                    <td style="padding: 0.5rem;">${
                                      u.municipio
                                    }</td>
                                    <td style="padding: 0.5rem; text-align: center;">${
                                      u.ativo ? "✅" : "❌"
                                    }</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
                ${
                  preview.usuariosValidos > 10
                    ? `<p style="margin-top: 0.5rem;"><small>+ ${
                        preview.usuariosValidos - 10
                      } usuários adicionais...</small></p>`
                    : ""
                }
            </div>
        `;
  }

  container.innerHTML = html;

  // Mostrar botões de ação se houver usuários válidos
  if (preview.usuariosValidos > 0) {
    document.getElementById("acoesImport").style.display = "block";
  } else {
    document.getElementById("acoesImport").style.display = "none";
    alertCustom(
      "Nenhum usuário válido encontrado na planilha. Corrija os erros e tente novamente.",
      "Atenção",
      "warning"
    );
  }
}

async function confirmarImportacao() {
  const confirmar = await confirmCustom(
    `Confirma a importação de ${dadosPreview.usuariosValidos} usuário(s)?\n\n` +
      `${
        dadosPreview.municipiosNovos.length > 0
          ? `Serão criados ${dadosPreview.municipiosNovos.length} novo(s) município(s).\n\n`
          : ""
      }` +
      `Esta ação pode criar ou atualizar registros no banco de dados.`,
    "Confirmar Importação",
    "warning"
  );

  if (!confirmar) return;

  try {
    const btnConfirmar = document.querySelector("#acoesImport .btn-success");
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Importando...';

    console.log("Enviando para importação:", {
      totalUsuarios: dadosPreview.usuarios.length,
      totalMunicipios: dadosPreview.municipiosNovos.length,
    });

    // IMPORTANTE: Enviar TODOS os usuários do preview
    const response = await request("/import/confirmar", {
      method: "POST",
      body: JSON.stringify({
        usuarios: dadosPreview.usuarios, // TODOS OS USUÁRIOS
        municipiosNovos: dadosPreview.municipiosNovos,
      }),
    });

    console.log("Resposta da importação:", response);

    if (response.success) {
      renderizarResultado(response.resultado);
      document.getElementById("stepResultado").style.display = "block";
      document.getElementById("stepPreview").style.display = "none";
      document
        .getElementById("stepResultado")
        .scrollIntoView({ behavior: "smooth" });

      // Recarregar listas de usuários e municípios
      console.log("Recarregando listas...");
      setTimeout(() => {
        if (typeof carregarUsuarios === "function") {
          carregarUsuarios();
        }
        if (typeof carregarMunicipios === "function") {
          carregarMunicipios();
        }
      }, 1000);
    }
  } catch (error) {
    console.error("Erro ao importar:", error);
    alertCustom("Erro ao importar dados:\n\n" + error.message, "Erro", "error");
  } finally {
    const btnConfirmar = document.querySelector("#acoesImport .btn-success");
    if (btnConfirmar) {
      btnConfirmar.disabled = false;
      btnConfirmar.innerHTML =
        '<i class="fas fa-check"></i> Confirmar Importação';
    }
  }
}

function renderizarResultado(resultado) {
  const container = document.getElementById("resultadoImportacao");

  let html = `
        <div class="mensagem success" style="margin-bottom: 2rem;">
            <h3><i class="fas fa-check-circle"></i> Importação Concluída!</h3>
            
            <div class="stats-grid" style="margin-top: 1.5rem;">
                <div class="stat-card">
                    <h4><i class="fas fa-city"></i> Municípios Criados</h4>
                    <p class="stat-value" style="color: var(--info-color);">${resultado.municipiosCriados}</p>
                </div>
                <div class="stat-card">
                    <h4><i class="fas fa-user-plus"></i> Usuários Criados</h4>
                    <p class="stat-value" style="color: var(--success-color);">${resultado.usuariosCriados}</p>
                </div>
                <div class="stat-card">
                    <h4><i class="fas fa-user-edit"></i> Usuários Atualizados</h4>
                    <p class="stat-value" style="color: var(--warning-color);">${resultado.usuariosAtualizados}</p>
                </div>
                <div class="stat-card">
                    <h4><i class="fas fa-exclamation-triangle"></i> Erros</h4>
                    <p class="stat-value" style="color: var(--danger-color);">${resultado.erros}</p>
                </div>
            </div>
        </div>
    `;

  // Mostrar erros se houver
  if (
    resultado.erros > 0 &&
    resultado.detalhesErros &&
    resultado.detalhesErros.length > 0
  ) {
    html += `
            <div class="mensagem error">
                <h4><i class="fas fa-exclamation-circle"></i> Erros durante a importação:</h4>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 1rem;">
                    <table style="width: 100%; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: var(--danger-color); color: white;">
                                <th style="padding: 0.5rem;">Linha</th>
                                <th style="padding: 0.5rem;">CPF/Nome</th>
                                <th style="padding: 0.5rem;">Erro</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultado.detalhesErros
                              .map(
                                (e) => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem; text-align: center;">${
                                      e.linha || "-"
                                    }</td>
                                    <td style="padding: 0.5rem;">${
                                      e.cpf || e.nome || "-"
                                    }</td>
                                    <td style="padding: 0.5rem;">${e.erro}</td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
  }

  html += `
        <div style="margin-top: 2rem; text-align: center;">
            <button onclick="novaImportacao()" class="btn btn-primary btn-lg">
                <i class="fas fa-file-upload"></i> Nova Importação
            </button>
            <button onclick="mudarTab('usuarios')" class="btn btn-secondary btn-lg">
                <i class="fas fa-users"></i> Ver Usuários Importados
            </button>
        </div>
    `;

  container.innerHTML = html;
}

function cancelarImportacao() {
  limparArquivo();
}

function novaImportacao() {
  limparArquivo();
  document.querySelector(".upload-placeholder").style.display = "flex";
}

// Drag and Drop - Inicializar após DOM carregar
document.addEventListener("DOMContentLoaded", () => {
  const uploadArea = document.getElementById("uploadArea");

  if (uploadArea) {
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--primary-color)";
      uploadArea.style.background = "var(--info-light)";
    });

    uploadArea.addEventListener("dragleave", () => {
      uploadArea.style.borderColor = "var(--border)";
      uploadArea.style.background = "var(--white)";
    });

    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = "var(--border)";
      uploadArea.style.background = "var(--white)";

      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById("arquivoImport");
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input });
      }
    });
  }
});
