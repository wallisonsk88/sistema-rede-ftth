/**
 * cable_marks.js — Reserva técnica e emenda de rompimento ao longo do cabo
 * (menu do botão direito no cabo). Ficam no próprio cabo: cable.reserves e cable.breaks.
 */

let cableMarksLayer = L.layerGroup().addTo(map);

// Causas mais comuns de rompimento de cabo na rede aérea
const BREAK_CAUSES = [
  'Veículo / caminhão',
  'Poda ou queda de árvore',
  'Queimada / incêndio',
  'Roedor / animal',
  'Vandalismo / furto',
  'Obra / troca de poste',
  'Temporal / vento',
  'Desgaste / outro',
];

function escMark(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/** Metros de reserva técnica do cabo */
function cableReserveMeters(cable) {
  return (cable.reserves || []).reduce((n, r) => n + (parseFloat(r.meters) || 0), 0);
}

/** Comprimento do cabo: traçado no mapa + reservas técnicas */
function cableTotalLength(cable) {
  return calcPolylineLength(cable.path || []) + cableReserveMeters(cable);
}

/** Acha uma reserva ou emenda de rompimento pelo id */
function findCableMark(id) {
  for (const cable of STATE.cables) {
    const reserve = (cable.reserves || []).find(m => m.id === id);
    if (reserve) return { cable, mark: reserve, kind: 'reserve' };
    const brk = (cable.breaks || []).find(m => m.id === id);
    if (brk) return { cable, mark: brk, kind: 'break' };
  }
  return null;
}

/** Ponto do cabo mais perto do clique */
function snapMarkToCable(cable, lat, lng) {
  const snap = findClosestOnPath([lat, lng], cable.path || []);
  return snap ? [snap.latlng.lat, snap.latlng.lng] : [lat, lng];
}

/** Menu do botão direito no cabo */
function openCableContextMenu(cableId, latlng) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;
  const { lat, lng } = latlng;
  const html = `
    <div class="cable-menu">
      <div class="cable-menu-title">${escMark(cable.name)}</div>
      <button onclick="map.closePopup(); addCableReserve('${cable.id}', ${lat}, ${lng})">🌀 Reserva técnica aqui</button>
      <button onclick="map.closePopup(); addCableBreak('${cable.id}', ${lat}, ${lng})">⚡ Emenda de rompimento aqui</button>
      <button onclick="map.closePopup(); toggleGeomanEditCable('${cable.id}')">✏️ Ajuste fino do cabo</button>
    </div>`;
  L.popup({ closeButton: false, className: 'cable-menu-popup', offset: [0, -4] })
    .setLatLng(latlng).setContent(html).openOn(map);
}

/** Lança uma reserva técnica no ponto do cabo */
function addCableReserve(cableId, lat, lng) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;
  const [la, ln] = snapMarkToCable(cable, lat, lng);
  if (!cable.reserves) cable.reserves = [];
  const mark = { id: 'rsv_' + Date.now(), lat: la, lng: ln, meters: 0, obs: '' };
  cable.reserves.push(mark);
  saveLocal();
  renderAllCableMarks();
  selectElement(mark.id);
  focusMarkInput('reserve-meters');
  toast('🌀 Reserva técnica lançada. Informe a metragem no painel.');
}

/** Lança uma emenda de rompimento no ponto do cabo */
function addCableBreak(cableId, lat, lng) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;
  const [la, ln] = snapMarkToCable(cable, lat, lng);
  if (!cable.breaks) cable.breaks = [];
  const mark = { id: 'brk_' + Date.now(), lat: la, lng: ln, date: new Date().toISOString().slice(0, 10), cause: '', description: '' };
  cable.breaks.push(mark);
  saveLocal();
  renderAllCableMarks();
  selectElement(mark.id);
  focusMarkInput('break-description');
  toast('⚡ Emenda de rompimento registrada. Descreva o ocorrido e adicione fotos no painel.');
}

function focusMarkInput(id) {
  setTimeout(() => { const el = document.getElementById(id); if (el) el.focus(); }, 50);
}

/** Altera um campo da reserva ou da emenda */
function updateCableMark(id, field, value) {
  const found = findCableMark(id);
  if (!found) return;
  found.mark[field] = field === 'meters' ? Math.max(0, parseFloat(value) || 0) : value;
  saveLocal();
  renderAllCableMarks();
  renderPanel();
}

/** Apaga a reserva ou a emenda (e as fotos dela) */
async function removeCableMark(id) {
  const found = findCableMark(id);
  if (!found) return;
  const list = found.kind === 'reserve' ? found.cable.reserves : found.cable.breaks;
  list.splice(list.indexOf(found.mark), 1);
  if (STATE.selectedId === id) STATE.selectedId = null;
  saveLocal();
  renderAllCableMarks();
  renderPanel();
  toast(found.kind === 'reserve' ? '🗑️ Reserva técnica removida' : '🗑️ Emenda de rompimento removida');
  if (typeof getPhotos === 'function') {
    try { for (const p of [...await getPhotos(id)]) await deletePhoto(p.id); } catch (e) { console.warn('Fotos da emenda não apagadas:', e); }
  }
}

/** Centraliza o mapa na reserva ou emenda e abre o painel dela */
function goToCableMark(id) {
  const found = findCableMark(id);
  if (!found) return;
  map.setView([found.mark.lat, found.mark.lng], Math.max(map.getZoom(), 18));
  selectElement(id);
}

/** Desenha no mapa as reservas e emendas de todos os cabos */
function renderAllCableMarks() {
  cableMarksLayer.clearLayers();
  STATE.cables.forEach(cable => {
    (cable.reserves || []).forEach(m => addCableMarkMarker(cable, m, 'reserve'));
    (cable.breaks || []).forEach(m => addCableMarkMarker(cable, m, 'break'));
  });
}

function addCableMarkMarker(cable, mark, kind) {
  const selected = STATE.selectedId === mark.id ? ' selected' : '';
  const html = kind === 'reserve'
    ? `<div class="cable-mark reserve${selected}"><span>🌀</span>${mark.meters ? `<b>${Math.round(mark.meters)} m</b>` : ''}</div>`
    : `<div class="cable-mark break${selected}"><span>⚡</span></div>`;
  const icon = L.divIcon({ html, className: 'marker-cable-mark', iconSize: [26, 26], iconAnchor: [13, 13] });
  const m = L.marker([mark.lat, mark.lng], { icon, draggable: true, zIndexOffset: 700 });

  const title = kind === 'reserve'
    ? `<b>🌀 Reserva técnica${mark.meters ? ' · ' + Math.round(mark.meters) + ' m' : ''}</b><br>${escMark(cable.name)}`
    : `<b>⚡ Emenda de rompimento</b>${mark.date ? ' · ' + mark.date.split('-').reverse().join('/') : ''}<br>${escMark(mark.cause || cable.name)}`;
  m.bindTooltip(title, { direction: 'top', offset: [0, -12] });

  // Arrastar mantém a marcação em cima do cabo
  m.on('dragend', ev => {
    const { lat, lng } = ev.target.getLatLng();
    [mark.lat, mark.lng] = snapMarkToCable(cable, lat, lng);
    m.setLatLng([mark.lat, mark.lng]);
    saveLocal();
  });

  m.on('click', ev => {
    L.DomEvent.stopPropagation(ev);
    if (STATE.tool === 'eraser') removeCableMark(mark.id);
    else selectElement(mark.id);
  });
  cableMarksLayer.addLayer(m);
}

/** Painel da reserva técnica ou da emenda de rompimento */
function renderCableMarkProps(found) {
  const { cable, mark, kind } = found;
  const back = `<button class="btn-full" style="margin-top:8px;" onclick="selectElement('${cable.id}')">〰️ Abrir o cabo ${escMark(cable.name)}</button>`;
  const del = `<button class="btn-full" style="margin-top:8px; background:#dc262622; color:#ef4444; border:1px solid #dc262644;" onclick="removeCableMark('${mark.id}')">🗑️ Excluir</button>`;

  if (kind === 'reserve') {
    const traced = calcPolylineLength(cable.path || []);
    const reserves = cableReserveMeters(cable);
    return `
      <div class="panel-section-title" style="margin-bottom:12px;">🌀 Reserva Técnica</div>
      <div style="font-size:10px; opacity:0.8; margin-bottom:10px;">Cabo: ${escMark(cable.name)} · ${cable.fibers} FO</div>
      <div class="prop-group">
        <label>Metragem da reserva (m)</label>
        <input id="reserve-meters" type="number" min="0" step="1" class="input-full" value="${mark.meters || ''}" placeholder="Ex.: 30"
          onchange="updateCableMark('${mark.id}', 'meters', this.value)">
      </div>
      <div class="prop-group">
        <label>Observação</label>
        <textarea class="input-full" rows="3" placeholder="Ex.: reserva no poste 12, em frente ao mercado" onchange="updateCableMark('${mark.id}', 'obs', this.value)">${escMark(mark.obs)}</textarea>
      </div>
      <div class="mark-length">
        <div><span>Traçado no mapa</span><b>${formatDist(traced)}</b></div>
        <div><span>Reservas técnicas (${(cable.reserves || []).length})</span><b>+ ${formatDist(reserves)}</b></div>
        <div class="total"><span>Tamanho total do cabo</span><b>${formatDist(traced + reserves)}</b></div>
      </div>
      ${back}${del}`;
  }

  return `
    <div class="panel-section-title" style="margin-bottom:12px;">⚡ Emenda de Rompimento</div>
    <div style="font-size:10px; opacity:0.8; margin-bottom:10px;">Cabo: ${escMark(cable.name)} · ${cable.fibers} FO</div>
    <div class="prop-group">
      <label>Data do rompimento</label>
      <input type="date" class="input-full" value="${escMark(mark.date)}" onchange="updateCableMark('${mark.id}', 'date', this.value)">
    </div>
    <div class="prop-group">
      <label>Causa</label>
      <select class="input-full" onchange="updateCableMark('${mark.id}', 'cause', this.value)">
        <option value="">-- Escolha --</option>
        ${BREAK_CAUSES.map(c => `<option ${mark.cause === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="prop-group">
      <label>O que aconteceu</label>
      <textarea id="break-description" class="input-full" rows="4" placeholder="Ex.: caminhão arrancou o cabo, feita emenda com caixa nova, 12 fibras fusionadas, cliente X sem sinal por 3h"
        onchange="updateCableMark('${mark.id}', 'description', this.value)">${escMark(mark.description)}</textarea>
    </div>
    ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(mark.id) : ''}
    ${back}${del}`;
}

/** Bloco do painel do cabo: tamanho com reservas e lista de ocorrências */
function renderCableMarksSection(cable) {
  const traced = calcPolylineLength(cable.path || []);
  const reserves = cable.reserves || [];
  const breaks = cable.breaks || [];
  const at = cableClickPoint(cable);
  const row = (m, icon, text) => `
    <div class="mark-row" onclick="goToCableMark('${m.id}')">
      <span>${icon}</span><span style="flex:1;">${text}</span><span style="color:var(--text3);">›</span>
    </div>`;
  return `
    <div class="mark-length" style="margin-bottom:10px;">
      <div><span>Traçado no mapa</span><b>${formatDist(traced)}</b></div>
      <div><span>Reservas técnicas (${reserves.length})</span><b>+ ${formatDist(cableReserveMeters(cable))}</b></div>
      <div class="total"><span>Tamanho total do cabo</span><b>${formatDist(cableTotalLength(cable))}</b></div>
    </div>
    ${reserves.map(m => row(m, '🌀', `Reserva técnica · <b>${m.meters ? Math.round(m.meters) + ' m' : 'sem metragem'}</b>`)).join('')}
    ${breaks.map(m => row(m, '⚡', `Rompimento${m.date ? ' · ' + m.date.split('-').reverse().join('/') : ''}${m.cause ? ' · ' + escMark(m.cause) : ''}`)).join('')}
    ${at ? `
      <div style="display:flex; gap:6px; margin-top:6px;">
        <button class="btn-full" style="flex:1;" onclick="addCableReserve('${cable.id}', ${at.lat}, ${at.lng})">🌀 Reserva aqui</button>
        <button class="btn-full" style="flex:1;" onclick="addCableBreak('${cable.id}', ${at.lat}, ${at.lng})">⚡ Rompimento aqui</button>
      </div>` : ''}
    <div style="font-size:9px; color:var(--text3); margin-top:4px;">Dica: clique com o botão direito em qualquer ponto do cabo para lançar ali.</div>`;
}
