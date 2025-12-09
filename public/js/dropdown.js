// Inicializar dropdowns
document.addEventListener("DOMContentLoaded", () => {
  const dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach((dropdown) => {
    const toggle = dropdown.querySelector(".dropdown-toggle");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();

      // Fechar outros dropdowns
      dropdowns.forEach((d) => {
        if (d !== dropdown) {
          d.classList.remove("open");
        }
      });

      dropdown.classList.toggle("open");
    });
  });

  // Fechar ao clicar fora
  document.addEventListener("click", () => {
    dropdowns.forEach((dropdown) => {
      dropdown.classList.remove("open");
    });
  });
});
