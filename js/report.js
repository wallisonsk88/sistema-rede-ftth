/**
 * report.js — Geração de Relatório de Quantitativo de Materiais (BOM)
 */

function generateReportData() {
  let totalCTOs = 0;
  let totalCEOs = STATE.splices.length;
  let cableLengths = {}; // ex: { '6': 150.5, '12': 320.0 }
  let totalCable = 0;

  // Conta as CTOs que de fato estão lançadas (possuem coordenadas)
  STATE.olts.forEach(pop => {
    (pop.pons || []).forEach(pon => {
      (pon.ramais || []).forEach(ramal => {
        (ramal.ctos || []).forEach(cto => {
          if (cto.lat && cto.lng) {
            totalCTOs++;
          }
        });
      });
    });
  });

  // Calcula metragem de cada cabo
  STATE.cables.forEach(cable => {
    if (!cable.path || cable.path.length < 2) return;
    
    let lengthMeters = 0;
    for (let i = 0; i < cable.path.length - 1; i++) {
      const p1 = L.latLng(cable.path[i][0], cable.path[i][1]);
      const p2 = L.latLng(cable.path[i+1][0], cable.path[i+1][1]);
      lengthMeters += p1.distanceTo(p2);
    }

    const fo = cable.fibers || 0;
    if (!cableLengths[fo]) cableLengths[fo] = 0;
    cableLengths[fo] += lengthMeters;
    totalCable += lengthMeters;
  });

  return {
    totalCTOs,
    totalCEOs,
    cableLengths,
    totalCable
  };
}

function openReportModal() {
  const data = generateReportData();
  
  let html = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
      <!-- CTO Card -->
      <div style="background:var(--surface2); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; display:flex; align-items:center; gap:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        <div style="width:40px; height:40px; border-radius:10px; background:rgba(59, 130, 246, 0.15); display:flex; align-items:center; justify-content:center; font-size:20px; color:#3b82f6;">📦</div>
        <div>
          <div style="font-size:11px; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:2px;">Total de CTOs</div>
          <div style="font-size:20px; font-weight:800; color:var(--text);">${data.totalCTOs} <span style="font-size:12px; font-weight:500; color:var(--text3);">unidades</span></div>
        </div>
      </div>

      <!-- CEO Card -->
      <div style="background:var(--surface2); border:1px solid rgba(255,255,255,0.05); padding:16px; border-radius:12px; display:flex; align-items:center; gap:12px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
        <div style="width:40px; height:40px; border-radius:10px; background:rgba(234, 179, 8, 0.15); display:flex; align-items:center; justify-content:center; font-size:20px; color:#eab308;">
          <img src="img/ceo.svg" style="width:24px; height:24px; filter: brightness(0) saturate(100%) invert(74%) sepia(85%) saturate(1906%) hue-rotate(352deg) brightness(98%) contrast(93%);" alt="CEO">
        </div>
        <div>
          <div style="font-size:11px; color:var(--text2); text-transform:uppercase; letter-spacing:0.5px; font-weight:600; margin-bottom:2px;">Total de CEOs</div>
          <div style="font-size:20px; font-weight:800; color:var(--text);">${data.totalCEOs} <span style="font-size:12px; font-weight:500; color:var(--text3);">unidades</span></div>
        </div>
      </div>
    </div>
    
    <h4 style="margin:0 0 12px 0; font-size:13px; color:var(--text); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Metragem de Cabos</h4>
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; margin-bottom:15px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
  `;

  const cableTypes = Object.keys(data.cableLengths).sort((a,b) => parseInt(a) - parseInt(b));
  
  if (cableTypes.length > 0) {
    cableTypes.forEach(fo => {
      const meters = data.cableLengths[fo];
      html += `
        <div style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; transition: background 0.2s; cursor:default;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='transparent'">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:28px; height:28px; border-radius:8px; background:rgba(16, 185, 129, 0.15); color:#10b981; display:flex; align-items:center; justify-content:center; font-size:14px;">〰️</div>
            <span style="font-size:13px; font-weight:600; color:var(--text);">Cabo AS <span style="color:var(--primary);">${fo} FO</span></span>
          </div>
          <div style="font-size:14px; font-weight:700; color:var(--text);">${meters.toFixed(1)} <span style="font-size:11px; font-weight:500; color:var(--text3);">metros</span></div>
        </div>
      `;
    });
    
    html += `
        <div style="padding:16px; background:var(--surface2); display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:28px; height:28px; border-radius:8px; background:rgba(255, 255, 255, 0.1); color:white; display:flex; align-items:center; justify-content:center; font-size:14px;">📏</div>
            <span style="font-size:13px; font-weight:700; color:var(--text);">Total Geral de Lançamento</span>
          </div>
          <div style="font-size:16px; font-weight:800; color:var(--green);">${data.totalCable.toFixed(1)} <span style="font-size:12px; font-weight:600; color:var(--text3);">metros</span></div>
        </div>
    `;
  } else {
    html += `
        <div style="padding:30px 20px; text-align:center; color:var(--text3); font-size:13px;">
          Nenhum cabo lançado no mapa.
        </div>
    `;
  }

  html += `
    </div>
    <div style="display:flex; gap:8px; align-items:flex-start; padding:10px 12px; background:rgba(234, 179, 8, 0.08); border:1px solid rgba(234, 179, 8, 0.3); border-radius:8px;">
      <span style="font-size:16px;">💡</span>
      <p style="font-size:11px; color:var(--text2); margin:0; line-height:1.4;">
        <strong style="color:var(--text);">Aviso de Cotação:</strong> A metragem é calculada geometricamente ponto a ponto. Recomenda-se adicionar <strong>5% a 10% de margem de sobra técnica</strong> (curvas, postes e reservas) na hora de comprar os cabos.
      </p>
    </div>
  `;

  document.getElementById('reportContent').innerHTML = html;
  document.getElementById('reportModal').style.display = 'flex';
}

function closeReportModal() {
  document.getElementById('reportModal').style.display = 'none';
}

function copyReport() {
  const data = generateReportData();
  
  let text = `📊 RELATÓRIO DE MATERIAIS - PROJETO FTTH\n`;
  text += `----------------------------------------\n`;
  text += `CTOs: ${data.totalCTOs} unidades\n`;
  text += `CEOs (Emendas): ${data.totalCEOs} unidades\n\n`;
  
  text += `CABOS ÓPTICOS:\n`;
  const cableTypes = Object.keys(data.cableLengths).sort((a,b) => parseInt(a) - parseInt(b));
  cableTypes.forEach(fo => {
    text += `- Cabo ${fo} FO: ${data.cableLengths[fo].toFixed(1)} metros\n`;
  });
  text += `Total Geral de Cabos: ${data.totalCable.toFixed(1)} metros\n`;
  text += `----------------------------------------\n`;
  text += `* Lembre-se de adicionar margem de segurança (sobras) para a compra.\n`;

  navigator.clipboard.writeText(text).then(() => {
    toast('📋 Relatório copiado para a Área de Transferência!');
  }).catch(err => {
    console.error('Erro ao copiar:', err);
    toast('⚠️ Não foi possível copiar. Selecione o texto manualmente.');
  });
}
