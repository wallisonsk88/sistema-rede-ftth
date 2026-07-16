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

// Atenuação inicial fixa da OLT/POP até o início do ramal (Conexões: 1.0 dB + Emendas: 0.4 dB = 1.4 dB)
const INITIAL_LOSS = 1.40;

// Perda padrão entre cada caixa CTO na rede desbalanceada (Distância + Fusão = ~0.2525 dB)
const LOSS_BETWEEN_BOXES = 0.2525;

/**
 * Calcula a potência óptica em cascata de CTOs.
 * @param {number} txPower - Potência de saída da OLT/POP (ex: +5.0 dBm)
 * @param {Array} ctos - Array com as configurações das CTOs em ordem
 * @returns {Array} Array com a potência de Rx esperada em cada CTO e o sinal que sobra na linha.
 */
function calculateOpticalCascade(txPower, ctos) {
  // A potência que sai do POP já sofre a atenuação inicial de conectores/emendas e DIO (1.4 dB)
  let currentSignal = txPower - INITIAL_LOSS;

  const results = [];

  for (let i = 0; i < ctos.length; i++) {
    const cto = ctos[i];
    let rxCto = 0;
    
    // Perda do splitter de atendimento (NAP) dentro da CTO (Ex: 1:8 -> 10.5 dB)
    const attLoss = SPLITTER_BAL[cto.attSplitter] || 10.5;

    if (cto.type === 'desbalanceado') {
      const unbal = SPLITTER_UNBAL[cto.ratio];
      if (!unbal) {
        results.push({ rx: '--', error: 'Ratio inválido' });
        continue;
      }
      
      // Sinal do cliente (ONU) = Sinal que chega na caixa - Perda de Derivação (Drop) - Perda da NAP
      rxCto = currentSignal - unbal.drop - attLoss;
      
      // O sinal que segue pela rua é atenuado apenas pela porta de Passagem (Pass) do splitter
      currentSignal = currentSignal - unbal.pass;
    } 
    else {
      // Balanceado: a rede é dividida simetricamente
      const bal = SPLITTER_BAL[cto.ratio] || 7.0; 
      rxCto = currentSignal - bal - attLoss;
      currentSignal = currentSignal - bal; // simplificação teórica, balanceado divide tudo igual.
    }

    // Ao sair da caixa para ir até a próxima, temos a perda da fibra e emendas (0.2525 dB)
    currentSignal -= LOSS_BETWEEN_BOXES;

    results.push({
      rx: rxCto.toFixed(2),
      remainingSignal: currentSignal.toFixed(2)
    });
  }

  return results;
}
