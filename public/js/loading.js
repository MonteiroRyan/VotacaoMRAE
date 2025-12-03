// Loading Overlay
function showLoading(message = "Carregando...") {
  const overlay = document.getElementById("loadingOverlay");
  if (!overlay) {
    const div = document.createElement("div");
    div.id = "loadingOverlay";
    div.className = "loading-overlay show";
    div.innerHTML = `
         <div class="loading-content">
             <div class="spinner-modern"></div>
             <p>${message}</p>
         </div>
     `;
    document.body.appendChild(div);
  } else {
    overlay.querySelector("p").textContent = message;
    overlay.classList.add("show");
  }
}

function hideLoading() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.remove("show");
  }
}

// Progress Indicator
function showProgress() {
  let indicator = document.getElementById("progressIndicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "progressIndicator";
    indicator.className = "progress-indicator";
    indicator.innerHTML = '<div class="progress-bar-animated"></div>';
    document.body.appendChild(indicator);
  }

  indicator.classList.add("show");
  const bar = indicator.querySelector(".progress-bar-animated");

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 30;
    if (progress > 90) progress = 90;
    bar.style.width = progress + "%";
  }, 200);

  return {
    complete: () => {
      clearInterval(interval);
      bar.style.width = "100%";
      setTimeout(() => {
        indicator.classList.remove("show");
        bar.style.width = "0%";
      }, 300);
    },
  };
}

// Button Loading State
function setButtonLoading(button, loading = true) {
  if (loading) {
    button.disabled = true;
    button.classList.add("loading");
    button.dataset.originalText = button.innerHTML;
  } else {
    button.disabled = false;
    button.classList.remove("loading");
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}

// Skeleton Loader
function showSkeleton(containerId, type = "card", count = 3) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const skeletons = {
    card: `
         <div class="skeleton-card">
             <div class="skeleton skeleton-title"></div>
             <div class="skeleton skeleton-text"></div>
             <div class="skeleton skeleton-text"></div>
             <div class="skeleton skeleton-button"></div>
         </div>
     `,
    row: `
         <div class="skeleton skeleton-row"></div>
     `,
    table: `
         <div class="skeleton-table">
             <div class="skeleton skeleton-row"></div>
             <div class="skeleton skeleton-row"></div>
             <div class="skeleton skeleton-row"></div>
         </div>
     `,
  };

  container.innerHTML = skeletons[type].repeat(count);
}

function hideSkeleton(containerId, content) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = content;
}
