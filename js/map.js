/**
 * map.js — Configuração do mapa Leaflet, camadas e geocoder
 */

const map = L.map('map', {
  center: [-15.78, -47.93],
  zoom: 14,
  zoomControl: false,
  attributionControl: false,
});

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.control.attribution({ position: 'bottomleft', prefix: '© OpenStreetMap · MEGANET FTTX' }).addTo(map);

// Barra de pesquisa de endereço
L.Control.geocoder({
  defaultMarkGeocode: false,
  position: 'topleft',
  placeholder: 'Buscar endereço...',
}).on('markgeocode', function (e) {
  map.fitBounds(e.geocode.bbox);
  toast('📍 ' + e.geocode.name.split(',')[0]);
}).addTo(map);

// Camadas de mapa
const tiles = {
  dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 20,
  }),
  satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 20,
  }),
};
tiles.dark.addTo(map);

let satActive = false;

/** Alterna entre mapa escuro e satélite */
window.toggleSatellite = function() {
  satActive = !satActive;
  if (satActive) {
    tiles.dark.remove();
    tiles.satellite.addTo(map);
    document.getElementById('tool-sat').classList.add('active');
  } else {
    tiles.satellite.remove();
    tiles.dark.addTo(map);
    document.getElementById('tool-sat').classList.remove('active');
  }
}

/** Ajusta o zoom para exibir todos os elementos */
window.fitBounds = function() {
  const all = [];
  STATE.olts.forEach(o => all.push([o.lat, o.lng]));
  STATE.splices.forEach(s => all.push([s.lat, s.lng]));
  if (all.length > 0) {
    map.fitBounds(L.latLngBounds(all), { padding: [40, 40] });
  }
}
