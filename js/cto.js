/**
 * cto.js — Lançamento contínuo de CTOs vinculadas a um cabo
 */

let placingRamalContext = null; // { popId, ramalId, ponIndex, cableId }

/** Prepara a interface para o lançamento sequencial de CTOs */
function preparePlaceCTO(popId, ramalId, cableId) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;

  let ponIndex = -1;
  pop.pons.forEach(p => {
    if (p.ramais && p.ramais.find(r => r.id === ramalId)) {
      ponIndex = p.index;
    }
  });

  if (ponIndex === -1) return;

  placingRamalContext = { popId, ramalId, ponIndex, cableId };
  
  setTool('cto_place');
  toast('📦 Clique no cabo para lançar as CTOs (ESC para sair)');
}

/** Calcula distância ao quadrado entre dois pontos X,Y (pixels) */
function dist2(v, w) { 
  return Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2); 
}

/** Encontra o ponto (L.Point) mais próximo de p num segmento v-w */
function getClosestPointOnSegment(p, v, w) {
  const l2 = dist2(v, w);
  if (l2 === 0) return v;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return L.point(v.x + t * (w.x - v.x), v.y + t * (w.y - v.y));
}

/** Retorna a coordenada com Snap (imã) e a distância em pixels até o cabo */
function snapToCable(lat, lng, cablePath) {
  if (!cablePath || cablePath.length < 2) return null;
  
  const pt = map.latLngToLayerPoint([lat, lng]);
  let minDistanceSq = Infinity;
  let closestLayerPt = null;

  for (let i = 0; i < cablePath.length - 1; i++) {
    const p1 = map.latLngToLayerPoint(cablePath[i]);
    const p2 = map.latLngToLayerPoint(cablePath[i + 1]);
    
    const projPt = getClosestPointOnSegment(pt, p1, p2);
    const sqDist = dist2(pt, projPt);
    
    if (sqDist < minDistanceSq) {
      minDistanceSq = sqDist;
      closestLayerPt = projPt;
    }
  }
  
  if (!closestLayerPt) return null;
  
  return {
    distancePx: Math.sqrt(minDistanceSq),
    latlng: map.layerPointToLatLng(closestLayerPt)
  };
}

/** Recebe o clique do mapa e adiciona uma nova CTO presa ao cabo */
function placeCTO(lat, lng) {
  if (!placingRamalContext) return;

  const { popId, ramalId, ponIndex, cableId } = placingRamalContext;
  
  const cable = STATE.cables.find(c => c.id === cableId);
  if (!cable) {
     toast('⚠️ Cabo não encontrado!');
     return;
  }
  
  // Imã no cabo (tolerância de ~30 pixels)
  const snap = snapToCable(lat, lng, cable.path);
  if (!snap || snap.distancePx > 30) {
    toast('⚠️ A CTO deve ser colada sobre o cabo! Clique mais perto da linha.');
    return;
  }

  const pop = STATE.olts.find(o => o.id === popId);
  const pon = pop.pons.find(p => p.index === ponIndex);
  const ramal = pon.ramais.find(r => r.id === ramalId);

  if (!ramal.ctos) ramal.ctos = [];

  // Busca a primeira CTO que ainda não foi posicionada no mapa
  const unplacedCto = ramal.ctos.find(c => !c.lat);
  let ctoName;

  if (unplacedCto) {
    unplacedCto.lat = snap.latlng.lat;
    unplacedCto.lng = snap.latlng.lng;
    unplacedCto.cableId = cableId;
    ctoName = unplacedCto.name;
  } else {
    // Se acabaram as CTOs geradas previamente, bloqueia o lançamento
    toast(`⚠️ Limite atingido! Todas as CTOs deste ramal já foram colocadas no mapa.`);
    setTool('select');
    placingRamalContext = null;
    return;
  }

  saveLocal();
  renderAllCTOMarkers();
  if (STATE.selectedId === popId) renderPanel();
  
  toast(`✅ ${ctoName} fixada no cabo!`);
}

let ctoMarkersLayer = L.layerGroup().addTo(map);

/** Renderiza as CTOs e cuida do arraste mantendo o snap */
function renderAllCTOMarkers() {
  ctoMarkersLayer.clearLayers();

  STATE.olts.forEach(pop => {
    (pop.pons || []).forEach(pon => {
      (pon.ramais || []).forEach(ramal => {
        (ramal.ctos || []).forEach((cto, ctoIdx) => {
          if (cto.lat && cto.lng) {
            
            const icon = L.divIcon({
              html: `<div class="cto-marker" style="background:${pon.color}; color:#fff; border:2px solid #fff; border-radius:4px; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; box-shadow:0 2px 5px rgba(0,0,0,0.4);">
                       ${ctoIdx + 1}
                     </div>`,
              className: '',
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            });

            const m = L.marker([cto.lat, cto.lng], {
              icon,
              draggable: true,
              zIndexOffset: 500,
            });

            m.on('click', () => {
              setTool('select');
              selectElement(cto.id);
            });

            m.bindTooltip(`<b>${pop.name}</b><br>${pon.rotaName} - ${ramal.name}<br>${cto.name}<br>Splitter: ${cto.ratio}`, { direction: 'top', offset: [0, -10] });

            // Atualiza posição forçando Snap
            m.on('dragend', ev => {
              let { lat, lng } = ev.target.getLatLng();
              
              if (cto.cableId) {
                 const cable = STATE.cables.find(c => c.id === cto.cableId);
                 if (cable) {
                    const snap = snapToCable(lat, lng, cable.path);
                    // Puxa pro ponto mais perto da linha não importa o quão longe o usuário arrastou
                    if (snap) {
                        lat = snap.latlng.lat;
                        lng = snap.latlng.lng;
                        m.setLatLng([lat, lng]); 
                        toast('🧲 CTO fixada de volta no cabo!');
                    }
                 }
              }
              
              cto.lat = lat;
              cto.lng = lng;
              saveLocal();
            });
            
            m.on('click', ev => {
                L.DomEvent.stopPropagation(ev);
                if (STATE.tool === 'eraser') {
                    ramal.ctos.splice(ctoIdx, 1);
                    ramal.ctos.forEach((c, i) => {
                        c.name = 'CTO ' + String(i + 1).padStart(2, '0');
                    });
                    saveLocal();
                    renderAllCTOMarkers();
                    if (STATE.selectedId === pop.id) renderPanel();
                    toast(`🗑️ CTO removida da rota!`);
                }
            });

            ctoMarkersLayer.addLayer(m);
          }
        });
      });
    });
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && STATE.tool === 'cto_place') {
    setTool('select');
    placingRamalContext = null;
    toast('✅ Lançamento de CTOs finalizado.');
  }
});
