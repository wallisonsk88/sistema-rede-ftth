/**
 * storage.js — Persistência na nuvem (Firebase Firestore), importação e exportação
 */

const urlParams = new URLSearchParams(window.location.search);
const currentProjectId = urlParams.get('id');
const CLOUD_SAVE_DELAY = 1500; // ms — agrupa várias alterações em uma única gravação
let currentUser = null;
let projectLoaded = false;     // só grava na nuvem depois que o projeto foi carregado
let cloudSaveTimeout = null;
let cloudSaveInFlight = false;
let pendingStateJson = null;
window.STATE_HISTORY = [];
window.isUndoing = false;

/** Atualiza o indicador de sincronização na barra de status */
function setSyncStatus(status) {
  const el = document.getElementById('sb-sync');
  if (!el) return;
  const labels = {
    saved:   '☁️ Salvo na nuvem',
    pending: '⏳ Salvando...',
    error:   '⚠️ Erro ao salvar',
  };
  el.textContent = labels[status] || '';
}

/** Grava o estado atual no Firestore (dados + nome/data na lista do dashboard) */
async function flushCloudSave() {
  cloudSaveTimeout = null;
  if (!pendingStateJson || !currentUser || !currentProjectId) return;

  const json = pendingStateJson;
  pendingStateJson = null;
  const updatedAt = new Date().toISOString();
  const name = document.getElementById('projectName').value;

  cloudSaveInFlight = true;
  try {
    const batch = fbDB.batch();
    batch.set(userProjectDataRef(currentUser.uid).doc(currentProjectId), { json, updatedAt });
    batch.set(userProjectsRef(currentUser.uid).doc(currentProjectId), { name, updatedAt });
    await batch.commit();
    if (!pendingStateJson) setSyncStatus('saved');
  } catch (e) {
    console.error('Erro ao salvar na nuvem:', e);
    setSyncStatus('error');
    toast('⚠️ Erro ao salvar na nuvem: ' + e.message);
    // Mantém para tentar de novo na próxima alteração
    if (!pendingStateJson) pendingStateJson = json;
  } finally {
    cloudSaveInFlight = false;
  }
}

// Avisa antes de fechar a página se ainda houver alterações não enviadas
window.addEventListener('beforeunload', e => {
  if (cloudSaveTimeout || cloudSaveInFlight || pendingStateJson) {
    if (cloudSaveTimeout) { clearTimeout(cloudSaveTimeout); flushCloudSave(); }
    e.preventDefault();
    e.returnValue = '';
  }
});

/** Converte o estado atual em um objeto simples (sem camadas do Leaflet) */
function serializeState() {
  return {
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
    }))
  };
}

function saveLocal() {
  recomputeSignals(); // mantém cabos derivados sempre de acordo com a OLT e as fusões
  const data = serializeState();

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

  if (!projectLoaded) return;
  pendingStateJson = currentStateJson;
  setSyncStatus('pending');
  if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
  cloudSaveTimeout = setTimeout(flushCloudSave, CLOUD_SAVE_DELAY);
}

/** Aplica um objeto de dados JSON ao Estado (STATE) */
function applyDataToState(data) {
  document.getElementById('projectName').value = data.projectName || 'Meu Projeto de Rede';
  STATE.nextOLTNum = data.nextOLTNum || 1;
  STATE.splices = data.splices || [];

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

/** Carrega o projeto do Firestore */
async function loadFromCloud() {
  currentUser = await requireAuth();

  if (!currentProjectId) {
    window.location.href = 'dashboard.html';
    return;
  }

  try {
    const doc = await userProjectDataRef(currentUser.uid).doc(currentProjectId).get();
    if (!doc.exists) {
      alert('Projeto não encontrado. Redirecionando para o painel...');
      window.location.href = 'dashboard.html';
      return;
    }
    applyDataToState(JSON.parse(doc.data().json));
    saveLocal(); // registra o estado inicial no histórico de desfazer (ainda sem gravar na nuvem)
    projectLoaded = true;
    setSyncStatus('saved');
  } catch (e) {
    console.error('Erro ao carregar projeto da nuvem:', e);
    alert('Erro ao carregar o projeto: ' + e.message);
  }

  // Renomear o projeto também salva
  document.getElementById('projectName').addEventListener('change', () => saveLocal());
}

/** Exporta o projeto como arquivo JSON */
function exportProject() {
  const data = {
    ...serializeState(),
    version: '2.0',
    exportedAt: new Date().toISOString(),
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
      applyDataToState({ ...data, projectName: data.projectName || 'Projeto Importado' });

      updateStatusBar();
      renderPanel();
      if (typeof renderAllCTOMarkers === 'function') renderAllCTOMarkers();
      if (typeof renderAllSplices === 'function') renderAllSplices();
      saveLocal();
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
