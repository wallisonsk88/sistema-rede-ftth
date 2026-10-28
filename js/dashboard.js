/**
 * dashboard.js — Gerenciamento de Projetos via Firebase (Firestore)
 */

// Chaves do modo local antigo (usadas só para migrar projetos para a nuvem)
const LEGACY_PROJECTS_KEY = 'meganet_projects_list';
const LEGACY_PROJECT_PREFIX = 'meganet_ftth_project_';

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  document.getElementById('user-email').innerText = currentUser.email;
  await migrateLocalProjects();
  loadProjects();
});

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

/**
 * Envia para a conta do usuário os projetos que estavam salvos só no navegador
 * (versão antiga em localStorage). Roda uma única vez neste navegador, para a
 * primeira conta que entrar, para não copiar os projetos para outras contas.
 */
async function migrateLocalProjects() {
  const flagKey = 'meganet_legacy_migrated';
  if (localStorage.getItem(flagKey)) return;

  let localProjects = [];
  try { localProjects = JSON.parse(localStorage.getItem(LEGACY_PROJECTS_KEY)) || []; } catch (e) {}

  try {
    for (const p of localProjects) {
      const json = localStorage.getItem(LEGACY_PROJECT_PREFIX + p.id);
      if (!json) continue;
      const updatedAt = p.updatedAt || new Date().toISOString();
      const batch = fbDB.batch();
      batch.set(userProjectsRef(currentUser.uid).doc(p.id), { name: p.name, updatedAt });
      batch.set(userProjectDataRef(currentUser.uid).doc(p.id), { json, updatedAt });
      await batch.commit();
    }
    localStorage.setItem(flagKey, '1');
  } catch (e) {
    console.error('Erro ao migrar projetos locais:', e);
  }
}

async function loadProjects() {
  const container = document.getElementById('projects-container');

  let projects = [];
  try {
    const snap = await userProjectsRef(currentUser.uid).orderBy('updatedAt', 'desc').get();
    projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error(e);
    container.innerHTML = `<div class="empty-state"><h3>Erro ao carregar projetos</h3><p style="color:var(--text2);">${escapeHTML(e.message)}</p></div>`;
    return;
  }

  if (projects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Nenhum projeto encontrado</h3>
        <p style="color:var(--text2); margin-bottom:15px;">Crie seu primeiro projeto para começar a desenhar sua rede.</p>
        <button class="btn-primary" style="margin: 0 auto;" onclick="createNewProject()">Criar Projeto</button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  projects.forEach(p => {
    const date = new Date(p.updatedAt).toLocaleString('pt-BR');
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => window.location.href = `index.html?id=${p.id}`;
    card.innerHTML = `
      <button class="btn-delete" onclick="deleteProject(event, '${p.id}')" title="Excluir projeto">🗑️</button>
      <div class="project-title">${escapeHTML(p.name)}</div>
      <div class="project-date">Atualizado em: ${date}</div>
    `;
    container.appendChild(card);
  });
}

async function createNewProject() {
  const name = prompt("Qual o nome do novo projeto?");
  if (!name || name.trim() === '') return;

  const newId = crypto.randomUUID();
  const updatedAt = new Date().toISOString();
  const initialData = {
    projectName: name,
    timestamp: Date.now(),
    nextOLTNum: 1,
    olts: [],
    cables: [],
    splices: [],
    ctos: []
  };

  try {
    const batch = fbDB.batch();
    batch.set(userProjectsRef(currentUser.uid).doc(newId), { name, updatedAt });
    batch.set(userProjectDataRef(currentUser.uid).doc(newId), { json: JSON.stringify(initialData), updatedAt });
    await batch.commit();
    window.location.href = `index.html?id=${newId}`;
  } catch (e) {
    console.error(e);
    alert('Erro ao criar projeto: ' + e.message);
  }
}

async function deleteProject(event, id) {
  event.stopPropagation();
  if (!confirm("Tem certeza que deseja excluir permanentemente este projeto?")) return;

  try {
    const batch = fbDB.batch();
    batch.delete(userProjectsRef(currentUser.uid).doc(id));
    batch.delete(userProjectDataRef(currentUser.uid).doc(id));
    await batch.commit();
    localStorage.removeItem(LEGACY_PROJECT_PREFIX + id);
  } catch (e) {
    console.error(e);
    alert('Erro ao excluir projeto: ' + e.message);
  }

  loadProjects();
}
