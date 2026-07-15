(function () {
  if (window.__saveEditorDedupPatch) return;
  window.__saveEditorDedupPatch = true;
  let savingEditor = false;
  async function guardedSave(event) {
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (savingEditor) return;
    savingEditor = true;
    const button = document.getElementById('saveEditor');
    if (button) button.disabled = true;
    try {
      if (typeof window.saveEditor === 'function') await window.saveEditor(event);
    } finally {
      setTimeout(() => {
        savingEditor = false;
        if (button) button.disabled = false;
      }, 800);
    }
  }
  document.addEventListener('click', (event) => {
    if (event.target.closest('#saveEditor')) guardedSave(event);
  }, true);
  document.addEventListener('submit', (event) => {
    if (event.target && event.target.id === 'editorForm') guardedSave(event);
  }, true);
})();
