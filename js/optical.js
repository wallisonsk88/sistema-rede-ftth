/**
 * optical.js — Motor de cálculos de atenuação e potência óptica
 * Valores baseados na planilha oficial: Potencia Splitter Desbalanceado_BOA.xlsx
 */

// Perdas (dB) para Splitters Balanceados
const SPLITTER_BAL = {
  '1:2': 3.50,
  '1:4': 7.00,
  '1:8': 10.50,
  '1:16': 14.00,
  '1:32': 17.50,
  '1:64': 20.50
};

// Perdas (dB) para Splitters Desbalanceados (Assymetric)
// key = Ratio, pass = perda na passagem (segue o cabo), drop = perda na derivação (vai pra CTO)
const SPLITTER_UNBAL = {
  '1/99':  { pass: 0.30, drop: 21.60 },
  '2/98':  { pass: 0.40, drop: 18.70 },
  '5/95':  { pass: 0.50, drop: 14.60 },
  '10/90': { pass: 0.70, drop: 11.00 },
  '15/85': { pass: 1.00, drop: 9.60 },
  '20/80': { pass: 1.40, drop: 7.90 },
  '25/75': { pass: 1.70, drop: 6.95 },
  '30/70': { pass: 1.90, drop: 6.00 },
  '35/65': { pass: 2.30, drop: 5.35 },
  '40/60': { pass: 2.70, drop: 4.70 },
  '45/55': { pass: 3.15, drop: 4.15 },
  '50/50': { pass: 3.50, drop: 3.50 }
};

// Atenuação padrão da Fibra Óptica (dB/km) em 1490nm (Download GPON)
const FIBER_ATTENUATION = 0.25; // 0.25 conforme excel (1490 nm)

// Perda padrão por conector / fusão (dB)
const CONNECTOR_LOSS = 0.5; // Conexões = 0.5 conforme excel

/**
 * Calcula a potência óptica em cascata de CTOs.
 * @param {number} txPower - Potência de saída da OLT/POP (ex: +4 dBm)
 * @param {Array} ctos - Array com as configurações das CTOs em ordem
 * @returns {Array} Array com a potência de Rx esperada em cada CTO e o sinal que sobra na linha.
 */
function calculateOpticalCascade(txPower, ctos) {
  let currentSignal = txPower;
  
  // Consideramos uma perda inicial padrão de fusões/conectores no POP (ex: 1.0 dB)
  currentSignal -= 1.0;

  const results = [];

  for (let i = 0; i < ctos.length; i++) {
    const cto = ctos[i];
    let rxCto = 0;
    
    // Perda do splitter de atendimento dentro da CTO (ex: 1:8), que agora pode ser manual por CTO
    const attLoss = SPLITTER_BAL[cto.attSplitter] || 10.5;

    if (cto.type === 'desbalanceado') {
      const unbal = SPLITTER_UNBAL[cto.ratio];
      if (!unbal) {
        results.push({ error: 'Ratio inválido' });
        continue;
      }
      // O Drop vai para o splitter de atendimento da CTO
      rxCto = currentSignal - unbal.drop - attLoss;
      // O Pass segue para o próximo ponto na linha
      currentSignal = currentSignal - unbal.pass;
    } 
    else {
      // Balanceado (ex: um 1:4 na rua dividindo para as CTOs 1:8)
      const bal = SPLITTER_BAL[cto.ratio] || 7.0; 
      rxCto = currentSignal - bal - attLoss;
    }

    // Subtrai perda de conector/fusão em cada caixa
    currentSignal -= CONNECTOR_LOSS;

    results.push({
      rx: rxCto.toFixed(2),
      remainingSignal: currentSignal.toFixed(2)
    });
  }

  return results;
}
