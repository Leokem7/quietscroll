(() => {
  "use strict";

  const STORAGE_KEY = "enabled";
  const ATTR_NAME = "data-quietscroll-enabled";
  const api = typeof browser !== "undefined" ? browser : chrome;

  function applyState(enabled) {
    const value = enabled ? "true" : "false";
    if (document.documentElement) {
      document.documentElement.setAttribute(ATTR_NAME, value);
    } else {
      document.addEventListener(
        "readystatechange",
        () => document.documentElement?.setAttribute(ATTR_NAME, value),
        { once: true }
      );
    }
  }

  // Default to enabled immediately so document_start hooks protect the first videos.
  applyState(true);

  if (!api?.storage?.local) return;

  api.storage.local
    .get({ [STORAGE_KEY]: true })
    .then((result) => {
      applyState(result[STORAGE_KEY] !== false);
    })
    .catch(() => {
      applyState(true);
    });

  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) {
      applyState(changes[STORAGE_KEY].newValue !== false);
    }
  });
})();
