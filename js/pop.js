/**
 * pop.js — Criação, marcadores e propriedades do POP / OLT
 */

// Cores disponíveis para rotas (padrão ABNT fibra óptica)
const ROUTE_COLORS = [
  { hex: '#10b981', name: 'Verde' },
  { hex: '#facc15', name: 'Amarelo' },
  { hex: '#e2e8f0', name: 'Branco' },
  { hex: '#3b82f6', name: 'Azul' },
  { hex: '#ef4444', name: 'Vermelho' },
  { hex: '#8b5cf6', name: 'Violeta' },
  { hex: '#a16207', name: 'Marrom' },
  { hex: '#ec4899', name: 'Rosa' },
  { hex: '#475569', name: 'Cinza' },
  { hex: '#f97316', name: 'Laranja' },
  { hex: '#06b6d4', name: 'Aqua' },
  { hex: '#84cc16', name: 'Lima' },
];

/** Adiciona um POP no mapa */
function addPOP(lat, lng) {
  const id = 'pop_' + Date.now();
  const name = 'POP-' + String(STATE.nextOLTNum++).padStart(2, '0');
  const obj = {
    id, lat, lng, name,
    outputPower: 4,
    oltEquipments: [
      { id: 'olt_' + Date.now(), name: 'OLT Principal', ports: 8 }
    ],
    pons: [],
  };
  obj.layer = createPOPMarker(obj);
  STATE.olts.push(obj);
  toast('✅ POP "' + name + '" posicionado');
  selectElement(id);
  updateStatusBar();
  saveLocal();
}

/** Cria o marcador visual do POP no mapa */
function createPOPMarker(obj) {
  const icon = L.divIcon({
    html: `<div style="position:relative; width:40px; height:40px;">
             <div class="olt-marker" id="mk_${obj.id}">🏢</div>
             <div class="olt-label" id="pop_lbl_${obj.id}">${obj.name}</div>
           </div>`,
    className: 'marker-pop',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
  });

  const m = L.marker([obj.lat, obj.lng], {
    icon,
    draggable: true,
    zIndexOffset: 1000,
  });

  m.on('click', ev => {
    L.DomEvent.stopPropagation(ev);
    if (STATE.tool === 'cable') {
      if (typeof startCable === 'function') startCable(obj.id, obj.lat, obj.lng);
    } else {
      handleElementClick(obj.id);
    }
  });

  m.on('dragend', ev => {
    const { lat, lng } = ev.target.getLatLng();
    obj.lat = lat;
    obj.lng = lng;
    saveLocal();
  });

  m.addTo(map);
  return m;
}

/** Atualiza uma propriedade do POP */
function popUpdate(id, key, val) {
  const pop = STATE.olts.find(o => o.id === id);
  if (pop) {
    pop[key] = val;
    
    // Atualiza imediatamente a etiqueta visual (DOM) se a propriedade for 'name'
    if (key === 'name') {
      const lbl = document.getElementById('pop_lbl_' + id);
      if (lbl) lbl.textContent = val;
    }
    
    saveLocal();
    renderPanel();
  }
}

// ================================================================
//  GERENCIAMENTO DE ROTAS PON
// ================================================================

/** Adiciona/configura uma rota em uma porta PON */
function addPonRota(popId, ponIndex) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;

  // Verifica se já existe
  if (pop.pons.find(p => p.index === ponIndex)) {
    toast('⚠️ Essa porta PON já tem uma rota configurada.');
    return;
  }

  // Sugere próxima cor disponível
  const usedColors = pop.pons.map(p => p.color);
  const nextColor = ROUTE_COLORS.find(c => !usedColors.includes(c.hex)) || ROUTE_COLORS[0];

  pop.pons.push({
    index: ponIndex,
    oltName: 'OLT 1',
    rotaName: 'Rota ' + ponIndex,
    color: nextColor.hex,
    ramais: [],
  });

  saveLocal();
  renderPanel();
  toast('✅ Rota configurada na PON ' + String(ponIndex).padStart(2, '0'));
}

/** Remove a rota de uma porta PON */
function removePonRota(popId, ponIndex) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;

  pop.pons = pop.pons.filter(p => p.index !== ponIndex);
  
  if (typeof syncPopCables === 'function') syncPopCables(popId);

  saveLocal();
  renderPanel();
  toast('🗑️ Rota da PON ' + String(ponIndex).padStart(2, '0') + ' removida');
}

/** Atualiza propriedade de uma rota PON */
function updatePonRota(popId, ponIndex, prop, value) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;

  const pon = pop.pons.find(p => p.index === ponIndex);
  if (!pon) return;
  pon[prop] = value;
  saveLocal();
  renderPanel();
}

/** Adiciona uma nova OLT no POP */
window.addOltEquipment = function(popId) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  
  if (!pop.oltEquipments) {
     pop.oltEquipments = [{ id: 'olt_default', name: 'OLT Principal', ports: pop.ponPorts || 8 }];
  }
  
  pop.oltEquipments.push({
    id: 'olt_' + Date.now(),
    name: 'OLT ' + (pop.oltEquipments.length + 1),
    ports: 8
  });
  
  saveLocal();
  renderPanel();
  toast('✅ Nova OLT adicionada');
};

/** Remove uma OLT do POP */
window.removeOltEquipment = function(popId, oltId) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop || !pop.oltEquipments) return;
  
  if (confirm('Tem certeza que deseja remover esta OLT? Suas portas e rotas podem ficar inacessíveis!')) {
     pop.oltEquipments = pop.oltEquipments.filter(o => o.id !== oltId);
     saveLocal();
     renderPanel();
     toast('🗑️ OLT Removida');
  }
};

/** Atualiza dados da OLT */
window.updateOltEquipment = function(popId, oltId, prop, value) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop || !pop.oltEquipments) return;
  
  const olt = pop.oltEquipments.find(o => o.id === oltId);
  if (!olt) return;
  
  if (prop === 'ports') value = parseInt(value) || 8;
  if (prop === 'outputPower') value = parseFloat(value) || 0;
  
  olt[prop] = value;
  saveLocal();
  renderPanel();
};

// ================================================================
//  GERENCIAMENTO DE RAMAIS E CTOs
// ================================================================

/** Adiciona um Ramal a uma rota PON */
function addRamal(popId, ponIndex) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  const pon = pop.pons.find(p => p.index === ponIndex);
  if (!pon) return;
  
  if (!pon.ramais) pon.ramais = [];
  
  const ramalId = 'ramal_' + Date.now();
  pon.ramais.push({
    id: ramalId,
    name: 'Ramal ' + (pon.ramais.length + 1),
    type: 'desbalanceado', // default
    attSplitter: '1:8',    // atendimento padrao
    ctos: []
  });
  
  if (typeof syncPopCables === 'function') syncPopCables(popId);

  saveLocal();
  renderPanel();
  toast('🌿 Ramal adicionado à Rota');
}

/** Remove um Ramal */
function removeRamal(popId, ponIndex, ramalId) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  const pon = pop.pons.find(p => p.index === ponIndex);
  if (!pon) return;
  
  pon.ramais = pon.ramais.filter(r => r.id !== ramalId);
  
  if (typeof syncPopCables === 'function') syncPopCables(popId);

  saveLocal();
  renderPanel();
}

/** Atualiza propriedade básica do Ramal */
function updateRamal(popId, ponIndex, ramalId, key, val) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  const pon = pop.pons.find(p => p.index === ponIndex);
  if (!pon) return;
  const ramal = pon.ramais.find(r => r.id === ramalId);
  if (ramal) {
    ramal[key] = val;
    // Se o usuário mudar o tipo ou splitter, vamos atualizar as CTOs geradas para refletirem o mesmo splitter (a fim de recalcular)
    if (key === 'attSplitter') {
       ramal.ctos.forEach(c => c.attSplitter = val);
    }
    if (key === 'type') {
       ramal.ctos.forEach(c => {
         c.type = val;
         // reseta ratio pro default do tipo
         c.ratio = val === 'desbalanceado' ? '10/90' : '1:4'; 
       });
    }
    saveLocal();
    if (key === 'cableId') {
       // Se mudar o cabo alvo, tira do mapeamento atual para forçar o syncPopCables a realocar
       STATE.cables.forEach(c => {
           if (c.fiberMapping) {
               for (let f in c.fiberMapping) {
                   if (c.fiberMapping[f] === ramalId) delete c.fiberMapping[f];
               }
           }
       });
       if (typeof syncPopCables === 'function') syncPopCables(popId);
    }
    renderPanel();
  }
}

/** Configura e gera a lista de CTOs do Ramal (Cálculo Automático) */
function generateRamalCTOs(popId, ponIndex, ramalId, numCtos) {
  if (!numCtos || numCtos < 1) return toast('⚠️ Digite uma quantidade válida de CTOs');
  
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  const pon = pop.pons.find(p => p.index === ponIndex);
  const ramal = pon.ramais.find(r => r.id === ramalId);
  
  const defaultRatios = ['10/90', '15/85', '20/80', '25/75', '30/70', '40/60', '50/50'];
  
  if (!ramal.ctos) ramal.ctos = [];
  
  if (ramal.ctos.length > numCtos) {
     // Trunca mantendo apenas as primeiras CTOs
     ramal.ctos = ramal.ctos.slice(0, numCtos);
  } else {
     // Preenche o restante
     for(let i = ramal.ctos.length; i < numCtos; i++) {
        let r = defaultRatios[0];
        
        if (ramal.type === 'desbalanceado') {
          if(i === numCtos - 1 && numCtos > 1) r = '50/50'; 
        } else {
          r = '1:4'; 
        }
        
        ramal.ctos.push({
          id: 'cto_' + Date.now() + '_' + i,
          name: 'CTO ' + String(i+1).padStart(2, '0'),
          ratio: r,
          type: ramal.type,
          attSplitter: ramal.attSplitter,
        });
     }
  }
  
  saveLocal();
  renderPanel();
  toast('✅ ' + numCtos + ' CTOs geradas. Ajuste as taxas se necessário.');
}

/** Atualiza a taxa de um splitter na CTO */
function updateCTORatio(popId, ponIndex, ramalId, ctoIdx, ratioVal) {
  const pop = STATE.olts.find(o => o.id === popId);
  const pon = pop.pons.find(p => p.index === ponIndex);
  const ramal = pon.ramais.find(r => r.id === ramalId);
  
  if(ramal && ramal.ctos[ctoIdx]) {
    ramal.ctos[ctoIdx].ratio = ratioVal;
    saveLocal();
    renderPanel();
  }
}

/** Atualiza o splitter de atendimento (1:8, 1:16) individualmente na CTO */
function updateCTOAttSplitter(popId, ponIndex, ramalId, ctoIdx, attVal) {
  const pop = STATE.olts.find(o => o.id === popId);
  const pon = pop.pons.find(p => p.index === ponIndex);
  const ramal = pon.ramais.find(r => r.id === ramalId);
  
  if(ramal && ramal.ctos[ctoIdx]) {
    ramal.ctos[ctoIdx].attSplitter = attVal;
    saveLocal();
    renderPanel();
  }
}
