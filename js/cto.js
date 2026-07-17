/**
 * cto.js — Posicionamento visual das CTOs no mapa
 */

let placingCtoContext = null; // { popId, ponIndex, ramalId, ctoIdx }

/** Prepara a interface para receber o clique no mapa e posicionar a CTO */
function preparePlaceCTO(popId, ponIndex, ramalId, ctoIdx) {
  placingCtoContext = { popId, ponIndex, ramalId, ctoIdx };
  
  // Muda temporariamente a ferramenta para o modo de posicionamento de CTO
  setTool('cto_place');
  toast('📍 Clique no mapa (ou sobre o cabo) para posicionar esta CTO');
}

/** Recebe o clique do mapa e salva a coordenada da CTO */
function placeCTO(lat, lng) {
  if (!placingCtoContext) return;

  const { popId, ponIndex, ramalId, ctoIdx } = placingCtoContext;
  const pop = STATE.olts.find(o => o.id === popId);
  const pon = pop.pons.find(p => p.index === ponIndex);
  const ramal = pon.ramais.find(r => r.id === ramalId);
  const cto = ramal.ctos[ctoIdx];

  cto.lat = lat;
  cto.lng = lng;

  saveLocal();
  renderAllCTOMarkers();
  renderPanel();
  
  // Volta para a ferramenta de seleção
  setTool('select');
  placingCtoContext = null;
  toast(`✅ ${cto.name} posicionada!`);
}

// Armazena as referências visuais dos marcadores de CTO no mapa
let ctoMarkersLayer = L.layerGroup().addTo(map);

/** Varre o estado global e desenha todas as CTOs que possuem lat/lng */
function renderAllCTOMarkers() {
  ctoMarkersLayer.clearLayers();

  STATE.olts.forEach(pop => {
    (pop.pons || []).forEach(pon => {
      (pon.ramais || []).forEach(ramal => {
        (ramal.ctos || []).forEach((cto, ctoIdx) => {
          if (cto.lat && cto.lng) {
            
            // Ícone da CTO
            const icon = L.divIcon({
              html: `<div class="cto-marker" style="background:${pon.color}; color:#fff; border:2px solid #fff; border-radius:4px; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.4);">
                       ${ctoIdx + 1}
                     </div>`,
              className: '',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            });

            const m = L.marker([cto.lat, cto.lng], {
              icon,
              draggable: true,
              zIndexOffset: 500,
            });

            m.bindTooltip(`<b>${pop.name}</b><br>${pon.rotaName} - ${ramal.name}<br>${cto.name}`, { direction: 'top', offset: [0, -10] });

            // Atualiza posição ao arrastar
            m.on('dragend', ev => {
              const { lat, lng } = ev.target.getLatLng();
              cto.lat = lat;
              cto.lng = lng;
              saveLocal();
            });
            
            // Remove a CTO do mapa se clicar com a borracha
            m.on('click', ev => {
                L.DomEvent.stopPropagation(ev);
                if (STATE.tool === 'eraser') {
                    delete cto.lat;
                    delete cto.lng;
                    saveLocal();
                    renderAllCTOMarkers();
                    renderPanel();
                    toast(`🗑️ Posição da ${cto.name} removida`);
                }
            });

            ctoMarkersLayer.addLayer(m);
          }
        });
      });
    });
  });
}
