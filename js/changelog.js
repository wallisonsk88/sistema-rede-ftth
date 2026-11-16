/**
 * changelog.js — Histórico de alterações do projeto
 *
 * A cada gravação na nuvem, o estado anterior é comparado com o novo e as
 * diferenças viram frases ("CTO 03 movida", "Fusão F4 Azul ..."). Cada gravação
 * vira um registro em users/{uid}/projectLogs/{projectId}/entries, com data,
 * conta e aparelho. Fotos (que não passam pelo saveLocal) também registram.
 */

const LOG_MAX_CHANGES = 150;
const LOG_PAGE = 30;

function projectLogRef(uid = currentUser.uid, projectId = currentProjectId) {
  return fbDB.collection('users').doc(uid).collection('projectLogs').doc(projectId).collection('entries');
}

function logDevice() {
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? '📱 Celular' : '💻 Computador';
}

/** Monta o registro (null se não houve mudança) */
function buildLogEntry(changes) {
  if (!changes.length) return null;
  return {
    at: new Date().toISOString(),
    by: (currentUser && currentUser.email) || '',
    device: logDevice(),
    total: changes.length,
    changes: changes.slice(0, LOG_MAX_CHANGES),
  };
}

/** Registra alterações que não passam pelo saveLocal (ex.: fotos) */
function logChanges(changes) {
  const entry = buildLogEntry(changes);
  if (!entry || !currentUser || !currentProjectId) return;
  projectLogRef().add(entry).catch(e => console.warn('Histórico não gravado:', e));
}

// ----------------------------------------------------------------
//  Comparação entre dois estados
// ----------------------------------------------------------------

const logQ = s => `"${s || 'sem nome'}"`;
const logFiber = n => {
  const c = FIBER_COLORS[(parseInt(n) - 1) % FIBER_COLORS.length];
  return `F${n}${c ? ' ' + c.name : ''}`;
};
const logSame = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const logMoved = (a, b) => Math.abs((a.lat || 0) - (b.lat || 0)) > 1e-7 || Math.abs((a.lng || 0) - (b.lng || 0)) > 1e-7;
const logIndex = arr => Object.fromEntries((arr || []).filter(x => x && x.id).map(x => [x.id, x]));
const logLen = path => { try { return formatDist(calcPolylineLength(path || [])); } catch (e) { return ''; } };

/** Ramais e CTOs de um estado, com o caminho até eles */
function logFlatten(data) {
  const ramais = {}, ctos = {}, pons = {};
  (data.olts || []).forEach(pop => (pop.pons || []).forEach(pon => {
    pons[pop.id + ':' + pon.index] = { pop, pon };
    (pon.ramais || []).forEach(r => {
      ramais[r.id] = { pop, pon, ramal: r };
      (r.ctos || []).forEach(cto => { ctos[cto.id] = { pop, pon, ramal: r, cto }; });
    });
  }));
  return { ramais, ctos, pons };
}

function describeChanges(oldD, newD) {
  const out = [];
  const add = (t, id) => out.push(id ? { t, id } : { t });
  const oldF = logFlatten(oldD), newF = logFlatten(newD);
  const ramalName = id => (newF.ramais[id] || oldF.ramais[id])?.ramal.name || 'livre';

  if ((oldD.projectName || '') !== (newD.projectName || '')) add(`📝 Projeto renomeado: ${logQ(oldD.projectName)} → ${logQ(newD.projectName)}`);

  // ---------- POPs ----------
  const oPops = logIndex(oldD.olts), nPops = logIndex(newD.olts);
  Object.values(nPops).forEach(n => {
    const o = oPops[n.id];
    if (!o) return add(`🏢 POP ${logQ(n.name)} criado`, n.id);
    const nm = logQ(n.name);
    if (o.name !== n.name) add(`🏢 POP renomeado: ${logQ(o.name)} → ${nm}`, n.id);
    if (logMoved(o, n)) add(`🏢 POP ${nm} movido no mapa`, n.id);
    if (!logSame(o.outputPower, n.outputPower)) add(`🏢 POP ${nm}: potência de saída ${o.outputPower ?? '-'} → ${n.outputPower ?? '-'}`, n.id);
    if (!logSame(o.obs, n.obs)) add(`🏢 POP ${nm}: observação alterada`, n.id);
    // Rack
    const oEq = logIndex([...(o.oltEquipments || []), ...(o.rackItems || [])]);
    const nEq = logIndex([...(n.oltEquipments || []), ...(n.rackItems || [])]);
    Object.values(nEq).forEach(e => {
      if (!oEq[e.id]) add(`🗄️ Rack do POP ${nm}: ${logQ(e.name || e.model || e.type)} adicionado`, n.id);
      else if (!logSame(oEq[e.id], e)) add(`🗄️ Rack do POP ${nm}: ${logQ(e.name || e.model || e.type)} alterado`, n.id);
    });
    Object.values(oEq).forEach(e => { if (!nEq[e.id]) add(`🗄️ Rack do POP ${nm}: ${logQ(e.name || e.model || e.type)} removido`, n.id); });
    if (!logSame(o.rackOrder, n.rackOrder)) add(`🗄️ Rack do POP ${nm}: ordem dos equipamentos alterada`, n.id);
    const ol = (o.rackLinks || []).length, nl = (n.rackLinks || []).length;
    if (!logSame(o.rackLinks, n.rackLinks)) add(`🔗 Rack do POP ${nm}: cordões/ligações alterados (${ol} → ${nl})`, n.id);
    if (!logSame(o.portInfo, n.portInfo)) add(`🏷️ Rack do POP ${nm}: nomes/informações de portas alterados`, n.id);
    const oD = logIndex(o.dios), nD = logIndex(n.dios);
    Object.values(nD).forEach(d => {
      const od = oD[d.id];
      if (!od) return add(`🔲 DIO ${logQ(d.name)} adicionado no POP ${nm}`, n.id);
      if (od.name !== d.name) add(`🔲 DIO renomeado: ${logQ(od.name)} → ${logQ(d.name)}`, n.id);
      const ports = new Set([...Object.keys(od.terms || {}), ...Object.keys(d.terms || {})]);
      const changed = [...ports].filter(p => !logSame((od.terms || {})[p], (d.terms || {})[p]));
      if (changed.length) add(`🔲 DIO ${logQ(d.name)}: ${changed.length} porta(s) com fibra alterada (${changed.slice(0, 8).join(', ')}${changed.length > 8 ? '…' : ''})`, n.id);
      const rest = (x) => { const c = { ...x }; delete c.terms; delete c.name; return c; };
      if (!logSame(rest(od), rest(d))) add(`🔲 DIO ${logQ(d.name)}: configuração alterada`, n.id);
    });
    Object.values(oD).forEach(d => { if (!nD[d.id]) add(`🔲 DIO ${logQ(d.name)} removido do POP ${nm}`, n.id); });
  });
  Object.values(oPops).forEach(o => { if (!nPops[o.id]) add(`🗑️ POP ${logQ(o.name)} apagado`); });

  // ---------- Rotas (PON), ramais e CTOs ----------
  Object.entries(newF.pons).forEach(([k, { pop, pon }]) => {
    const o = oldF.pons[k];
    const label = `PON ${String(pon.index).padStart(2, '0')}`;
    if (!o) return add(`🛣️ Rota ${logQ(pon.rotaName)} configurada na ${label} do POP ${logQ(pop.name)}`, pop.id);
    if (o.pon.rotaName !== pon.rotaName) add(`🛣️ Rota renomeada: ${logQ(o.pon.rotaName)} → ${logQ(pon.rotaName)}`, pop.id);
    if (o.pon.color !== pon.color) add(`🎨 Rota ${logQ(pon.rotaName)}: cor alterada`, pop.id);
  });
  Object.entries(oldF.pons).forEach(([k, { pop, pon }]) => {
    if (!newF.pons[k]) add(`🗑️ Rota ${logQ(pon.rotaName)} removida da PON ${String(pon.index).padStart(2, '0')} do POP ${logQ(pop.name)}`, pop.id);
  });
  Object.values(newF.ramais).forEach(({ pop, pon, ramal }) => {
    const o = oldF.ramais[ramal.id];
    if (!o) return add(`🌿 Ramal ${logQ(ramal.name)} criado na rota ${logQ(pon.rotaName)}`, pop.id);
    if (o.ramal.name !== ramal.name) add(`🌿 Ramal renomeado: ${logQ(o.ramal.name)} → ${logQ(ramal.name)}`, pop.id);
    if (o.ramal.type !== ramal.type) add(`🌿 Ramal ${logQ(ramal.name)}: tipo ${o.ramal.type || '-'} → ${ramal.type || '-'}`, pop.id);
    if (o.ramal.attSplitter !== ramal.attSplitter) add(`🌿 Ramal ${logQ(ramal.name)}: splitter de atendimento ${o.ramal.attSplitter || '-'} → ${ramal.attSplitter || '-'}`, pop.id);
  });
  Object.values(oldF.ramais).forEach(({ ramal }) => { if (!newF.ramais[ramal.id]) add(`🗑️ Ramal ${logQ(ramal.name)} apagado`); });
  Object.values(newF.ctos).forEach(({ ramal, cto }) => {
    const o = oldF.ctos[cto.id];
    const nm = logQ(cto.name);
    if (!o) return add(`📦 CTO ${nm} criada no ramal ${logQ(ramal.name)}`, cto.id);
    const oc = o.cto;
    if (!oc.lat && cto.lat) add(`📦 CTO ${nm} colocada no mapa`, cto.id);
    else if (oc.lat && !cto.lat) add(`📦 CTO ${nm} retirada do mapa`, cto.id);
    else if (cto.lat && logMoved(oc, cto)) add(`📦 CTO ${nm} movida no mapa`, cto.id);
    if (oc.name !== cto.name && o.ramal.id === ramal.id) add(`📦 CTO renomeada: ${logQ(oc.name)} → ${nm}`, cto.id);
    if (o.ramal.id !== ramal.id) add(`📦 CTO ${logQ(oc.name)} passou do ramal ${logQ(o.ramal.name)} para ${logQ(ramal.name)}${oc.name !== cto.name ? ` (agora ${nm})` : ''}`, cto.id);
    if (oc.ratio !== cto.ratio) add(`📦 CTO ${nm}: splitter ${oc.ratio || '-'} → ${cto.ratio || '-'}`, cto.id);
    if (oc.cableId !== cto.cableId || String(oc.fiberIndex || '') !== String(cto.fiberIndex || '')) {
      const cName = id => logQ(((newD.cables || []).find(c => c.id === id) || (oldD.cables || []).find(c => c.id === id) || {}).name);
      add(`📦 CTO ${nm}: ligação ${oc.cableId ? cName(oc.cableId) + ' ' + logFiber(oc.fiberIndex || '?') : 'nenhuma'} → ${cto.cableId ? cName(cto.cableId) + ' ' + logFiber(cto.fiberIndex || '?') : 'nenhuma'}`, cto.id);
    }
    const rest = x => { const c = { ...x }; ['id', 'name', 'lat', 'lng', 'ratio', 'cableId', 'fiberIndex', 'type', 'attSplitter'].forEach(k => delete c[k]); return c; };
    if (!logSame(rest(oc), rest(cto))) add(`📦 CTO ${nm}: dados alterados`, cto.id);
  });
  Object.values(oldF.ctos).forEach(({ ramal, cto }) => { if (!newF.ctos[cto.id]) add(`🗑️ CTO ${logQ(cto.name)} apagada (ramal ${logQ(ramal.name)})`); });

  // ---------- Cabos ----------
  const oCab = logIndex(oldD.cables), nCab = logIndex(newD.cables);
  Object.values(nCab).forEach(n => {
    const o = oCab[n.id];
    const nm = logQ(n.name);
    if (!o) return add(`〰️ Cabo ${nm} lançado (${n.fibers} FO, ${logLen(n.path)})`, n.id);
    if (o.name !== n.name) add(`〰️ Cabo renomeado: ${logQ(o.name)} → ${nm}`, n.id);
    if (!logSame(o.path, n.path)) add(`〰️ Cabo ${nm}: traçado alterado (${logLen(o.path)} → ${logLen(n.path)})`, n.id);
    if (o.fibers !== n.fibers) add(`〰️ Cabo ${nm}: capacidade ${o.fibers} FO → ${n.fibers} FO`, n.id);
    if (o.sourceId !== n.sourceId) add(`〰️ Cabo ${nm}: origem alterada`, n.id);
    if (!logSame([...(o.oltIds || [])].sort(), [...(n.oltIds || [])].sort())) add(`〰️ Cabo ${nm}: POPs ligados alterados`, n.id);
    const om = o.fiberMapping || {}, nmap = n.fiberMapping || {};
    const fibers = new Set([...Object.keys(om), ...Object.keys(nmap)]);
    // Nos cabos derivados o ramal vem das fusões (recalculado); só o tronco guarda a escolha
    if (n.sourceType !== 'splice') {
      [...fibers].sort((a, b) => a - b).forEach(f => {
        if (om[f] !== nmap[f]) add(`🧵 Cabo ${nm} ${logFiber(f)}: ${ramalName(om[f])} → ${ramalName(nmap[f])}`, n.id);
      });
    }
    const oR = logIndex(o.reserves), nR = logIndex(n.reserves);
    Object.values(nR).forEach(r => {
      if (!oR[r.id]) add(`🌀 Reserva técnica de ${r.meters || 0} m lançada no cabo ${nm}`, r.id);
      else {
        if (oR[r.id].meters !== r.meters) add(`🌀 Reserva no cabo ${nm}: ${oR[r.id].meters || 0} m → ${r.meters || 0} m`, r.id);
        if (logMoved(oR[r.id], r)) add(`🌀 Reserva no cabo ${nm} movida`, r.id);
        if (oR[r.id].obs !== r.obs) add(`🌀 Reserva no cabo ${nm}: observação alterada`, r.id);
      }
    });
    Object.values(oR).forEach(r => { if (!nR[r.id]) add(`🗑️ Reserva técnica de ${r.meters || 0} m removida do cabo ${nm}`, n.id); });
    const oB = logIndex(o.breaks), nB = logIndex(n.breaks);
    Object.values(nB).forEach(b => {
      if (!oB[b.id]) add(`⚡ Rompimento registrado no cabo ${nm}`, b.id);
      else if (!logSame(oB[b.id], b)) add(`⚡ Rompimento no cabo ${nm}: ${logMoved(oB[b.id], b) ? 'movido' : 'dados alterados'}`, b.id);
    });
    Object.values(oB).forEach(b => { if (!nB[b.id]) add(`🗑️ Rompimento removido do cabo ${nm}`, n.id); });
  });
  Object.values(oCab).forEach(o => { if (!nCab[o.id]) add(`🗑️ Cabo ${logQ(o.name)} apagado (${logLen(o.path)})`); });

  // ---------- CEOs ----------
  const cabName = id => logQ(((newD.cables || []).find(c => c.id === id) || (oldD.cables || []).find(c => c.id === id) || {}).name);
  const srcLabel = src => (typeof src === 'string' && /^S/.test(src)) ? `saída ${src.slice(1)} do splitter` : logFiber(src);
  const oSp = logIndex(oldD.splices), nSp = logIndex(newD.splices);
  Object.values(nSp).forEach(n => {
    const o = oSp[n.id];
    const nm = logQ(n.name);
    if (!o) return add(`🔴 CEO ${nm} criada no cabo ${cabName(n.cableId)}`, n.id);
    if (o.name !== n.name) add(`🔴 CEO renomeada: ${logQ(o.name)} → ${nm}`, n.id);
    if (logMoved(o, n)) add(`🔴 CEO ${nm} movida no mapa`, n.id);
    if (o.cableId !== n.cableId) add(`🔴 CEO ${nm}: cabo de entrada ${cabName(o.cableId)} → ${cabName(n.cableId)}`, n.id);
    if (!logSame(o.obs, n.obs)) add(`🔴 CEO ${nm}: observação alterada`, n.id);
    const os = o.splitter, ns = n.splitter;
    if (!os && ns) add(`🔀 CEO ${nm}: splitter ${ns.ratio || '1:' + ns.outputs} instalado`, n.id);
    else if (os && !ns) add(`🔀 CEO ${nm}: splitter removido`, n.id);
    else if (os && ns) {
      if (os.outputs !== ns.outputs || os.ratio !== ns.ratio) add(`🔀 CEO ${nm}: splitter ${os.ratio || '1:' + os.outputs} → ${ns.ratio || '1:' + ns.outputs}`, n.id);
      if (String(os.inputFiber || '') !== String(ns.inputFiber || '')) add(`🔀 CEO ${nm}: entrada do splitter ${os.inputFiber ? logFiber(os.inputFiber) : 'nenhuma'} → ${ns.inputFiber ? logFiber(ns.inputFiber) : 'nenhuma'}`, n.id);
    }
    const of = o.fusions || {}, nf = n.fusions || {};
    new Set([...Object.keys(of), ...Object.keys(nf)]).forEach(dest => {
      const a = of[dest] || {}, b = nf[dest] || {};
      new Set([...Object.keys(a), ...Object.keys(b)]).forEach(df => {
        if (String(a[df] ?? '') === String(b[df] ?? '')) return;
        const into = `${logFiber(df)} do cabo ${cabName(dest)}`;
        if (a[df] == null) add(`🔥 CEO ${nm}: fusão ${srcLabel(b[df])} de ${cabName(n.cableId)} → ${into}`, n.id);
        else if (b[df] == null) add(`✂️ CEO ${nm}: fusão desfeita (${srcLabel(a[df])} → ${into})`, n.id);
        else add(`🔥 CEO ${nm}: ${into} agora recebe ${srcLabel(b[df])} (antes ${srcLabel(a[df])})`, n.id);
      });
    });
  });
  Object.values(oSp).forEach(o => { if (!nSp[o.id]) add(`🗑️ CEO ${logQ(o.name)} apagada`); });

  if (!out.length && JSON.stringify(oldD) !== JSON.stringify(newD)) add('✏️ Outros ajustes no projeto');
  return out;
}

// ----------------------------------------------------------------
//  Tela do histórico
// ----------------------------------------------------------------

let logLastDoc = null;
let logEntries = [];

async function openChangeLog() {
  document.getElementById('logModal').style.display = 'flex';
  document.getElementById('logSearch').value = '';
  logEntries = [];
  logLastDoc = null;
  document.getElementById('logContent').innerHTML = '<div class="log-empty">⏳ Carregando histórico...</div>';
  await loadMoreLog();
}

function closeChangeLog() {
  document.getElementById('logModal').style.display = 'none';
}

async function loadMoreLog() {
  try {
    let q = projectLogRef().orderBy('at', 'desc').limit(LOG_PAGE);
    if (logLastDoc) q = q.startAfter(logLastDoc);
    const snap = await q.get();
    if (snap.docs.length) logLastDoc = snap.docs[snap.docs.length - 1];
    logEntries.push(...snap.docs.map(d => d.data()));
    renderChangeLog(snap.docs.length === LOG_PAGE);
  } catch (e) {
    document.getElementById('logContent').innerHTML = `<div class="log-empty">⚠️ Erro ao carregar: ${e.message}</div>`;
  }
}

function logEsc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderChangeLog(hasMore) {
  if (hasMore === undefined) hasMore = !!document.getElementById('logMoreBtn');
  const term = (document.getElementById('logSearch').value || '').trim().toLowerCase();
  const el = document.getElementById('logContent');
  if (!logEntries.length) {
    el.innerHTML = '<div class="log-empty">Nenhuma alteração registrada ainda.<br><small>O histórico começa a partir de agora: toda alteração salva aparece aqui.</small></div>';
    return;
  }
  let lastDay = '';
  let html = '';
  logEntries.forEach(e => {
    const items = (e.changes || []).filter(c => !term || c.t.toLowerCase().includes(term) || (e.by || '').toLowerCase().includes(term));
    if (!items.length) return;
    const d = new Date(e.at);
    const day = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    if (day !== lastDay) { html += `<div class="log-day">${day}</div>`; lastDay = day; }
    html += `
      <div class="log-entry">
        <div class="log-head">
          <b>${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b>
          <span>${logEsc(e.by)}</span><span>${logEsc(e.device)}</span>
        </div>
        ${items.map(c => `<div class="log-item${c.id ? ' link' : ''}" ${c.id ? `onclick="focusLoggedElement('${logEsc(c.id)}')" title="Mostrar no mapa"` : ''}>${logEsc(c.t)}</div>`).join('')}
        ${e.total > (e.changes || []).length ? `<div class="log-item" style="color:var(--text3);">… e mais ${e.total - e.changes.length} alteração(ões)</div>` : ''}
      </div>`;
  });
  if (!html) html = '<div class="log-empty">Nada encontrado com esse filtro nas alterações carregadas.</div>';
  if (hasMore) html += `<button class="btn-full" id="logMoreBtn" style="margin-top:10px;" onclick="this.disabled=true; this.textContent='⏳ Carregando...'; loadMoreLog()">Carregar mais antigas</button>`;
  el.innerHTML = html;
}

/** Centraliza e seleciona no mapa o elemento citado no histórico */
function focusLoggedElement(id) {
  let latlng = null, bounds = null;
  const pop = STATE.olts.find(o => o.id === id);
  const cable = STATE.cables.find(c => c.id === id);
  const splice = STATE.splices.find(s => s.id === id);
  let cto = null;
  STATE.olts.forEach(p => (p.pons || []).forEach(pon => (pon.ramais || []).forEach(r => (r.ctos || []).forEach(c => { if (c.id === id) cto = c; }))));
  const mark = typeof findCableMark === 'function' ? findCableMark(id) : null;
  if (pop) latlng = [pop.lat, pop.lng];
  else if (splice) latlng = [splice.lat, splice.lng];
  else if (cto && cto.lat) latlng = [cto.lat, cto.lng];
  else if (mark) latlng = [mark.mark.lat, mark.mark.lng];
  else if (cable && cable.layer) bounds = cable.layer.getBounds();
  if (!latlng && !bounds) { toast('Esse item não existe mais no projeto.'); return; }
  closeChangeLog();
  if (bounds) map.fitBounds(bounds, { padding: [40, 40] });
  else map.setView(latlng, Math.max(map.getZoom(), 18));
  if (cable) STATE.clickedLatLng = null;
  selectElement(id);
}
