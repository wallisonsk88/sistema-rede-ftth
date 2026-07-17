/**
 * state.js — Estado global da aplicação e constantes
 */

const STATE = {
  tool: 'select',
  olts: [],          // POPs / OLTs
  cables: [],        // Cabos
  splices: [],       // Caixas de Emenda (CEOs)
  selectedId: null,
  rulerPoints: [],
  rulerLines: [],
  rulerMarkers: [],
  activeTab: 'props',
  nextOLTNum: 1,
};
