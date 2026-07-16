/**
 * utils.js — Funções utilitárias reutilizáveis
 */

/** Exibe uma notificação toast na tela */
function toast(msg) {
  const w = document.getElementById('toastWrap');
  if (!w) return;
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerText = msg;
  w.appendChild(d);
  setTimeout(() => d.classList.add('show'), 10);
  setTimeout(() => {
    d.classList.remove('show');
    setTimeout(() => d.remove(), 300);
  }, 3000);
}

/** Formata distância em metros ou quilômetros */
function formatDist(m) {
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return Math.round(m) + ' m';
}

/** Calcula o comprimento total de uma polyline */
function calcPolylineLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += map.distance(pts[i - 1], pts[i]);
  }
  return len;
}

/** Retorna o ponto do meio de uma polyline */
function midPointOfPolyline(pts) {
  if (pts.length === 0) return [0, 0];
  return pts[Math.floor(pts.length / 2)];
}
