/**
 * firebase-config.js — Inicialização do Firebase (Auth + Firestore)
 *
 * Estrutura no Firestore (cada usuário só acessa os próprios dados):
 *   users/{uid}/projects/{projectId}     -> { name, updatedAt }        (lista do dashboard)
 *   users/{uid}/projectData/{projectId}  -> { json, updatedAt }        (conteúdo do projeto)
 *
 * O conteúdo é salvo como string JSON porque o Firestore não aceita arrays
 * aninhados (ex.: path do cabo = [[lat, lng], ...]).
 */

const firebaseConfig = {
  apiKey: 'AIzaSyAgyqNi_Xp2wC9ggZbmXSjCJD5CozXKJTA',
  authDomain: 'megafttx.firebaseapp.com',
  projectId: 'megafttx',
  storageBucket: 'megafttx.firebasestorage.app',
  messagingSenderId: '71099904307',
  appId: '1:71099904307:web:ecad94260349a520318e46',
};

firebase.initializeApp(firebaseConfig);
const fbAuth = firebase.auth();
const fbDB = firebase.firestore();

// Cache offline: continua funcionando sem internet e sincroniza quando voltar
fbDB.enablePersistence({ synchronizeTabs: true }).catch(e => console.warn('Cache offline indisponível:', e.code));

/** Referências das coleções do usuário logado */
function userProjectsRef(uid) {
  return fbDB.collection('users').doc(uid).collection('projects');
}
function userProjectDataRef(uid) {
  return fbDB.collection('users').doc(uid).collection('projectData');
}

/**
 * Garante que há um usuário logado. Se não houver, manda para o login.
 * Resolve com o usuário do Firebase.
 */
function requireAuth() {
  return new Promise(resolve => {
    const unsub = fbAuth.onAuthStateChanged(user => {
      unsub();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      resolve(user);
    });
  });
}

function logout() {
  fbAuth.signOut().then(() => { window.location.href = 'login.html'; });
}
