/**
 * ruler.js — Ferramenta de medição (régua)
 */

/** Adiciona um ponto à régua */
function rulerAddPoint(lat, lng) {
  STATE.rulerPoints.push([lat, lng]);

  const m = L.circleMarker([lat, lng], {
    radius: 5,
    color: '#f59e0b',
    fillColor: '#f59e0b',
    fillOpacity: 1,
  }).addTo(map);
  STATE.rulerMarkers.push(m);

  if (STATE.rulerPoints.length > 1) {
    const l = L.polyline(STATE.rulerPoints, {
      color: '#f59e0b',
      weight: 1.5,
      dashArray: '6,4',
    }).addTo(map);
    STATE.rulerLines.push(l);
    toast('📏 Total: ' + formatDist(calcPolylineLength(STATE.rulerPoints)));
  }
}

/** Finaliza a medição da régua */
function finishRuler() {
  if (STATE.rulerPoints.length >= 2) {
    toast('📏 Distância: ' + formatDist(calcPolylineLength(STATE.rulerPoints)));
  }
  clearRuler();
  setTool('select');
}

/** Limpa todos os elementos da régua do mapa */
function clearRuler() {
  STATE.rulerMarkers.forEach(m => map.removeLayer(m));
  STATE.rulerLines.forEach(l => map.removeLayer(l));
  STATE.rulerPoints  = [];
  STATE.rulerMarkers = [];
  STATE.rulerLines   = [];
}
