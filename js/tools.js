/**
 * tools.js — Gerenciamento de ferramentas e atalhos de teclado
 */

const toolNames = {
  select: 'Selecionar',
  pop:    'Colocar POP',
  ruler:  'Régua',
  eraser: 'Apagar',
};

const toolHints = {
  pop:    '📍 Clique no mapa para posicionar o POP / OLT',
  ruler:  '📏 Clique para marcar pontos · Duplo-clique para finalizar',
  eraser: '🗑️ Clique em um elemento para apagá-lo',
};

/** Define a ferramenta ativa */
function setTool(t) {
  if (STATE.rulerPoints.length) clearRuler();

  STATE.tool = t;

  // Highlight no botão
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + t)?.classList.add('active');
  document.getElementById('sb-tool').textContent = toolNames[t] || t;

  // Hint overlay
  const hint = document.getElementById('hintOverlay');
  if (toolHints[t]) {
    hint.textContent = toolHints[t];
    hint.style.display = 'block';
  } else {
    hint.style.display = 'none';
  }

  // Cursor crosshair
  document.body.classList.toggle('drawing', ['pop', 'ruler', 'eraser'].includes(t));

  renderPanel();
}

// Atalhos de teclado
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const keys = { s: 'select', o: 'pop', r: 'ruler' };
  if (keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
  if (e.key === 'Delete' || e.key === 'Backspace') setTool('eraser');
  if (e.key === 'Escape') { clearRuler(); setTool('select'); }
});
