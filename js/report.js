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
    <table class="report-table">
      <thead>
        <tr>
          <th>Item / Material</th>
          <th style="text-align:right">Quantidade</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Caixas de Terminação Óptica (CTO)</strong></td>
          <td style="text-align:right">${data.totalCTOs} un</td>
        </tr>
        <tr>
          <td><strong>Caixas de Emenda Óptica (CEO)</strong></td>
          <td style="text-align:right">${data.totalCEOs} un</td>
        </tr>
  `;

  const cableTypes = Object.keys(data.cableLengths).sort((a,b) => parseInt(a) - parseInt(b));
  
  if (cableTypes.length > 0) {
    cableTypes.forEach(fo => {
      const meters = data.cableLengths[fo];
      html += `
        <tr>
          <td>Cabo Óptico AS (Autossustentado) - <strong>${fo} FO</strong></td>
          <td style="text-align:right">${meters.toFixed(1)} m</td>
        </tr>
      `;
    });
    
    html += `
        <tr style="background:var(--surface2);">
          <td><strong>Total Geral de Cabos</strong></td>
          <td style="text-align:right; font-weight:700;">${data.totalCable.toFixed(1)} m</td>
        </tr>
    `;
  } else {
    html += `
        <tr>
          <td colspan="2" style="text-align:center; color:var(--text3);">Nenhum cabo lançado no mapa.</td>
        </tr>
    `;
  }

  html += `
      </tbody>
    </table>
    <p style="font-size:11px; color:var(--text3); margin:0;">
      <em>Nota: A metragem dos cabos é calculada com base nas coordenadas geográficas ponto a ponto no mapa (sem contar margens de sobra nos postes). Recomenda-se adicionar uma margem de segurança de 5% a 10% na hora da compra.</em>
    </p>
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
