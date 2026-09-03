/**
 * storage.js — Persistência local, importação e exportação
 */

const urlParams = new URLSearchParams(window.location.search);
const currentProjectId = urlParams.get('id');
const STORAGE_KEY = currentProjectId ? `meganet_ftth_project_${currentProjectId}` : 'meganet_ftth_v2';
const PROJECTS_LIST_KEY = 'meganet_projects_list';
let saveTimeout = null;
window.STATE_HISTORY = [];
window.isUndoing = false;

/** Atualiza o nome e data do projeto na lista do dashboard */
function syncProjectMeta(projectName) {
  if (!currentProjectId) return;
  try {
    const projects = JSON.parse(localStorage.getItem(PROJECTS_LIST_KEY)) || [];
    const idx = projects.findIndex(p => p.id === currentProjectId);
    if (idx !== -1) {
      projects[idx].name = projectName;
      projects[idx].updatedAt = new Date().toISOString();
    } else {
      // Projeto não está na lista ainda — adiciona
      projects.push({ id: currentProjectId, name: projectName, updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projects));
  } catch(e) {}
}

function saveLocal() {
  const data = {
    timestamp: Date.now(),
    projectName: document.getElementById('projectName').value,
    nextOLTNum: STATE.nextOLTNum,
    olts: STATE.olts.map(o => ({
      id: o.id,
      lat: o.lat,
      lng: o.lng,
      name: o.name,
      outputPower: o.outputPower,
      ponPorts: o.ponPorts,
      pons: o.pons,
      oltEquipments: o.oltEquipments,
      obs: o.obs,
    })),
    cables: STATE.cables.map(c => ({
      id: c.id,
      name: c.name,
      popId: c.popId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      oltId: c.oltId,
      path: c.path,
      fibers: c.fibers,
      fiberMapping: c.fiberMapping,
    })),
    splices: STATE.splices.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      cableId: s.cableId,
      fusions: s.fusions,
      splitter: s.splitter,
      obs: s.obs
    })),
    ctos: STATE.ctos.map(c => ({
      id: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      cableId: c.cableId,
      portCount: c.portCount,
      fiberIndex: c.fiberIndex,
      ratio: c.ratio
    }))
  };

  const currentStateJson = JSON.stringify(data);

  // Histórico de Desfazer (Undo)
  if (!window.isUndoing) {
    if (window.STATE_HISTORY.length === 0 || window.STATE_HISTORY[window.STATE_HISTORY.length - 1] !== currentStateJson) {
      window.STATE_HISTORY.push(currentStateJson);
      if (window.STATE_HISTORY.length > 20) {
        window.STATE_HISTORY.shift();
      }
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, currentStateJson);
    // Atualiza nome e data na lista do dashboard
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => syncProjectMeta(data.projectName), 1000);
  } catch (e) {
    console.error('Erro ao salvar localmente:', e);
  }
}

/** Aplica um objeto de dados JSON ao Estado (STATE) */
function applyDataToState(data) {
  document.getElementById('projectName').value = data.projectName || 'Meu Projeto de Rede';
  STATE.nextOLTNum = data.nextOLTNum || 1;
  STATE.splices = data.splices || [];
  STATE.ctos = data.ctos || [];

  (data.olts || []).forEach(o => {
    o.layer = createPOPMarker(o);
    STATE.olts.push(o);
  });

  (data.cables || []).forEach(c => {
    STATE.cables.push(c);
    if (typeof renderCableOnMap === 'function') renderCableOnMap(c);
  });

  // Força o auto-mapeamento para projetos já salvos antes da atualização
  STATE.olts.forEach(o => {
    if (typeof syncPopCables === 'function') syncPopCables(o.id);
  });

  // Centraliza o mapa no projeto carregado automaticamente
  setTimeout(() => {
    if (typeof fitBounds === 'function') fitBounds();
  }, 500);
}

/** Carrega o projeto do localStorage (substitui loadFromCloud) */
async function loadFromCloud() {
  if (!currentProjectId) {
    alert('Projeto não encontrado. Redirecionando para o painel...');
    window.location.href = 'dashboard.html';
    return;
  }

  console.log('💻 Carregando projeto do navegador...');
  loadLocal();
}

/** Carrega o estado do localStorage */
function loadLocal() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return;

  try {
    const data = JSON.parse(json);
    applyDataToState(data);
  } catch (e) {
    console.error('Erro ao carregar do localStorage:', e);
  }
}

/** Exporta o projeto como arquivo JSON */
function exportProject() {
  const data = {
    projectName: document.getElementById('projectName').value,
    version: '2.0',
    exportedAt: new Date().toISOString(),
    nextOLTNum: STATE.nextOLTNum,
    olts: STATE.olts.map(o => ({
      id: o.id,
      lat: o.lat,
      lng: o.lng,
      name: o.name,
      outputPower: o.outputPower,
      ponPorts: o.ponPorts,
      pons: o.pons,
      oltEquipments: o.oltEquipments,
      obs: o.obs,
    })),
    cables: STATE.cables.map(c => ({
      id: c.id,
      name: c.name,
      popId: c.popId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
      oltId: c.oltId,
      path: c.path,
      fibers: c.fibers,
      fiberMapping: c.fiberMapping,
    })),
    splices: STATE.splices.map(s => ({
      id: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      cableId: s.cableId,
      fusions: s.fusions
    })),
    ctos: STATE.ctos.map(c => ({
      id: c.id,
      name: c.name,
      lat: c.lat,
      lng: c.lng,
      cableId: c.cableId,
      portCount: c.portCount
    }))
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (data.projectName || 'projeto_ftth').replace(/\s+/g, '_') + '.json';
  a.click();
  toast('💾 Projeto salvo!');
}

/** Importa um projeto a partir de arquivo JSON */
function importProject(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      clearAll(true);
      document.getElementById('projectName').value = data.projectName || 'Projeto Importado';
      STATE.nextOLTNum = data.nextOLTNum || 1;
      STATE.splices = data.splices || [];
      STATE.ctos = data.ctos || [];

      (data.olts || []).forEach(o => {
        o.layer = createPOPMarker(o);
        STATE.olts.push(o);
      });

      (data.cables || []).forEach(c => {
        STATE.cables.push(c);
        if (typeof renderCableOnMap === 'function') renderCableOnMap(c);
      });

      updateStatusBar();
      renderPanel();
      if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
      if (typeof renderAllSplices === 'function') renderAllSplices();
      setTimeout(fitBounds, 300);
      toast('📂 Projeto importado!');
    } catch (err) {
      toast('❌ Erro ao importar: arquivo inválido');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/** Limpa todo o projeto */
function clearAll(silent = false) {
  STATE.olts.forEach(o => { if (o.layer) map.removeLayer(o.layer); });
  STATE.cables.forEach(c => { if (c.layer) map.removeLayer(c.layer); });
  if (typeof ctoMarkersLayer !== 'undefined') ctoMarkersLayer.clearLayers();
  if (typeof spliceMarkersLayer !== 'undefined') spliceMarkersLayer.clearLayers();

  STATE.olts = [];
  STATE.cables = [];
  STATE.splices = [];
  STATE.ctos = [];
  STATE.selectedId = null;
  STATE.nextOLTNum = 1;

  updateStatusBar();
  renderPanel();
  saveLocal();

  if (!silent) toast('🗑️ Projeto limpo');
}

/** Desfaz a última ação (Undo) */
window.undoLastAction = function() {
  if (window.STATE_HISTORY.length <= 1) {
    toast('Nenhuma ação para desfazer');
    return;
  }

  // Remove o estado atual
  window.STATE_HISTORY.pop();

  // Pega o estado anterior
  const previousStateJson = window.STATE_HISTORY[window.STATE_HISTORY.length - 1];

  window.isUndoing = true;

  try {
    const data = JSON.parse(previousStateJson);
    clearAll(true);
    applyDataToState(data);

    if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
    if (typeof renderAllSplices === 'function') renderAllSplices();

    toast('↩️ Ação desfeita!');
  } catch (e) {
    console.error('Erro ao desfazer ação:', e);
  } finally {
    window.isUndoing = false;
    saveLocal();
  }
}
