/**
 * splice.js — Caixas de Emenda Óptica (CEOs) e Derivações
 */

let spliceMarkersLayer = L.layerGroup().addTo(map);

/** Recebe o clique do mapa com a ferramenta de splice e adiciona uma CEO no cabo mais próximo */
function placeSplice(lat, lng) {
  if (STATE.cables.length === 0) {
    toast('⚠️ Não há cabos lançados. A CEO deve ser inserida em um cabo existente.');
    return;
  }

  // Encontra o cabo mais próximo (limite de 30px)
  let closestCable = null;
  let minDistance = Infinity;
  let finalSnap = null;

  STATE.cables.forEach(cable => {
    const snap = snapToCable(lat, lng, cable.path);
    if (snap && snap.distancePx < minDistance) {
      minDistance = snap.distancePx;
      closestCable = cable;
      finalSnap = snap;
    }
  });

  if (!closestCable || minDistance > 30) {
    toast('⚠️ A CEO deve ser colocada sobre um cabo! Clique na linha do cabo.');
    return;
  }

  const newSpliceId = 'splice_' + Date.now();
  
  const newSplice = {
    id: newSpliceId,
    name: 'CEO ' + (STATE.splices.length + 1),
    lat: finalSnap.latlng.lat,
    lng: finalSnap.latlng.lng,
    cableId: closestCable.id,
    fusions: {} // mapeamento de fusões, ex: { 'cableB_ID': { 'fibraB_num': 'fibraA_num' } }
  };

  STATE.splices.push(newSplice);

  saveLocal();
  renderAllSplices();
  setTool('select');
  selectElement(newSpliceId);
  toast(`✅ ${newSplice.name} instalada no ${closestCable.name}!`);
}

function renderAllSplices() {
  spliceMarkersLayer.clearLayers();

  STATE.splices.forEach(splice => {
    // Icone de cilindro vermelho sem fundo (referenciando o svg que criamos)
    const icon = L.icon({
      iconUrl: 'img/ceo.svg',
      iconSize: [20, 40],
      iconAnchor: [10, 20],
      tooltipAnchor: [0, -20]
    });

    const m = L.marker([splice.lat, splice.lng], {
      icon,
      draggable: true,
      zIndexOffset: 600,
    });

    m.bindTooltip(`<b>${splice.name}</b><br>Clique para gerenciar derivações`, { direction: 'top' });

    // Atualiza posição forçando Snap no cabo de origem
    m.on('dragend', ev => {
      let { lat, lng } = ev.target.getLatLng();
      
      const cable = STATE.cables.find(c => c.id === splice.cableId);
      if (cable) {
        const snap = snapToCable(lat, lng, cable.path);
        if (snap) {
            lat = snap.latlng.lat;
            lng = snap.latlng.lng;
            m.setLatLng([lat, lng]); 
            toast('🧲 CEO reposicionada no cabo!');
        }
      }
      
      splice.lat = lat;
      splice.lng = lng;
      
      // Quando movemos a CEO, temos que mover a origem de todos os cabos derivados dela!
      STATE.cables.forEach(c => {
         if (c.sourceType === 'splice' && c.sourceId === splice.id) {
            c.path[0] = [lat, lng];
            if (c.layer) c.layer.setLatLngs(c.path);
         }
      });
      
      saveLocal();
      // renderCableOnMap não é recriado inteiro, a linha acima já atualiza a polyline na tela, 
      // mas podemos chamar update se necessário.
    });
    
    m.on('click', ev => {
        L.DomEvent.stopPropagation(ev);
        if (STATE.tool === 'eraser') {
            removeSplice(splice.id);
        } else {
            handleElementClick(splice.id);
        }
    });

    splice.layer = m;
    spliceMarkersLayer.addLayer(m);
  });
}

function removeSplice(id) {
  const sIndex = STATE.splices.findIndex(s => s.id === id);
  if (sIndex === -1) return;
  
  // Verifica se existem cabos derivados dessa CEO
  const derivados = STATE.cables.filter(c => c.sourceType === 'splice' && c.sourceId === id);
  if (derivados.length > 0) {
     toast(`⚠️ Remova os cabos derivados (${derivados.length}) antes de apagar a CEO!`);
     return;
  }
  
  const splice = STATE.splices[sIndex];
  if (splice.layer) spliceMarkersLayer.removeLayer(splice.layer);
  STATE.splices.splice(sIndex, 1);
  
  if (STATE.selectedId === id) STATE.selectedId = null;
  
  saveLocal();
  renderPanel();
  toast('🗑️ CEO removida');
}

/** Prepara para lançar um cabo derivado da CEO */
function startCableFromSplice(spliceId) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (!splice) return;
   
   setTool('cable');
   
   // Adapta o cable.js para começar da CEO
   // Precisaremos injetar sourceType='splice' e sourceId no cableDraw
   startCableExt('splice', spliceId, splice.lat, splice.lng);
}
