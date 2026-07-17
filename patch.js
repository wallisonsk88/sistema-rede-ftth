const fs = require('fs');

let content = fs.readFileSync('js/panel.js', 'utf8');

// 1. Modificar o switch do topo
content = content.replace(
  "  const cable = STATE.cables.find(c => c.id === id);\n  if (cable) return renderCableProps(cable);\n\n  return '';",
  "  const cable = STATE.cables.find(c => c.id === id);\n  if (cable) return renderCableProps(cable);\n\n  const splice = STATE.splices.find(s => s.id === id);\n  if (splice) return renderSpliceProps(splice);\n\n  return '';"
);

// 2. Modificar renderCableProps (assinatura + top lines)
content = content.replace(
  "function renderCableProps(cable) {\n  const pop = STATE.olts.find(o => o.id === cable.popId);\n  if (!pop) return '<div class=\"empty-panel\">POP não encontrado para este cabo.</div>';",
  `function renderCableProps(cable) {
  let originName = 'Origem Desconhecida';
  let rootPopId = null;
  let allRamais = [];

  if (cable.sourceType === 'pop') {
     const pop = STATE.olts.find(o => o.id === cable.popId);
     if (pop) {
       originName = 'POP: ' + pop.name;
       rootPopId = pop.id;
       pop.pons.forEach(pon => {
         if(pon.ramais) pon.ramais.forEach(r => allRamais.push({ id: r.id, name: \`\${pon.rotaName} - \${r.name}\`, color: pon.color }));
       });
     }
  } else if (cable.sourceType === 'splice') {
     const splice = STATE.splices.find(s => s.id === cable.sourceId);
     if (splice) {
       originName = 'CEO: ' + splice.name;
       let currentCable = STATE.cables.find(c => c.id === splice.cableId);
       while (currentCable && currentCable.sourceType === 'splice') {
           const parentSplice = STATE.splices.find(s => s.id === currentCable.sourceId);
           if (!parentSplice) break;
           currentCable = STATE.cables.find(c => c.id === parentSplice.cableId);
       }
       if (currentCable && currentCable.sourceType === 'pop') {
           const pop = STATE.olts.find(o => o.id === currentCable.popId);
           if (pop) {
             rootPopId = pop.id;
             pop.pons.forEach(pon => {
               if(pon.ramais) pon.ramais.forEach(r => allRamais.push({ id: r.id, name: \`\${pon.rotaName} - \${r.name}\`, color: pon.color }));
             });
           }
       }
     }
  }`
);

// Adicionar a originName e remover old allRamais logic
content = content.replace(
  `    <div class="prop-group">\n      <label>Nome do Cabo</label>`,
  `    <div class="panel-header" style="margin-bottom:15px">\n      <div style="font-size:14px; margin-bottom:5px;">〰️ \${cable.name}</div>\n      <div style="font-size:10px; opacity:0.8;">\${originName}</div>\n    </div>\n    <div class="prop-group">\n      <label>Nome do Cabo</label>`
);

content = content.replace(
  `  // Coletar todos os ramais disponíveis no POP\n  let allRamais = [];\n  pop.pons.forEach(pon => {\n    if(pon.ramais) {\n      pon.ramais.forEach(r => {\n        allRamais.push({ id: r.id, name: \`\${pon.rotaName} - \${r.name}\`, color: pon.color });\n      });\n    }\n  });`,
  `  // Ramais coletados no topo baseado na origem`
);

content = content.replace(
  "highlightRamal('${pop.id}', '${mappedRamalId}')",
  "highlightRamal('${rootPopId}', '${mappedRamalId}')"
);
content = content.replace(
  "preparePlaceCTO('${pop.id}', '${mappedRamalId}', '${cable.id}')",
  "preparePlaceCTO('${rootPopId}', '${mappedRamalId}', '${cable.id}')"
);
content = content.replace(
  "${mappedRamalId ? `",
  "${mappedRamalId && rootPopId ? `"
);

// 3. Adicionar renderSpliceProps no fim
const spliceProps = `

function renderSpliceProps(splice) {
  const sourceCable = STATE.cables.find(c => c.id === splice.cableId);
  const derivedCables = STATE.cables.filter(c => c.sourceType === 'splice' && c.sourceId === splice.id);
  
  let html = \`
    <div class="panel-header">
      <div style="font-size:14px; margin-bottom:5px;">🗃️ \${splice.name}</div>
      <div style="font-size:10px; opacity:0.8;">Caixa de Emenda Óptica (Sangria)</div>
    </div>
    
    <div style="padding:15px;">
      <button class="btn-full primary" style="margin-bottom:15px;" onclick="startCableFromSplice('\${splice.id}')">
        🔌 Lançar Cabo Derivado
      </button>

      <div class="pon-card">
        <div class="pon-header" style="background:var(--border);">
           Entrada (Tronco): <b>\${sourceCable ? sourceCable.name : 'Nenhum'}</b>
        </div>
      </div>
  \`;

  if (derivedCables.length === 0) {
      html += \`<div style="font-size:11px; color:var(--text2); text-align:center; padding:20px;">Nenhum cabo derivado ainda.</div>\`;
  } else {
      derivedCables.forEach(dc => {
         html += \`
          <div class="pon-card" style="margin-top:15px;">
            <div class="pon-header">
               📍 Saída: <b>\${dc.name}</b>
            </div>
            <div style="padding:10px;">
               <div style="font-size:10px; color:var(--text2); margin-bottom:8px;">
                 Fusão de Fibras (Sangria):
               </div>
         \`;
         
         for (let i = 1; i <= dc.fibers; i++) {
           const subFColor = FIBER_COLORS[(i-1) % FIBER_COLORS.length];
           let sourceOptions = '';
           for (let j = 1; j <= (sourceCable ? sourceCable.fibers : 12); j++) {
              const srcFColor = FIBER_COLORS[(j-1) % FIBER_COLORS.length];
              const currentSrcFiber = splice.fusions[dc.id] ? splice.fusions[dc.id][i] : null;
              const selected = currentSrcFiber == j ? 'selected' : '';
              sourceOptions += \`<option value="\${j}" \${selected}>F\${j} (\${srcFColor.name}) do Tronco</option>\`;
           }
           
           html += \`
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); border:1px solid var(--border); padding:6px; border-radius:4px; margin-bottom:6px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:12px; height:12px; border-radius:50%; background:\${subFColor.hex}"></div>
                <span style="font-size:12px; color:var(--text); font-weight:600;">F\${i} - \${subFColor.name}</span>
              </div>
              <select onchange="setFusion('\${splice.id}', '\${dc.id}', \${i}, this.value)" style="width:140px; font-size:10px; padding:4px;">
                <option value="">Não fundida</option>
                \${sourceOptions}
              </select>
            </div>
           \`;
         }
         
         html += \`</div></div>\`;
      });
  }

  html += \`</div>\`;
  return html;
}

window.setFusion = function(spliceId, destCableId, destFiber, srcFiber) {
   const splice = STATE.splices.find(s => s.id === spliceId);
   if (splice) {
      if (!splice.fusions[destCableId]) splice.fusions[destCableId] = {};
      if (srcFiber) {
         splice.fusions[destCableId][destFiber] = parseInt(srcFiber);
      } else {
         delete splice.fusions[destCableId][destFiber];
      }
      saveLocal();
      toast('🔗 Fusão atualizada na CEO');
      renderPanel();
   }
}
`;

fs.writeFileSync('js/panel.js', content + spliceProps);
console.log('OK');
