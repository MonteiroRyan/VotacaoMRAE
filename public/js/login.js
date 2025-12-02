document.addEventListener("DOMContentLoaded", () => {
  const cpfInput = document.getElementById("cpf");
  aplicarMascaraCPF(cpfInput);

  const sessionId = getSessionId();
  if (sessionId) {
    verificarSessaoExistente();
  }

  document.getElementById("loginForm").addEventListener("submit", handleLogin);

  cpfInput.addEventListener("blur", verificarTipoUsuario);
});

async function verificarSessaoExistente() {
  try {
    const response = await request("/auth/verify", {
      method: "POST",
      body: JSON.stringify({ sessionId: getSessionId() }),
    });

    if (response.success) {
      redirecionarPorTipo(response.usuario.tipo);
    }
  } catch (error) {
    clearSession();
  }
}

async function verificarTipoUsuario() {
  const cpf = limparCPF(document.getElementById("cpf").value);

  if (!cpf || cpf.length !== 11) {
    return;
  }

  document.getElementById("senhaGroup").style.display = "none";
  document.getElementById("senha").required = false;
}

async function handleLogin(e) {
  e.preventDefault();

  const cpf = limparCPF(document.getElementById("cpf").value);
  const senha = document.getElementById("senha").value;

  if (!cpf) {
    mostrarMensagem("mensagem", "Por favor, preencha o CPF", "error");
    return;
  }

  try {
    const response = await request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ cpf, senha }),
    });

    if (response.success) {
      setSessionId(response.sessionId);
      setUsuario(response.usuario);

      // Salvar eventos de presença para mostrar depois
      if (
        response.eventosComPresenca &&
        response.eventosComPresenca.length > 0
      ) {
        localStorage.setItem(
          "eventosPresenca",
          JSON.stringify(response.eventosComPresenca)
        );
      }

      // Mostrar mensagem de presença confirmada
      if (
        response.eventosComPresenca &&
        response.eventosComPresenca.length > 0
      ) {
        const eventosNovos = response.eventosComPresenca.filter(
          (e) => e.automatica
        );
        const eventosJaConfirmados = response.eventosComPresenca.filter(
          (e) => !e.automatica
        );

        let mensagemFinal = "Login realizado com sucesso!\n\n";

        if (eventosNovos.length > 0) {
          mensagemFinal += `✅ Presença confirmada automaticamente em ${eventosNovos.length} evento(s):\n`;
          mensagemFinal += eventosNovos.map((e) => `• ${e.titulo}`).join("\n");
        }

        if (eventosJaConfirmados.length > 0) {
          if (eventosNovos.length > 0) mensagemFinal += "\n\n";
          mensagemFinal += `ℹ️ Presença já confirmada anteriormente:\n`;
          mensagemFinal += eventosJaConfirmados
            .map((e) => `• ${e.titulo}\n  ${e.mensagem}`)
            .join("\n");
        }

        setTimeout(async () => {
          await alertCustom(mensagemFinal, "Bem-vindo ao Sistema", "success");
          redirecionarPorTipo(response.usuario.tipo);
        }, 500);
      } else {
        mostrarMensagem("mensagem", "Login realizado com sucesso!", "success");
        setTimeout(() => {
          redirecionarPorTipo(response.usuario.tipo);
        }, 1000);
      }
    }
  } catch (error) {
    if (error.message.includes("Senha") || error.message.includes("senha")) {
      document.getElementById("senhaGroup").style.display = "block";
      document.getElementById("senha").required = true;
    }
    mostrarMensagem("mensagem", error.message, "error");
  }
}

function redirecionarPorTipo(tipo) {
  if (tipo === "ADMIN") {
    window.location.href = "/admin.html";
  } else {
    window.location.href = "/eventos.html";
  }
}
