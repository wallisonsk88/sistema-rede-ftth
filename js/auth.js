/**
 * auth.js — Lógica de Autenticação Supabase
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Formulário de Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const btnText = document.getElementById('login-text');
            const loader = document.getElementById('login-loader');
            const errorMsg = document.getElementById('error-msg');
            
            btnText.style.display = 'none';
            loader.style.display = 'block';
            errorMsg.style.display = 'none';
            
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) throw error;
                
                // Redireciona para o painel de projetos
                window.location.href = 'dashboard.html';
            } catch (error) {
                console.error(error);
                errorMsg.innerText = error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : error.message;
                errorMsg.style.display = 'block';
                btnText.style.display = 'block';
                loader.style.display = 'none';
            }
        });
    }

    // Formulário de Cadastro
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const btnText = document.getElementById('reg-text');
            const loader = document.getElementById('reg-loader');
            const errorMsg = document.getElementById('reg-error-msg');
            const successMsg = document.getElementById('reg-success-msg');
            
            btnText.style.display = 'none';
            loader.style.display = 'block';
            errorMsg.style.display = 'none';
            successMsg.style.display = 'none';
            
            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email: email,
                    password: password
                });
                
                if (error) throw error;
                
                successMsg.innerText = 'Conta criada com sucesso! Faça o login.';
                successMsg.style.display = 'block';
                
                // Limpa formulário
                document.getElementById('reg-email').value = '';
                document.getElementById('reg-password').value = '';
                
            } catch (error) {
                console.error(error);
                errorMsg.innerText = error.message;
                errorMsg.style.display = 'block';
            } finally {
                btnText.style.display = 'block';
                loader.style.display = 'none';
            }
        });
    }

    // Checa sessão atual (se já estiver logado, pula o login)
    async function checkSession() {
        if (!window.location.pathname.includes('login.html')) return;
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            window.location.href = 'dashboard.html';
        }
    }
    
    if (typeof supabaseClient !== 'undefined') {
        checkSession();
    }
});
