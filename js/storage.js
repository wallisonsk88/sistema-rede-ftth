/**
 * storage.js — Persistência local, importação e exportação
 */

const STORAGE_KEY = 'meganet_ftth_v2';

/** Salva o estado no localStorage */
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
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Erro ao salvar:', e);
  }
}

/** Carrega o estado do localStorage */
function loadLocal() {
  const json = localStorage.getItem(STORAGE_KEY);
  if (!json) return;

  try {
    const data = JSON.parse(json);
    document.getElementById('projectName').value = data.projectName || 'Meu Projeto de Rede';
    STATE.nextOLTNum = data.nextOLTNum || 1;

    (data.olts || []).forEach(o => {
      o.layer = createPOPMarker(o);
      STATE.olts.push(o);
    });
  } catch (e) {
    console.error('Erro ao carregar:', e);
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

      (data.olts || []).forEach(o => {
        o.layer = createPOPMarker(o);
        STATE.olts.push(o);
      });

      updateStatusBar();
      renderPanel();
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
  STATE.olts = [];
  STATE.selectedId = null;
  STATE.nextOLTNum = 1;

  updateStatusBar();
  renderPanel();
  saveLocal();

  if (!silent) toast('🗑️ Projeto limpo');
}
