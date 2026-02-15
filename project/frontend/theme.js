const THEME_KEY = "conspirabert_theme";

function detectInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function initThemeToggle(button) {
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    button.textContent = theme === "dark" ? "Light" : "Dark";
    localStorage.setItem(THEME_KEY, theme);
  };

  apply(detectInitialTheme());

  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    apply(next);
  });
}
