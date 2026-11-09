/**
 * photos.js — Sistema de Fotos para POP, CEO, CTO e emenda de rompimento
 *
 * As fotos ficam na nuvem, no Firestore do próprio usuário (uma foto por documento):
 *   users/{uid}/photos/{photoId} -> { projectId, elementId, data (JPEG base64), caption, date }
 * Assim aparecem em qualquer computador ou celular. Com o cache offline do Firestore,
 * a foto tirada sem internet aparece na hora e sobe quando a conexão voltar.
 *
 * Versões antigas guardavam as fotos só no aparelho (IndexedDB). Ao abrir o projeto,
 * as fotos antigas deste aparelho são enviadas para a nuvem e apagadas daqui.
 */

const PHOTO_DB_NAME = 'meganet_photos';
const PHOTO_DB_VERSION = 1;
const PHOTO_STORE = 'photos';
const PHOTO_MAX_CHARS = 900000; // o documento do Firestore aceita até 1 MB

const photoCache = {};   // elementId -> [fotos], evita baixar de novo a cada abertura do painel
const photoLoading = {}; // elementId -> busca em andamento (o painel e o upload usam a mesma)

/** Fotos do usuário logado na nuvem */
function cloudPhotosRef() {
  return fbDB.collection('users').doc(currentUser.uid).collection('photos');
}

/** Adiciona uma foto a um elemento (POP, CEO, CTO ou emenda) */
async function addPhoto(elementId, base64Data, caption) {
  // Lista carregada antes: assim uma busca atrasada não apaga a foto nova da tela
  await getPhotos(elementId).catch(() => {});
  const ref = cloudPhotosRef().doc();
  const record = {
    projectId: currentProjectId,
    elementId: elementId,
    data: base64Data,
    caption: caption || '',
    date: new Date().toISOString()
  };
  (photoCache[elementId] = photoCache[elementId] || []).push({ id: ref.id, ...record });
  // Não espera o servidor: sem internet a foto fica no cache e sobe quando a conexão voltar
  ref.set(record).catch(e => {
    console.error('Erro ao enviar foto para a nuvem:', e);
    toast('⚠️ Erro ao enviar foto para a nuvem: ' + e.message);
  });
  return ref.id;
}

/** Busca todas as fotos de um elemento */
function getPhotos(elementId) {
  if (photoCache[elementId]) return Promise.resolve(photoCache[elementId]);
  if (!currentUser || !currentProjectId) return Promise.resolve([]);
  if (!photoLoading[elementId]) {
    photoLoading[elementId] = cloudPhotosRef()
      .where('projectId', '==', currentProjectId)
      .where('elementId', '==', elementId)
      .get()
      .then(snap => {
        const photos = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.date.localeCompare(b.date));
        if (!photoCache[elementId]) photoCache[elementId] = photos;
        return photoCache[elementId];
      })
      .finally(() => { delete photoLoading[elementId]; });
  }
  return photoLoading[elementId];
}

/** Remove uma foto pelo ID */
async function deletePhoto(photoId) {
  Object.values(photoCache).forEach(list => {
    const i = list.findIndex(p => p.id === photoId);
    if (i >= 0) list.splice(i, 1);
  });
  await cloudPhotosRef().doc(photoId).delete();
}

/** Acha uma foto já carregada (ou busca na nuvem) */
async function findPhoto(photoId) {
  for (const list of Object.values(photoCache)) {
    const p = list.find(x => x.id === photoId);
    if (p) return p;
  }
  const doc = await cloudPhotosRef().doc(photoId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

/** Desenha a imagem num canvas e devolve JPEG base64 */
function encodeImage(img, maxWidth, quality) {
  let w = img.width;
  let h = img.height;
  if (w > maxWidth) {
    h = Math.round((h * maxWidth) / w);
    w = maxWidth;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Redimensiona a imagem para não ficar pesada demais (e caber num documento da nuvem) */
function resizeImage(file, maxWidth) {
  maxWidth = maxWidth || 1280;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Diminui até caber no limite do documento
        const tries = [[maxWidth, 0.75], [1024, 0.65], [800, 0.6], [640, 0.5]];
        let out = '';
        for (const [w, q] of tries) {
          out = encodeImage(img, w, q);
          if (out.length <= PHOTO_MAX_CHARS) break;
        }
        resolve(out);
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
  toast('📸 ' + files.length + (files.length > 1 ? ' fotos salvas na nuvem!' : ' foto salva na nuvem!'));
  renderPanel();
};

/** Abre o lightbox com a foto em tela cheia */
window.openLightbox = async function(photoId) {
  const photo = await findPhoto(photoId);
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
      <button onclick="event.stopPropagation(); removePhotoAndClose('${photo.id}')" style="background:rgba(239,68,68,0.8); border:none; color:#fff; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600;">🗑️ Excluir</button>
      <button onclick="document.getElementById('photo-lightbox').remove()" style="background:rgba(255,255,255,0.15); border:none; color:#fff; padding:8px 16px; border-radius:8px; cursor:pointer; font-size:18px; font-weight:bold;">✕</button>
    </div>
    <img src="${photo.data}" style="max-width:92vw; max-height:82vh; border-radius:8px; box-shadow:0 8px 40px rgba(0,0,0,0.5); object-fit:contain;" onclick="event.stopPropagation()">
    <div style="color:rgba(255,255,255,0.6); font-size:11px; margin-top:10px;">${dateStr}</div>
  `;

  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
};

/** Remove foto e fecha o lightbox */
window.removePhotoAndClose = async function(photoId) {
  const lb = document.getElementById('photo-lightbox');
  if (lb) lb.remove();
  try {
    await deletePhoto(photoId);
    toast('🗑️ Foto excluída');
  } catch (e) {
    toast('⚠️ Erro ao excluir foto: ' + e.message);
  }
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

    let photos;
    try {
      photos = await getPhotos(elementId);
    } catch (e) {
      console.error('Erro ao carregar fotos:', e);
      container.innerHTML = `<div style="font-size:10px; color:#ef4444;">⚠️ Não foi possível carregar as fotos (${e.message}).</div>`;
      return;
    }
    if (!document.getElementById(containerId)) return;

    let galleryHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span style="font-size:10px; font-weight:700; color:var(--text3);">📸 FOTOS (${photos.length}) <span style="font-weight:500;">· ☁️ na nuvem</span></span>
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
          <div style="position:relative; cursor:pointer; border-radius:6px; overflow:hidden; aspect-ratio:1; border:1px solid var(--border);" onclick="openLightbox('${photo.id}')">
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

// ================================================================
//  FOTOS ANTIGAS (só neste aparelho) -> NUVEM
// ================================================================

/** Abre o banco local antigo, se existir */
function openLegacyPhotoDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) return resolve(null);
    const request = indexedDB.open(PHOTO_DB_NAME, PHOTO_DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        const store = db.createObjectStore(PHOTO_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('elementId', 'elementId', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = () => resolve(null);
  });
}

/** IDs de tudo que pode ter foto neste projeto */
function projectPhotoElementIds() {
  const ids = new Set();
  STATE.olts.forEach(pop => {
    ids.add(pop.id);
    (pop.pons || []).forEach(pon => (pon.ramais || []).forEach(r => (r.ctos || []).forEach(cto => ids.add(cto.id))));
  });
  STATE.splices.forEach(s => ids.add(s.id));
  STATE.cables.forEach(c => (c.breaks || []).forEach(b => ids.add(b.id)));
  return ids;
}

/**
 * Envia para a nuvem as fotos antigas deste aparelho que são deste projeto.
 * Cada uma só é apagada do aparelho depois que a nuvem confirma.
 */
async function migrateLocalPhotosToCloud() {
  if (!currentUser || !currentProjectId) return 0;
  const db = await openLegacyPhotoDB();
  if (!db) return 0;
  const all = await new Promise((resolve) => {
    const req = db.transaction(PHOTO_STORE, 'readonly').objectStore(PHOTO_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
  const ids = projectPhotoElementIds();
  const mine = all.filter(p => ids.has(p.elementId));
  if (!mine.length) return 0;

  let sent = 0;
  for (const p of mine) {
    try {
      // ID fixo: se a migração rodar de novo, não duplica
      await cloudPhotosRef().doc(`local_${p.elementId}_${p.id}`).set({
        projectId: currentProjectId,
        elementId: p.elementId,
        data: p.data,
        caption: p.caption || '',
        date: p.date || new Date().toISOString()
      });
      await new Promise((resolve) => {
        const req = db.transaction(PHOTO_STORE, 'readwrite').objectStore(PHOTO_STORE).delete(p.id);
        req.onsuccess = req.onerror = () => resolve();
      });
      delete photoCache[p.elementId];
      sent++;
    } catch (e) {
      console.error('Foto antiga não enviada para a nuvem:', e);
    }
  }
  if (sent) {
    toast(`☁️ ${sent} foto(s) que estavam só neste aparelho foram enviadas para a nuvem!`);
    renderPanel();
  }
  return sent;
}
