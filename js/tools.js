/**
 * tools.js — Gerenciamento de ferramentas e atalhos de teclado
 */

const toolNames = {
  select: 'Selecionar',
  pop:    'Colocar POP',
  cable:  'Lançar Cabo',
  ruler:  'Régua',
  eraser: 'Apagar',
};

const toolHints = {
  pop:    '📍 Clique no mapa para posicionar o POP / OLT',
  cable:  '🔌 Clique num POP para iniciar o cabo. Vá clicando para traçar e Duplo-clique para terminar',
  ruler:  '📏 Clique para marcar pontos · Duplo-clique para finalizar',
  eraser: '🗑️ Clique em um elemento para apagá-lo',
};

/** Define a ferramenta ativa */
function setTool(t) {
  if (STATE.rulerPoints.length) clearRuler();
  // Se mudar de ferramenta enquanto desenha o cabo, deve limpar também (será adicionado em cable.js)
  if (typeof clearCableDraw === 'function') clearCableDraw();

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
  document.body.classList.toggle('drawing', ['pop', 'cable', 'ruler', 'eraser', 'cto_place'].includes(t));

  renderPanel();
}

// Atalhos de teclado
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  const keys = { s: 'select', o: 'pop', c: 'cable', r: 'ruler' };
  if (keys[e.key.toLowerCase()]) setTool(keys[e.key.toLowerCase()]);
  if (e.key === 'Delete' || e.key === 'Backspace') setTool('eraser');
  if (e.key === 'Escape') { clearRuler(); setTool('select'); }
});
