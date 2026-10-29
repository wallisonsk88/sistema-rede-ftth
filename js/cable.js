/**
 * cable.js — Lógica de criação e manipulação de cabos no mapa
 */

let currentCableSourceType = null; // 'pop' ou 'splice'
let currentCableSourceId = null;
let currentCablePoints = [];
let currentCablePolyline = null;
let currentCableCursorLine = null; // Linha temp que segue o mouse
let currentEditingCableId = null; // ID do cabo sendo continuado
let isGeomanEditingCableId = null; // ID do cabo sendo editado de forma fina (Geoman)

// Configuração Global do Geoman
if (typeof map !== 'undefined' && map.pm) {
  map.pm.setLang('pt_br');
}

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
  createCableDrawLines();
  toast('🔌 Cabo iniciado. Clique no mapa para traçar.');
}

/** Cria as linhas temporárias do desenho (traçado + linha que segue o mouse) */
function createCableDrawLines() {
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
  createCableDrawLines();

  closeMobilePanel(); // Fecha painel lateral no mobile para focar no mapa
  toast('🔌 Continuando traçado do cabo. Clique para adicionar mais pontos.');
}

/** Adiciona um ponto ao cabo atual */
function cableAddPoint(lat, lng) {
  if (!currentCableSourceId) return toast('⚠️ Clique numa Origem (POP/CEO) para iniciar o cabo!');

  if (currentCablePoints.length > 0) {
    const lastPt = currentCablePoints[currentCablePoints.length - 1];
    const dist = map.distance([lastPt[0], lastPt[1]], [lat, lng]);
    // Previne duplo clique ou pontos no mesmo lugar (ex: dist < 1 metro)
    if (dist < 1) return;
  }

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

  // Ponta do cabo chegando numa CEO: encosta nela e, se a CEO ainda não usa outro cabo com
  // sinal, este passa a ser o cabo de entrada dela (o sinal continua de CEO em CEO)
  let endMsg = '';
  const end = obj.path[obj.path.length - 1];
  const endSplice = STATE.splices.find(s => s.id !== obj.sourceId && !isDownstreamOfSplice(obj, s.id) && map.distance(end, [s.lat, s.lng]) <= 20);
  if (endSplice) {
    obj.path[obj.path.length - 1] = [endSplice.lat, endSplice.lng];
    const current = STATE.cables.find(c => c.id === endSplice.cableId);
    const inUse = Object.values(endSplice.fusions || {}).some(f => Object.keys(f).length) || (endSplice.splitter && endSplice.splitter.inputFiber);
    if (!inUse && !(current && countActiveFibersAt(current, [endSplice.lat, endSplice.lng]))) {
      endSplice.cableId = obj.id;
      endMsg = ` Ligado como entrada da ${endSplice.name}.`;
    } else {
      endMsg = ` Chegou na ${endSplice.name}: escolha-o em "Cabo de entrada" no painel dela.`;
    }
  }

  STATE.cables.push(obj);
  clearCableDraw();

  // Renderiza no mapa
  renderCableOnMap(obj);

  // Cabo tronco novo: ramais da OLT que ainda não saíam em nenhuma fibra são ligados nele
  let msg = '✅ Cabo criado com sucesso!' + endMsg;
  if (obj.sourceType === 'pop') {
    const n = autoConnectRamais(obj.sourceId, null, [obj]);
    if (n) msg += ` ${n} ramal(is) sem fibra ligado(s) nele.`;
  }
  saveLocal();

  setTool('select');
  selectElement(id);
  toast(msg);
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
  const closest = findClosestOnPath(latlng, cablePath);
  if (!closest) return 0;

  const upToSegment = cablePath.slice(0, closest.segmentIndex + 1);
  return calcPolylineLength(upToSegment) + map.distance(cablePath[closest.segmentIndex], closest.latlng);
}

/** Corta o path do cabo até o ponto especificado e retorna um novo array de coordenadas */
function slicePathTo(cablePath, latlng) {
  const closest = findClosestOnPath(latlng, cablePath);
  if (!closest) return cablePath;

  const newPath = cablePath.slice(0, closest.segmentIndex + 1);
  newPath.push([closest.latlng.lat, closest.latlng.lng]);
  return newPath;
}

/** Conteúdo do tooltip do cabo (nome, fibras, comprimento e rotas que passam nele) */
function cableTooltipHtml(cable) {
  const routes = new Set();
  Object.values(cable.fiberMapping || {}).forEach(ramalId => {
    const info = getRamalInfo(ramalId);
    if (info) routes.add(`${info.oltName} · PON ${info.ponLabel} · ${info.pon.rotaName}`);
  });
  return `
    <div style="text-align: center;">
      <b>${cable.name || 'Cabo'}</b><br>
      <span style="color: var(--primary);">🧵 ${cable.fibers} FO</span> | 📏 ${formatDist(calcPolylineLength(cable.path || []))}
      ${[...routes].map(r => `<br><span style="font-size:10px;">${r}</span>`).join('')}
    </div>
  `;
}

/** Nome da fibra pelo código de cores (12 fibras por tubo quando o cabo tem mais de 12) */
function fiberLabel(fiber, totalFibers) {
  const color = FIBER_COLORS[(fiber - 1) % FIBER_COLORS.length];
  if (totalFibers <= 12) return `Fibra ${fiber} (${color.name})`;
  const tube = Math.ceil(fiber / 12);
  const tubeColor = FIBER_COLORS[(tube - 1) % FIBER_COLORS.length];
  return `Fibra ${fiber} · Tubo ${tube} (${tubeColor.name}) · ${color.name}`;
}

/** Cabos tronco que saem de um POP */
function getPopRootCables(popId) {
  return STATE.cables.filter(c => (c.sourceType === 'pop' || c.popId) && (c.sourceId === popId || c.popId === popId));
}

/** Renderiza um cabo já salvo no estado */
function renderCableOnMap(cableObj) {
  const pl = L.polyline(cableObj.path, {
    color: '#cbd5e1', // Cinza claro para contrastar com o fundo escuro
    weight: 4,
    opacity: 0.9
  }).addTo(map);

  pl.bindTooltip(() => cableTooltipHtml(cableObj), { sticky: true });

  pl.on('click', ev => {
    L.DomEvent.stopPropagation(ev);
    if (STATE.tool === 'eraser') {
      removeCable(cableObj.id);
    } else {
      handleElementClick(cableObj.id, ev.latlng);
    }
  });

  // Botão direito no cabo para entrar no modo de edição (se já estiver editando, não faz nada para permitir que o Geoman use o botão direito para deletar o vértice)
  pl.on('contextmenu', ev => {
    if (STATE.tool !== 'eraser') {
       if (isGeomanEditingCableId !== cableObj.id) {
           L.DomEvent.stopPropagation(ev);
           toggleGeomanEditCable(cableObj.id);
       }
    }
  });

  // Atualiza as coordenadas automaticamente quando o Geoman editar
  pl.on('pm:edit', e => {
    if (isGeomanEditingCableId === cableObj.id) {
       const latlngs = e.layer.getLatLngs();
       cableObj.path = latlngs.map(ll => [ll.lat, ll.lng]);
    }
  });

  cableObj.layer = pl;
}

/** Inicia ou finaliza a edição fina de nós com Geoman */
function toggleGeomanEditCable(id) {
  const cable = STATE.cables.find(c => c.id === id);
  if (!cable || !cable.layer) return;

  if (isGeomanEditingCableId === id) {
     // Salva e finaliza edição
     cable.layer.pm.disable();
     isGeomanEditingCableId = null;
     document.body.classList.remove('editing-cable');
     map.doubleClickZoom.enable();
     saveLocal();
     toast('💾 Ajuste fino do cabo salvo com sucesso!');
  } else {
     // Se já houver outro cabo sendo editado, desliga ele primeiro
     if (isGeomanEditingCableId) {
        const oldCable = STATE.cables.find(c => c.id === isGeomanEditingCableId);
        if (oldCable && oldCable.layer) {
           oldCable.layer.pm.disable();
           saveLocal();
        }
     }
     // Ativa edição neste cabo
     isGeomanEditingCableId = id;
     document.body.classList.add('editing-cable');
     map.doubleClickZoom.disable(); // duplo clique passa a finalizar a edição

     // Remove pontos duplicados para evitar bugs de nós sobrepostos (causados por duplo clique)
     if (cable.path && cable.path.length > 0) {
       const cleanedPath = [cable.path[0]];
       for (let i = 1; i < cable.path.length; i++) {
         const lastPt = cleanedPath[cleanedPath.length - 1];
         const currPt = cable.path[i];
         const dist = map.distance([lastPt[0], lastPt[1]], [currPt[0], currPt[1]]);
         if (dist > 1) {
           cleanedPath.push(currPt);
         }
       }
       cable.path = cleanedPath;
       if (cable.layer) {
         cable.layer.setLatLngs(cleanedPath);
       }
     }

     cable.layer.pm.enable({
       allowSelfIntersection: true,
       preventMarkerRemoval: false
     });
     toast('✏️ Edição livre: Arraste a bolinha para mover, botão direito nela para apagar. Duplo clique para finalizar.');
  }
  renderPanel();
}

/** Remove um cabo do sistema */
function removeCable(id) {
  const cIndex = STATE.cables.findIndex(c => c.id === id);
  if (cIndex === -1) return;
  const cable = STATE.cables[cIndex];

  if (isGeomanEditingCableId === id) {
    isGeomanEditingCableId = null;
    document.body.classList.remove('editing-cable');
    map.doubleClickZoom.enable();
  }

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

/**
 * Aloca um ramal a uma fibra do cabo tronco (só o tronco recebe escolha manual).
 * Um ramal sai da OLT em uma só fibra: se ele já estava em outra, é movido.
 */
function setFiberMapping(cableId, fiberNumber, ramalId) {
  const cable = STATE.cables.find(c => c.id === cableId);
  if (cable) {
    if (ramalId) {
      disconnectRamal(ramalId);
      cable.fiberMapping[fiberNumber] = ramalId;
    } else {
      delete cable.fiberMapping[fiberNumber];
    }
    saveLocal(); // recalcula a propagação para os cabos derivados e CTOs
    renderPanel();
  }
}

/** Tira o ramal de qualquer fibra de cabo tronco */
function disconnectRamal(ramalId) {
  STATE.cables.filter(isRootCable).forEach(c => {
    Object.keys(c.fiberMapping || {}).forEach(f => {
      if (c.fiberMapping[f] === ramalId) delete c.fiberMapping[f];
    });
  });
}

/** Liga (value = "cabo:fibra") ou desliga (value vazio) um ramal da OLT numa fibra do cabo tronco */
function connectRamalToFiber(ramalId, value) {
  disconnectRamal(ramalId);
  if (value) {
    const [cableId, fiber] = value.split(':');
    const cable = STATE.cables.find(c => c.id === cableId);
    if (cable) cable.fiberMapping[fiber] = ramalId;
  }
  saveLocal();
  renderPanel();
}

/**
 * Liga ramais que ainda não saem em nenhuma fibra na primeira fibra livre de um cabo tronco
 * (só cabos da mesma OLT do ramal ou sem OLT definida). Usado ao criar um ramal ou um
 * cabo tronco novo; a ligação aparece no painel e pode ser trocada. Retorna quantos ligou.
 */
function autoConnectRamais(popId, ramalIds, cables) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return 0;
  cables = cables || getPopRootCables(popId);
  const ponToOlt = buildPonToOltMap(pop);
  const connected = new Set();
  STATE.cables.filter(isRootCable).forEach(c => Object.values(c.fiberMapping || {}).forEach(r => connected.add(r)));

  let count = 0;
  (pop.pons || []).forEach(pon => (pon.ramais || []).forEach(ramal => {
    if (connected.has(ramal.id) || (ramalIds && !ramalIds.includes(ramal.id))) return;
    for (const cable of cables) {
      if (!cableAcceptsOlt(cable, ponToOlt[pon.index])) continue;
      if (!cable.fiberMapping) cable.fiberMapping = {};
      let f = 1;
      while (f <= cable.fibers && cable.fiberMapping[f]) f++;
      if (f <= cable.fibers) {
        cable.fiberMapping[f] = ramal.id;
        count++;
        break;
      }
    }
  }));
  return count;
}

/**
 * OLTs ligadas ao cabo tronco. Um mesmo cabo pode levar fibras de várias OLTs do POP;
 * lista vazia = aceita qualquer OLT. (Projetos antigos guardavam só uma em `oltId`.)
 */
function getCableOltIds(cable) {
  if (Array.isArray(cable.oltIds)) return cable.oltIds;
  return cable.oltId ? [cable.oltId] : [];
}

/** O cabo tronco pode receber ramais desta OLT? */
function cableAcceptsOlt(cable, oltId) {
  const ids = getCableOltIds(cable);
  return ids.length === 0 || ids.includes(oltId);
}

/** Cabo tronco: sai direto do POP (os demais saem de uma CEO) */
function isRootCable(cable) {
  return cable.sourceType === 'pop' || !!cable.popId;
}

/** Fusão vinda de uma saída de splitter da CEO ('S1', 'S2'...) */
function isSplitterOutput(src) {
  return typeof src === 'string' && src.startsWith('S');
}

/**
 * Splitter desbalanceado na CEO (ex.: 10/90): S1 = derivação (menor %), S2 = passagem (maior %).
 * Se a passagem não for fusionada em outro cabo, ela segue na mesma fibra do cabo de entrada,
 * e a fibra continua ativa para as próximas CEOs.
 */
function isUnbalancedSplitter(splitter) {
  return !!(splitter && splitter.ratio);
}

/** A fibra de entrada do splitter é cortada na CEO? (no desbalanceado só se a passagem sair por outro cabo) */
function splitterCutsInput(sp) {
  if (!isUnbalancedSplitter(sp.splitter)) return true;
  return Object.values(sp.fusions || {}).some(fus => Object.values(fus).includes('S2'));
}

function splitterName(splitter) {
  return isUnbalancedSplitter(splitter) ? `Splitter ${splitter.ratio} desbalanceado` : `Splitter 1:${splitter.outputs}`;
}

function splitterOutLabel(splitter, src) {
  const k = parseInt(String(src).slice(1));
  if (isUnbalancedSplitter(splitter)) {
    const [drop, pass] = splitter.ratio.split('/');
    return k === 1 ? `OUT ${drop}% (derivação)` : `OUT ${pass}% (passagem)`;
  }
  return `OUT ${k}`;
}

/** O cabo sai (direta ou indiretamente) desta CEO? Ele não pode ser a entrada dela */
function isDownstreamOfSplice(cable, spliceId) {
  const seen = new Set();
  while (cable && cable.sourceType === 'splice' && !seen.has(cable.id)) {
    if (cable.sourceId === spliceId) return true;
    seen.add(cable.id);
    const sp = STATE.splices.find(s => s.id === cable.sourceId);
    cable = sp ? STATE.cables.find(c => c.id === sp.cableId) : null;
  }
  return false;
}

/** Cabos que passam ou terminam na CEO (até 20 m), candidatos a cabo de entrada */
function getCablesAtSplice(splice) {
  return STATE.cables
    .filter(c => !isDownstreamOfSplice(c, splice.id))
    .map(c => {
      const snap = findClosestOnPath([splice.lat, splice.lng], c.path);
      return snap ? { cable: c, meters: map.distance([splice.lat, splice.lng], snap.latlng) } : null;
    })
    .filter(x => x && x.meters <= 20)
    .sort((a, b) => a.meters - b.meters);
}

/** Quantas fibras do cabo chegam com sinal da OLT no ponto da CEO */
function countActiveFibersAt(cable, latlng) {
  let n = 0;
  for (let f = 1; f <= cable.fibers; f++) if (getFiberSignalAt(cable, f, latlng)) n++;
  return n;
}

/**
 * CEOs ao longo do cabo, com a distância (m) desde a origem e as fibras do cabo cortadas
 * em cada uma: fusionadas para um cabo derivado (sangria) ou ligadas na entrada do splitter.
 * Não cortam a fibra: a CTO e o splitter desbalanceado com a passagem seguindo no cabo.
 */
function getSpliceUsesAlong(cable) {
  return STATE.splices.filter(s => s.cableId === cable.id).map(sp => {
    const fibers = new Set();
    Object.values(sp.fusions || {}).forEach(fus => Object.values(fus).forEach(src => {
      if (!isSplitterOutput(src)) fibers.add(parseInt(src));
    }));
    // Fibra que entra num splitter desbalanceado e segue pela passagem: usada aqui, mas não cortada
    const taps = new Set();
    if (sp.splitter && sp.splitter.inputFiber) {
      (splitterCutsInput(sp) ? fibers : taps).add(parseInt(sp.splitter.inputFiber));
    }
    return { splice: sp, dist: getDistanceAlongCable([sp.lat, sp.lng], cable.path), fibers, taps };
  });
}

/**
 * Para cada fibra do cabo, a primeira CEO (a partir da origem do cabo) onde ela é cortada.
 * Retorna { [fibra]: { splice, dist } }.
 */
function getFiberCuts(cable) {
  const cuts = {};
  getSpliceUsesAlong(cable).forEach(({ splice, dist, fibers }) => {
    fibers.forEach(fiber => {
      if (!cuts[fiber] || dist < cuts[fiber].dist) cuts[fiber] = { splice, dist };
    });
  });
  return cuts;
}

/** Ramal que chega num ponto de uma fibra do cabo (null se a fibra foi cortada antes do ponto) */
function getFiberSignalAt(cable, fiber, latlng) {
  const cut = getFiberCuts(cable)[fiber];
  if (cut && getDistanceAlongCable(latlng, cable.path) > cut.dist + 1) return null;
  return cable.fiberMapping[fiber] || null;
}

/** Cabo e fibra em que a CTO está presa e o ramal que chega até ela pela rede */
function getCtoSignal(cto) {
  const cable = cto.cableId && cto.lat ? STATE.cables.find(c => c.id === cto.cableId) : null;
  const fiber = cto.fiberIndex ? parseInt(cto.fiberIndex) : null;
  if (!cable || !fiber) return { cable, fiber, ramalId: null };
  return { cable, fiber, ramalId: getFiberSignalAt(cable, fiber, [cto.lat, cto.lng]) };
}

/**
 * Recalcula o sinal (ramal) de todas as fibras da rede a partir da OLT.
 * Só os cabos tronco guardam a escolha do usuário; nos cabos derivados o ramal
 * vem das fusões e splitters das CEOs. Uma fibra cortada numa CEO não leva
 * sinal para as CEOs que ficam depois dela no mesmo cabo. No fim, cada CTO
 * passa a pertencer ao ramal que chega na fibra dela.
 */
function recomputeSignals() {
  repairSpliceInputs();

  STATE.cables.forEach(c => {
    if (!c.fiberMapping) c.fiberMapping = {};
    if (!isRootCable(c)) {
      c.fiberMapping = {};
      return;
    }
    // No tronco descarta fibras que não existem mais no cabo e ramais/rotas apagados
    Object.keys(c.fiberMapping).forEach(f => {
      if (parseInt(f) > c.fibers || !getRamalInfo(c.fiberMapping[f])) delete c.fiberMapping[f];
    });
  });

  // Distância (m) do início de cada cabo até a OLT, para pôr as CTOs na ordem do sinal
  const offsets = {};
  const queue = STATE.cables.filter(isRootCable);
  queue.forEach(c => offsets[c.id] = 0);
  const visited = new Set();
  while (queue.length) {
    const cable = queue.shift();
    if (visited.has(cable.id)) continue;
    visited.add(cable.id);

    const cuts = getFiberCuts(cable);
    STATE.splices.filter(s => s.cableId === cable.id).forEach(sp => {
      const alongDist = getDistanceAlongCable([sp.lat, sp.lng], cable.path);
      const spliceDist = offsets[cable.id] + alongDist;
      STATE.cables.filter(c => c.sourceType === 'splice' && c.sourceId === sp.id).forEach(child => {
        if (offsets[child.id] === undefined) offsets[child.id] = spliceDist;
        Object.entries((sp.fusions || {})[child.id] || {}).forEach(([childFiber, src]) => {
          const parentFiber = isSplitterOutput(src) ? parseInt(sp.splitter && sp.splitter.inputFiber) : parseInt(src);
          if (!parentFiber) return;
          // Se a fibra já foi cortada numa CEO anterior, o sinal não chega nesta
          const cut = cuts[parentFiber];
          if (cut && cut.splice.id !== sp.id && cut.dist < alongDist) return;
          const ramalId = cable.fiberMapping[parentFiber];
          if (ramalId) child.fiberMapping[childFiber] = ramalId;
        });
        queue.push(child);
      });
    });
  }

  syncCTOsWithSignal(offsets);
}

/**
 * CEO cujo cabo de entrada foi apagado (ex.: cabo excluído e redesenhado) é religada no
 * cabo que passa ou chega nela com mais fibras ativas (ou o mais perto). As fusões são
 * mantidas, então o sinal volta a correr para os cabos derivados e CTOs.
 */
function repairSpliceInputs() {
  const repaired = [];
  STATE.splices.forEach(sp => {
    if (STATE.cables.some(c => c.id === sp.cableId)) return;
    const pos = [sp.lat, sp.lng];
    const best = getCablesAtSplice(sp)
      .map(x => ({ ...x, active: countActiveFibersAt(x.cable, pos) }))
      .sort((a, b) => b.active - a.active || a.meters - b.meters)[0];
    if (!best) return;
    sp.cableId = best.cable.id;
    repaired.push(`${sp.name} → ${best.cable.name}`);
  });
  if (repaired.length && typeof toast === 'function') {
    toast(`🔌 CEO religada no cabo que chega nela: ${repaired.join(', ')}`);
  }
}

let lastCtoSignature = null;

/**
 * Cada CTO pertence ao ramal que chega pela fibra em que ela está presa: se a fibra
 * passar a levar outro ramal (troca no tronco ou fusão na CEO), a CTO acompanha.
 * As CTOs de cada ramal ficam em ordem de distância da OLT (CTO 01 é a mais perto).
 */
function syncCTOsWithSignal(offsets) {
  const ramais = {};
  STATE.olts.forEach(pop => (pop.pons || []).forEach(pon => (pon.ramais || []).forEach(r => {
    if (!r.ctos) r.ctos = [];
    ramais[r.id] = r;
  })));

  const distFromOlt = {};
  const signals = {};
  const moves = [];
  Object.values(ramais).forEach(ramal => ramal.ctos.forEach(cto => {
    const cable = cto.lat && cto.cableId ? STATE.cables.find(c => c.id === cto.cableId) : null;
    if (!cable) return;
    if (!cto.fiberIndex) {
      // Legado: CTO sem fibra gravada fica na fibra do cabo que leva o ramal dela
      const f = Object.keys(cable.fiberMapping).find(k => cable.fiberMapping[k] === ramal.id);
      if (f) cto.fiberIndex = parseInt(f);
    }
    if (offsets[cable.id] !== undefined) {
      distFromOlt[cto.id] = offsets[cable.id] + getDistanceAlongCable([cto.lat, cto.lng], cable.path);
    }
    const signal = getCtoSignal(cto).ramalId;
    signals[cto.id] = signal;
    if (signal && signal !== ramal.id && ramais[signal]) moves.push({ cto, from: ramal, to: ramais[signal] });
  }));

  moves.forEach(({ cto, from, to }) => {
    from.ctos.splice(from.ctos.indexOf(cto), 1);
    to.ctos.push(cto);
    cto.type = to.type;
    if (to.type === 'desbalanceado' && !SPLITTER_UNBAL[cto.ratio]) cto.ratio = '10/90';
    if (to.type !== 'desbalanceado' && !SPLITTER_BAL[cto.ratio]) cto.ratio = '1:4';
  });

  // Lançadas na ordem do sinal, depois as lançadas fora da rede, depois as ainda não lançadas
  const rank = cto => distFromOlt[cto.id] !== undefined ? distFromOlt[cto.id] : (cto.lat ? 1e12 : 2e12);
  Object.values(ramais).forEach(ramal => {
    ramal.ctos.sort((a, b) => rank(a) - rank(b));
    ramal.ctos.forEach((cto, i) => {
      if (/^CTO \d+$/.test(cto.name)) cto.name = 'CTO ' + String(i + 1).padStart(2, '0');
    });
  });

  // Redesenha os marcadores só quando algo visível mudou (ramal, ordem, nome ou sinal)
  const signature = JSON.stringify(Object.values(ramais).map(r => [r.id, r.ctos.map(c => [c.id, c.name, signals[c.id] || null])]));
  if (signature !== lastCtoSignature) {
    lastCtoSignature = signature;
    if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
  }
}

/** Destaque (Highlight) no ramal selecionado pelo cabo */
/**
 * Lupa da rota (porta PON): destaca no mapa todos os ramais dela, da OLT até o fim,
 * e aproxima o mapa no caminho. Clicar de novo desliga.
 */
window.highlightPon = function(popId, ponIndex) {
  const key = `pon:${popId}:${ponIndex}`;
  if (window.activeRamalTrace === key) {
    clearHighlight();
    return;
  }
  const pop = STATE.olts.find(o => o.id === popId);
  const pon = pop && (pop.pons || []).find(p => p.index === ponIndex);
  if (!pon) return;

  clearHighlight();
  (pon.ramais || []).forEach(r => highlightRamal(popId, r.id, true));
  window.activeRamalTrace = key;

  const lines = window.activeTraceLines || [];
  if (lines.length === 0) {
    toast('⚠️ Nenhum ramal desta rota está ligado numa fibra do cabo tronco.');
    window.activeRamalTrace = null;
    return;
  }
  map.fitBounds(L.featureGroup(lines).getBounds(), { padding: [40, 40], maxZoom: 18 });
  toast(`🔍 ${pon.rotaName}: ${pon.ramais.length} ramal(is) destacado(s) no mapa`);
}

/** Lupa do ramal. `keep` = soma ao destaque atual (usado pela lupa da rota) */
window.highlightRamal = function(popId, ramalId, keep) {
  // Se clicar na lupa do mesmo ramal já destacado, atua como um botão liga/desliga (toggle)
  if (!keep && window.activeRamalTrace === ramalId) {
    clearHighlight();
    return;
  }

  // Limpa traços anteriores
  if (!keep) {
    if (window.activeTraceLines) {
      window.activeTraceLines.forEach(l => map.removeLayer(l));
    }
    window.activeTraceLines = [];
  }
  window.activeTraceLines = window.activeTraceLines || [];
  window.activeRamalTrace = ramalId; // Memoriza qual ramal está ativo

  // Encontra a cor correta da PON para este ramal e o objeto do ramal
  let routeColor = '#f97316';
  let ramalObj = null;
  const pop = STATE.olts.find(o => o.id === popId);
  if (pop && pop.pons) {
    for (const pon of pop.pons) {
      if (pon.ramais) {
        const found = pon.ramais.find(r => r.id === ramalId);
        if (found) {
          ramalObj = found;
          routeColor = pon.color || '#f97316';
          break;
        }
      }
    }
  }

  // Descobre qual fibra do cabo tronco que sai do POP alimenta este ramal (para usar a cor dela)
  let rootFiberNum = null;
  const rootCables = getPopRootCables(popId);
  for (const rc of rootCables) {
      if (rc.fiberMapping) {
         for (let fn in rc.fiberMapping) {
            if (rc.fiberMapping[fn] === ramalId) {
                rootFiberNum = parseInt(fn);
                break;
            }
         }
      }
      if (rootFiberNum) break;
  }

  if (rootFiberNum) {
      const fiberColorObj = FIBER_COLORS[(rootFiberNum - 1) % FIBER_COLORS.length];
      if (fiberColorObj) routeColor = fiberColorObj.hex;
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
         const cuts = getFiberCuts(c);

         fibersWithRamal.forEach(fNum => {
            const earliestCutSplice = cuts[fNum] ? cuts[fNum].splice : null;

            // Pega a CTO mais distante deste ramal neste cabo
            let furthestCto = null;
            let maxCtoDist = -1;

            if (ramalObj && ramalObj.ctos) {
                ramalObj.ctos.forEach(cto => {
                    if (cto.cableId === c.id && cto.lat && cto.lng) {
                        const dist = getDistanceAlongCable([cto.lat, cto.lng], c.path);
                        if (dist > maxCtoDist) {
                            maxCtoDist = dist;
                            furthestCto = cto;
                        }
                    }
                });
            }

            let pathTrace = c.path;
            if (earliestCutSplice) {
               pathTrace = slicePathTo(c.path, [earliestCutSplice.lat, earliestCutSplice.lng]);
            } else if (furthestCto) {
               // Se a fibra não foi cortada (derivada) e existem CTOs, o sinal "morre" na última CTO
               pathTrace = slicePathTo(c.path, [furthestCto.lat, furthestCto.lng]);
            }

            // Usa a cor da fibra física NESTE cabo específico (para mostrar a mudança de cor nas derivações)
            let physicalColor = routeColor;
            if (typeof FIBER_COLORS !== 'undefined') {
                const fColorObj = FIBER_COLORS[(fNum - 1) % FIBER_COLORS.length];
                if (fColorObj) physicalColor = fColorObj.hex;
            }

            // Cria a linha animada
            const traceLine = L.polyline(pathTrace, {
               color: physicalColor,
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
