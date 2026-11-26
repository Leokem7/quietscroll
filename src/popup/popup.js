(() => {
  "use strict";

  const STORAGE_KEY = "enabled";
  const api = typeof browser !== "undefined" ? browser : chrome;
  const toggle = document.getElementById("enabled-toggle");
  const statusText = document.getElementById("status-text");

  function render(enabled) {
    toggle.checked = enabled;
    statusText.textContent = enabled ? "Active on x.com" : "Paused";
  }

  if (!api?.storage?.local) return;

  api.storage.local
    .get({ [STORAGE_KEY]: true })
    .then((result) => {
      render(result[STORAGE_KEY] !== false);
    })
    .catch(() => {
      render(true);
    });

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    render(enabled);
    api.storage.local.set({ [STORAGE_KEY]: enabled }).catch(() => {});
  });
})();
