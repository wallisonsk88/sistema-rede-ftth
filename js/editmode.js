/**
 * editmode.js — Modo edição (cadeado)
 *
 * O projeto abre sempre em "Visualização": dá para navegar, clicar, ver painéis,
 * rack, fusões, fotos e usar a régua, mas nada é alterado. Para mexer, clique em
 * "🔒 Visualização" no topo e ele passa para "✏️ Editando".
 *
 * Proteção em três camadas:
 *  1. As ferramentas e ações que alteram o projeto avisam e não fazem nada;
 *  2. Campos do painel ficam travados e os marcadores do mapa não arrastam;
 *  3. Se mesmo assim algo mudar, o salvamento percebe e desfaz na hora (storage.js).
 */

STATE.locked = true;

// Ações que alteram o projeto (bloqueadas na visualização)
const EDIT_ACTIONS = [
  'undoLastAction', 'importProject', 'deleteElement', 'removeCable', 'removeSplice', 'cableUpdate',
  'setFiberMapping', 'connectRamalToFiber', 'disconnectRamal', 'toggleCableOltLink', 'resumeCableDraw',
  'toggleGeomanEditCable', 'openCableContextMenu', 'startCableFromSplice',
  'addCableReserve', 'addCableBreak', 'updateCableMark', 'removeCableMark',
  'popUpdate', 'addPonRota', 'removePonRota', 'updatePonRota', 'addOltEquipment', 'removeOltEquipment',
  'updateOltEquipment', 'addRamal', 'removeRamal', 'updateRamal', 'generateRamalCTOs', 'updateCTORatio',
  'updateCTOAttSplitter', 'preparePlaceCTO', 'updateCTOField',
  'dropFiber', 'removeFusion', 'installSplitterInSplice', 'setSpliceInputCable', 'dropFiberToSplitter',
  'removeSplitterInput', 'updateSplitterInput', 'setFusion', 'updateSpliceField',
  'rackAddEquipment', 'rackUpdateEquipment', 'rackRemoveEquipment', 'rackSetPortName', 'rackLinkPort',
  'rackSetLinkProp', 'rackMove', 'rackAddOlt', 'rackConfigurePon', 'rackConnectRamalAt', 'rackDropOnDio',
  'rackTerminate', 'rackAutoTerminate', 'rackAddDio', 'rackUpdateDio', 'rackClearDio', 'rackRemoveDio',
  'handlePhotoUpload', 'removePhotoAndClose',
];
// Ferramentas que podem ser usadas na visualização
const VIEW_TOOLS = ['select', 'ruler'];

let lastLockToast = 0;
function lockedToast() {
  if (Date.now() - lastLockToast < 1500) return;
  lastLockToast = Date.now();
  toast('🔒 Edição desligada. Clique em "🔒 Visualização" no topo para poder alterar.');
}

// Envolve as ações: na visualização elas só avisam
EDIT_ACTIONS.forEach(name => {
  const original = window[name];
  if (typeof original !== 'function') return;
  window[name] = function (...args) {
    if (STATE.locked) {
      const ev = args.find(a => a && typeof a.preventDefault === 'function');
      if (ev) ev.preventDefault();
      lockedToast();
      return;
    }
    return original.apply(this, args);
  };
});

const originalSetTool = window.setTool;
window.setTool = function (t) {
  if (STATE.locked && !VIEW_TOOLS.includes(t)) { lockedToast(); return; }
  return originalSetTool(t);
};

// "Limpar" pelo botão do topo (o clearAll(true) interno continua funcionando)
const originalClearAll = window.clearAll;
window.clearAll = function (silent = false) {
  if (!silent) {
    if (STATE.locked) { lockedToast(); return; }
    if (!confirm('Apagar TODO o projeto? Isso remove todos os POPs, cabos, CEOs e CTOs.')) return;
  }
  return originalClearAll(silent);
};

/** Marcadores do mapa só arrastam no modo edição */
function applyLockToLayer(layer) {
  if (layer && layer.dragging && layer.options && layer.options.draggable) {
    if (STATE.locked) layer.dragging.disable(); else layer.dragging.enable();
  }
}
map.on('layeradd', e => applyLockToLayer(e.layer));

/** Trava os campos e ações do painel na visualização */
function lockPanelControls() {
  if (!STATE.locked) return;
  const body = document.getElementById('panelBody');
  if (!body) return;
  body.querySelectorAll('input, select, textarea').forEach(el => {
    if (!el.disabled && !el.classList.contains('allow-locked')) el.disabled = true;
  });
  body.querySelectorAll('label').forEach(l => {
    const input = l.control || l.querySelector('input');
    if (input && input.disabled) l.classList.add('locked-action');
  });
  body.querySelectorAll('[draggable="true"]').forEach(el => el.setAttribute('draggable', 'false'));
  body.querySelectorAll('[onclick], [ondrop]').forEach(el => {
    const code = (el.getAttribute('onclick') || '') + (el.getAttribute('ondrop') || '');
    if (EDIT_ACTIONS.some(n => code.includes(n + '('))) el.classList.add('locked-action');
  });
}
new MutationObserver(lockPanelControls).observe(document.getElementById('panelBody'), { childList: true, subtree: true });

/** Liga/desliga o modo edição */
function setEditMode(on) {
  if (!on && !STATE.locked) {
    // Antes de travar, conclui o que estava sendo feito
    if (typeof isGeomanEditingCableId !== 'undefined' && isGeomanEditingCableId) toggleGeomanEditCable(isGeomanEditingCableId);
    if (typeof currentCableSourceId !== 'undefined' && currentCableSourceId) finishCable();
    if (!VIEW_TOOLS.includes(STATE.tool)) originalSetTool('select');
  }
  STATE.locked = !on;
  document.body.classList.toggle('locked', STATE.locked);
  const btn = document.getElementById('editModeBtn');
  if (btn) {
    btn.classList.toggle('editing', !STATE.locked);
    btn.innerHTML = STATE.locked
      ? '🔒 <span class="tb-text">Visualização</span>'
      : '✏️ <span class="tb-text">Editando</span>';
    btn.title = STATE.locked ? 'Somente visualização. Clique para liberar a edição.' : 'Edição liberada. Clique para travar.';
  }
  const sb = document.getElementById('sb-mode');
  if (sb) sb.innerHTML = STATE.locked ? '🔒 Somente visualização' : '<b style="color:#4ade80;">✏️ Modo edição</b>';
  const name = document.getElementById('projectName');
  if (name) name.readOnly = STATE.locked;
  map.eachLayer(applyLockToLayer);
  if (typeof renderPanel === 'function') renderPanel();
  lockPanelControls();
}

function toggleEditMode() {
  setEditMode(STATE.locked);
  toast(STATE.locked ? '🔒 Edição travada' : '✏️ Edição liberada. Lembre de travar quando terminar.');
}

/**
 * Chamado pelo saveLocal quando algo mudou com a edição travada:
 * volta o projeto para o último estado salvo, sem mexer na visão do mapa.
 */
function revertLockedState(baseJson) {
  const sel = STATE.selectedId;
  const center = map.getCenter(), zoom = map.getZoom();
  window.lockReverting = true;
  try {
    originalClearAll(true);
    applyDataToState(JSON.parse(baseJson), { keepView: true });
    if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
    if (typeof renderAllSplices === 'function') renderAllSplices();
    map.setView(center, zoom, { animate: false });
    STATE.selectedId = sel;
    renderPanel();
  } finally {
    window.lockReverting = false;
  }
  lockedToast();
}

setEditMode(false);
