/**
 * cable.js — Lógica de criação e manipulação de cabos no mapa
 */

let currentCableSourceType = null; // 'pop' ou 'splice'
let currentCableSourceId = null;
let currentCablePoints = [];
let currentCablePolyline = null;
let currentCableCursorLine = null; // Linha temp que segue o mouse

// Cores padrão de tubos/fibras (1 a 12)
const FIBER_COLORS = [
  { hex: '#10b981', name: 'Verde' },
  { hex: '#facc15', name: 'Amarelo' },
  { hex: '#e2e8f0', name: 'Branco' },
  { hex: '#3b82f6', name: 'Azul' },
  { hex: '#ef4444', name: 'Vermelho' },
  { hex: '#8b5cf6', name: 'Violeta' },
  { hex: '#a16207', name: 'Marrom' },
  { hex: '#ec4899', name: 'Rosa' },
  { hex: '#000000', name: 'Preto' },
  { hex: '#475569', name: 'Cinza' },
  { hex: '#f97316', name: 'Laranja' },
  { hex: '#06b6d4', name: 'Aqua' }
];

/** Inicia o desenho do cabo a partir de um POP (legado) */
function startCable(popId, lat, lng) {
  startCableExt('pop', popId, lat, lng);
}

/** Inicia o desenho do cabo a partir de qualquer origem */
function startCableExt(sourceType, sourceId, lat, lng) {
  if (currentCablePolyline) clearCableDraw();
  
  currentCableSourceType = sourceType;
  currentCableSourceId = sourceId;
  currentCablePoints = [[lat, lng]];
  
  currentCablePolyline = L.polyline(currentCablePoints, {
    color: '#38bdf8', // Azul claro chamativo para o desenho
    weight: 4,
    opacity: 0.9,
    interactive: false
  }).addTo(map);

  currentCableCursorLine = L.polyline([], {
    color: '#38bdf8',
    weight: 4,
    dashArray: '5, 10',
    opacity: 0.6,
    interactive: false
  }).addTo(map);

  map.on('mousemove', onCableMouseMove);
  toast('🔌 Cabo iniciado. Clique no mapa para traçar.');
}

function onCableMouseMove(e) {
  if (currentCablePoints.length > 0 && currentCableCursorLine) {
    const lastPoint = currentCablePoints[currentCablePoints.length - 1];
    currentCableCursorLine.setLatLngs([lastPoint, [e.latlng.lat, e.latlng.lng]]);
  }
}

/** Adiciona um ponto ao cabo atual */
function cableAddPoint(lat, lng) {
  if (!currentCableSourceId) return toast('⚠️ Clique numa Origem (POP/CEO) para iniciar o cabo!');
  
  currentCablePoints.push([lat, lng]);
  currentCablePolyline.setLatLngs(currentCablePoints);
}

/** Finaliza o traçado do cabo e salva */
function finishCable() {
  if (!currentCableSourceId || currentCablePoints.length < 2) {
    clearCableDraw();
    return;
  }
  
  const id = 'cable_' + Date.now();
  const obj = {
    id,
    name: 'Cabo ' + (STATE.cables.length + 1),
    sourceType: currentCableSourceType,
    sourceId: currentCableSourceId,
    path: [...currentCablePoints],
    fibers: 12,          // Capacidade padrão
    fiberMapping: {}     // { "1": "ramalId" }
  };
  
  STATE.cables.push(obj);
  clearCableDraw();
  
  // Renderiza no mapa
  renderCableOnMap(obj);
  
  saveLocal();
  setTool('select');
  selectElement(id);
  toast('✅ Cabo criado com sucesso!');
}

/** Limpa o estado temporário de desenho */
function clearCableDraw() {
  currentCableSourceType = null;
  currentCableSourceId = null;
  currentCablePoints = [];
  if (currentCablePolyline) { map.removeLayer(currentCablePolyline); currentCablePolyline = null; }
  if (currentCableCursorLine) { map.removeLayer(currentCableCursorLine); currentCableCursorLine = null; }
  map.off('mousemove', onCableMouseMove);
}

/** Calcula a distancia de um ponto projetado ao longo de um cabo */
function getDistanceAlongCable(latlng, cablePath) {
  if (!cablePath || cablePath.length < 2) return 0;
  
  const pt = map.latLngToLayerPoint(latlng);
  let minDistanceSq = Infinity;
  let closestLayerPt = null;
  let closestSegmentIndex = 0;

  for (let i = 0; i < cablePath.length - 1; i++) {
    const p1 = map.latLngToLayerPoint(cablePath[i]);
    const p2 = map.latLngToLayerPoint(cablePath[i + 1]);
    
    // Funcoes do cto.js
    const projPt = getClosestPointOnSegment(pt, p1, p2);
    const sqDist = dist2(pt, projPt);
    
    if (sqDist < minDistanceSq) {
      minDistanceSq = sqDist;
      closestLayerPt = projPt;
      closestSegmentIndex = i;
    }
  }

  if (!closestLayerPt) return 0;

  let distToPt = 0;
  for (let i = 0; i < closestSegmentIndex; i++) {
    distToPt += map.distance(cablePath[i], cablePath[i+1]);
  }
  const snapLatLng = map.layerPointToLatLng(closestLayerPt);
  distToPt += map.distance(cablePath[closestSegmentIndex], snapLatLng);

  return distToPt;
}

/** Renderiza um cabo já salvo no estado */
function renderCableOnMap(cableObj) {
  const pl = L.polyline(cableObj.path, {
    color: '#cbd5e1', // Cinza claro para contrastar com o fundo escuro
    weight: 4,
    opacity: 0.9
  }).addTo(map);
  
  pl.on('click', ev => {
    L.DomEvent.stopPropagation(ev);
    if (STATE.tool === 'eraser') {
      removeCable(cableObj.id);
    } else {
      handleElementClick(cableObj.id, ev.latlng);
    }
  });
  
  cableObj.layer = pl;
}

/** Remove um cabo do sistema */
function removeCable(id) {
  const cIndex = STATE.cables.findIndex(c => c.id === id);
  if (cIndex === -1) return;
  const cable = STATE.cables[cIndex];
  
  if (cable.layer) map.removeLayer(cable.layer);
  STATE.cables.splice(cIndex, 1);
  
  if (STATE.selectedId === id) STATE.selectedId = null;
  
  saveLocal();
  renderPanel();
  toast('🗑️ Cabo removido');
}

/** Atualiza propriedade básica do cabo */
function cableUpdate(id, key, val) {
  const cable = STATE.cables.find(c => c.id === id);
  if (cable) {
    cable[key] = val;
    saveLocal();
    renderPanel();
  }
}

/** Aloca um ramal a uma fibra no cabo */
function setFiberMapping(cableId, fiberNumber, ramalId) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (cable) {
    if (ramalId) {
      cable.fiberMapping[fiberNumber] = ramalId;
    } else {
      delete cable.fiberMapping[fiberNumber];
    }
    
    // Propaga a mudança para cabos filhos conectados nas CEOs
    cascadeFiberMapping(cableId, fiberNumber, ramalId);
    
    saveLocal();
    renderPanel();
  }
}

/** Propaga a rota/ramal pela árvore de cabos usando as fusões nas CEOs (Recursivo) */
function cascadeFiberMapping(cableId, fiberNumber, ramalId) {
  const splicesOnCable = STATE.splices.filter(s => s.cableId === cableId);
  
  splicesOnCable.forEach(splice => {
    if (splice.fusions) {
      Object.keys(splice.fusions).forEach(childCableId => {
        const childCable = STATE.cables.find(c => c.id === childCableId);
        if (childCable) {
          Object.keys(splice.fusions[childCableId]).forEach(childFiberStr => {
            const parentFiberNum = splice.fusions[childCableId][childFiberStr];
            if (parentFiberNum == fiberNumber) {
              const childFiberNum = parseInt(childFiberStr);
              
              if (ramalId) {
                childCable.fiberMapping[childFiberNum] = ramalId;
              } else {
                delete childCable.fiberMapping[childFiberNum];
              }
              
              // Continua propagando (cascata)
              cascadeFiberMapping(childCableId, childFiberNum, ramalId);
            }
          });
        }
      });
    }
  });
}

/** Destaque (Highlight) no ramal selecionado pelo cabo */
function highlightRamal(popId, ramalId) {
  // Reset de todos os cabos
  STATE.cables.forEach(c => {
    if (c.layer) {
      // Se este cabo mapeia esse ramal em alguma fibra, pinta o cabo de azul/colorido, senão apaga um pouco
      let hasRamal = false;
      const mapping = c.fiberMapping || {};
      Object.values(mapping).forEach(rId => {
        if (rId === ramalId) hasRamal = true;
      });
      
      if (hasRamal) {
        c.layer.setStyle({ color: '#f97316', weight: 6, opacity: 1, dashArray: '12, 12', className: 'cable-flow' });
        c.layer.bringToFront();
      } else {
        c.layer.setStyle({ color: '#475569', weight: 4, opacity: 0.2, dashArray: null, className: '' });
      }
    }
  });
}

function clearHighlight() {
  STATE.cables.forEach(c => {
    if (c.layer) {
      c.layer.setStyle({ color: '#cbd5e1', weight: 4, opacity: 0.9, dashArray: null, className: '' });
    }
  });
}
