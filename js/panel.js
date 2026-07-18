/**
 * panel.js — Renderização do painel lateral direito
 */

/** Troca a aba ativa do painel */
function switchTab(tab) {
  STATE.activeTab = tab;
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  renderPanel();
}

/** Renderiza o conteúdo do painel com base na aba ativa */
function renderPanel() {
  const body = document.getElementById('panelBody');
  switch (STATE.activeTab) {
    case 'props':
      body.innerHTML = renderProps();
      break;
    default:
      body.innerHTML = '';
      break;
  }
  
  // Controle Mobile
  const panel = document.getElementById('panelRight');
  if (panel) {
    if (STATE.selectedId) panel.classList.add('mobile-open');
    else panel.classList.remove('mobile-open');
  }
}

function closeMobilePanel() {
  const panel = document.getElementById('panelRight');
  if (panel) panel.classList.remove('mobile-open');
  STATE.selectedId = null;
  if (typeof updateSelectionStyle === 'function') updateSelectionStyle();
}

function toggleMobilePanel() {
  const panel = document.getElementById('panelRight');
  if (panel) {
    if (panel.classList.contains('mobile-open')) {
      closeMobilePanel();
    } else {
      panel.classList.add('mobile-open');
    }
  }
}

/** Renderiza o conteúdo da aba Propriedades */
function renderProps() {
  const id = STATE.selectedId;

  if (!id) {
    return `<div class="empty-panel">
      <div class="ep-icon">🖱️</div>
      <div class="ep-text">
        Selecione um elemento no mapa para ver suas propriedades.<br><br>
        <strong>Use a ferramenta POP</strong> na barra lateral para colocar um ponto de presença no mapa.
      </div>
    </div>`;
  }

  const pop = STATE.olts.find(o => o.id === id);
  if (pop) return renderPOPProps(pop);

  const cable = STATE.cables.find(c => c.id === id);
  if (cable) return renderCableProps(cable);

  const splice = STATE.splices.find(s => s.id === id);
  if (splice) return renderSpliceProps(splice);

  return '';
}

/** Renderiza as propriedades de um POP selecionado */
function renderPOPProps(pop) {
  const totalPons = pop.ponPorts || 8;
  const configuredCount = pop.pons ? pop.pons.length : 0;

  let html = `
  <div class="panel-section">
    <div class="panel-section-title">🏢 POP / OLT</div>

    <div class="fp-group">
      <label class="fp-label">Nome</label>
      <input class="fp-input" value="${pop.name}"
        onchange="popUpdate('${pop.id}','name',this.value)">
    </div>

    <div class="fp-row">
      <div class="fp-group">
        <label class="fp-label">Portas PON</label>
        <input class="fp-input" type="number" min="1" max="128"
          value="${totalPons}"
          onchange="popUpdate('${pop.id}','ponPorts',parseInt(this.value))">
      </div>
      <div class="fp-group">
        <label class="fp-label">Potência TX (dBm)</label>
        <input class="fp-input" type="number" step=".5"
          value="${pop.outputPower || 4}"
          onchange="popUpdate('${pop.id}','outputPower',parseFloat(this.value))">
      </div>
    </div>

    <div class="fp-group">
      <label class="fp-label">Coordenadas</label>
      <div class="fp-row">
        <input class="fp-input" value="${pop.lat.toFixed(6)}" readonly>
        <input class="fp-input" value="${pop.lng.toFixed(6)}" readonly>
      </div>
    </div>
  </div>`;

  // ============================================================
  //  SEÇÃO DE PORTAS PON / ROTAS
  // ============================================================
  html += `
  <div class="panel-section">
    <div class="panel-section-title">
      🔌 Portas PON — Rotas
      <span style="float:right; font-size:10px; color:var(--text2); text-transform:none; letter-spacing:0">
        ${configuredCount} / ${totalPons} configuradas
      </span>
    </div>`;

  for (let i = 1; i <= totalPons; i++) {
    const pon = pop.pons ? pop.pons.find(p => p.index === i) : null;

    if (pon) {
      // ── PON CONFIGURADA ──
      html += `
      <div class="pon-card configured">
        <div class="pon-color-bar" style="background:${pon.color}"></div>
        <div class="pon-content">
          <div class="pon-header">
            <span class="pon-badge" style="background:${pon.color}20; color:${pon.color}; border:1px solid ${pon.color}44">
              PON ${String(i).padStart(2, '0')}
            </span>
            <button class="pon-remove-btn" onclick="removePonRota('${pop.id}', ${i})" title="Liberar porta">✕</button>
          </div>
          <div class="pon-field">
            <label>Nome da Rota</label>
            <input type="text" value="${pon.rotaName}"
              onchange="updatePonRota('${pop.id}', ${i}, 'rotaName', this.value)">
          </div>
          <div class="pon-field-row">
            <div class="pon-field" style="flex:1">
              <label>Cor da Rota</label>
              <select onchange="updatePonRota('${pop.id}', ${i}, 'color', this.value)">
                ${ROUTE_COLORS.map(c =>
                  `<option value="${c.hex}" ${pon.color === c.hex ? 'selected' : ''}
                    style="color:${c.hex}">${c.name}</option>`
                ).join('')}
              </select>
            </div>
          </div>
          
          <!-- INICIO RAMAIS -->
          <div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="font-size:10px; font-weight:700; color:var(--text3)">🌿 RAMAIS (DISTRIBUIÇÃO)</span>
              <button class="pon-remove-btn" style="font-size:10px; color:var(--primary); font-weight:600;" onclick="addRamal('${pop.id}', ${i})">+ Adicionar Ramal</button>
            </div>
            
            ${(pon.ramais || []).map(ramal => {
              // Calculamos o sinal das CTOs!
              const cascadeResults = typeof calculateOpticalCascade === 'function' 
                ? calculateOpticalCascade(pop.outputPower || 4, ramal.ctos || []) 
                : [];
              
              let ramalHtml = `
              <div style="background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px; align-items:center;">
                  <input type="text" value="${ramal.name}" style="background:transparent; border:none; color:var(--text); font-size:11px; font-weight:700; width:140px; padding:2px;" onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'name', this.value)">
                  <button class="pon-remove-btn" onclick="removeRamal('${pop.id}', ${i}, '${ramal.id}')">✕</button>
                </div>
                
                <div class="pon-field-row" style="margin-bottom:8px;">
                  <div class="pon-field" style="flex:1">
                    <label>Topologia</label>
                    <select onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'type', this.value)">
                      <option value="desbalanceado" ${ramal.type === 'desbalanceado' ? 'selected' : ''}>Desbalanceada</option>
                      <option value="balanceado" ${ramal.type === 'balanceado' ? 'selected' : ''}>Balanceada</option>
                    </select>
                  </div>
                  <div class="pon-field" style="flex:1">
                    <label>CTO (Splitter)</label>
                    <select onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'attSplitter', this.value)">
                      <option value="1:8" ${ramal.attSplitter === '1:8' ? 'selected' : ''}>1:8</option>
                      <option value="1:16" ${ramal.attSplitter === '1:16' ? 'selected' : ''}>1:16</option>
                    </select>
                  </div>
                </div>
                
                <div class="pon-field-row" style="margin-bottom:8px; align-items:flex-end;">
                  <div class="pon-field" style="flex:1">
                    <label>Quantidade de CTOs</label>
                    <input type="number" min="1" max="32" id="qtde_cto_${ramal.id}" placeholder="Ex: 5" value="${ramal.ctos ? ramal.ctos.length : ''}">
                  </div>
                  <button class="btn-full primary" style="flex:1; margin-bottom:0;" onclick="generateRamalCTOs('${pop.id}', ${i}, '${ramal.id}', parseInt(document.getElementById('qtde_cto_${ramal.id}').value))">🪄 Gerar / Calcular</button>
                </div>
              `;
              
              if(ramal.ctos && ramal.ctos.length > 0) {
                 ramalHtml += `<div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
                   <div style="font-size:11px; font-weight:700; color:var(--primary); margin-bottom:8px;">
                     📦 CTOs Lançadas no Mapa: ${ramal.ctos.filter(c => c.lat).length} / ${ramal.ctos.length}
                   </div>
                   <div style="font-size:9px; color:var(--text2); display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700; gap:4px;">
                     <span style="flex:1">CTO</span>
                     <span style="flex:1">Split Entrada</span>
                     <span style="flex:1; text-align:right">Sinal</span>
                   </div>
                 `;
                 
                 ramal.ctos.forEach((cto, idx) => {
                   const res = cascadeResults[idx];
                   const rxVal = res ? parseFloat(res.rx) : 0;
                   const isBad = rxVal < -25;
                   const isWarn = rxVal > -15 || (rxVal < -23 && rxVal >= -25);
                   const colorStyle = isBad ? 'color:var(--red)' : isWarn ? 'color:var(--yellow)' : 'color:var(--green)';
                   
                   let ratioSelect = `<select style="font-size:10px; padding:2px; background:var(--surface2); border:1px solid var(--border); color:var(--text); border-radius:3px; outline:none; width:100%;" onchange="updateCTORatio('${pop.id}', ${i}, '${ramal.id}', ${idx}, this.value)">`;
                   if (ramal.type === 'desbalanceado') {
                      Object.keys(SPLITTER_UNBAL).forEach(k => {
                        ratioSelect += `<option value="${k}" ${cto.ratio === k ? 'selected' : ''}>${k}</option>`;
                      });
                   } else {
                      Object.keys(SPLITTER_BAL).forEach(k => {
                        ratioSelect += `<option value="${k}" ${cto.ratio === k ? 'selected' : ''}>${k}</option>`;
                      });
                   }
                   ratioSelect += `</select>`;
                   
                   ramalHtml += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:10px; gap:4px;">
                     <span style="display:flex; align-items:center; flex:1; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${cto.name}">
                       ${cto.name}
                     </span>
                     <span style="flex:1">${ratioSelect}</span>
                     <span style="flex:1; text-align:right; font-weight:700; ${colorStyle}">${res ? res.rx + ' dBm' : '--'}</span>
                   </div>`;
                 });
                 ramalHtml += `</div>`;
              }
              
              ramalHtml += `</div>`;
              return ramalHtml;
            }).join('')}
            
          </div>
          <!-- FIM RAMAIS -->

        </div>
      </div>`;
    } else {
      // ── PON LIVRE ──
      html += `
      <div class="pon-card free" onclick="addPonRota('${pop.id}', ${i})">
        <div class="pon-color-bar" style="background:var(--border)"></div>
        <div class="pon-content">
          <span class="pon-badge free-badge">PON ${String(i).padStart(2, '0')}</span>
          <span class="pon-free-text">Livre — clique para configurar rota</span>
        </div>
      </div>`;
    }
  }

  html += `</div>`;

  // Botão remover POP
  html += `
  <button class="btn-full danger" onclick="deleteElement('${pop.id}')">
    🗑️ Remover POP
  </button>`;

  return html;
}

// ================================================================
//  SELEÇÃO E DELEÇÃO
// ================================================================

/** Lida com o clique em um elemento do mapa */
function handleElementClick(id, latlng) {
  if (STATE.tool === 'eraser') {
    deleteElement(id);
    return;
  }
  if (latlng) STATE.clickedLatLng = latlng;
  selectElement(id);
}

/** Seleciona um elemento e atualiza o painel */
function selectElement(id) {
  STATE.selectedId = id;
  renderPanel();
}

/** Deleta um elemento do mapa e do estado */
function deleteElement(id) {
  const pop = STATE.olts.find(o => o.id === id);
  if (pop) {
    map.removeLayer(pop.layer);
    STATE.olts = STATE.olts.filter(o => o.id !== id);
    toast('🗑️ POP removido');
  }

  if (STATE.selectedId === id) STATE.selectedId = null;
  updateStatusBar();
  renderPanel();
  saveLocal();
}

/** Renderiza as propriedades de um Cabo selecionado */
function renderCableProps(cable) {
  let originName = 'Origem Desconhecida';
  let rootPopId = null;
  let allRamais = [];

  if (cable.sourceType === 'pop' || cable.popId) {
     const pId = cable.sourceId || cable.popId;
     const pop = STATE.olts.find(o => o.id === pId);
     if (pop) {
       originName = 'POP: ' + pop.name;
       rootPopId = pop.id;
       pop.pons.forEach(pon => {
         if(pon.ramais) pon.ramais.forEach(r => allRamais.push({ id: r.id, name: `${pon.rotaName} - ${r.name}`, color: pon.color }));
       });
     }
  } else if (cable.sourceType === 'splice') {
     const splice = STATE.splices.find(s => s.id === cable.sourceId);
     if (splice) {
       originName = 'CEO: ' + splice.name;
       let currentCable = STATE.cables.find(c => c.id === splice.cableId);
       while (currentCable && currentCable.sourceType === 'splice') {
           const parentSplice = STATE.splices.find(s => s.id === currentCable.sourceId);
           if (!parentSplice) break;
           currentCable = STATE.cables.find(c => c.id === parentSplice.cableId);
       }
       if (currentCable && (currentCable.sourceType === 'pop' || currentCable.popId)) {
           const pop = STATE.olts.find(o => o.id === (currentCable.sourceId || currentCable.popId));
           if (pop) {
             rootPopId = pop.id;
             pop.pons.forEach(pon => {
               if(pon.ramais) pon.ramais.forEach(r => allRamais.push({ id: r.id, name: `${pon.rotaName} - ${r.name}`, color: pon.color }));
             });
           }
       }
     }
  }

  let html = `
    <div class="prop-group">
      <label>Nome do Cabo</label>
      <input type="text" class="input-full" value="${cable.name}" onchange="cableUpdate('${cable.id}', 'name', this.value)">
    </div>
    <div style="font-size:10px; opacity:0.8; margin-bottom:10px;">${originName}</div>
    
    <div class="prop-group">
      <label>Capacidade (Fibras)</label>
      <select class="input-full" onchange="cableUpdate('${cable.id}', 'fibers', parseInt(this.value))">
        ${[2, 4, 6, 12, 24, 36, 48, 72, 144].map(v => `<option value="${v}" ${cable.fibers === v ? 'selected' : ''}>${v} Fibras (FO)</option>`).join('')}
      </select>
    </div>
    
    <hr style="border:0; border-top:1px dashed var(--border); margin:15px 0;">
    <h3 style="margin-bottom:10px; font-size:12px; color:var(--text); text-transform:uppercase;">Alocação de Fibras</h3>
  `;
  
  html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
  
  // Calculate click distance
  let clickDist = 0;
  if (STATE.clickedLatLng) {
    clickDist = getDistanceAlongCable(STATE.clickedLatLng, cable.path);
  }

  // Busca CEOs conectadas a este cabo e pre-calcula distâncias
  const cableSplices = STATE.splices
    .filter(s => s.cableId === cable.id)
    .map(s => ({ ...s, dist: getDistanceAlongCable([s.lat, s.lng], cable.path) }));

  for(let i=1; i<=cable.fibers; i++) {
    const cIdx = (i - 1) % FIBER_COLORS.length;
    const fColor = FIBER_COLORS[cIdx];
    const mappedRamalId = cable.fiberMapping[i] || '';
    
    let earliestCutSplice = null;
    let minCutDist = Infinity;

    for (const sp of cableSplices) {
       if (sp.fusions) {
          for (const dCId in sp.fusions) {
             for (const dFib in sp.fusions[dCId]) {
                 if (sp.fusions[dCId][dFib] == i) {
                     if (sp.dist < minCutDist) {
                        minCutDist = sp.dist;
                        earliestCutSplice = sp;
                     }
                 }
             }
          }
       }
    }

    // A fibra morre 1 metro após a CEO.
    let isDeadAtClick = earliestCutSplice && (clickDist > minCutDist + 1);

    if (isDeadAtClick) {
      // Fibra morta (após a CEO) - SEM SELECTOR DE RAMAL
      html += `
        <div style="display:flex; align-items:center; gap:10px; background:var(--surface2); padding:6px; border-radius:6px; border:1px solid #dc2626; opacity:0.8;">
          <div style="width:16px; height:16px; border-radius:50%; background:${fColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:600; margin-bottom:2px; color:var(--text2)">Tubo/Fibra ${i} (${fColor.name})</div>
            <div style="width:100%; font-size:11px; padding:4px; background:rgba(220, 38, 38, 0.1); border:1px solid rgba(220, 38, 38, 0.4); color:#ef4444; border-radius:4px;">
              ✂️ Cortada (Sangria na ${earliestCutSplice.name})
            </div>
          </div>
          <div style="width:52px"></div>
        </div>
      `;
    } else {
      // Fibra normal
      let options = `<option value="">-- Livre --</option>`;
      allRamais.forEach(r => {
        options += `<option value="${r.id}" ${mappedRamalId === r.id ? 'selected' : ''}>${r.name}</option>`;
      });

      html += `
        <div style="display:flex; align-items:center; gap:10px; background:var(--surface2); padding:6px; border-radius:6px; border:1px solid var(--border);">
          <div style="width:16px; height:16px; border-radius:50%; background:${fColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:600; margin-bottom:2px; color:var(--text2)">Tubo/Fibra ${i} (${fColor.name})</div>
            <select style="width:100%; font-size:11px; padding:4px; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px; outline:none;" 
                    onchange="setFiberMapping('${cable.id}', ${i}, this.value)">
              ${options}
            </select>
          </div>
          ${mappedRamalId && rootPopId ? `
            <div style="display:flex;">
              <button onclick="highlightRamal('${rootPopId}', '${mappedRamalId}')" title="Destacar ramal no cabo" style="background:none; border:none; cursor:pointer; font-size:14px; padding:4px;">🔍</button>
              <button onclick="preparePlaceCTO('${rootPopId}', '${mappedRamalId}', '${cable.id}')" title="Lançar CTOs no mapa" style="background:none; border:none; cursor:pointer; font-size:14px; padding:4px;">📦</button>
            </div>
          ` : `<div style="width:52px"></div>`}
        </div>
      `;
    }
  }
  
  html += `</div>`;
  
  html += `
    <div style="margin-top:15px;">
      <button class="btn-full" onclick="clearHighlight()">🧹 Limpar Destaques</button>
    </div>
  `;

  return html;
}


function renderSpliceProps(splice) {
  if (!splice.fusions) splice.fusions = {};
  const sourceCable = STATE.cables.find(c => c.id === splice.cableId);
  const derivedCables = STATE.cables.filter(c => c.sourceType === 'splice' && c.sourceId === splice.id);
  
  let html = `
    <div class="panel-header">
      <div style="font-size:14px; margin-bottom:5px; display:flex; align-items:center; gap:6px;">
        <img src="img/ceo.svg" style="width:16px; height:16px;" alt="CEO"> ${splice.name}
      </div>
      <div style="font-size:10px; opacity:0.8;">Painel de Fusão Kanban (Arrastar e Soltar)</div>
    </div>
    
    <div style="padding:15px;">
      <button class="btn-full primary" style="margin-bottom:15px;" onclick="startCableFromSplice('${splice.id}')">
        🔌 Lançar Cabo Derivado
      </button>
  `;

  if (derivedCables.length === 0) {
      html += `<div style="font-size:11px; color:var(--text2); text-align:center; padding:20px;">Nenhum cabo derivado ainda. Lance um cabo derivado para começar a fusão.</div></div>`;
      return html;
  }

  // Draw Kanban Board for each derived cable
  derivedCables.forEach(dc => {
    html += `
      <div style="background:var(--surface2); border:1px solid var(--border); border-radius:8px; margin-bottom:15px; padding:10px;">
        <div style="text-align:center; font-size:11px; font-weight:bold; margin-bottom:10px; color:var(--text);">Fusão: ${sourceCable ? sourceCable.name : 'Tronco'} ➡️ ${dc.name}</div>
        <div style="display:flex; gap:10px;">
          
          <!-- Left Column (Trunk Fibers) -->
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; border-right:1px dashed var(--border); padding-right:10px;">
            <div style="font-size:10px; text-align:center; color:var(--text2); margin-bottom:4px;">Cabo Tronco (Arraste)</div>
    `;
    
    // Check which trunk fibers are already used in THIS splice
    const usedTrunkFibers = {};
    derivedCables.forEach(ddc => {
       if (splice.fusions[ddc.id]) {
          Object.values(splice.fusions[ddc.id]).forEach(f => usedTrunkFibers[f] = true);
       }
    });

    const trunkFibers = sourceCable ? sourceCable.fibers : 12;
    for (let j = 1; j <= trunkFibers; j++) {
       const srcFColor = FIBER_COLORS[(j-1) % FIBER_COLORS.length];
       if (usedTrunkFibers[j]) {
          html += `
            <div style="padding:6px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2); display:flex; align-items:center; gap:6px; opacity:0.5;">
              <div style="width:12px; height:12px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:10px; color:var(--text2)">F${j} (Em uso)</span>
            </div>
          `;
       } else {
          html += `
            <div draggable="true" ondragstart="dragFiber(event, ${j})" style="padding:6px; border-radius:4px; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; gap:6px; cursor:grab; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              <div style="width:12px; height:12px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:10px; font-weight:600;">F${j} - ${srcFColor.name}</span>
            </div>
          `;
       }
    }

    html += `</div>
          <!-- Right Column (Derived Fibers) -->
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding-left:10px;">
            <div style="font-size:10px; text-align:center; color:var(--text2); margin-bottom:4px;">Cabo Derivado (Solte Aqui)</div>
    `;

    for (let i = 1; i <= dc.fibers; i++) {
       const subFColor = FIBER_COLORS[(i-1) % FIBER_COLORS.length];
       const currentSrcFiber = splice.fusions[dc.id] ? splice.fusions[dc.id][i] : null;
       
       if (currentSrcFiber) {
           const srcFColor = FIBER_COLORS[(currentSrcFiber-1) % FIBER_COLORS.length];
           html += `
             <div style="padding:6px; border-radius:4px; border:1px solid #f97316; background:rgba(249, 115, 22, 0.15); display:flex; justify-content:space-between; align-items:center;">
               <div style="display:flex; align-items:center; gap:4px;">
                 <div style="width:8px; height:8px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
                 <span style="font-size:10px; font-weight:bold; color:#fdba74;">F${currentSrcFiber} ➡️ F${i}</span>
                 <div style="width:8px; height:8px; border-radius:50%; background:${subFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
               </div>
               <button onclick="removeFusion('${splice.id}', '${dc.id}', ${i})" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:12px; display:flex; align-items:center; justify-content:center; width:20px; height:20px;" title="Desfazer Fusão">✖</button>
             </div>
           `;
       } else {
           html += `
             <div ondragover="allowDrop(event)" ondrop="dropFiber(event, '${splice.id}', '${dc.id}', ${i})" 
                  style="padding:6px; border-radius:4px; border:1px dashed var(--border); background:rgba(255,255,255,0.02); display:flex; align-items:center; gap:6px; min-height:28px;">
               <div style="width:12px; height:12px; border-radius:50%; background:${subFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
               <span style="font-size:10px; color:var(--text2)">F${i} (Solte a fibra)</span>
             </div>
           `;
       }
    }

    html += `</div></div></div>`;
  });

  html += `</div>`;
  return html;
}

// Funções de Arrastar e Soltar (Kanban)
window.dragFiber = function(ev, srcFiberIndex) {
  ev.dataTransfer.setData("srcFiber", srcFiberIndex);
}

window.allowDrop = function(ev) {
  ev.preventDefault();
}

window.dropFiber = function(ev, spliceId, destCableId, destFiberIndex) {
  ev.preventDefault();
  const srcFiber = ev.dataTransfer.getData("srcFiber");
  if (srcFiber) {
    setFusion(spliceId, destCableId, destFiberIndex, srcFiber);
  }
}

window.removeFusion = function(spliceId, destCableId, destFiberIndex) {
  setFusion(spliceId, destCableId, destFiberIndex, null);
}

window.setFusion = function(spliceId, destCableId, destFiber, srcFiber) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (splice) {
      if (!splice.fusions) splice.fusions = {};
      if (!splice.fusions[destCableId]) splice.fusions[destCableId] = {};
      if (srcFiber) {
         splice.fusions[destCableId][destFiber] = parseInt(srcFiber);
      } else {
         delete splice.fusions[destCableId][destFiber];
      }
      saveLocal();
      toast('🔗 Matriz de fusão atualizada!');
      renderPanel();
   }
}
