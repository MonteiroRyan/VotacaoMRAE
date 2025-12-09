class SearchBar {
  constructor(inputId, resultsId, onSelect) {
    this.input = document.getElementById(inputId);
    this.results = document.getElementById(resultsId);
    this.onSelect = onSelect;
    this.data = [];

    this.init();
  }

  init() {
    this.input.addEventListener("input", (e) =>
      this.handleSearch(e.target.value)
    );
    this.input.addEventListener("focus", () => {
      if (this.input.value.length > 0) {
        this.results.classList.add("show");
      }
    });

    // Fechar ao clicar fora
    document.addEventListener("click", (e) => {
      if (!this.input.contains(e.target) && !this.results.contains(e.target)) {
        this.results.classList.remove("show");
      }
    });
  }

  setData(data) {
    this.data = data;
  }

  handleSearch(query) {
    const searchClear = document.querySelector(".search-clear");

    if (query.length > 0) {
      searchClear?.classList.add("show");
      const filtered = this.filterData(query);
      this.renderResults(filtered);
      this.results.classList.add("show");
    } else {
      searchClear?.classList.remove("show");
      this.results.classList.remove("show");
    }
  }

  filterData(query) {
    const lowerQuery = query.toLowerCase();
    return this.data.filter(
      (item) =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.subtitle?.toLowerCase().includes(lowerQuery)
    );
  }

  renderResults(items) {
    if (items.length === 0) {
      this.results.innerHTML = `
       <div class="search-no-results">
         <i class="fas fa-search" style="font-size: 2rem; color: var(--gray-300); margin-bottom: var(--space-3);"></i>
         <p>Nenhum resultado encontrado</p>
       </div>
     `;
      return;
    }

    this.results.innerHTML = items
      .map(
        (item) => `
     <div class="search-result-item" onclick="searchBar.selectItem(${item.id})">
       <div class="search-result-icon">
         <i class="${item.icon || "fas fa-file"}"></i>
       </div>
       <div class="search-result-content">
         <div class="search-result-title">${this.highlightMatch(
           item.title,
           this.input.value
         )}</div>
         ${
           item.subtitle
             ? `<div class="search-result-subtitle">${item.subtitle}</div>`
             : ""
         }
       </div>
     </div>
   `
      )
      .join("");
  }

  highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, "gi");
    return text.replace(
      regex,
      '<mark style="background: var(--warning-light); padding: 2px 4px; border-radius: 4px;">$1</mark>'
    );
  }

  selectItem(id) {
    const item = this.data.find((i) => i.id === id);
    if (item && this.onSelect) {
      this.onSelect(item);
    }
    this.results.classList.remove("show");
    this.input.value = "";
  }

  clear() {
    this.input.value = "";
    this.results.classList.remove("show");
    document.querySelector(".search-clear")?.classList.remove("show");
  }
}

// Exemplo de uso
/*
const searchBar = new SearchBar('searchInput', 'searchResults', (item) => {
 console.log('Selecionado:', item);
 verDetalhesEvento(item. id);
});

// Definir dados
searchBar.setData([
 { id: 1, title: 'Evento 1', subtitle: 'Votação Sim/Não', icon: 'fas fa-calendar' },
 { id: 2, title: 'Evento 2', subtitle: 'Votação por Aprovação', icon: 'fas fa-calendar-check' }
]);
*/
