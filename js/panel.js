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

  // Verifica se é uma CTO
  let ctoContext = null;
  STATE.olts.forEach(pop => {
    (pop.pons || []).forEach(pon => {
      (pon.ramais || []).forEach(ramal => {
        (ramal.ctos || []).forEach(cto => {
          if (cto.id === id) {
            ctoContext = { pop, pon, ramal, cto };
          }
        });
      });
    });
  });
  
  if (ctoContext) return renderCTOProps(ctoContext.cto, ctoContext.pop, ctoContext.pon, ctoContext.ramal);

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
    
    <div class="fp-group">
      <label class="fp-label">Observações</label>
      <textarea class="fp-input" style="height:60px; resize:vertical;" 
        onchange="popUpdate('${pop.id}','obs',this.value)">${pop.obs || ''}</textarea>
    </div>

    ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(pop.id) : ''}
  </div>`;

  // ============================================================
  //  SEÇÃO DE PORTAS PON / ROTAS
  // ============================================================
  const rootCables = STATE.cables.filter(c => c.sourceType === 'pop' && c.sourceId === pop.id);

  // CABOS RESUMO
  if (rootCables.length > 0) {
    html += `
    <div class="panel-section" style="margin-bottom:15px; border-radius:8px; background:var(--surface2); border:1px solid var(--border);">
      <div class="panel-section-title" style="padding:10px 15px; border-bottom:1px solid var(--border); font-size:11px; text-transform:uppercase; color:var(--primary); margin:0;">
        📊 Resumo de Cabos Tronco
      </div>
      <div style="padding:10px 15px; display:flex; flex-direction:column; gap:10px;">
    `;
    
    rootCables.forEach(cable => {
      let allocatedFibers = 0;
      let ramaisNames = [];
      
      for(let i=1; i<=cable.fibers; i++) {
         if (cable.fiberMapping && cable.fiberMapping[i]) {
            allocatedFibers++;
            let rId = cable.fiberMapping[i];
            let rName = 'Desconhecido';
            (pop.pons || []).forEach(p => {
               const r = p.ramais?.find(rr => rr.id === rId);
               if (r) rName = `${p.rotaName} - ${r.name}`;
            });
            ramaisNames.push(`<span style="font-size:10px; padding:2px 4px; background:var(--bg); border-radius:4px; border:1px solid var(--border); color:var(--text2); display:inline-block; margin:2px;">T${i}: ${rName}</span>`);
         }
      }
      
      html += `
        <div>
          <div style="font-size:11px; font-weight:700; color:var(--text); margin-bottom:4px;">
            🧵 ${cable.name} <span style="font-weight:normal; color:var(--text3);">(${allocatedFibers}/${cable.fibers} FO)</span>
          </div>
          <div>${ramaisNames.length > 0 ? ramaisNames.join('') : '<span style="font-size:10px; color:var(--text3); font-style:italic;">Nenhum ramal alocado</span>'}</div>
        </div>
      `;
    });
    
    html += `</div></div>`;
  }

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
      const detailsKey = `${pop.id}_pon_${i}`;
      const isOpen = window.openPonDetails && window.openPonDetails[detailsKey] ? 'open' : '';
      
      html += `
      <details class="pon-card configured" ${isOpen} ontoggle="window.openPonDetails = window.openPonDetails || {}; window.openPonDetails['${detailsKey}'] = this.open" style="display:block; padding:0; border:1px solid var(--border); background:var(--bg); border-radius:8px; margin-bottom:10px;">
        <summary class="pon-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px; cursor:pointer; list-style:none; outline:none; user-select:none;">
          <div style="display:flex; align-items:center; gap:10px;">
             <div class="pon-color-bar" style="background:${pon.color}; width:6px; height:24px; border-radius:3px;"></div>
             <span class="pon-badge" style="background:${pon.color}20; color:${pon.color}; border:1px solid ${pon.color}44">
               PON ${String(i).padStart(2, '0')}
             </span>
             <span style="font-size:11px; font-weight:600; color:var(--text2);">${pon.rotaName} (${(pon.ramais||[]).length} ramais)</span>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
             <span style="font-size:10px; color:var(--text3);">▼ expandir</span>
             <button class="pon-remove-btn" onclick="removePonRota('${pop.id}', ${i})" title="Liberar porta">✕</button>
          </div>
        </summary>
        <div class="pon-content" style="padding:0 10px 10px 10px; border-top:1px solid var(--border); margin-top:5px; padding-top:10px;">
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
                  <input type="text" value="${ramal.name}" style="background:transparent; border:none; color:var(--text); font-size:11px; font-weight:700; width:120px; padding:2px;" onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'name', this.value)">
                  <div style="display:flex; gap:4px;">
                    <button class="pon-remove-btn" onclick="highlightRamal('${pop.id}', '${ramal.id}')" title="Rastrear Ramal no mapa" style="color:var(--primary);">🔍</button>
                    <button class="pon-remove-btn" onclick="removeRamal('${pop.id}', ${i}, '${ramal.id}')" title="Excluir Ramal">✕</button>
                  </div>
                </div>
                
                <div class="pon-field-row" style="margin-bottom:8px;">
                  <div class="pon-field" style="flex:1">
                    <label>Cabo Tronco (Saída)</label>
                    <select onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'cableId', this.value)">
                      <option value="">Automático (Sequencial)</option>
                      ${rootCables.map(c => `<option value="${c.id}" ${ramal.cableId === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                  </div>
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
      </details>`;
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

  // Botões de ação do POP
  html += `
  <div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">
    <button class="btn-full" style="background:var(--surface2);" onclick="clearHighlight()">🧹 Limpar Rastreamento</button>
    <button class="btn-full danger" onclick="deleteElement('${pop.id}')">
      🗑️ Remover POP
    </button>
  </div>`;

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
              <button onclick="preparePlaceCTO('${rootPopId}', '${mappedRamalId}', '${cable.id}', ${i})" title="Lançar CTOs no mapa" style="background:none; border:none; cursor:pointer; font-size:14px; padding:4px;">📦</button>
            </div>
          ` : `<div style="width:52px"></div>`}
        </div>
      `;
    }
  }
  
  html += `</div>`;
  
  html += `
    <div style="margin-top:15px; display:flex; flex-direction:column; gap:8px;">
      <button class="btn-full primary" onclick="resumeCableDraw('${cable.id}')">
        ${currentEditingCableId === cable.id ? '🛑 Parar Traçado' : '➕ Continuar Traçado (Ponta)'}
      </button>
      <button class="btn-full" style="background:var(--surface2); border:1px solid var(--border); color:var(--text);" onclick="toggleGeomanEditCable('${cable.id}')">
        ${(typeof isGeomanEditingCableId !== 'undefined' && isGeomanEditingCableId === cable.id) ? '💾 Salvar Ajuste Fino' : '✏️ Ajuste Fino (Meio/Pontas)'}
      </button>
      <button class="btn-full" style="background:#dc262622; color:#ef4444; border:1px solid #dc262644;" onclick="removeCable('${cable.id}')">🗑️ Excluir Cabo</button>
    </div>
  `;

  return html;
}


function renderSpliceProps(splice) {
  if (!splice.fusions) splice.fusions = {};
  const sourceCable = STATE.cables.find(c => c.id === splice.cableId);
  const derivedCables = STATE.cables.filter(c => c.sourceType === 'splice' && c.sourceId === splice.id);
  
  let html = `
    <div class="panel-section">
      <div class="panel-section-title">
        <img src="img/ceo.svg" style="width:16px; height:16px; margin-right:5px; vertical-align:middle;" alt="CEO"> CEO / Emenda
      </div>
      
      <div class="fp-group">
        <label class="fp-label">Nome da Caixa</label>
        <input class="fp-input" value="${splice.name}"
          onchange="updateSpliceField('${splice.id}','name',this.value)">
      </div>
      
      <div class="fp-group">
        <label class="fp-label">Observações</label>
        <textarea class="fp-input" style="height:60px; resize:vertical;" 
          onchange="updateSpliceField('${splice.id}','obs',this.value)">${splice.obs || ''}</textarea>
      </div>

      <!-- PAINEL DO SPLITTER FÍSICO NA CEO -->
      <div class="fp-group" style="background:var(--bg3); padding:10px; border-radius:6px; border:1px solid var(--border);">
        <div style="font-size:12px; font-weight:bold; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>🎛️ Splitter Balanceado</span>
        </div>
        <label class="fp-label" style="font-size:10px;">Instalar Splitter (Desconecta fusões caso o tamanho mude)</label>
        <select class="fp-input" onchange="installSplitterInSplice('${splice.id}', this.value)">
          <option value="" ${!splice.splitter ? 'selected' : ''}>Nenhum Splitter Instalado</option>
          <option value="4" ${splice.splitter && splice.splitter.outputs === 4 ? 'selected' : ''}>Splitter 1:4</option>
          <option value="8" ${splice.splitter && splice.splitter.outputs === 8 ? 'selected' : ''}>Splitter 1:8</option>
          <option value="16" ${splice.splitter && splice.splitter.outputs === 16 ? 'selected' : ''}>Splitter 1:16</option>
        </select>
      </div>

      ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(splice.id) : ''}
    </div>

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
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; border-right:1px dashed var(--border); padding-right:5px;">
            <div style="font-size:10px; text-align:center; color:var(--text2); margin-bottom:4px; line-height:1.3;">
              <b style="color:var(--text1)">${sourceCable ? sourceCable.name : 'Cabo Tronco'}</b><br>
              ${sourceCable ? `<span style="font-size:8px; color:var(--primary);">${sourceCable.fibers} FO</span>` : ''}
            </div>
    `;
    
    // Check how many times each trunk fiber is used in THIS splice
    const trunkFiberUses = {};
    derivedCables.forEach(ddc => {
       if (splice.fusions[ddc.id]) {
          Object.values(splice.fusions[ddc.id]).forEach(f => {
              if (typeof f === 'number' || !isNaN(f)) {
                  trunkFiberUses[f] = (trunkFiberUses[f] || 0) + 1;
              }
              if (typeof f === 'string' && f.startsWith('S')) {
                  trunkFiberUses[f] = true;
              }
          });
       }
    });

    // Check which trunk fibers are cut in upstream splices OR used in downstream splices
    const cutUpstreamFibers = {};
    const usedDownstreamFibers = {};
    if (sourceCable && typeof getDistanceAlongCable === 'function') {
      const thisSpliceDist = getDistanceAlongCable([splice.lat, splice.lng], sourceCable.path);
      STATE.splices.forEach(s => {
        if (s.cableId === splice.cableId && s.id !== splice.id && s.fusions) {
          const sDist = getDistanceAlongCable([s.lat, s.lng], sourceCable.path);
          if (sDist < thisSpliceDist) {
            Object.values(s.fusions).forEach(cableFusions => {
               Object.values(cableFusions).forEach(f => cutUpstreamFibers[f] = true);
            });
            if (s.splitter && s.splitter.inputFiber) cutUpstreamFibers[s.splitter.inputFiber] = true;
          } else if (sDist > thisSpliceDist) {
            Object.values(s.fusions).forEach(cableFusions => {
               Object.values(cableFusions).forEach(f => usedDownstreamFibers[f] = true);
            });
            if (s.splitter && s.splitter.inputFiber) usedDownstreamFibers[s.splitter.inputFiber] = true;
          }
        }
      });
    }

    // Renderiza as Fibras do Tronco
    const trunkFibers = sourceCable ? sourceCable.fibers : 12;
    for (let j = 1; j <= trunkFibers; j++) {
       const srcFColor = FIBER_COLORS[(j-1) % FIBER_COLORS.length];
       
       let isInputFiber = (splice.splitter && splice.splitter.inputFiber == j);
       let limit = 1; // Straight fusion limit
       let uses = trunkFiberUses[j] || 0;
       
       if (isInputFiber) {
          html += `
            <div style="padding:4px; border-radius:4px; border:1px solid rgba(168, 85, 247, 0.4); background:rgba(168, 85, 247, 0.1); display:flex; align-items:center; gap:6px; opacity:0.8;" title="No Splitter">
              <div style="width:10px; height:10px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:9px; color:#d8b4fe; font-weight:bold;">F${j} (No Splitter)</span>
            </div>
          `;
       } else if (uses >= limit) {
          html += `
            <div style="padding:4px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2); display:flex; align-items:center; gap:6px; opacity:0.5;">
              <div style="width:10px; height:10px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:9px; color:var(--text2)">F${j} (Usada)</span>
            </div>
          `;
       } else if (cutUpstreamFibers[j]) {
          html += `
            <div style="padding:4px; border-radius:4px; border:1px solid rgba(239,68,68,0.2); background:rgba(239,68,68,0.05); display:flex; align-items:center; gap:6px; opacity:0.6;" title="Cortada Antes">
              <div style="width:10px; height:10px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:9px; color:var(--red)">F${j} (Cortada)</span>
            </div>
          `;
       } else if (usedDownstreamFibers[j]) {
          html += `
            <div draggable="true" ondragstart="dragFiber(event, ${j})" style="padding:4px; border-radius:4px; border:1px solid #eab308; background:rgba(234, 179, 8, 0.1); display:flex; align-items:center; gap:6px; cursor:grab; box-shadow:0 2px 4px rgba(0,0,0,0.2);" title="Usada na Frente">
              <div style="width:10px; height:10px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:9px; font-weight:600; color:#ca8a04;">F${j} (Na frente)</span>
            </div>
          `;
       } else {
          html += `
            <div draggable="true" ondragstart="dragFiber(event, ${j})" style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--surface); display:flex; align-items:center; gap:6px; cursor:grab; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
              <div style="width:10px; height:10px; border-radius:50%; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size:9px; font-weight:600;">F${j} - ${srcFColor.name}</span>
            </div>
          `;
       }
    }

    html += `</div>`;
    
    // Middle Column (Splitter)
    if (splice.splitter) {
        html += `
          <!-- Middle Column (Splitter) -->
          <div style="flex:1.2; display:flex; flex-direction:column; align-items:center; border-right:1px dashed var(--border); padding:0 5px;">
            <div style="font-size:10px; font-weight:bold; color:var(--primary); margin-bottom:8px; display:flex; align-items:center; gap:4px;">
              <div style="width:0; height:0; border-top:6px solid transparent; border-bottom:6px solid transparent; border-left:8px solid var(--primary);"></div>
              Splitter 1:${splice.splitter.outputs}
            </div>
            
            <!-- Entrada do Splitter -->
            <div class="fusion-drop-zone" ondrop="dropFiberToSplitter(event, '${splice.id}')" ondragover="allowDrop(event)" style="width:100%; text-align:center; padding:8px; border:1px dashed ${splice.splitter.inputFiber ? 'var(--primary)' : 'var(--text2)'}; border-radius:4px; margin-bottom:10px; background:var(--surface2);">
              <div style="font-size:8px; color:var(--text2); margin-bottom:4px;">ENTRADA (IN)</div>
        `;
        
        if (splice.splitter.inputFiber) {
            const inf = splice.splitter.inputFiber;
            const infColor = FIBER_COLORS[(inf-1) % FIBER_COLORS.length];
            html += `
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(168, 85, 247, 0.15); padding:4px 8px; border-radius:4px; border:1px solid rgba(168, 85, 247, 0.4);">
                <div style="width:10px; height:10px; border-radius:50%; background:${infColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
                <span style="font-size:10px; font-weight:bold; color:#d8b4fe;">F${inf}</span>
                <span onclick="removeSplitterInput('${splice.id}')" style="cursor:pointer; color:#ef4444; font-size:10px; margin-left:4px; font-weight:bold;" title="Remover Fibra">✕</span>
              </div>
            `;
        } else {
            html += `<div style="font-size:9px; color:var(--text2);">Arraste a Fibra Tronco aqui</div>`;
        }
        
        html += `</div>
            <!-- Saídas do Splitter -->
            <div style="font-size:8px; color:var(--text2); margin-bottom:4px;">SAÍDAS (OUT)</div>
            <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:4px;">
        `;
        
        for (let j = 1; j <= splice.splitter.outputs; j++) {
            const sId = 'S' + j;
            const outColor = typeof FIBER_COLORS !== 'undefined' ? FIBER_COLORS[(j-1) % FIBER_COLORS.length] : { hex: 'var(--primary)', name: '' };
            
            if (trunkFiberUses[sId]) {
               html += `
                 <div style="padding:4px; border-radius:4px; border:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2); display:flex; align-items:center; gap:4px; opacity:0.5;">
                   <div style="width:8px; height:8px; border-radius:50%; background:${outColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
                   <span style="font-size:8px; color:var(--text2)">OUT ${j} (${outColor.name})</span>
                 </div>
               `;
            } else if (!splice.splitter.inputFiber) {
               html += `
                 <div style="padding:4px; border-radius:4px; border:1px solid var(--border); background:var(--surface2); display:flex; align-items:center; gap:4px; opacity:0.3;" title="Alimente o splitter primeiro!">
                   <div style="width:8px; height:8px; border-radius:50%; background:${outColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
                   <span style="font-size:8px; color:var(--text2)">OUT ${j} (${outColor.name})</span>
                 </div>
               `;
            } else {
               html += `
                 <div draggable="true" ondragstart="dragFiber(event, '${sId}')" style="padding:4px; border-radius:4px; border:1px solid ${outColor.hex}; background:rgba(59, 130, 246, 0.05); display:flex; align-items:center; gap:4px; cursor:grab; box-shadow:0 1px 2px rgba(0,0,0,0.2);" title="${outColor.name}">
                   <div style="width:8px; height:8px; border-radius:50%; background:${outColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
                   <span style="font-size:8px; font-weight:bold; color:var(--text1)">OUT ${j}</span>
                 </div>
               `;
            }
        }
        html += `</div></div>`;
    }

    html += `
          <!-- Right Column (Derived Fibers) -->
          <div style="flex:1; display:flex; flex-direction:column; gap:6px; padding-left:10px;">
            <div style="font-size:10px; text-align:center; color:var(--text2); margin-bottom:4px;">Cabo Derivado (Solte Aqui)</div>
    `;

    for (let i = 1; i <= dc.fibers; i++) {
       const subFColor = FIBER_COLORS[(i-1) % FIBER_COLORS.length];
       const currentSrcFiber = splice.fusions[dc.id] ? splice.fusions[dc.id][i] : null;
       
       if (currentSrcFiber) {
           let srcFColor, srcLabel, isDead;
           if (typeof currentSrcFiber === 'string' && currentSrcFiber.startsWith('S')) {
               srcFColor = { hex: '#3b82f6' }; // Azul primary
               srcLabel = 'SPL ' + currentSrcFiber.replace('S', 'OUT ');
               isDead = false; // Splitter local não "morre" no meio do caminho, depende do input dele (o que verificamos no setFusion)
           } else {
               srcFColor = FIBER_COLORS[(parseInt(currentSrcFiber)-1) % FIBER_COLORS.length];
               srcLabel = 'F' + currentSrcFiber;
               isDead = cutUpstreamFibers[currentSrcFiber];
           }
           
           if (isDead) {
             html += `
               <div style="padding:6px; border-radius:4px; border:1px solid #ef4444; background:rgba(239, 68, 68, 0.15); display:flex; justify-content:space-between; align-items:center;" title="Atenção: A fibra de origem ${srcLabel} foi cortada em uma CEO anterior. O sinal não chega aqui!">
                 <div style="display:flex; align-items:center; gap:4px; opacity:0.6;">
                   <div style="width:8px; height:8px; border-radius:2px; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
                   <span style="font-size:10px; font-weight:bold; color:#fca5a5;"><strike>${srcLabel}</strike> (Sem Sinal) ➡️ F${i}</span>
                   <div style="width:8px; height:8px; border-radius:50%; background:${subFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
                 </div>
                 <button onclick="removeFusion('${splice.id}', '${dc.id}', ${i})" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:12px; display:flex; align-items:center; justify-content:center; width:20px; height:20px;" title="Remover Fusão Morta">✖</button>
               </div>
             `;
           } else {
             html += `
               <div style="padding:6px; border-radius:4px; border:1px solid #f97316; background:rgba(249, 115, 22, 0.15); display:flex; justify-content:space-between; align-items:center;">
                 <div style="display:flex; align-items:center; gap:4px;">
                   <div style="width:8px; height:8px; border-radius:2px; background:${srcFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
                   <span style="font-size:10px; font-weight:bold; color:#fdba74;">${srcLabel} ➡️ F${i}</span>
                   <div style="width:8px; height:8px; border-radius:50%; background:${subFColor.hex}; border:1px solid rgba(255,255,255,0.3);"></div>
                 </div>
                 <button onclick="removeFusion('${splice.id}', '${dc.id}', ${i})" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:12px; display:flex; align-items:center; justify-content:center; width:20px; height:20px;" title="Desfazer Fusão">✖</button>
               </div>
             `;
           }
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

// Manipulação do Splitter Físico
window.installSplitterInSplice = function(spliceId, outputs) {
  const splice = STATE.splices.find(s => s.id === spliceId);
  if (!splice) return;

  if (!outputs) {
    // Remove o splitter e limpa as fusões que eram dele (tudo que começa com 'S')
    delete splice.splitter;
    if (splice.fusions) {
      Object.keys(splice.fusions).forEach(cableId => {
        Object.keys(splice.fusions[cableId]).forEach(fiberIndex => {
          if (typeof splice.fusions[cableId][fiberIndex] === 'string' && splice.fusions[cableId][fiberIndex].startsWith('S')) {
            window.removeFusion(spliceId, cableId, fiberIndex); // Remove a herança também
          }
        });
      });
    }
  } else {
    // Instala um splitter novo
    splice.splitter = {
      outputs: parseInt(outputs),
      inputFiber: null
    };
  }
  saveLocal();
  renderPanel();
}

window.dropFiberToSplitter = function(ev, spliceId) {
   ev.preventDefault();
   const srcFiber = ev.dataTransfer.getData("srcFiber");
   if (srcFiber && !srcFiber.startsWith('S')) { // Cannot drop a splitter output into a splitter input
      const splice = STATE.splices.find(s => s.id === spliceId);
      if (splice && splice.splitter) {
         splice.splitter.inputFiber = parseInt(srcFiber);
         saveLocal();
         toast('🔌 Fibra conectada à entrada do Splitter!');
         // Re-cascateia as saídas do splitter
         window.updateSplitterInput(spliceId, parseInt(srcFiber));
      }
   }
}

window.removeSplitterInput = function(spliceId) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (splice && splice.splitter) {
      splice.splitter.inputFiber = null;
      saveLocal();
      toast('🔌 Fibra removida do Splitter.');
      window.updateSplitterInput(spliceId, null);
   }
}

window.updateSplitterInput = function(spliceId, fiberIndex) {
  const splice = STATE.splices.find(s => s.id === spliceId);
  if (!splice || !splice.splitter) return;
  splice.splitter.inputFiber = fiberIndex ? parseInt(fiberIndex) : null;
  saveLocal();
  
  // Como mudamos a entrada do splitter, o ramal propagado por ele muda.
  // Precisamos re-cascatear as fibras que estão conectadas nas saídas dele.
  if (splice.fusions) {
      Object.keys(splice.fusions).forEach(cableId => {
          Object.keys(splice.fusions[cableId]).forEach(fIndex => {
              const srcF = splice.fusions[cableId][fIndex];
              if (typeof srcF === 'string' && srcF.startsWith('S')) {
                  // Força a atualização do cascade dessa fibra
                  window.setFusion(spliceId, cableId, fIndex, srcF);
              }
          });
      });
  }
  
  renderPanel();
}

window.setFusion = function(spliceId, destCableId, destFiber, srcFiber) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (splice) {
      if (!splice.fusions) splice.fusions = {};
      if (!splice.fusions[destCableId]) splice.fusions[destCableId] = {};
      
      const parentCable = STATE.cables.find(c => c.id === splice.cableId);
      const childCable = STATE.cables.find(c => c.id === destCableId);

      if (srcFiber) {
         if (typeof srcFiber === 'string' && srcFiber.startsWith('S')) {
             splice.fusions[destCableId][destFiber] = srcFiber;
         } else {
             splice.fusions[destCableId][destFiber] = parseInt(srcFiber);
         }
         
         // Herdar Rota/Ramal automaticamente do cabo pai
         if (parentCable && childCable) {
            let effectiveRamalId = null;
            let checkFiber = null;

            if (typeof srcFiber === 'string' && srcFiber.startsWith('S')) {
               if (splice.splitter && splice.splitter.inputFiber) {
                  effectiveRamalId = parentCable.fiberMapping[splice.splitter.inputFiber];
                  checkFiber = splice.splitter.inputFiber;
               }
            } else {
               effectiveRamalId = parentCable.fiberMapping[parseInt(srcFiber)];
               checkFiber = parseInt(srcFiber);
            }
            
            // Verifica se a fibra já foi cortada antes (upstream) nesta mesma linha de cabo
            if (checkFiber && typeof getDistanceAlongCable === 'function') {
               const thisSpliceDist = getDistanceAlongCable([splice.lat, splice.lng], parentCable.path);
               const splicesOnCable = STATE.splices.filter(s => s.cableId === parentCable.id);
               for (const otherSplice of splicesOnCable) {
                  if (otherSplice.id !== splice.id && otherSplice.fusions) {
                     const otherDist = getDistanceAlongCable([otherSplice.lat, otherSplice.lng], parentCable.path);
                     if (otherDist < thisSpliceDist) {
                        Object.values(otherSplice.fusions).forEach(fusions => {
                           Object.values(fusions).forEach(f => {
                              if (f == checkFiber || (typeof f === 'string' && f.startsWith('S') && otherSplice.splitter && otherSplice.splitter.inputFiber == checkFiber)) {
                                 effectiveRamalId = null;
                              }
                           });
                        });
                     }
                  }
               }
            }

            if (effectiveRamalId) {
               childCable.fiberMapping[destFiber] = effectiveRamalId;
               if (typeof cascadeFiberMapping === 'function') {
                  cascadeFiberMapping(destCableId, destFiber, effectiveRamalId);
               }
            } else {
               delete childCable.fiberMapping[destFiber];
               if (typeof cascadeFiberMapping === 'function') {
                  cascadeFiberMapping(destCableId, destFiber, null);
               }
            }
         }
      } else {
         delete splice.fusions[destCableId][destFiber];
         
         // Limpa a herança se desfazer a fusão
         if (childCable) {
            delete childCable.fiberMapping[destFiber];
            if (typeof cascadeFiberMapping === 'function') {
               cascadeFiberMapping(destCableId, destFiber, null);
            }
         }
      }
      saveLocal();
      toast('🔗 Matriz de fusão atualizada!');
      
      // Se houver roubo de fibra, precisamos recalcular os cabos filhos a frente
      // Para garantir a integridade total do sinal no tronco, recalculamos a partir da origem do tronco
      if (parentCable && typeof cascadeFiberMapping === 'function') {
          // Re-cascateia todas as fibras do tronco para corrigir CEOs downstream
          for(let i=1; i<=parentCable.fibers; i++) {
              if (parentCable.fiberMapping[i]) {
                  cascadeFiberMapping(parentCable.id, i, parentCable.fiberMapping[i]);
              }
          }
      }
      
      renderPanel();
   }
}

window.updateSpliceField = function(spliceId, field, value) {
  const splice = STATE.splices.find(s => s.id === spliceId);
  if (splice) {
    splice[field] = value;
    saveLocal();
    // Atualiza tooltip no mapa
    if (typeof renderAllSplices === 'function' && field === 'name') renderAllSplices();
    renderPanel();
  }
}

function renderCTOProps(cto, pop, pon, ramal) {
  // Descobre a fibra física em que esta CTO está no cabo
  let fiberStr = "Sinal Ausente";
  let fiberHex = "#475569";
  
  if (cto.cableId) {
     const cable = STATE.cables.find(c => c.id === cto.cableId);
     if (cable && cable.fiberMapping) {
        if (cto.fiberIndex) {
            const fNum = cto.fiberIndex;
            const fiberObj = typeof FIBER_COLORS !== 'undefined' ? FIBER_COLORS[(parseInt(fNum) - 1) % FIBER_COLORS.length] : null;
            fiberStr = `Fibra ${fNum} (${fiberObj ? fiberObj.name : 'Desconhecida'})`;
            fiberHex = fiberObj ? fiberObj.hex : '#ccc';
        } else {
            // Legado: pega a primeira fibra que pertence ao ramal
            for (let fNum in cable.fiberMapping) {
               if (cable.fiberMapping[fNum] === ramal.id) {
                  const fiberObj = typeof FIBER_COLORS !== 'undefined' ? FIBER_COLORS[(parseInt(fNum) - 1) % FIBER_COLORS.length] : null;
                  fiberStr = `Fibra ${fNum} (${fiberObj ? fiberObj.name : 'Desconhecida'})`;
                  fiberHex = fiberObj ? fiberObj.hex : '#ccc';
                  break;
               }
            }
        }
     }
  }

  let html = `
  <div class="panel-section">
    <div class="panel-section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📦 CTO (Caixa de Terminação)</span>
      <button onclick="highlightRamal('${pop.id}', '${ramal.id}')" title="Destacar Rota no Mapa" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--primary); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🔍</button>
    </div>

    <div style="font-size:11px; color:var(--text2); margin-bottom:15px;">
      Hierarquia: <b>${pop.name}</b> ➡️ ${pon.rotaName} ➡️ ${ramal.name}
    </div>
    
    <div class="fp-group" style="margin-bottom: 20px; background:var(--bg3); padding:10px; border-radius:6px;">
      <label class="fp-label">Fibra Física no Cabo</label>
      <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
          <div style="width:20px; height:20px; border-radius:50%; background:${fiberHex}; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
          <span style="font-size:14px; font-weight:bold; color:var(--text1)">${fiberStr}</span>
      </div>
    </div>

    <div class="fp-group">
      <label class="fp-label">Nome da CTO</label>
      <input class="fp-input" value="${cto.name}"
        onchange="updateCTOField('${pop.id}', '${pon.index}', '${ramal.id}', '${cto.id}', 'name', this.value)">
    </div>

    <div class="fp-row">
      <div class="fp-group">
        <label class="fp-label">Splitter</label>
        <input class="fp-input" value="${cto.ratio}" readonly style="opacity:0.7">
      </div>
      <div class="fp-group">
        <label class="fp-label">Sinal Estimado</label>
        <input class="fp-input" value="${cto.sinalFinal ? cto.sinalFinal + ' dBm' : 'N/A'}" readonly style="opacity:0.7">
      </div>
    </div>

    <div class="fp-group">
      <label class="fp-label">Observações</label>
      <textarea class="fp-input" style="height:60px; resize:vertical;" 
        onchange="updateCTOField('${pop.id}', '${pon.index}', '${ramal.id}', '${cto.id}', 'obs', this.value)">${cto.obs || ''}</textarea>
    </div>

    ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(cto.id) : ''}
  </div>`;
  return html;
}

window.updateCTOField = function(popId, ponIndex, ramalId, ctoId, field, value) {
  const pop = STATE.olts.find(o => o.id === popId);
  if (!pop) return;
  const pon = pop.pons.find(p => p.index === parseInt(ponIndex));
  if (!pon) return;
  const ramal = pon.ramais.find(r => r.id === ramalId);
  if (!ramal) return;
  const cto = ramal.ctos.find(c => c.id === ctoId);
  if (cto) {
    cto[field] = value;
    saveLocal();
    // Atualiza tooltip
    if (typeof renderAllCTOMarkers === 'function' && field === 'name') renderAllCTOMarkers();
    renderPanel();
  }
}
