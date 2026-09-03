/**
 * auth.js — Sem autenticação. Redireciona login para o dashboard.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Se estiver na tela de login, vai direto pro dashboard
  if (window.location.pathname.includes('login.html')) {
    window.location.href = 'dashboard.html';
  }
});
