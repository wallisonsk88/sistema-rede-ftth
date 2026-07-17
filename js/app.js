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
  } else if (STATE.tool === 'ruler') {
    rulerAddPoint(lat, lng);
  } else if (STATE.tool === 'cable') {
    if (typeof cableAddPoint === 'function') cableAddPoint(lat, lng);
  } else if (STATE.tool === 'cto_place') {
    if (typeof placeCTO === 'function') placeCTO(lat, lng);
  } else if (STATE.tool === 'splice') {
    if (typeof placeSplice === 'function') placeSplice(lat, lng);
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

async function init() {
  await loadFromCloud();
  updateStatusBar();
  renderPanel();
  if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
  if (typeof renderAllSplices === 'function') renderAllSplices();
}

window.onload = init;
