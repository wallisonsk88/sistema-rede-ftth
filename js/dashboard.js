/**
 * dashboard.js — Gerenciamento de Projetos do Usuário Logado
 */

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof supabaseClient === 'undefined') return;
    
    // Verifica Sessão
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = session.user;
    document.getElementById('user-email').innerText = currentUser.email;
    
    loadProjects();
});

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

async function loadProjects() {
    const container = document.getElementById('projects-container');
    
    try {
        const { data: projects, error } = await supabaseClient
            .from('ftth_projects')
            .select('id, name, updated_at')
            .order('updated_at', { ascending: false });
            
        if (error) throw error;
        
        if (!projects || projects.length === 0) {
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
            const date = new Date(p.updated_at).toLocaleString('pt-BR');
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
        
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div class="empty-state" style="color:var(--danger)">Erro ao carregar projetos.</div>`;
    }
}

async function createNewProject() {
    const name = prompt("Qual o nome do novo projeto?");
    if (!name || name.trim() === '') return;
    
    const initialData = {
        projectName: name,
        nextOLTNum: 1,
        olts: [],
        cables: [],
        splices: [],
        ctos: []
    };
    
    try {
        const { data, error } = await supabaseClient
            .from('ftth_projects')
            .insert([{ name: name, data: initialData, user_id: currentUser.id }])
            .select()
            .single();
            
        if (error) throw error;
        
        // Redireciona para o novo projeto
        window.location.href = `index.html?id=${data.id}`;
    } catch (error) {
        console.error(error);
        alert('Erro ao criar projeto: ' + error.message);
    }
}

async function deleteProject(event, id) {
    event.stopPropagation(); // Evita abrir o projeto
    if (!confirm("Tem certeza que deseja excluir permanentemente este projeto?")) return;
    
    try {
        const { error } = await supabaseClient
            .from('ftth_projects')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        loadProjects(); // Recarrega a lista
    } catch (error) {
        console.error(error);
        alert('Erro ao excluir projeto.');
    }
}
