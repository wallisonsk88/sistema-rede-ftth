/**
 * app.js — Inicialização da aplicação e eventos do mapa
 */

// ================================================================
//  EVENTOS DO MAPA
// ================================================================

map.on('click', e => {
  const { lat, lng } = e.latlng;

  if (STATE.tool === 'pop') {
    addPOP(lat, lng);
    return;
  }

  if (STATE.tool === 'ruler') {
    rulerAddPoint(lat, lng);
    return;
  }

  if (STATE.tool === 'cable') {
    if (typeof cableAddPoint === 'function') cableAddPoint(lat, lng);
    return;
  }

  if (STATE.tool === 'cto_place') {
    if (typeof placeCTO === 'function') placeCTO(lat, lng);
    return;
  }
});

map.on('dblclick', e => {
  L.DomEvent.stopPropagation(e);
  if (STATE.tool === 'ruler') {
    finishRuler();
  }
  if (STATE.tool === 'cable') {
    if (typeof finishCable === 'function') finishCable();
  }
});

// ================================================================
//  STATUS BAR
// ================================================================

function updateStatusBar() {
  document.getElementById('sb-pops').textContent = STATE.olts.length;
}

// ================================================================
//  INICIALIZAÇÃO
// ================================================================

function init() {
  loadLocal();
  updateStatusBar();
  renderPanel();
  if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
}

window.onload = init;
