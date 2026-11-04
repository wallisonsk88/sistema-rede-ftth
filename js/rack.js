/**
 * rack.js — Página do POP em forma de rack 19" interativo
 *
 * O rack mostra só o que existe no projeto:
 *   - OLT: cada OLT cadastrada no POP (portas PON em gaiolas SFP, 16 por U)
 *   - DIO: cada cabo tronco que sai do POP (adaptadores SC/APC, 24 por U)
 *   - Equipamentos que o usuário adicionar do catálogo (switch, MikroTik, borda,
 *     CGNAT, nobreak...), guardados em pop.rackItems
 *   - Cordões de manobra: da porta PON até a fibra do DIO em que o ramal está ligado
 * A ordem das peças fica em pop.rackOrder. Clicar numa peça abre a edição dela ao lado.
 */

// Peça selecionada no rack: { popId, type: 'pop' | 'olt' | 'pon' | 'dio' | 'fiber' | 'eq' | 'catalog', oltId, ponIndex, cableId, fiber, eqId }
window.rackSel = window.rackSel || null;

const PONS_PER_ROW = 8;
const DIO_PER_ROW = 12;

/**
 * Equipamentos que um provedor costuma ter no POP. `face` escolhe o desenho da frente;
 * u/rj45/sfp são os padrões ao adicionar (o usuário ajusta depois).
 */
const EQUIPMENT_CATALOG = [
  { type: 'borda',     label: 'Roteador de Borda (BGP)',   icon: '🌐', face: 'router',   u: 1, rj45: 4,  sfp: 8, desc: 'Saída para a operadora / trânsito IP e BGP' },
  { type: 'bng',       label: 'Concentrador PPPoE / BNG',  icon: '🔐', face: 'router',   u: 1, rj45: 4,  sfp: 4, desc: 'Autentica e entrega IP aos clientes' },
  { type: 'cgnat',     label: 'CGNAT',                     icon: '🔁', face: 'server',   u: 1, rj45: 4,  sfp: 4, desc: 'Compartilha IP público entre clientes' },
  { type: 'mikrotik',  label: 'Roteador MikroTik',         icon: '🧭', face: 'mikrotik', u: 1, rj45: 8,  sfp: 4, desc: 'CCR / RB: roteamento, PPPoE, firewall' },
  { type: 'switch',    label: 'Switch',                    icon: '🔀', face: 'switch',   u: 1, rj45: 24, sfp: 4, desc: 'Agregação e distribuição da rede' },
  { type: 'firewall',  label: 'Firewall',                  icon: '🛡️', face: 'firewall', u: 1, rj45: 8,  sfp: 2, desc: 'Segurança da rede' },
  { type: 'servidor',  label: 'Servidor',                  icon: '🗄️', face: 'server',   u: 2, rj45: 2,  sfp: 0, desc: 'DNS, Radius, sistema de gestão, monitoramento' },
  { type: 'cache',     label: 'Cache CDN (GGC / OCA)',     icon: '⚡', face: 'server',   u: 2, rj45: 0,  sfp: 4, desc: 'Cache Google, Netflix, Meta' },
  { type: 'patch',     label: 'Patch Panel',               icon: '🔌', face: 'patch',    u: 1, rj45: 24, sfp: 0, desc: 'Organização dos cabos de rede (RJ45)' },
  { type: 'organizador', label: 'Organizador de Cabos',    icon: '〰️', face: 'brush',    u: 1, rj45: 0,  sfp: 0, desc: 'Guia horizontal para os cordões' },
  { type: 'nobreak',   label: 'Nobreak / UPS',             icon: '🔋', face: 'ups',      u: 2, rj45: 0,  sfp: 0, desc: 'Energia de reserva (bateria)' },
  { type: 'retificadora', label: 'Retificadora / Fonte -48V', icon: '⚙️', face: 'ups',   u: 2, rj45: 0,  sfp: 0, desc: 'Alimentação DC dos equipamentos' },
  { type: 'pdu',       label: 'Régua de Tomadas (PDU)',    icon: '🔌', face: 'pdu',      u: 1, rj45: 0,  sfp: 0, desc: 'Distribuição de energia no rack' },
  { type: 'ventilacao', label: 'Ventilação',               icon: '🌀', face: 'fans',     u: 1, rj45: 0,  sfp: 0, desc: 'Exaustores / ventiladores do rack' },
  { type: 'bandeja',   label: 'Bandeja / Prateleira',      icon: '🧰', face: 'shelf',    u: 1, rj45: 0,  sfp: 0, desc: 'Apoio para ONU, modem, conversor de mídia' },
];
const PORT_FACES = ['router', 'server', 'mikrotik', 'switch', 'firewall', 'patch'];

function catalogEntry(type) {
  return EQUIPMENT_CATALOG.find(c => c.type === type) || { type, label: 'Equipamento', icon: '📦', face: 'shelf', u: 1, rj45: 0, sfp: 0 };
}

/** Peças do rack na ordem salva (pop.rackOrder); peças novas entram no fim */
function getRackEntries(pop) {
  const entries = [
    ...getOltPorts(pop).map(o => ({ key: 'olt:' + o.olt.id, kind: 'olt', olt: o.olt, ports: o.ports })),
    ...(pop.rackItems || []).map(item => ({ key: 'eq:' + item.id, kind: 'eq', item })),
    ...getPopRootCables(pop.id).map(cable => ({ key: 'dio:' + cable.id, kind: 'dio', cable })),
  ];
  const order = pop.rackOrder || [];
  const rank = (e, i) => { const k = order.indexOf(e.key); return k >= 0 ? k : 1000 + i; };
  return entries.map((e, i) => ({ e, r: rank(e, i) })).sort((a, b) => a.r - b.r).map(x => x.e);
}

function rackSelect(sel) {
  window.rackSel = sel;
  renderPanel();
}

function getRackSel(pop) {
  const sel = window.rackSel;
  if (!sel || sel.popId !== pop.id) return { popId: pop.id, type: 'pop' };
  // Peça que deixou de existir (OLT removida, cabo apagado) volta para o POP
  if (sel.oltId && !pop.oltEquipments.some(o => o.id === sel.oltId)) return { popId: pop.id, type: 'pop' };
  if (sel.cableId && !STATE.cables.some(c => c.id === sel.cableId)) return { popId: pop.id, type: 'pop' };
  if (sel.eqId && !(pop.rackItems || []).some(i => i.id === sel.eqId)) return { popId: pop.id, type: 'pop' };
  return sel;
}

/** Portas PON de cada OLT com o índice global (OLT 1 = 1..N, OLT 2 = N+1..) */
function getOltPorts(pop) {
  let index = 1;
  return pop.oltEquipments.map(olt => {
    const ports = [];
    for (let j = 1; j <= (parseInt(olt.ports) || 8); j++) {
      ports.push({ index: index, local: j, pon: (pop.pons || []).find(p => p.index === index) });
      index++;
    }
    return { olt, ports };
  });
}

/** Ramais da PON que já saem numa fibra de cabo tronco */
function connectedRamais(pop, pon) {
  const cables = getPopRootCables(pop.id);
  return (pon.ramais || []).filter(r => cables.some(c => Object.values(c.fiberMapping || {}).includes(r.id)));
}

// ================================================================
//  PÁGINA DO POP
// ================================================================

function renderPOPProps(pop) {
  // Compatibilidade com estruturas antigas
  if (!pop.oltEquipments) {
    pop.oltEquipments = [{ id: 'olt_default', name: 'OLT Principal', ports: pop.ponPorts || 8 }];
  }
  const sel = getRackSel(pop);
  return `
    <div class="rack-layout">
      <div class="rack-col">${renderRack(pop, sel)}</div>
      <div class="rack-detail">${renderRackDetail(pop, sel)}</div>
    </div>`;
}

function renderRack(pop, sel) {
  const isSel = (type, extra) => sel.type === type && Object.keys(extra).every(k => sel[k] === extra[k]);
  const screws = '<span class="screw tl"></span><span class="screw bl"></span><span class="screw tr"></span><span class="screw br"></span>';
  let units = '';
  let u = 1;
  const uLabels = [];
  const addU = n => { for (let k = 0; k < n; k++) uLabels.push(u++); };

  getRackEntries(pop).forEach(entry => {
    if (entry.kind === 'olt') {
      const { olt, ports } = entry;
      const rows = Math.ceil(ports.length / PONS_PER_ROW);
      const uSize = Math.max(1, Math.ceil(rows / 2));
      addU(uSize);
      const portsHtml = ports.map(p => {
        let state = 'off';
        let title = `${olt.name} · PON ${String(p.local).padStart(2, '0')} — livre (clique para configurar uma rota)`;
        let color = '';
        if (p.pon) {
          const conn = connectedRamais(pop, p.pon).length;
          state = conn ? 'on' : 'warn';
          color = p.pon.color;
          title = `${olt.name} · PON ${String(p.local).padStart(2, '0')} · ${p.pon.rotaName} — ${(p.pon.ramais || []).length} ramal(is), ${conn} ligado(s) no DIO`;
        }
        const selected = isSel('pon', { ponIndex: p.index }) ? ' selected' : '';
        return `
          <button class="sfp ${state}${selected}" data-pon="${p.index}" title="${title}"
            onclick="rackSelect({ popId: '${pop.id}', type: 'pon', oltId: '${olt.id}', ponIndex: ${p.index} })"
            onmouseenter="rackHover('pon-${p.index}', true)" onmouseleave="rackHover('pon-${p.index}', false)">
            <span class="sfp-led" style="${color ? `--led:${color}` : ''}"></span>
            <span class="sfp-num">${p.local}</span>
          </button>`;
      }).join('');

      units += `
        <div class="rack-unit olt-unit${isSel('olt', { oltId: olt.id }) ? ' selected' : ''}" style="--u:${uSize}">
          ${screws}
          <div class="olt-plate" onclick="rackSelect({ popId: '${pop.id}', type: 'olt', oltId: '${olt.id}' })" title="Configurar ${olt.name}">
            <div class="olt-name">${olt.name}</div>
            <div class="olt-model">GPON OLT · ${ports.length} PON</div>
            <div class="olt-leds"><span class="led pwr" title="PWR"></span><span class="led sys" title="SYS"></span><span class="led alm" title="ALM"></span></div>
          </div>
          <div class="olt-ports" style="--cols:${Math.min(PONS_PER_ROW, ports.length)}">${portsHtml}</div>
          <div class="olt-uplink" title="Uplink / gerência">
            <span class="rj45"></span><span class="rj45"></span><span class="rj45"></span><span class="rj45"></span>
            <span class="console">CON</span>
          </div>
        </div>`;
    } else if (entry.kind === 'dio') {
      const { cable } = entry;
      const uSize = Math.max(1, Math.ceil(cable.fibers / (DIO_PER_ROW * 2)));
      addU(uSize);
      let adapters = '';
      for (let f = 1; f <= cable.fibers; f++) {
        const fColor = FIBER_COLORS[(f - 1) % FIBER_COLORS.length];
        const info = getRamalInfo(cable.fiberMapping[f]);
        const selected = isSel('fiber', { cableId: cable.id, fiber: f }) ? ' selected' : '';
        const title = `${fiberLabel(f, cable.fibers)} — ${info ? info.label : 'livre'}`;
        adapters += `
          <button class="dio-port ${info ? 'on' : 'off'}${selected}" data-fiber="${cable.id}:${f}" title="${title}"
            onclick="rackSelect({ popId: '${pop.id}', type: 'fiber', cableId: '${cable.id}', fiber: ${f} })"
            ondragover="rackDragOver(event)" ondragleave="this.classList.remove('drop-ok')" ondrop="rackDropRamal(event, '${cable.id}', ${f})"
            onmouseenter="${info ? `rackHover('pon-${info.pon.index}', true)` : ''}" onmouseleave="${info ? `rackHover('pon-${info.pon.index}', false)` : ''}">
            <span class="dio-ring" style="background:${fColor.hex}"></span>
            <span class="dio-num">${f}</span>
          </button>`;
      }
      const used = Object.keys(cable.fiberMapping || {}).filter(f => getRamalInfo(cable.fiberMapping[f])).length;
      units += `
        <div class="rack-unit dio-unit${isSel('dio', { cableId: cable.id }) ? ' selected' : ''}" style="--u:${uSize}">
          ${screws}
          <div class="dio-plate" onclick="rackSelect({ popId: '${pop.id}', type: 'dio', cableId: '${cable.id}' })" title="Configurar DIO do ${cable.name}">
            <div class="dio-title">DIO</div>
            <div class="dio-cable">${cable.name}</div>
            <div class="dio-count">${used}/${cable.fibers} FO</div>
          </div>
          <div class="dio-ports" style="--cols:${Math.min(DIO_PER_ROW, cable.fibers)}">${adapters}</div>
        </div>`;
    } else {
      const { item } = entry;
      const uSize = Math.max(1, parseInt(item.u) || 1);
      addU(uSize);
      units += renderEquipUnit(pop, item, uSize, isSel('eq', { eqId: item.id }), screws);
    }
  });

  // ---- Espaço livre ----
  addU(1);
  units += `
    <button class="rack-unit rack-empty${sel.type === 'catalog' ? ' selected' : ''}" onclick="rackSelect({ popId: '${pop.id}', type: 'catalog' })" title="Adicionar um equipamento neste rack">
      ＋ Adicionar equipamento
    </button>`;

  const rails = uLabels.map(n => `<span style="--u:1">${n}</span>`).join('');
  return `
    <div class="rack" data-pop="${pop.id}">
      <div class="rack-top${sel.type === 'pop' ? ' selected' : ''}" onclick="rackSelect({ popId: '${pop.id}', type: 'pop' })" title="Dados do POP">
        <img src="img/logo.png" alt="MEGA FTTX">
        <span class="rack-pop-name">${pop.name}</span>
        <button class="rack-full-btn" onclick="event.stopPropagation(); rackToggleFull()" title="${window.rackFull ? 'Voltar ao tamanho normal' : 'Ver o rack em tela cheia'}">${window.rackFull ? '🗗' : '⛶'}</button>
        <span class="rack-status-led"></span>
      </div>
      <div class="rack-body">
        <div class="rack-rail">${rails}</div>
        <div class="rack-units">${units}</div>
        <div class="rack-rail">${rails}</div>
      </div>
      <div class="rack-base"><span class="caster"></span><span class="caster"></span></div>
      <svg class="rack-cords"></svg>
    </div>
    <div class="rack-legend">
      <span><i class="lg on"></i>Rota com ramal no DIO</span>
      <span><i class="lg warn"></i>Rota sem fibra</span>
      <span><i class="lg off"></i>Porta livre</span>
    </div>`;
}

/** Frente do equipamento conforme o tipo (desenho ilustrativo; as portas não têm ligação no projeto) */
function renderEquipUnit(pop, item, uSize, selected, screws) {
  const cat = catalogEntry(item.type);
  const face = cat.face;
  const rows = uSize * 2;
  const portGrid = (n, cls, label) => {
    if (!n) return '';
    const cols = Math.ceil(n / rows);
    let html = '';
    for (let k = 1; k <= n; k++) html += `<span class="${cls}" title="${label} ${k}"><i></i></span>`;
    return `<div class="eq-ports" style="--cols:${cols}">${html}</div>`;
  };

  let body = '';
  if (PORT_FACES.includes(face)) {
    const lcd = face === 'mikrotik' || face === 'server' ? `<div class="eq-lcd">${face === 'server' ? 'OK' : (item.ip || 'RouterOS')}</div>` : '';
    const bays = face === 'server' ? `<div class="eq-bays" style="--cols:${uSize * 2}">${'<span></span>'.repeat(uSize * 4)}</div>` : '';
    body = `${bays}${portGrid(parseInt(item.rj45) || 0, 'eq-rj45', face === 'patch' ? 'Keystone' : 'Porta RJ45')}${portGrid(parseInt(item.sfp) || 0, 'eq-sfp', 'SFP')}${lcd}`;
  } else if (face === 'ups') {
    body = `
      <div class="eq-ups-lcd"><b>${item.type === 'retificadora' ? '-48V DC' : '220V · 100%'}</b><span>${'▮'.repeat(5)}</span></div>
      <div class="eq-ups-btns"><span></span><span></span><span></span></div>
      <div class="eq-vents"></div>`;
  } else if (face === 'pdu') {
    body = `<div class="eq-sockets">${'<span></span>'.repeat(8)}</div><span class="eq-power"></span>`;
  } else if (face === 'fans') {
    body = `<div class="eq-fans">${'<span></span>'.repeat(4)}</div>`;
  } else if (face === 'brush') {
    body = `<div class="eq-brush"></div>`;
  } else {
    body = `<div class="eq-shelf"></div>`;
  }

  return `
    <div class="rack-unit eq-unit face-${face} eq-${item.type}${selected ? ' selected' : ''}" style="--u:${uSize}" data-eq="${item.id}"
      onclick="rackSelect({ popId: '${pop.id}', type: 'eq', eqId: '${item.id}' })" title="${item.name}${item.model ? ' · ' + item.model : ''}">
      ${screws}
      <div class="eq-plate">
        <div class="eq-name">${cat.icon} ${item.name}</div>
        <div class="eq-model">${item.model || cat.label}</div>
        <div class="olt-leds"><span class="led pwr"></span><span class="led sys"></span></div>
      </div>
      <div class="eq-body">${body}</div>
    </div>`;
}

// ================================================================
//  EDIÇÃO DA PEÇA SELECIONADA
// ================================================================

function renderRackDetail(pop, sel) {
  switch (sel.type) {
    case 'olt': return renderOltDetail(pop, pop.oltEquipments.find(o => o.id === sel.oltId));
    case 'pon': return renderPonDetail(pop, sel.ponIndex);
    case 'dio': return renderDioDetail(pop, STATE.cables.find(c => c.id === sel.cableId));
    case 'fiber': return renderFiberDetail(pop, STATE.cables.find(c => c.id === sel.cableId), sel.fiber);
    case 'eq': return renderEquipDetail(pop, (pop.rackItems || []).find(i => i.id === sel.eqId));
    case 'catalog': return renderCatalog(pop);
    default: return renderPopDetail(pop);
  }
}

function detailHeader(icon, title, subtitle) {
  return `
    <div class="rack-detail-head">
      <span class="rack-detail-icon">${icon}</span>
      <div><div class="rack-detail-title">${title}</div>${subtitle ? `<div class="rack-detail-sub">${subtitle}</div>` : ''}</div>
    </div>`;
}

function renderPopDetail(pop) {
  const ports = getOltPorts(pop).flatMap(o => o.ports);
  const configured = ports.filter(p => p.pon).length;
  const ramais = (pop.pons || []).reduce((n, p) => n + (p.ramais || []).length, 0);
  const cables = getPopRootCables(pop.id);
  const fibers = cables.reduce((n, c) => n + c.fibers, 0);
  const usedFibers = cables.reduce((n, c) => n + Object.keys(c.fiberMapping || {}).length, 0);
  return `
    ${detailHeader('🏢', pop.name, 'POP · rack principal')}
    <div class="rack-stats">
      <div><b>${pop.oltEquipments.length}</b><span>OLT(s)</span></div>
      <div><b>${configured}/${ports.length}</b><span>PONs com rota</span></div>
      <div><b>${ramais}</b><span>ramais</span></div>
      <div><b>${usedFibers}/${fibers}</b><span>fibras no DIO</span></div>
    </div>
    <div class="rack-hint">👉 Clique numa <b>porta PON</b> da OLT para configurar a rota e os ramais, ou numa <b>fibra do DIO</b> para ver o que está ligado nela.</div>

    <div class="fp-group">
      <label class="fp-label">Nome do POP</label>
      <input class="fp-input" value="${pop.name}" onchange="popUpdate('${pop.id}','name',this.value)">
    </div>
    <div class="fp-group">
      <label class="fp-label">Coordenadas</label>
      <div class="fp-row">
        <input class="fp-input" value="${pop.lat.toFixed(6)}" readonly>
        <input class="fp-input" value="${pop.lng.toFixed(6)}" readonly>
      </div>
    </div>
    ${typeof renderPhotoGallery === 'function' ? renderPhotoGallery(pop.id) : ''}

    <div style="margin-top:14px; display:flex; flex-direction:column; gap:8px;">
      <button class="btn-full primary" onclick="rackSelect({ popId: '${pop.id}', type: 'catalog' })">＋ Adicionar equipamento</button>
      <button class="btn-full" style="background:var(--surface2);" onclick="clearHighlight()">🧹 Limpar Rastreamento</button>
      <button class="btn-full danger" onclick="deleteElement('${pop.id}')">🗑️ Remover POP</button>
    </div>`;
}

function renderOltDetail(pop, olt) {
  const rootCables = getPopRootCables(pop.id);
  const ports = getOltPorts(pop).find(o => o.olt.id === olt.id).ports;
  return `
    ${detailHeader('🖥️', olt.name, `GPON OLT · ${ports.filter(p => p.pon).length}/${ports.length} PONs com rota`)}
    <div class="fp-group">
      <label class="fp-label">Nome da OLT</label>
      <input class="fp-input" value="${olt.name}" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'name', this.value)" placeholder="Nome da OLT">
    </div>
    <div class="fp-row">
      <div class="fp-group">
        <label class="fp-label">Qtd. Portas PON</label>
        <select class="fp-input" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'ports', this.value)">
          ${[2, 4, 8, 16, 32].map(n => `<option value="${n}" ${olt.ports == n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="fp-group">
        <label class="fp-label">Potência TX (dBm)</label>
        <input class="fp-input" type="number" step="0.5" value="${olt.outputPower !== undefined ? olt.outputPower : (pop.outputPower || 4)}" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'outputPower', this.value)">
      </div>
    </div>
    <div class="fp-group">
      <label class="fp-label">Observações da OLT</label>
      <textarea class="fp-input" style="height:50px; resize:vertical;" onchange="updateOltEquipment('${pop.id}', '${olt.id}', 'obs', this.value)">${olt.obs || ''}</textarea>
    </div>

    <div class="fp-group">
      <label class="fp-label" style="color:var(--primary);">🔗 Cabos tronco (DIO) que saem desta OLT</label>
      <div style="font-size:9px; color:var(--text3); margin-bottom:4px;">Um cabo pode sair de mais de uma OLT: cada fibra mostra de qual OLT ela vem.</div>
      <div class="rack-checklist">
        ${rootCables.length === 0 ? '<span style="font-size:10px; color:var(--text3);">Nenhum cabo saindo deste POP.</span>' : rootCables.map(c => {
          const others = getCableOltIds(c).filter(id => id !== olt.id).map(id => (pop.oltEquipments.find(o => o.id === id) || {}).name).filter(Boolean);
          return `
            <label>
              <input type="checkbox" ${getCableOltIds(c).includes(olt.id) ? 'checked' : ''} onchange="window.toggleCableOltLink('${c.id}', '${olt.id}', this.checked)">
              ${c.name || 'Cabo Tronco ' + c.fibers + ' FO'}
              ${others.length ? `<span style="color:var(--text3); font-size:9px;">(também na ${others.join(', ')})</span>` : ''}
            </label>`;
        }).join('')}
      </div>
    </div>

    <div class="fp-group">
      <label class="fp-label">Portas PON</label>
      <div class="rack-pon-list">
        ${ports.map(p => `
          <button onclick="rackSelect({ popId: '${pop.id}', type: 'pon', oltId: '${olt.id}', ponIndex: ${p.index} })">
            <span class="color-dot" style="background:${p.pon ? p.pon.color : 'transparent'}"></span>
            PON ${String(p.local).padStart(2, '0')} <span>${p.pon ? p.pon.rotaName : 'livre'}</span>
          </button>`).join('')}
      </div>
    </div>

    ${rackMoveButtons(pop, 'olt:' + olt.id)}
    <button class="btn-full danger" onclick="removeOltEquipment('${pop.id}', '${olt.id}')">🗑️ Remover OLT</button>`;
}

function renderPonDetail(pop, ponIndex) {
  const ponToOltMap = buildPonToOltMap(pop);
  const olt = pop.oltEquipments.find(o => o.id === ponToOltMap[ponIndex]);
  const port = getOltPorts(pop).flatMap(o => o.ports).find(p => p.index === ponIndex);
  if (!olt || !port) return renderPopDetail(pop);
  const localId = String(port.local).padStart(2, '0');
  const pon = port.pon;

  if (!pon) {
    return `
      ${detailHeader('🔌', `${olt.name} · PON ${localId}`, 'Porta livre')}
      <div class="rack-hint">Esta porta ainda não tem rota. Configure uma rota para criar os ramais e ligar nas fibras do DIO.</div>
      <button class="btn-full primary" onclick="rackConfigurePon('${pop.id}', ${ponIndex})">⚡ Configurar rota nesta porta</button>`;
  }

  const hasConn = connectedRamais(pop, pon).length > 0;
  return `
    ${detailHeader('🔌', `${olt.name} · PON ${localId}`, `${pon.rotaName} · ${(pon.ramais || []).length} ramal(is)`)}
    <div class="rack-btn-row">
      <button class="rack-btn" style="opacity:${hasConn ? 1 : 0.5};" onclick="highlightPon('${pop.id}', ${ponIndex})" title="Ver no mapa para onde vai esta rota">🔍 Ver rota no mapa</button>
      <button class="rack-btn danger" onclick="removePonRota('${pop.id}', ${ponIndex})" title="Liberar porta">✕ Liberar porta</button>
    </div>
    <div class="pon-field-row">
      <div class="pon-field" style="flex:1">
        <label>Nome da Rota</label>
        <input type="text" value="${pon.rotaName}" onchange="updatePonRota('${pop.id}', ${ponIndex}, 'rotaName', this.value)">
      </div>
    </div>
    <div class="pon-field-row">
      <div class="pon-field" style="flex:1">
        <label>Cor da Rota: <b style="color:var(--text);">${routeColorName(pon.color)}</b></label>
        <div class="color-swatches">
          ${ROUTE_COLORS.map(c => `
            <button type="button" class="color-swatch ${pon.color === c.hex ? 'active' : ''}" title="${c.name}" onclick="updatePonRota('${pop.id}', ${ponIndex}, 'color', '${c.hex}')">
              <span class="color-dot" style="background:${c.hex}"></span>${c.name}
            </button>`).join('')}
        </div>
      </div>
    </div>

    <div style="margin-top:10px; border-top:1px dashed var(--border); padding-top:10px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="font-size:10px; font-weight:700; color:var(--text3)">🌿 RAMAIS (DISTRIBUIÇÃO)</span>
        <button class="pon-remove-btn" style="font-size:10px; color:var(--primary); font-weight:600;" onclick="addRamal('${pop.id}', ${ponIndex})">+ Adicionar Ramal</button>
      </div>
      ${(pon.ramais || []).map(ramal => renderRamalBlock(pop, pon, ponIndex, ramal, olt, ponToOltMap)).join('')}
    </div>`;
}

function renderRamalBlock(pop, pon, i, ramal, olt, ponToOltMap) {
  // Fibra do cabo tronco em que este ramal sai da OLT (é dela que a informação corre pela rede)
  const popCables = getPopRootCables(pop.id);
  let mappedFiberNum = '';
  let mappedValue = '';
  for (const pc of popCables) {
    const f = Object.keys(pc.fiberMapping || {}).find(k => pc.fiberMapping[k] === ramal.id);
    if (f) { mappedFiberNum = f; mappedValue = pc.id + ':' + f; break; }
  }
  const fiberOptions = popCables.filter(c => cableAcceptsOlt(c, ponToOltMap[pon.index]) || mappedValue.startsWith(c.id + ':')).map(c => {
    let opts = '';
    for (let f = 1; f <= c.fibers; f++) {
      const value = c.id + ':' + f;
      const other = c.fiberMapping && c.fiberMapping[f];
      const busy = other && other !== ramal.id ? getRamalInfo(other) : null;
      opts += `<option value="${value}" ${value === mappedValue ? 'selected' : ''} ${busy ? 'disabled' : ''}>${fiberLabel(f, c.fibers)}${busy ? ' — ' + busy.pon.rotaName + ' · ' + busy.ramal.name : ''}</option>`;
    }
    return `<optgroup label="${c.name || 'Cabo Tronco ' + c.fibers + ' FO'}">${opts}</optgroup>`;
  }).join('');

  let ramalHtml = `<div class="rack-ramal" style="background:var(--surface2); border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
    <div style="display:flex; gap:8px; margin-bottom:8px;">
      <span class="ramal-drag" draggable="true" ondragstart="rackDragRamal(event, '${ramal.id}')" title="Arraste até uma fibra do DIO para ligar este ramal">⠿</span>
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
        : `<button class="btn-full secondary" style="flex:1; margin-bottom:0; background:var(--surface2); color:var(--text3);" disabled title="Ligue este ramal numa fibra do DIO para gerar CTOs">⚠️ Ligue numa fibra do DIO</button>`}
      </div>
    </div>
  `;

  if (ramal.ctos && ramal.ctos.length > 0) {
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

      const ratios = Object.keys(ramal.type === 'desbalanceado' ? SPLITTER_UNBAL : SPLITTER_BAL);
      const ratioSelect = `<select style="font-size:10px; padding:2px; background:var(--surface2); border:1px solid var(--border); color:var(--text); border-radius:3px; outline:none; width:100%;" onchange="updateCTORatio('${pop.id}', ${i}, '${ramal.id}', ${idx}, this.value)">
        ${ratios.map(k => `<option value="${k}" ${cto.ratio === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select>`;

      ramalHtml += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:10px; gap:4px;">
        <span style="display:flex; align-items:center; flex:1; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${cto.name}">${cto.name}</span>
        <span style="flex:1">${ratioSelect}</span>
        <span style="flex:1; text-align:right; font-weight:700; ${colorStyle}">${res ? res.rx + ' dBm' : '--'}</span>
      </div>`;
    });
    ramalHtml += `</div>`;
  }

  return ramalHtml + `</div>`;
}

function renderDioDetail(pop, cable) {
  const used = [];
  for (let f = 1; f <= cable.fibers; f++) {
    const info = getRamalInfo(cable.fiberMapping[f]);
    if (info) used.push({ f, info });
  }
  return `
    ${detailHeader('🗄️', `DIO · ${cable.name}`, `${used.length}/${cable.fibers} fibras ligadas na OLT`)}
    <div class="fp-group">
      <label class="fp-label">Sai das OLTs</label>
      <div class="rack-checklist">
        ${pop.oltEquipments.map(o => `
          <label>
            <input type="checkbox" ${getCableOltIds(cable).includes(o.id) ? 'checked' : ''} onchange="toggleCableOltLink('${cable.id}', '${o.id}', this.checked)">
            ${o.name}
          </label>`).join('')}
      </div>
      <div style="font-size:9px; color:var(--text3); margin-top:2px;">Nenhuma marcada = aceita ramais de todas as OLTs do POP.</div>
    </div>
    <div class="fp-group">
      <label class="fp-label">Fibras ligadas</label>
      ${used.length === 0 ? '<div class="rack-hint">Nenhuma fibra ligada. Clique numa fibra do DIO ou arraste um ramal até ela.</div>' : used.map(({ f, info }) => `
        <button class="rack-fiber-row" onclick="rackSelect({ popId: '${pop.id}', type: 'fiber', cableId: '${cable.id}', fiber: ${f} })">
          <span class="color-dot" style="background:${FIBER_COLORS[(f - 1) % FIBER_COLORS.length].hex}"></span>
          <span><b>${fiberLabel(f, cable.fibers)}</b><br>${info.label}</span>
        </button>`).join('')}
    </div>
    ${rackMoveButtons(pop, 'dio:' + cable.id)}
    <button class="btn-full primary" onclick="selectElement('${cable.id}')">🧵 Abrir propriedades do cabo</button>`;
}

function renderFiberDetail(pop, cable, fiber) {
  const fColor = FIBER_COLORS[(fiber - 1) % FIBER_COLORS.length];
  const current = cable.fiberMapping[fiber] || '';
  const info = getRamalInfo(current);
  const ponToOltMap = buildPonToOltMap(pop);

  // Ramais que podem sair nesta fibra (das OLTs ligadas ao cabo)
  const options = (pop.pons || []).filter(pon => cableAcceptsOlt(cable, ponToOltMap[pon.index]) || (pon.ramais || []).some(r => r.id === current))
    .flatMap(pon => (pon.ramais || []).map(r => {
      let where = '';
      getPopRootCables(pop.id).forEach(c => Object.keys(c.fiberMapping || {}).forEach(f => {
        if (c.fiberMapping[f] === r.id && !(c.id === cable.id && parseInt(f) === fiber)) where = ` (hoje em ${c.name} F${f} — será movido)`;
      }));
      return `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${getRamalInfo(r.id).label}${where}</option>`;
    })).join('');

  return `
    ${detailHeader(`<span class="color-dot big" style="background:${fColor.hex}"></span>`, fiberLabel(fiber, cable.fibers), `DIO · ${cable.name}`)}
    <div class="rack-fiber-status ${info ? 'on' : 'off'}">
      ${info ? `🟢 <b>${info.label}</b>` : '⚪ Fibra livre — não está ligada em nenhuma porta da OLT'}
    </div>
    <div class="fp-group">
      <label class="fp-label">Ligar nesta fibra o ramal</label>
      <select class="fp-input" onchange="setFiberMapping('${cable.id}', ${fiber}, this.value)">
        <option value="">-- Livre --</option>
        ${options}
      </select>
    </div>
    ${info ? `
      <div class="rack-btn-row">
        <button class="rack-btn" onclick="highlightRamal('${pop.id}', '${current}')">🔍 Ver no mapa</button>
        <button class="rack-btn" onclick="rackSelect({ popId: '${pop.id}', type: 'pon', ponIndex: ${info.pon.index} })">🔌 Ir para a PON</button>
      </div>` : ''}`;
}

function rackMoveButtons(pop, key) {
  const keys = getRackEntries(pop).map(e => e.key);
  const i = keys.indexOf(key);
  return `
    <div class="rack-btn-row">
      <button class="rack-btn" ${i <= 0 ? 'disabled' : ''} onclick="rackMove('${pop.id}', '${key}', -1)">⬆ Subir no rack</button>
      <button class="rack-btn" ${i >= keys.length - 1 ? 'disabled' : ''} onclick="rackMove('${pop.id}', '${key}', 1)">⬇ Descer no rack</button>
    </div>`;
}

function renderCatalog(pop) {
  return `
    ${detailHeader('➕', 'Adicionar equipamento', 'Escolha o que existe neste POP')}
    <div class="eq-catalog">
      <button class="eq-card" onclick="rackAddOlt('${pop.id}')">
        <span class="eq-card-icon">🖥️</span><b>OLT GPON</b><span>Portas PON para as rotas</span>
      </button>
      ${EQUIPMENT_CATALOG.map(c => `
        <button class="eq-card" onclick="rackAddEquipment('${pop.id}', '${c.type}')">
          <span class="eq-card-icon">${c.icon}</span><b>${c.label}</b><span>${c.desc}</span>
        </button>`).join('')}
    </div>
    <div class="rack-hint" style="margin-top:12px;">🗄️ O <b>DIO</b> aparece sozinho no rack para cada cabo tronco que sai deste POP.</div>`;
}

function renderEquipDetail(pop, item) {
  const cat = catalogEntry(item.type);
  const key = 'eq:' + item.id;
  const field = (prop, label, attrs = '') => `
    <div class="fp-group">
      <label class="fp-label">${label}</label>
      <input class="fp-input" value="${item[prop] !== undefined ? item[prop] : ''}" ${attrs} onchange="rackUpdateEquipment('${pop.id}', '${item.id}', '${prop}', this.value)">
    </div>`;
  return `
    ${detailHeader(cat.icon, item.name, cat.label)}
    ${field('name', 'Nome')}
    ${field('model', 'Fabricante / Modelo', 'placeholder="Ex.: MikroTik CCR2004, Huawei NE8000"')}
    <div class="fp-row">
      <div class="fp-group">
        <label class="fp-label">Altura (U)</label>
        <select class="fp-input" onchange="rackUpdateEquipment('${pop.id}', '${item.id}', 'u', this.value)">
          ${[1, 2, 3, 4].map(n => `<option value="${n}" ${parseInt(item.u) === n ? 'selected' : ''}>${n}U</option>`).join('')}
        </select>
      </div>
      ${field('ip', 'IP de gerência', 'placeholder="Ex.: 10.0.0.1"')}
    </div>
    ${PORT_FACES.includes(cat.face) ? `
      <div class="fp-row">
        ${field('rj45', cat.face === 'patch' ? 'Portas (keystone)' : 'Portas RJ45', 'type="number" min="0" max="96"')}
        ${cat.face === 'patch' ? '' : field('sfp', 'Portas SFP / SFP+', 'type="number" min="0" max="48"')}
      </div>` : ''}
    <div class="fp-group">
      <label class="fp-label">Observações</label>
      <textarea class="fp-input" style="height:60px; resize:vertical;" onchange="rackUpdateEquipment('${pop.id}', '${item.id}', 'obs', this.value)">${item.obs || ''}</textarea>
    </div>
    ${rackMoveButtons(pop, key)}
    <button class="btn-full danger" onclick="rackRemoveEquipment('${pop.id}', '${item.id}')">🗑️ Remover do rack</button>`;
}

// ================================================================
//  AÇÕES
// ================================================================

/** Adiciona um equipamento do catálogo no fim do rack e abre a edição dele */
function rackAddEquipment(popId, type) {
  const pop = STATE.olts.find(o => o.id === popId);
  const cat = catalogEntry(type);
  if (!pop.rackItems) pop.rackItems = [];
  const same = pop.rackItems.filter(i => i.type === type).length;
  const item = {
    id: 'eq_' + Date.now(),
    type,
    name: same ? `${cat.label} ${same + 1}` : cat.label,
    model: '',
    u: cat.u,
    rj45: cat.rj45,
    sfp: cat.sfp,
    ip: '',
    obs: '',
  };
  pop.rackItems.push(item);
  saveLocal();
  rackSelect({ popId, type: 'eq', eqId: item.id });
  toast(`✅ ${item.name} adicionado no rack`);
}

function rackUpdateEquipment(popId, eqId, prop, value) {
  const pop = STATE.olts.find(o => o.id === popId);
  const item = (pop.rackItems || []).find(i => i.id === eqId);
  if (!item) return;
  if (['u', 'rj45', 'sfp'].includes(prop)) value = Math.max(0, parseInt(value) || 0);
  if (prop === 'u') value = Math.min(4, Math.max(1, value));
  item[prop] = value;
  saveLocal();
  renderPanel();
}

function rackRemoveEquipment(popId, eqId) {
  const pop = STATE.olts.find(o => o.id === popId);
  const item = (pop.rackItems || []).find(i => i.id === eqId);
  if (!item || !confirm(`Remover ${item.name} do rack?`)) return;
  pop.rackItems = pop.rackItems.filter(i => i.id !== eqId);
  pop.rackOrder = (pop.rackOrder || []).filter(k => k !== 'eq:' + eqId);
  saveLocal();
  rackSelect({ popId, type: 'pop' });
}

/** Sobe (-1) ou desce (+1) uma peça no rack */
function rackMove(popId, key, dir) {
  const pop = STATE.olts.find(o => o.id === popId);
  const keys = getRackEntries(pop).map(e => e.key);
  const i = keys.indexOf(key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return;
  [keys[i], keys[j]] = [keys[j], keys[i]];
  pop.rackOrder = keys;
  saveLocal();
  renderPanel();
}

/** Rack em tela cheia (esconde o mapa) ou no tamanho normal */
function rackToggleFull() {
  window.rackFull = !window.rackFull;
  renderPanel();
}

function rackAddOlt(popId) {
  addOltEquipment(popId);
  const pop = STATE.olts.find(o => o.id === popId);
  const olt = pop.oltEquipments[pop.oltEquipments.length - 1];
  rackSelect({ popId, type: 'olt', oltId: olt.id });
}

function rackConfigurePon(popId, ponIndex) {
  window.rackSel = { popId, type: 'pon', ponIndex };
  addPonRota(popId, ponIndex);
}

function rackDragRamal(ev, ramalId) {
  ev.dataTransfer.setData('text/ramal', ramalId);
  ev.dataTransfer.effectAllowed = 'link';
  document.querySelector('.rack')?.classList.add('dragging-ramal');
}

function rackDragOver(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('drop-ok');
}

/** Soltar um ramal numa fibra do DIO: liga o ramal nessa fibra (sai da que estava) */
function rackDropRamal(ev, cableId, fiber) {
  ev.preventDefault();
  document.querySelector('.rack')?.classList.remove('dragging-ramal');
  const ramalId = ev.dataTransfer.getData('text/ramal');
  if (!ramalId) return;
  const cable = STATE.cables.find(c => c.id === cableId);
  const other = getRamalInfo(cable.fiberMapping[fiber]);
  if (other && other.ramal.id !== ramalId) {
    toast(`⚠️ ${fiberLabel(fiber, cable.fibers)} já está com ${other.pon.rotaName} · ${other.ramal.name}`);
    renderPanel();
    return;
  }
  const info = getRamalInfo(ramalId);
  if (info && !cableAcceptsOlt(cable, info.olt && info.olt.id)) {
    toast(`⚠️ O ${cable.name} não está ligado na ${info.oltName}. Marque a OLT no DIO.`);
    renderPanel();
    return;
  }
  setFiberMapping(cableId, fiber, ramalId);
  toast(`🔗 ${info ? info.ramal.name : 'Ramal'} ligado na ${fiberLabel(fiber, cable.fibers)} do ${cable.name}`);
}

document.addEventListener('dragend', () => document.querySelector('.rack')?.classList.remove('dragging-ramal'));

// ================================================================
//  CORDÕES DE MANOBRA (PON -> DIO)
// ================================================================

/** Desenha os cordões entre a porta PON e a fibra do DIO de cada ramal ligado */
function drawRackCords() {
  const rack = document.querySelector('.rack[data-pop]');
  if (!rack) return;
  const svg = rack.querySelector('svg.rack-cords');
  const pop = STATE.olts.find(o => o.id === rack.dataset.pop);
  if (!svg || !pop) return;

  const base = rack.getBoundingClientRect();
  svg.setAttribute('width', base.width);
  svg.setAttribute('height', base.height);
  const center = el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2 };
  };

  let paths = '';
  getPopRootCables(pop.id).forEach(cable => {
    Object.keys(cable.fiberMapping || {}).forEach(f => {
      const info = getRamalInfo(cable.fiberMapping[f]);
      if (!info || info.pop.id !== pop.id) return;
      const ponEl = rack.querySelector(`[data-pon="${info.pon.index}"]`);
      const fibEl = rack.querySelector(`[data-fiber="${cable.id}:${f}"]`);
      if (!ponEl || !fibEl) return;
      const a = center(ponEl);
      const b = center(fibEl);
      const sag = Math.max(30, Math.abs(b.y - a.y) * 0.45);
      const d = `M ${a.x} ${a.y} C ${a.x} ${a.y + sag}, ${b.x} ${b.y - sag}, ${b.x} ${b.y}`;
      const color = info.pon.color || '#f97316';
      const edge = color === '#000000' ? '#cbd5e1' : 'rgba(0,0,0,0.6)';
      const key = `pon-${info.pon.index}`;
      paths += `
        <g class="cord${window.rackHoverKey === key ? ' active' : ''}" data-key="${key}">
          <title>${info.label} ➜ ${cable.name} · ${fiberLabel(parseInt(f), cable.fibers)}</title>
          <path d="${d}" stroke="${edge}" stroke-width="5" fill="none" stroke-linecap="round"/>
          <path d="${d}" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
        </g>`;
    });
  });
  svg.innerHTML = paths;
}

/** Passar o mouse numa PON (ou na fibra dela) realça os cordões dessa PON */
function rackHover(key, on) {
  window.rackHoverKey = on ? key : null;
  document.querySelectorAll(`.rack .cord[data-key="${key}"]`).forEach(g => g.classList.toggle('active', on));
  document.querySelector('.rack')?.classList.toggle('cord-focus', on);
}

function afterRenderRack() {
  if (!document.querySelector('.rack[data-pop]')) return;
  drawRackCords();
  // Redesenha quando a gaveta termina de abrir/alargar (as posições mudam)
  requestAnimationFrame(drawRackCords);
}

document.addEventListener('transitionend', e => {
  if (e.target && e.target.id === 'panelRight') afterRenderRack();
});

window.addEventListener('resize', afterRenderRack);
