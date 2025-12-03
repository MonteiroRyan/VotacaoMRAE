class DarkMode {
  constructor() {
    this.darkMode = localStorage.getItem("darkMode") === "true";
    this.init();
  }

  init() {
    if (this.darkMode) {
      document.documentElement.classList.add("dark-mode");
    }
    this.createToggle();
  }

  createToggle() {
    const toggle = document.createElement("button");
    toggle.className = "dark-mode-toggle";
    toggle.innerHTML = `
         <i class="fas ${this.darkMode ? "fa-sun" : "fa-moon"}"></i>
     `;
    toggle.onclick = () => this.toggle();

    const navbar = document.querySelector(".navbar . nav-right");
    if (navbar) {
      navbar.insertBefore(toggle, navbar.firstChild);
    }
  }

  toggle() {
    this.darkMode = !this.darkMode;
    document.documentElement.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", this.darkMode);

    const icon = document.querySelector(".dark-mode-toggle i");
    icon.className = `fas ${this.darkMode ? "fa-sun" : "fa-moon"}`;

    toast.info(`Modo ${this.darkMode ? "escuro" : "claro"} ativado`);
  }
}

// Inicializar ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  new DarkMode();
});
