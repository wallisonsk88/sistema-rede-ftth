/**
 * auth.js — Login, cadastro e recuperação de senha (Firebase Auth)
 */

const AUTH_ERRORS = {
  'auth/invalid-credential': 'E-mail ou senha inválidos.',
  'auth/invalid-login-credentials': 'E-mail ou senha inválidos.',
  'auth/wrong-password': 'E-mail ou senha inválidos.',
  'auth/user-not-found': 'E-mail ou senha inválidos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha precisa ter no mínimo 6 caracteres.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/operation-not-allowed': 'Login por e-mail/senha não está ativado no Firebase.',
};

function authErrorMessage(error) {
  return AUTH_ERRORS[error.code] || error.message;
}

function setLoading(textId, loaderId, loading) {
  document.getElementById(textId).style.display = loading ? 'none' : 'block';
  document.getElementById(loaderId).style.display = loading ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {

  // Se já estiver logado, pula o login
  const unsub = fbAuth.onAuthStateChanged(user => {
    unsub();
    if (user) window.location.href = 'dashboard.html';
  });

  // Formulário de Login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const errorMsg = document.getElementById('error-msg');

      setLoading('login-text', 'login-loader', true);
      errorMsg.style.display = 'none';

      try {
        await fbAuth.signInWithEmailAndPassword(email, password);
        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error(error);
        errorMsg.innerText = authErrorMessage(error);
        errorMsg.style.display = 'block';
        setLoading('login-text', 'login-loader', false);
      }
    });
  }

  // Formulário de Cadastro
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const errorMsg = document.getElementById('reg-error-msg');
      const successMsg = document.getElementById('reg-success-msg');

      setLoading('reg-text', 'reg-loader', true);
      errorMsg.style.display = 'none';
      successMsg.style.display = 'none';

      try {
        // Cria a conta e já entra logado
        await fbAuth.createUserWithEmailAndPassword(email, password);
        window.location.href = 'dashboard.html';
      } catch (error) {
        console.error(error);
        errorMsg.innerText = authErrorMessage(error);
        errorMsg.style.display = 'block';
        setLoading('reg-text', 'reg-loader', false);
      }
    });
  }
});

/** Envia e-mail de redefinição de senha */
async function forgotPassword(event) {
  event.preventDefault();
  const errorMsg = document.getElementById('error-msg');
  const email = document.getElementById('email').value.trim() || prompt('Digite seu e-mail:');
  if (!email) return;

  try {
    await fbAuth.sendPasswordResetEmail(email);
    alert('Enviamos um e-mail para ' + email + ' com o link para redefinir a senha.');
  } catch (error) {
    errorMsg.innerText = authErrorMessage(error);
    errorMsg.style.display = 'block';
  }
}
