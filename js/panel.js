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
  // Compatibilidade com estruturas antigas
  if (!pop.oltEquipments) {
     pop.oltEquipments = [{ id: 'olt_default', name: 'OLT Principal', ports: pop.ponPorts || 8 }];
  }
  const totalPons = pop.oltEquipments.reduce((sum, olt) => sum + (parseInt(olt.ports) || 8), 0);
  const configuredCount = pop.pons ? pop.pons.length : 0;

  let html = `
  <div class="panel-section">
    <div class="panel-section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>🏢 POP / OLT</span>
      <button onclick="addOltEquipment('${pop.id}')" style="background:var(--primary); color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">+ Adicionar OLT</button>
    </div>

    <div class="fp-group">
      <label class="fp-label">Nome</label>
      <input class="fp-input" value="${pop.name}"
        onchange="popUpdate('${pop.id}','name',this.value)">
    </div>

    <div class="fp-group">
      <label class="fp-label">Coordenadas</label>
      <div class="fp-row">
        <input class="fp-input" value="${pop.lat.toFixed(6)}" readonly>
        <input class="fp-input" value="${pop.lng.toFixed(6)}" readonly>
      </div>
    </div>

    ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(pop.id) : ''}
  </div>`;

  html += `
  <div class="panel-section">
    <div class="panel-section-title">
      🔌 Portas PON — Rotas
      <span style="float:right; font-size:10px; color:var(--text2); text-transform:none; letter-spacing:0">
        ${configuredCount} / ${totalPons} configuradas
      </span>
    </div>`;

  const ponToOltMap = buildPonToOltMap(pop);
  let globalIndexCounter = 1; // índice global da porta PON no loop de renderização

  pop.oltEquipments.forEach((olt, oltIndex) => {
    const oltDetailsKey = `${pop.id}_olt_${olt.id || oltIndex}`;
    const isOltOpen = window.openOltDetails && window.openOltDetails[oltDetailsKey] ? 'open' : '';
    html += `
      <details class="olt-section-details" ${isOltOpen} ontoggle="window.openOltDetails = window.openOltDetails || {}; window.openOltDetails['${oltDetailsKey}'] = this.open" style="margin: 15px 0 5px 0; background:var(--surface); border:1px solid var(--border); border-radius:8px;">
        <summary style="padding:12px; font-size:12px; font-weight:bold; color:var(--primary); cursor:pointer; outline:none; user-select:none; display:flex; justify-content:space-between; align-items:center;">
          <span>⚙️ ${olt.name} (${olt.ports} Portas)</span>
          <span style="font-size:10px; color:var(--text3);">▼ expandir</span>
        </summary>
        <div style="padding: 10px; border-top:1px solid var(--border); background:var(--bg); margin:10px; border-radius:6px;">
          <!-- OLT config -->
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:8px;">
            <input type="text" value="${olt.name}" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'name', this.value)" style="font-size:12px; font-weight:bold; background:transparent; border:none; color:var(--text); outline:none; width:150px;" placeholder="Nome da OLT">
            <button onclick="removeOltEquipment('${pop.id}', '${olt.id}')" style="background:none; border:none; color:var(--red); cursor:pointer; font-size:12px;" title="Remover OLT">🗑️</button>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:8px;">
            <div>
              <label style="font-size:10px; color:var(--text3);">Qtd. Portas PON</label>
              <select onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'ports', this.value)" style="width:100%; font-size:11px; padding:4px; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px;">
                ${[2, 4, 8, 16, 32].map(n => `<option value="${n}" ${olt.ports == n ? 'selected' : ''}>${n}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="font-size:10px; color:var(--text3);">Potência TX (dBm)</label>
              <input type="number" step="0.5" value="${olt.outputPower !== undefined ? olt.outputPower : (pop.outputPower || 4)}" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'outputPower', this.value)" style="width:100%; font-size:11px; padding:4px; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px;">
            </div>
          </div>
          <div>
            <label style="font-size:10px; color:var(--text3);">Observações da OLT</label>
            <textarea onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'obs', this.value)" style="width:100%; height:40px; font-size:11px; padding:4px; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px; resize:vertical;">${olt.obs || ''}</textarea>
          </div>

          <div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--border);">
            <label style="font-size:10px; color:var(--primary); font-weight:bold;">🔗 Cabo Tronco (Backbone) Vinculado</label>
            <div style="font-size:9px; color:var(--text3); margin-bottom:4px;">Selecione o cabo que sairá desta OLT. Apenas rotas desta OLT irão para ele.</div>
            <div style="display:flex; flex-direction:column; gap:4px; margin-top:6px; background:var(--bg); padding:6px; border-radius:4px; border:1px solid var(--border);">
               ${(() => {
                  const rootCables = getPopRootCables(pop.id);
                  if (rootCables.length === 0) return '<span style="font-size:10px; color:var(--text3);">Nenhum cabo saindo deste POP.</span>';

                  return rootCables.map(c =>
                     `<label style="font-size:11px; display:flex; align-items:center; gap:6px; color:var(--text); cursor:pointer;">
                        <input type="checkbox" ${c.oltId === olt.id ? 'checked' : ''} onchange="window.toggleCableOltLink('${c.id}', '${olt.id}', this.checked)" style="accent-color:var(--primary);">
                        ${c.name || 'Cabo Tronco ' + c.fibers + ' FO'} ${c.oltId && c.oltId !== olt.id ? '<span style="color:var(--text3); font-size:9px;">(Vinculado a outra OLT)</span>' : ''}
                      </label>`
                  ).join('');
               })()}
            </div>
          </div>
        </div>
        <div style="padding: 10px;">
    `;

    for (let j = 1; j <= (parseInt(olt.ports) || 8); j++) {
      const i = globalIndexCounter++;
      const localPonId = String(j).padStart(2, '0');
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
                 PON ${localPonId}
               </span>
               <div style="display:flex; flex-direction:column;">
                 <span style="font-size:11px; font-weight:bold; color:var(--text);">${olt.name}</span>
                 <span style="font-size:10px; font-weight:600; color:var(--text2);">${pon.rotaName} (${(pon.ramais||[]).length} ramais)</span>
               </div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
               <span style="font-size:10px; color:var(--text3);">▼ expandir</span>
               <button class="pon-remove-btn" onclick="removePonRota('${pop.id}', ${i})" title="Liberar porta">✕</button>
            </div>
          </summary>
          <div class="pon-content" style="padding:0 10px 10px 10px; border-top:1px solid var(--border); margin-top:5px; padding-top:10px;">
            <div class="pon-field-row">
              <div class="pon-field" style="flex:1">
                <label>Nome da OLT (Visualização)</label>
                <input type="text" value="${olt.name}" disabled style="opacity:0.7;">
              </div>
              <div class="pon-field" style="flex:1">
                <label>Nome da Rota</label>
                <input type="text" value="${pon.rotaName}"
                  onchange="updatePonRota('${pop.id}', ${i}, 'rotaName', this.value)">
              </div>
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
              ${(pon.ramais || []).map((ramal, rIdx) => {
                // Fibra do cabo tronco em que este ramal sai da OLT (é dela que a informação corre pela rede)
                const popCables = getPopRootCables(pop.id);
                let mappedFiberNum = '';
                let mappedValue = '';
                for (const pc of popCables) {
                  const f = Object.keys(pc.fiberMapping || {}).find(k => pc.fiberMapping[k] === ramal.id);
                  if (f) { mappedFiberNum = f; mappedValue = pc.id + ':' + f; break; }
                }
                const fiberOptions = popCables.filter(c => !c.oltId || c.oltId === ponToOltMap[pon.index]).map(c => {
                  let opts = '';
                  for (let f = 1; f <= c.fibers; f++) {
                    const value = c.id + ':' + f;
                    const other = c.fiberMapping && c.fiberMapping[f];
                    const busy = other && other !== ramal.id ? getRamalInfo(other) : null;
                    opts += `<option value="${value}" ${value === mappedValue ? 'selected' : ''} ${busy ? 'disabled' : ''}>${fiberLabel(f, c.fibers)}${busy ? ' — ' + busy.pon.rotaName + ' · ' + busy.ramal.name : ''}</option>`;
                  }
                  return `<optgroup label="${c.name || 'Cabo Tronco ' + c.fibers + ' FO'}">${opts}</optgroup>`;
                }).join('');

                let ramalHtml = `<div style="background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                  <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1;">
                      <label style="font-size:9px; color:var(--text3); display:block; margin-bottom:2px;">Nome do Ramal</label>
                      <input type="text" value="${ramal.name}" onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'name', this.value)" style="width:100%; font-size:11px; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; outline:none;">
                    </div>
                    <div>
                      <label style="font-size:9px; color:var(--text3); display:block; margin-bottom:2px;">Tipo</label>
                      <select onchange="updateRamal('${pop.id}', ${i}, '${ramal.id}', 'type', this.value)" style="font-size:11px; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; outline:none;">
                        <option value="balanceado" ${ramal.type === 'balanceado' ? 'selected' : ''}>Balanc.</option>
                        <option value="desbalanceado" ${ramal.type === 'desbalanceado' ? 'selected' : ''}>Desbalanc.</option>
                      </select>
                    </div>
                    <div style="display:flex; align-items:flex-end;">
                      <button onclick="removeRamal('${pop.id}', ${i}, '${ramal.id}')" style="background:var(--red); color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;" title="Remover Ramal">🗑️</button>
                    </div>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <div style="flex:1;">
                      <label style="font-size:9px; color:var(--primary); display:block; margin-bottom:2px; font-weight:bold;">🔗 Sai da OLT na fibra do cabo tronco</label>
                      <select onchange="connectRamalToFiber('${ramal.id}', this.value)" style="width:100%; font-size:11px; padding:4px; background:var(--bg); border:1px solid ${mappedFiberNum ? 'var(--border)' : 'var(--yellow)'}; color:var(--text); border-radius:4px; outline:none;">
                        <option value="">-- Não conectado --</option>
                        ${fiberOptions}
                      </select>
                      ${popCables.length === 0 ? '<div style="font-size:9px; color:var(--text3); margin-top:2px;">Lance um cabo saindo deste POP para conectar o ramal.</div>' : ''}
                    </div>
                    <div style="display:flex; align-items:flex-end;">
                      ${mappedFiberNum ?
                        `<button onclick="highlightRamal('${pop.id}', '${ramal.id}')" title="Destacar Rota no Mapa" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--primary); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🔍</button>`
                        : `<button disabled title="Conecte o ramal numa fibra do cabo tronco para destacar no mapa" style="background:none; border:none; font-size:16px; color:var(--text3); opacity:0.5; cursor:not-allowed;">🔍</button>`}
                    </div>
                  </div>
                `;

                const cascadeResults = window.calcOpticalPower ? window.calcOpticalPower((olt.outputPower !== undefined ? olt.outputPower : pop.outputPower) || 4, ramal) : [];

                ramalHtml += `
                  <div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px; opacity:${mappedFiberNum ? '1' : '0.6'};">
                    <label style="font-size:9px; color:var(--text3); display:block; margin-bottom:4px;">Planejamento de CTOs neste ramal (Simulação Automática)</label>
                    <div style="display:flex; gap:4px; align-items:center;">
                      <input type="number" id="qtde_cto_${ramal.id}" value="${ramal.ctos ? ramal.ctos.length : 8}" min="1" max="64" style="width:40px; font-size:11px; padding:4px; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; outline:none;" ${mappedFiberNum ? '' : 'disabled'}>
                      <span style="font-size:10px; color:var(--text2)">CTOs</span>
                      ${mappedFiberNum ?
                      `<button class="btn-full primary" style="flex:1; margin-bottom:0;" onclick="generateRamalCTOs('${pop.id}', ${i}, '${ramal.id}', parseInt(document.getElementById('qtde_cto_${ramal.id}').value))">🪄 Gerar / Calcular</button>`
                      : `<button class="btn-full secondary" style="flex:1; margin-bottom:0; background:var(--surface2); color:var(--text3);" disabled title="Tube este ramal num cabo para gerar CTOs">⚠️ Tubagem Pendente</button>`}
                    </div>
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
            <span class="pon-badge free-badge">PON ${localPonId}</span>
            <span class="pon-free-text">Livre — clique para configurar rota</span>
          </div>
        </div>`;
      }
    } // for j

    html += `
        </div>
      </details>
    `;
  }); // forEach olt

  html += `</div>`;

  // ============================================================
  //  SEÇÃO DE PORTAS PON / ROTAS
  // ============================================================
  const rootCables = getPopRootCables(pop.id);

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

  let rootPop = null;
  if (cable.sourceType === 'pop' || cable.popId) {
     rootPop = STATE.olts.find(o => o.id === (cable.sourceId || cable.popId));
     if (rootPop) originName = 'POP: ' + rootPop.name;
  } else if (cable.sourceType === 'splice') {
     const splice = STATE.splices.find(s => s.id === cable.sourceId);
     if (splice) {
       originName = 'CEO: ' + splice.name;
       // Sobe pela árvore de CEOs até achar o cabo tronco que sai do POP
       let currentCable = STATE.cables.find(c => c.id === splice.cableId);
       while (currentCable && currentCable.sourceType === 'splice') {
           const parentSplice = STATE.splices.find(s => s.id === currentCable.sourceId);
           if (!parentSplice) break;
           currentCable = STATE.cables.find(c => c.id === parentSplice.cableId);
       }
       if (currentCable && (currentCable.sourceType === 'pop' || currentCable.popId)) {
           rootPop = STATE.olts.find(o => o.id === (currentCable.sourceId || currentCable.popId));
       }
     }
  }

  if (rootPop) {
     rootPopId = rootPop.id;
     const ponToOltMap = buildPonToOltMap(rootPop);
     (rootPop.pons || []).forEach(pon => {
       if (cable.oltId && ponToOltMap[pon.index] !== cable.oltId) return;
       if(pon.ramais) pon.ramais.forEach(r => allRamais.push({ id: r.id, name: getRamalInfo(r.id).label, color: pon.color }));
     });
  }

  let html = `
    <div class="prop-group">
      <label>Nome do Cabo</label>
      <input type="text" class="input-full" value="${cable.name}" onchange="cableUpdate('${cable.id}', 'name', this.value)">
    </div>
    <div style="font-size:10px; opacity:0.8; margin-bottom:10px;">${originName}</div>
    ${rootPopId && isRootCable(cable) ? `
      <div class="prop-group">
        <label style="color:var(--primary); font-weight:bold;">Conectado na OLT (Opcional)</label>
        <select class="input-full" onchange="cableUpdate('${cable.id}', 'oltId', this.value)">
          <option value="">-- Listar todas as rotas do POP --</option>
          ${(STATE.olts.find(o => o.id === rootPopId).oltEquipments || []).map(o => `<option value="${o.id}" ${cable.oltId === o.id ? 'selected' : ''}>${o.name}</option>`).join('')}
        </select>
        <div style="font-size:9px; color:var(--text3); margin-top:2px;">Selecione para filtrar os ramais abaixo apenas dessa OLT.</div>
      </div>
    ` : ''}

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

  // Mapeia onde cada ramal está sendo usado em OUTROS cabos tronco
  // (nos derivados ele chega por fusão, isso não é conflito)
  let ramalUsageMap = {};
  STATE.cables.forEach(c => {
     if (c.id === cable.id || !isRootCable(c)) return;
     if (c.fiberMapping) {
        for (let f in c.fiberMapping) {
           ramalUsageMap[c.fiberMapping[f]] = c.name || 'Outro Cabo';
        }
     }
  });

  const cuts = getFiberCuts(cable);
  const isRoot = isRootCable(cable);
  const sourceSplice = isRoot ? null : STATE.splices.find(s => s.id === cable.sourceId);
  const sourceCable = sourceSplice ? STATE.cables.find(c => c.id === sourceSplice.cableId) : null;

  for(let i=1; i<=cable.fibers; i++) {
    const cIdx = (i - 1) % FIBER_COLORS.length;
    const fColor = FIBER_COLORS[cIdx];
    const mappedRamalId = cable.fiberMapping[i] || '';

    const earliestCutSplice = cuts[i] ? cuts[i].splice : null;

    // A fibra morre 1 metro após a CEO.
    let isDeadAtClick = earliestCutSplice && (clickDist > cuts[i].dist + 1);

    if (isDeadAtClick) {
      // Fibra morta (após a CEO) - SEM SELECTOR DE RAMAL
      html += `
        <div style="display:flex; align-items:center; gap:10px; background:var(--surface2); padding:6px; border-radius:6px; border:1px solid #dc2626; opacity:0.8;">
          <div style="width:16px; height:16px; border-radius:50%; background:${fColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:600; margin-bottom:2px; color:var(--text2)">${fiberLabel(i, cable.fibers)}</div>
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
        const isUsed = ramalUsageMap[r.id];
        const isUsedText = isUsed ? ` (Usado: ${isUsed})` : '';
        // Se estiver sendo usado em outro cabo, mostramos visualmente e desabilitamos para evitar conflito
        options += `<option value="${r.id}" ${mappedRamalId === r.id ? 'selected' : ''} ${isUsed ? 'disabled' : ''}>${r.name}${isUsedText}</option>`;
      });

      // No tronco o usuário escolhe; no derivado a informação vem da fusão na CEO de origem
      let fiberControl;
      if (isRoot) {
        fiberControl = `
            <select style="width:100%; font-size:11px; padding:4px; background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:4px; outline:none;"
                    onchange="setFiberMapping('${cable.id}', ${i}, this.value)">
              ${options}
            </select>`;
      } else {
        const src = sourceSplice && sourceSplice.fusions && sourceSplice.fusions[cable.id] ? sourceSplice.fusions[cable.id][i] : null;
        const srcText = !src ? '' : isSplitterOutput(src)
          ? `Splitter 1:${sourceSplice.splitter ? sourceSplice.splitter.outputs : '?'} · ${src.replace('S', 'OUT ')}`
          : `F${src} do ${sourceCable ? sourceCable.name : 'cabo de origem'}`;
        const info = getRamalInfo(mappedRamalId);
        fiberControl = `
            <div style="width:100%; font-size:11px; padding:4px; background:var(--bg); border:1px solid var(--border); border-radius:4px; color:${info ? 'var(--text)' : 'var(--text3)'};">
              ${info ? info.label : (src ? 'Fusionada, mas a fibra de origem não tem rota' : 'Sem fusão — sem sinal')}
              ${src ? `<div style="font-size:9px; color:var(--text3); margin-top:2px;">⬅️ ${sourceSplice.name}: ${srcText}</div>` : ''}
            </div>`;
      }

      html += `
        <div style="display:flex; align-items:center; gap:10px; background:var(--surface2); padding:6px; border-radius:6px; border:1px solid var(--border);">
          <div style="width:16px; height:16px; border-radius:50%; background:${fColor.hex}; border:1px solid rgba(255,255,255,0.2);"></div>
          <div style="flex:1;">
            <div style="font-size:10px; font-weight:600; margin-bottom:2px; color:var(--text2)">${fiberLabel(i, cable.fibers)}</div>
            ${fiberControl}
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

    // Fibras do cabo de entrada cortadas numa CEO anterior ou usadas numa CEO mais à frente
    // (mesma regra da propagação do sinal: a CTO não corta a fibra)
    const cutUpstreamFibers = {};
    const usedDownstreamFibers = {};
    if (sourceCable) {
      const alongUses = getSpliceUsesAlong(sourceCable);
      const here = alongUses.find(u => u.splice.id === splice.id);
      alongUses.forEach(u => {
        if (u.splice.id === splice.id) return;
        u.fibers.forEach(f => {
          if (u.dist < here.dist) cutUpstreamFibers[f] = true;
          else usedDownstreamFibers[f] = true;
        });
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

  // As saídas do splitter herdam o novo ramal automaticamente (recomputeSignals no saveLocal)
  renderPanel();
}

window.setFusion = function(spliceId, destCableId, destFiber, srcFiber) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (splice) {
      if (!splice.fusions) splice.fusions = {};
      if (!splice.fusions[destCableId]) splice.fusions[destCableId] = {};

      if (srcFiber) {
         splice.fusions[destCableId][destFiber] = isSplitterOutput(srcFiber) ? srcFiber : parseInt(srcFiber);
      } else {
         delete splice.fusions[destCableId][destFiber];
      }
      saveLocal(); // o cabo derivado herda o ramal da OLT pela fusão (recomputeSignals)
      toast('🔗 Matriz de fusão atualizada!');
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
  // A informação da CTO é o sinal que chega pela fibra em que ela está presa
  const signal = getCtoSignal(cto);
  const info = getRamalInfo(signal.ramalId);
  const fiberObj = signal.fiber ? FIBER_COLORS[(signal.fiber - 1) % FIBER_COLORS.length] : null;
  const fiberStr = signal.cable && signal.fiber ? `${signal.cable.name} · ${fiberLabel(signal.fiber, signal.cable.fibers)}` : 'Não está presa em um cabo';

  let html = `
  <div class="panel-section">
    <div class="panel-section-title" style="display:flex; justify-content:space-between; align-items:center;">
      <span>📦 CTO (Caixa de Terminação)</span>
      <button onclick="highlightRamal('${pop.id}', '${ramal.id}')" title="Destacar Rota no Mapa" style="background:none; border:none; cursor:pointer; font-size:16px; color:var(--primary); transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'">🔍</button>
    </div>

    <div style="font-size:11px; color:var(--text2); margin-bottom:15px;">
      ${info
        ? `Hierarquia: <b>${info.pop.name}</b> ➡️ ${info.oltName} ➡️ PON ${info.ponLabel} ➡️ ${info.pon.rotaName} ➡️ ${info.ramal.name}`
        : `<span style="color:var(--red);">⚠️ Sem sinal: a fibra desta CTO não tem rota da OLT ou foi cortada numa CEO antes dela.</span>`}
    </div>

    <div class="fp-group" style="margin-bottom: 20px; background:var(--bg3); padding:10px; border-radius:6px;">
      <label class="fp-label">Fibra Física no Cabo</label>
      <div style="display:flex; align-items:center; gap:10px; margin-top:5px;">
          <div style="width:20px; height:20px; border-radius:50%; background:${fiberObj ? fiberObj.hex : '#475569'}; border:2px solid #fff; box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>
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

window.toggleCableOltLink = function(cableId, oltId, isLinked) {
   const cable = STATE.cables.find(c => c.id === cableId);
   if (cable) {
       if (isLinked) {
           cable.oltId = oltId;
       } else {
           if (cable.oltId === oltId) cable.oltId = null;
       }
   }

   saveLocal();
   renderPanel();
};
