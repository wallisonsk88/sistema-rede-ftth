/**
 * storage.js — Persistência local, importação e exportação
 */

const STORAGE_KEY = 'meganet_ftth_v2';

let saveTimeout = null;

function saveLocal() {
  const data = {
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
    })),
    cables: STATE.cables.map(c => ({
      id: c.id,
      name: c.name,
      popId: c.popId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
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
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Erro ao salvar localmente:', e);
  }

  // Sincronização com a Nuvem (Supabase) via Debounce (1,5 segundos)
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      if (typeof supabaseClient === 'undefined') return;
      const { error } = await supabaseClient
        .from('ftth_projects')
        .upsert([{ id: 1, name: data.projectName, data: data, updated_at: new Date() }]);
      
      if (error) {
        if (error.code === '42P01') {
          console.error('⚠️ Supabase: Tabela "ftth_projects" não existe. Crie a tabela no SQL Editor.');
        } else {
          console.error('Erro no Supabase:', error);
        }
      } else {
        console.log('☁️ Projeto sincronizado com a nuvem com sucesso!');
      }
    } catch(err) {
      console.error('Erro de rede ao salvar na nuvem:', err);
    }
  }, 1500);
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
}

/** Tenta carregar da nuvem; se falhar, cai para o LocalStorage */
async function loadFromCloud() {
  try {
    if (typeof supabaseClient !== 'undefined') {
      const { data, error } = await supabaseClient
        .from('ftth_projects')
        .select('data')
        .eq('id', 1)
        .maybeSingle();
        
      if (!error && data && data.data) {
        console.log('☁️ Projeto carregado da Nuvem!');
        applyDataToState(data.data);
        return;
      } else if (error && error.code !== 'PGRST116') {
        console.warn('Falha ao ler da nuvem (ou tabela não existe), tentando backup local.', error);
      }
    }
  } catch (err) {
    console.error('Erro de rede na inicialização.', err);
  }
  
  // Fallback Local
  console.log('💻 Carregando backup do navegador (local)...');
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
    })),
    cables: STATE.cables.map(c => ({
      id: c.id,
      name: c.name,
      popId: c.popId,
      sourceType: c.sourceType,
      sourceId: c.sourceId,
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
