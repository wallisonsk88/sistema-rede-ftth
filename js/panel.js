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
            <div class="pon-field" style="flex:1">
              <label>Fibras</label>
              <select onchange="updatePonRota('${pop.id}', ${i}, 'fibers', parseInt(this.value))">
                ${[2, 4, 6, 12, 24, 36, 48, 72].map(f =>
                  `<option value="${f}" ${pon.fibers === f ? 'selected' : ''}>${f} FO</option>`
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
                    <label>Gerar cascata de CTOs</label>
                    <input type="number" min="1" max="32" id="qtde_cto_${ramal.id}" placeholder="Quantidade (Ex: 5)">
                  </div>
                  <button class="btn-full primary" style="flex:1; margin-bottom:0;" onclick="generateRamalCTOs('${pop.id}', ${i}, '${ramal.id}', parseInt(document.getElementById('qtde_cto_${ramal.id}').value))">🪄 Gerar / Calcular</button>
                </div>
              `;
              
              if(ramal.ctos && ramal.ctos.length > 0) {
                 ramalHtml += `<div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
                   <div style="font-size:9px; color:var(--text2); display:flex; justify-content:space-between; margin-bottom:4px; font-weight:700; gap:4px;">
                     <span style="flex:1">CTO</span>
                     <span style="flex:1">Split Entrada</span>
                     <span style="flex:1; text-align:right">Sinal Estimado</span>
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
                     <span style="flex:1; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${cto.name}">${cto.name}</span>
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
function handleElementClick(id) {
  if (STATE.tool === 'eraser') {
    deleteElement(id);
    return;
  }
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
