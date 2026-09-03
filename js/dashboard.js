/**
 * dashboard.js — Gerenciamento de Projetos via localStorage
 */

const PROJECTS_KEY = 'meganet_projects_list';

function getProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || [];
  } catch(e) { return []; }
}

function saveProjectsList(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

document.addEventListener('DOMContentLoaded', () => {
  const userEmailEl = document.getElementById('user-email');
  if (userEmailEl) userEmailEl.innerText = 'Modo Local';
  loadProjects();
});

function logout() {
  // Sem login — botão não faz nada
}

function loadProjects() {
  const container = document.getElementById('projects-container');
  const projects = getProjects();

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

  // Ordena do mais recente para o mais antigo
  projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  container.innerHTML = '';
  projects.forEach(p => {
    const date = new Date(p.updatedAt).toLocaleString('pt-BR');
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => window.location.href = `index.html?id=${p.id}`;
    card.innerHTML = `
      <button class="btn-delete" onclick="deleteProject(event, '${p.id}')" title="Excluir projeto">🗑️</button>
      <div class="project-title">${p.name}</div>
      <div class="project-date">Atualizado em: ${date}</div>
    `;
    container.appendChild(card);
  });
}

function createNewProject() {
  const name = prompt("Qual o nome do novo projeto?");
  if (!name || name.trim() === '') return;

  const newId = crypto.randomUUID();
  const initialData = {
    projectName: name,
    timestamp: Date.now(),
    nextOLTNum: 1,
    olts: [],
    cables: [],
    splices: [],
    ctos: []
  };

  // Salva os dados do projeto
  localStorage.setItem(`meganet_ftth_project_${newId}`, JSON.stringify(initialData));

  // Adiciona à lista de projetos
  const projects = getProjects();
  projects.push({ id: newId, name: name, updatedAt: new Date().toISOString() });
  saveProjectsList(projects);

  window.location.href = `index.html?id=${newId}`;
}

function deleteProject(event, id) {
  event.stopPropagation();
  if (!confirm("Tem certeza que deseja excluir permanentemente este projeto?")) return;

  // Remove os dados do projeto
  localStorage.removeItem(`meganet_ftth_project_${id}`);

  // Remove da lista
  const projects = getProjects().filter(p => p.id !== id);
  saveProjectsList(projects);

  loadProjects();
}
