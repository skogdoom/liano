// Review-only controls. Artwork acceptance is recorded separately by the owner.
const tabs = [...document.querySelectorAll('[data-tab]')];
const groups = [...document.querySelectorAll('.group')];

function show(id) {
  if (!groups.some(group => group.id === id)) id = 'world';
  for (const group of groups) group.hidden = group.id !== id;
  for (const tab of tabs) tab.setAttribute('aria-pressed', String(tab.dataset.tab === id));
  history.replaceState(null, '', `#${id}`);
}
for (const tab of tabs) {
  tab.onclick = () => {
    show(tab.dataset.tab);
    scrollTo({ top: 0 });
  };
}
show(location.hash.slice(1));

const dialog = document.querySelector('dialog');
const full = dialog.querySelector('img');
const area = dialog.querySelector('.imagearea');
const zoom = dialog.querySelector('select');
function fit() {
  area.classList.toggle('fit', zoom.value === 'fit');
  full.style.width = zoom.value === 'fit' ? 'auto' : `${full.naturalWidth * Number(zoom.value)}px`;
}
full.onload = fit;
for (const button of document.querySelectorAll('button.image')) {
  button.onclick = () => {
    const image = button.querySelector('img');
    full.src = image.src;
    full.alt = image.alt;
    dialog.querySelector('strong').textContent = image.alt;
    zoom.value = 'fit';
    fit();
    dialog.showModal();
  };
}
zoom.onchange = fit;
dialog.querySelector('button').onclick = () => dialog.close();

const fields = [...document.querySelectorAll('textarea')];
for (const field of fields) {
  try {
    field.value = localStorage.getItem(`m8a-review-${field.dataset.notes}`) || '';
  } catch { /* The page remains usable when browser storage is disabled. */ }
  field.oninput = () => {
    try {
      localStorage.setItem(`m8a-review-${field.dataset.notes}`, field.value);
    } catch { /* Notes can still be exported without browser storage. */ }
  };
}
document.querySelector('#export').onclick = () => {
  const notes = {
    build: '3f72b69 + accepted painted owl, hooked beak and registered bat eyes on 62230a2',
    notes: Object.fromEntries(fields.map(field => [field.dataset.notes, field.value])),
  };
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' }));
  link.download = 'm8a-artwork-review-notes.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
