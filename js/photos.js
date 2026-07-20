/**
 * photos.js — Sistema de Fotos para POP, CEO e CTO
 * Usa IndexedDB para armazenar imagens (base64) sem estourar o localStorage
 */

const PHOTO_DB_NAME = 'meganet_photos';
const PHOTO_DB_VERSION = 1;
const PHOTO_STORE = 'photos';

let photoDB = null;

/** Inicializa o IndexedDB para fotos */
function initPhotoDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('elementId', 'elementId', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      photoDB = event.target.result;
      resolve(photoDB);
    };

    request.onerror = (event) => {
      console.error('Erro ao abrir IndexedDB para fotos:', event);
      reject(event);
    };
  });
}

/** Adiciona uma foto a um elemento (POP, CEO ou CTO) */
function addPhoto(elementId, base64Data, caption) {
  return new Promise((resolve, reject) => {
    if (!photoDB) { reject('DB não inicializado'); return; }
    const tx = photoDB.transaction(PHOTO_STORE, 'readwrite');
    const store = tx.objectStore(PHOTO_STORE);
    const record = {
      elementId: elementId,
      data: base64Data,
      caption: caption || '',
      date: new Date().toISOString()
    };
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Busca todas as fotos de um elemento */
function getPhotos(elementId) {
  return new Promise((resolve, reject) => {
    if (!photoDB) { resolve([]); return; }
    const tx = photoDB.transaction(PHOTO_STORE, 'readonly');
    const store = tx.objectStore(PHOTO_STORE);
    const index = store.index('elementId');
    const req = index.getAll(elementId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Remove uma foto pelo ID */
function deletePhoto(photoId) {
  return new Promise((resolve, reject) => {
    if (!photoDB) { reject('DB não inicializado'); return; }
    const tx = photoDB.transaction(PHOTO_STORE, 'readwrite');
    const store = tx.objectStore(PHOTO_STORE);
    const req = store.delete(photoId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Redimensiona a imagem para não ficar pesada demais */
function resizeImage(file, maxWidth) {
  maxWidth = maxWidth || 1200;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Handler para o input de foto — chamado pelo onchange do <input> */
window.handlePhotoUpload = async function(elementId, inputEl) {
  const files = inputEl.files;
  if (!files || files.length === 0) return;

  for (let i = 0; i < files.length; i++) {
    const base64 = await resizeImage(files[i]);
    await addPhoto(elementId, base64, '');
  }

  inputEl.value = ''; // Limpa o input
  toast('📸 ' + files.length + (files.length > 1 ? ' fotos adicionadas!' : ' foto adicionada!'));
  renderPanel();
};

/** Abre o lightbox com a foto em tela cheia */
window.openLightbox = function(photoId) {
  if (!photoDB) return;
  const tx = photoDB.transaction(PHOTO_STORE, 'readonly');
  const store = tx.objectStore(PHOTO_STORE);
  const req = store.get(photoId);
  req.onsuccess = () => {
    const photo = req.result;
    if (!photo) return;

    const overlay = document.createElement('div');
    overlay.id = 'photo-lightbox';
    overlay.style.cssText = `
      position:fixed; top:0; left:0; width:100%; height:100%;
      background:rgba(0,0,0,0.92); z-index:99999;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      cursor:pointer; animation: fadeIn 0.2s ease;
    `;

    const dateStr = new Date(photo.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });

    overlay.innerHTML = `
      <div style="position:absolute; top:15px; right:20px; display:flex; gap:12px; z-index:100000;">
        <button onclick="event.stopPropagation(); removePhotoAndClose(${photo.id})" style="background:rgba(239,68,68,0.8); border:none; color:#fff; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;">🗑️ Excluir</button>
        <button onclick="document.getElementById('photo-lightbox').remove()" style="background:rgba(255,255,255,0.15); border:none; color:#fff; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:18px; font-weight:bold;">✕</button>
      </div>
      <img src="${photo.data}" style="max-width:92vw; max-height:82vh; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,0.5); object-fit:contain;" onclick="event.stopPropagation()">
      <div style="color:rgba(255,255,255,0.6); font-size:11px; margin-top:10px;">${dateStr}</div>
    `;

    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  };
};

/** Remove foto e fecha o lightbox */
window.removePhotoAndClose = async function(photoId) {
  await deletePhoto(photoId);
  const lb = document.getElementById('photo-lightbox');
  if (lb) lb.remove();
  toast('🗑️ Foto excluída');
  renderPanel();
};

/** Gera o HTML da galeria de fotos para qualquer elemento */
window.renderPhotoGallery = function(elementId) {
  // Retorna um div com id que será preenchido assincronamente
  const containerId = 'photo-gallery-' + elementId.replace(/[^a-zA-Z0-9]/g, '_');
  
  // Dispara o carregamento assíncrono
  setTimeout(async () => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const photos = await getPhotos(elementId);
    
    let galleryHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:10px; font-weight:700; color:var(--text3);">📸 FOTOS (${photos.length})</span>
        <label style="font-size:10px; color:var(--primary); font-weight:600; cursor:pointer; display:flex; align-items:center; gap:4px;">
          📷 Adicionar
          <input type="file" accept="image/*" capture="environment" multiple
            style="display:none;" onchange="handlePhotoUpload('${elementId}', this)">
        </label>
      </div>
    `;

    if (photos.length > 0) {
      galleryHTML += `<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">`;
      photos.forEach(photo => {
        const dateStr = new Date(photo.date).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
        galleryHTML += `
          <div style="position:relative; cursor:pointer; border-radius:6px; overflow:hidden; aspect-ratio:1; border:1px solid var(--border);" onclick="openLightbox(${photo.id})">
            <img src="${photo.data}" style="width:100%; height:100%; object-fit:cover;">
            <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(transparent, rgba(0,0,0,0.7)); padding:2px 4px; text-align:right;">
              <span style="font-size:8px; color:rgba(255,255,255,0.8);">${dateStr}</span>
            </div>
          </div>
        `;
      });
      galleryHTML += `</div>`;
    } else {
      galleryHTML += `<div style="font-size:10px; color:var(--text2); text-align:center; padding:12px; border:1px dashed var(--border); border-radius:6px;">
        Nenhuma foto. Toque em "📷 Adicionar" para tirar uma foto ou selecionar do galeria.
      </div>`;
    }

    container.innerHTML = galleryHTML;
  }, 50);

  return `<div id="${containerId}" style="margin-top:12px; border-top:1px dashed var(--border); padding-top:12px;">
    <div style="font-size:10px; color:var(--text2);">Carregando fotos...</div>
  </div>`;
};

// Inicializa o banco de dados de fotos quando a página carregar
initPhotoDB().then(() => {
  console.log('📸 Banco de fotos IndexedDB inicializado!');
}).catch(err => {
  console.error('Erro ao inicializar banco de fotos:', err);
});
