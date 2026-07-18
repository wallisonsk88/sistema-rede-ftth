async function exportKMZ() {
  const kmlParts = [];
  
  kmlParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  kmlParts.push(`<kml xmlns="http://www.opengis.net/kml/2.2">`);
  kmlParts.push(`<Document>`);
  kmlParts.push(`<name>${document.getElementById('projectName').value || 'Projeto FTTH'}</name>`);
  kmlParts.push(`<description>Exportado de Meganet FTTX</description>`);

  // Definindo cores e estilos (formato KML cor: aabbggrr)
  kmlParts.push(`
    <Style id="style-pop">
      <IconStyle>
        <color>ff0000ff</color> <!-- Vermelho (KML usa aabbggrr) -->
        <scale>1.5</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/business.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="style-ceo">
      <IconStyle>
        <color>ffff0000</color> <!-- Azul -->
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="style-cto">
      <IconStyle>
        <color>ff00ff00</color> <!-- Verde -->
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/polygon.png</href></Icon>
      </IconStyle>
    </Style>
    <Style id="style-cable">
      <LineStyle>
        <color>ffebaa34</color> <!-- Azul Claro -->
        <width>4</width>
      </LineStyle>
    </Style>
  `);

  // POPs
  kmlParts.push(`<Folder><name>POPs / OLTs</name>`);
  STATE.olts.forEach(pop => {
     kmlParts.push(`
       <Placemark>
         <name><![CDATA[${pop.name}]]></name>
         <description><![CDATA[${pop.obs ? 'Observações: ' + pop.obs : 'Nenhuma observação'}]]></description>
         <styleUrl>#style-pop</styleUrl>
         <Point>
           <coordinates>${pop.lng},${pop.lat},0</coordinates>
         </Point>
       </Placemark>
     `);
  });
  kmlParts.push(`</Folder>`);

  // CEOs (Splices)
  kmlParts.push(`<Folder><name>CEOs (Emendas)</name>`);
  STATE.splices.forEach(splice => {
     kmlParts.push(`
       <Placemark>
         <name><![CDATA[${splice.name}]]></name>
         <description><![CDATA[${splice.obs ? 'Observações: ' + splice.obs : ''}]]></description>
         <styleUrl>#style-ceo</styleUrl>
         <Point>
           <coordinates>${splice.lng},${splice.lat},0</coordinates>
         </Point>
       </Placemark>
     `);
  });
  kmlParts.push(`</Folder>`);

  // CTOs
  kmlParts.push(`<Folder><name>CTOs (Caixas de Atendimento)</name>`);
  STATE.olts.forEach(pop => {
    (pop.pons || []).forEach(pon => {
      (pon.ramais || []).forEach(ramal => {
        (ramal.ctos || []).forEach((cto, idx) => {
          if (cto.lat && cto.lng) {
            kmlParts.push(`
              <Placemark>
                <name><![CDATA[${cto.name}]]></name>
                <description><![CDATA[
Hierarquia: ${pop.name} -> ${pon.rotaName} -> ${ramal.name}<br>
Splitter: ${cto.ratio}<br>
Sinal Estimado: ${cto.sinalFinal ? cto.sinalFinal + ' dBm' : 'N/A'}<br>
Observações: ${cto.obs || 'Nenhuma'}
                ]]></description>
                <styleUrl>#style-cto</styleUrl>
                <Point>
                  <coordinates>${cto.lng},${cto.lat},0</coordinates>
                </Point>
              </Placemark>
            `);
          }
        });
      });
    });
  });
  kmlParts.push(`</Folder>`);

  // Cables
  kmlParts.push(`<Folder><name>Cabos de Fibra Óptica</name>`);
  STATE.cables.forEach(cable => {
     const coords = cable.path.map(p => `${p[1]},${p[0]},0`).join(' ');
     kmlParts.push(`
       <Placemark>
         <name><![CDATA[${cable.name}]]></name>
         <description><![CDATA[Capacidade: ${cable.fibers} Fibras]]></description>
         <styleUrl>#style-cable</styleUrl>
         <LineString>
           <tessellate>1</tessellate>
           <coordinates>${coords}</coordinates>
         </LineString>
       </Placemark>
     `);
  });
  kmlParts.push(`</Folder>`);

  kmlParts.push(`</Document>`);
  kmlParts.push(`</kml>`);

  const kmlString = kmlParts.join('\n');

  try {
    toast('Gerando arquivo KMZ para Google Earth...');
    if (typeof JSZip === 'undefined') {
       toast('❌ Biblioteca JSZip não carregou. Verifique a internet.');
       return;
    }
    const zip = new JSZip();
    zip.file("doc.kml", kmlString); // KML obrigatoriamente chamado doc.kml na raiz
    const content = await zip.generateAsync({ type: "blob" });
    
    const a = document.createElement("a");
    a.href = URL.createObjectURL(content);
    a.download = (document.getElementById('projectName').value || 'Projeto_FTTH').replace(/\s+/g, '_') + ".kmz";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('✅ KMZ Exportado com sucesso!');
  } catch(e) {
    console.error(e);
    toast('❌ Erro ao gerar KMZ.');
  }
}
