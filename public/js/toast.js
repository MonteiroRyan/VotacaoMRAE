class ToastNotification {
  constructor() {
    this.container = this.createContainer();
  }

  createContainer() {
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  show(message, type = "info", duration = 3000) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle",
    };

    toast.innerHTML = `
     <i class="fas ${icons[type]} fa-lg"></i>
     <div>
       <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
       <p style="margin: 0; font-size: var(--font-size-sm);">${message}</p>
     </div>
     <button onclick="this.parentElement.remove()" style="background: none; border: none; cursor: pointer; color: var(--gray-400); margin-left: auto;">
       <i class="fas fa-times"></i>
     </button>
   `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "slideOutRight 0.3s ease-out";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  success(message, duration) {
    this.show(message, "success", duration);
  }

  error(message, duration) {
    this.show(message, "error", duration);
  }

  warning(message, duration) {
    this.show(message, "warning", duration);
  }

  info(message, duration) {
    this.show(message, "info", duration);
  }
}

const toast = new ToastNotification();

// Adicionar animação de saída
const style = document.createElement("style");
style.textContent = `
 @keyframes slideOutRight {
   from {
     opacity: 1;
     transform: translateX(0);
   }
   to {
     opacity: 0;
     transform: translateX(100%);
   }
 }
`;
document.head.appendChild(style);
