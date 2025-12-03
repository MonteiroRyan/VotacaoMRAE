class ModalConfirm {
  constructor() {
    this.modal = null;
    this.createModal();
  }

  createModal() {
    const modal = document.createElement("div");
    modal.className = "modal-confirm";
    modal.innerHTML = `
         <div class="modal-confirm-overlay"></div>
         <div class="modal-confirm-content">
             <div class="modal-confirm-icon"></div>
             <h3 class="modal-confirm-title"></h3>
             <p class="modal-confirm-message"></p>
             <div class="modal-confirm-actions">
                 <button class="btn btn-secondary" data-action="cancel">
                     <i class="fas fa-times"></i> Cancelar
                 </button>
                 <button class="btn btn-primary" data-action="confirm">
                     <i class="fas fa-check"></i> Confirmar
                 </button>
             </div>
         </div>
     `;
    document.body.appendChild(modal);
    this.modal = modal;
  }

  show(options) {
    return new Promise((resolve) => {
      const {
        title = "Confirmação",
        message = "Tem certeza? ",
        type = "warning",
        confirmText = "Confirmar",
        cancelText = "Cancelar",
        icon = null,
      } = options;

      // Configurar conteúdo
      const titleEl = this.modal.querySelector(".modal-confirm-title");
      const messageEl = this.modal.querySelector(".modal-confirm-message");
      const iconEl = this.modal.querySelector(". modal-confirm-icon");
      const confirmBtn = this.modal.querySelector('[data-action="confirm"]');
      const cancelBtn = this.modal.querySelector('[data-action="cancel"]');

      titleEl.textContent = title;
      messageEl.textContent = message;

      // Ícone baseado no tipo
      const icons = {
        success:
          '<i class="fas fa-check-circle fa-3x" style="color: var(--success-500);"></i>',
        error:
          '<i class="fas fa-exclamation-circle fa-3x" style="color: var(--error-500);"></i>',
        warning:
          '<i class="fas fa-exclamation-triangle fa-3x" style="color: var(--warning-500);"></i>',
        info: '<i class="fas fa-info-circle fa-3x" style="color: var(--info-500);"></i>',
        question:
          '<i class="fas fa-question-circle fa-3x" style="color: var(--primary-500);"></i>',
      };

      iconEl.innerHTML = icon || icons[type];

      // Textos dos botões
      confirmBtn.innerHTML = `<i class="fas fa-check"></i> ${confirmText}`;
      cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${cancelText}`;

      // Classe do botão de confirmar baseado no tipo
      confirmBtn.className = "btn";
      if (type === "error" || type === "warning") {
        confirmBtn.classList.add("btn-danger");
      } else if (type === "success") {
        confirmBtn.classList.add("btn-success");
      } else {
        confirmBtn.classList.add("btn-primary");
      }

      // Mostrar modal
      this.modal.classList.add("show");

      // Event listeners
      const handleConfirm = () => {
        this.hide();
        resolve(true);
        cleanup();
      };

      const handleCancel = () => {
        this.hide();
        resolve(false);
        cleanup();
      };

      const handleEscape = (e) => {
        if (e.key === "Escape") {
          handleCancel();
        }
      };

      const cleanup = () => {
        confirmBtn.removeEventListener("click", handleConfirm);
        cancelBtn.removeEventListener("click", handleCancel);
        document.removeEventListener("keydown", handleEscape);
      };

      confirmBtn.addEventListener("click", handleConfirm);
      cancelBtn.addEventListener("click", handleCancel);
      document.addEventListener("keydown", handleEscape);

      // Auto-focus no botão de confirmação
      setTimeout(() => confirmBtn.focus(), 100);
    });
  }

  hide() {
    this.modal.classList.remove("show");
  }

  async alert(message, title = "Aviso", type = "info") {
    return this.show({
      title,
      message,
      type,
      confirmText: "OK",
      cancelText: "",
    });
  }

  async confirm(message, title = "Confirmação", type = "warning") {
    return this.show({
      title,
      message,
      type,
    });
  }
}

// Instância global
const modalConfirm = new ModalConfirm();

// Helpers globais
async function confirmCustom(message, title, type) {
  return modalConfirm.confirm(message, title, type);
}

async function alertCustom(message, title, type) {
  return modalConfirm.alert(message, title, type);
}
