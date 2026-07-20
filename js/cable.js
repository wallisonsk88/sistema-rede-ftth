/**
 * cable.js — Lógica de criação e manipulação de cabos no mapa
 */

let currentCableSourceType = null; // 'pop' ou 'splice'
let currentCableSourceId = null;
let currentCablePoints = [];
let currentCablePolyline = null;
let currentCableCursorLine = null; // Linha temp que segue o mouse
let currentEditingCableId = null; // ID do cabo sendo continuado

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

/** Continua o traçado de um cabo existente */
window.resumeCableDraw = function(cableId) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) return;
  
  if (currentCablePolyline) clearCableDraw();
  
  setTool('cable'); // Muda para a ferramenta de cabo e reseta estados
  
  // Agora preenchemos o estado de desenho
  currentCableSourceType = cable.sourceType;
  currentCableSourceId = cable.sourceId;
  currentEditingCableId = cable.id;
  currentCablePoints = [...cable.path]; // Começa com os pontos existentes
  
  currentCablePolyline = L.polyline(currentCablePoints, {
    color: '#38bdf8',
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

  closeMobilePanel(); // Fecha painel lateral no mobile para focar no mapa
  
  map.on('mousemove', onCableMouseMove);
  toast('🔌 Continuando traçado do cabo. Clique para adicionar mais pontos.');
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
  
  if (currentEditingCableId) {
    // Atualiza cabo existente
    const cable = STATE.cables.find(c => c.id === currentEditingCableId);
    if (cable) {
      cable.path = [...currentCablePoints];
      if (cable.layer) {
        map.removeLayer(cable.layer);
      }
      renderCableOnMap(cable);
      saveLocal();
      const id = currentEditingCableId;
      clearCableDraw();
      setTool('select');
      selectElement(id);
      toast('✅ Traçado do cabo atualizado!');
    } else {
      clearCableDraw();
    }
    return;
  }
  
  // Cria novo cabo
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
  
  if (currentCableSourceType === 'pop') {
     if (typeof syncPopCables === 'function') syncPopCables(currentCableSourceId);
  } else {
     saveLocal();
  }
  
  setTool('select');
  selectElement(id);
  toast('✅ Cabo criado com sucesso!');
}

/** Limpa o estado temporário de desenho */
function clearCableDraw() {
  currentCableSourceType = null;
  currentCableSourceId = null;
  currentEditingCableId = null;
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

/** Corta o path do cabo até o ponto especificado e retorna um novo array de coordenadas */
function slicePathTo(cablePath, latlng) {
  const pt = map.latLngToLayerPoint(latlng);
  let minDistanceSq = Infinity;
  let closestLayerPt = null;
  let closestSegmentIndex = 0;

  for (let i = 0; i < cablePath.length - 1; i++) {
    const p1 = map.latLngToLayerPoint(cablePath[i]);
    const p2 = map.latLngToLayerPoint(cablePath[i + 1]);
    
    const projPt = getClosestPointOnSegment(pt, p1, p2);
    const sqDist = dist2(pt, projPt);
    
    if (sqDist < minDistanceSq) {
      minDistanceSq = sqDist;
      closestLayerPt = projPt;
      closestSegmentIndex = i;
    }
  }
  
  if (!closestLayerPt) return cablePath;
  
  const newPath = [];
  for (let i = 0; i <= closestSegmentIndex; i++) {
     newPath.push(cablePath[i]);
  }
  const snapLatLng = map.layerPointToLatLng(closestLayerPt);
  newPath.push([snapLatLng.lat, snapLatLng.lng]);
  return newPath;
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

/** Auto-mapeia as fibras dos cabos tronco que saem do POP na mesma ordem dos ramais */
window.syncPopCables = function(popId) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  
  // Coleta todos os ramais criados no POP em ordem
  let allRamais = [];
  (pop.pons || []).forEach(pon => {
    (pon.ramais || []).forEach(ramal => {
       allRamais.push(ramal.id);
    });
  });

  // Acha todos os cabos tronco que nascem deste POP
  const rootCables = STATE.cables.filter(c => c.sourceType === 'pop' && c.sourceId === popId);
  
  rootCables.forEach(cable => {
    for (let i = 1; i <= cable.fibers; i++) {
       const ramalId = allRamais[i - 1]; // Índice do array começa no zero
       
       if (ramalId) {
         cable.fiberMapping[i] = ramalId;
       } else {
         delete cable.fiberMapping[i];
       }
       
       // Força a cascata para os cabos derivados deste tronco
       if (typeof cascadeFiberMapping === 'function') {
           cascadeFiberMapping(cable.id, i, ramalId);
       }
    }
  });
  saveLocal();
}

/** Destaque (Highlight) no ramal selecionado pelo cabo */
window.highlightRamal = function(popId, ramalId) {
  // Se clicar na lupa do mesmo ramal já destacado, atua como um botão liga/desliga (toggle)
  if (window.activeRamalTrace === ramalId) {
    clearHighlight();
    return;
  }

  // Limpa traços anteriores
  if (window.activeTraceLines) {
    window.activeTraceLines.forEach(l => map.removeLayer(l));
  }
  window.activeTraceLines = [];
  window.activeRamalTrace = ramalId; // Memoriza qual ramal está ativo

  // Encontra a cor correta da PON para este ramal
  let routeColor = '#f97316';
  const pop = STATE.olts.find(o => o.id === popId);
  if (pop && pop.pons) {
    for (const pon of pop.pons) {
      if (pon.ramais && pon.ramais.some(r => r.id === ramalId)) {
        routeColor = pon.color || '#f97316';
        break;
      }
    }
  }

  // Fade out em todos os cabos originais
  STATE.cables.forEach(c => {
    if (c.layer) {
      c.layer.setStyle({ color: '#475569', weight: 4, opacity: 0.2, dashArray: null, className: '' });

      // Encontra as fibras deste cabo que possuem este ramal
      const fibersWithRamal = [];
      const mapping = c.fiberMapping || {};
      for (let fNum in mapping) {
         if (mapping[fNum] === ramalId) {
            fibersWithRamal.push(parseInt(fNum));
         }
      }

      if (fibersWithRamal.length > 0) {
         // Pega CEOs no cabo
         const cableSplices = STATE.splices
            .filter(s => s.cableId === c.id)
            .map(s => ({ ...s, dist: getDistanceAlongCable([s.lat, s.lng], c.path) }));
         
         fibersWithRamal.forEach(fNum => {
            let earliestCutSplice = null;
            let minCutDist = Infinity;

            for (const sp of cableSplices) {
               if (sp.fusions) {
                  for (const dCId in sp.fusions) {
                     for (const dFib in sp.fusions[dCId]) {
                         if (sp.fusions[dCId][dFib] == fNum) {
                             if (sp.dist < minCutDist) {
                                minCutDist = sp.dist;
                                earliestCutSplice = sp;
                             }
                         }
                     }
                  }
               }
            }

            let pathTrace = c.path;
            if (earliestCutSplice) {
               pathTrace = slicePathTo(c.path, [earliestCutSplice.lat, earliestCutSplice.lng]);
            }

            // Cria a linha animada
            const traceLine = L.polyline(pathTrace, {
               color: routeColor, 
               weight: 6, 
               opacity: 1, 
               dashArray: '10, 15', 
               className: 'cable-flow',
               interactive: false
            }).addTo(map);
            traceLine.bringToFront();
            window.activeTraceLines.push(traceLine);
         });
      }
    }
  });
}

function clearHighlight() {
  if (window.activeTraceLines) {
    window.activeTraceLines.forEach(l => map.removeLayer(l));
    window.activeTraceLines = [];
  }
  window.activeRamalTrace = null;
  STATE.cables.forEach(c => {
    if (c.layer) {
      c.layer.setStyle({ color: '#cbd5e1', weight: 4, opacity: 0.9, dashArray: null, className: '' });
    }
  });
}
