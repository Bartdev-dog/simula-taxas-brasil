// app.js - versão com máscara BRL, upload foto (OCR) e cálculo atualizado

const icmsRates = {
  "Acre": 0.17, "Alagoas": 0.18, "Amapa": 0.18, "Amazonas": 0.18, "Bahia": 0.18, "Ceara": 0.18,
  "Distrito Federal": 0.18, "Espirito Santo": 0.17, "Goias": 0.17, "Maranhao": 0.18, "Mato Grosso": 0.17, "Mato Grosso do Sul": 0.17,
  "Minas Gerais": 0.18, "Para": 0.18, "Paraiba": 0.18, "Parana": 0.18, "Pernambuco": 0.18, "Piaui": 0.18,
  "Rio de Janeiro": 0.20, "Rio Grande do Norte": 0.18, "Rio Grande do Sul": 0.18, "Rondonia": 0.17, "Roraima": 0.18, "Santa Catarina": 0.17,
  "Sao Paulo": 0.18, "Sergipe": 0.18, "Tocantins": 0.18
};

// ===================== FUNÇÕES DE SUPORTE ===================== //

async function fetchDollar() {
  try {
    const resp = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await resp.json();
    const rate = parseFloat(data['USDBRL'].bid);
    return rate;
  } catch (e) {
    console.warn('Não foi possível obter cotação automática', e);
    return null;
  }
}

function formatBRLvalueFromNumber(num) {
  if (isNaN(num)) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRLString(str) {
  if (!str) return 0;
  str = String(str).trim();
  const tmp = str.replace(/\./g, '').replace(/\s/g, '').replace(/R\$/g, '');
  const normalized = tmp.replace(/,/g, '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

function setupBRLInputMask(inputEl) {
  inputEl.addEventListener('input', () => {
    let raw = inputEl.value.replace(/[^\d]/g, "");

    if (!raw) {
      inputEl.value = "";
      return;
    }

    while (raw.length < 3) raw = "0" + raw;

    let cents = raw.slice(-2);
    let reais = raw.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    inputEl.value = `${reais},${cents}`;
  });

  inputEl.addEventListener('blur', () => {
    if (!inputEl.value.includes(",")) {
      inputEl.value += ",00";
    }
  });
}
  
function showModal(text) {
  const modal = document.getElementById('modal');
  const modalText = document.getElementById('modalText');
  if (!modal || !modalText) return;
  modalText.textContent = text;
  modal.setAttribute('aria-hidden', 'false');
}

function hideModal() {
  const modal = document.getElementById('modal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
}

function calculateFromUSD(totalUsd, cotacao, icmsRate) {
  const usdThreshold = 50.00;
  let aliquota;
  let impostoImportacaoBRL = 0;
  const valorBRL = totalUsd * cotacao;

  if (totalUsd <= usdThreshold) {
    aliquota = 0.20;
    impostoImportacaoBRL = valorBRL * aliquota;
  } else {
    aliquota = 0.60;
    const baseUsd = Math.max(0, totalUsd - 20.00);
    const baseBRL = baseUsd * cotacao;
    impostoImportacaoBRL = baseBRL * aliquota;
  }

  const icms = impostoImportacaoBRL * icmsRate;
  const total = valorBRL + impostoImportacaoBRL + icms;

  return { valorBRL, aliquota, impostoImportacaoBRL, icms, total };
}

// Cotação inicial
async function updateRateToInput() {
  const rate = await fetchDollar();
  if (rate) {
    if (cotacaoEl) cotacaoEl.value = rate.toFixed(4);
  } else {
    if (cotacaoEl) cotacaoEl.value = 5.65;
  }
}

// ===================== EVENTO PRINCIPAL ===================== //

document.addEventListener('DOMContentLoaded', async () => {
  await updateRateToInput();

  // 🔽 Carregar promoções dinamicamente
  try {
    if (!cotacaoEl.value || parseFloat(cotacaoEl.value) <= 0) await updateRateToInput();
    const response = await fetch('promocoes.json');
    if (!response.ok) throw new Error('Erro ao carregar promoções');
    const data = await response.json();

    const promocoesContainer = document.getElementById('promocoes');
    if (promocoesContainer) {
      promocoesContainer.innerHTML = '';
      data.forEach(p => {
        const card = document.createElement('div');
        card.classList.add('promo-card');
        card.innerHTML = `
  <img src="${p.imagem}" 
       alt="${p.titulo}" 
       class="promo-img" 
       crossorigin="anonymous" 
       referrerpolicy="no-referrer">
          <h3>${p.titulo}</h3>
          <p>${p.preco}</p>
          <a href="${p.link}" target="_blank" class="promo-btn">Ver na ${p.loja}</a>
        `;
        promocoesContainer.appendChild(card);
      });
    }
  } catch (error) {
    console.error('Erro ao carregar promoções:', error);
  }

  const brlEl = document.getElementById('brl') || document.getElementById('valor');
  const freteBrlEl = document.getElementById('frete_brl');
  const estadoEl = document.getElementById('estado');
  const calcBtn = document.getElementById('calcular');
  const resetBtn = document.getElementById('reset');
  const refreshBtn = document.getElementById('refreshRate');
  const uploadBtn = document.getElementById('uploadFoto');
  const fotoInput = document.getElementById('fotoInput');
  const resultadoDiv = document.getElementById('resultado');

  // Ícone da câmera no botão de upload
  if (uploadBtn) uploadBtn.innerHTML = '📸 Ler valor do print';

  // Preenche estados automaticamente
  function populateStates() {
    estadoEl.innerHTML = '';
    Object.keys(icmsRates).forEach(uf => {
      const opt = document.createElement('option');
      opt.value = uf;
      opt.dataset.icms = icmsRates[uf];
      opt.textContent = uf;
      if (uf === 'Sao Paulo') opt.selected = true;
      estadoEl.appendChild(opt);
    });
  }

  // Máscara BRL
  if (brlEl) setupBRLInputMask(brlEl);

  populateStates();

  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Atualizando...';
      await updateRateToInput();
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Atualizar dólar';
    });
  }

  // Upload da imagem (OCR)
  if (uploadBtn && fotoInput) {
    uploadBtn.addEventListener('click', () => fotoInput.click());
  }

  if (fotoInput) {
    fotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Lendo imagem...';
      try {
        const { createWorker } = Tesseract;
        const worker = createWorker();
        await worker.load();
        await worker.loadLanguage('por');
        await worker.initialize('por');

        const imgData = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = () => res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });

        const { data: { text } } = await worker.recognize(imgData);
        await worker.terminate();

        const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        let found = null;
        const currencyRegex = /R\$\s?([\d\.\,]+)/i;
        const genericRegex = /([\d]{1,3}(?:[\.\s]\d{3})*(?:[\,\.]\d{2})|\d+[\.\,]\d{2})/g;

        for (const line of lines) {
          let m = currencyRegex.exec(line);
          if (m && m[1]) { found = m[1]; break; }
          let gm;
          while ((gm = genericRegex.exec(line)) !== null) {
            const candidate = gm[1];
            if (/[\.\,]/.test(candidate)) { found = candidate; break; }
          }
          if (found) break;
        }

        if (found) {
          const tmp = found.replace(/\./g, '').replace(/\s/g, '').replace(/,/g, '.');
          const n = parseFloat(tmp);
          if (!isNaN(n)) {
            brlEl.value = formatBRLvalueFromNumber(n);
            if (resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#8ae6c1">Valor lido: R$ ${formatBRLvalueFromNumber(n)} — edite se necessário e clique em Calcular.</p>`;
          }
        } else {
          if (resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#f6c85f">Não foi possível identificar valor na imagem. Edite manualmente.</p>`;
        }

      } catch (err) {
        console.error(err);
        if (resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#f87171">Erro durante leitura da imagem.</p>`;
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '📸 Ler valor do print';
      }
    });
  }

  // Botão Calcular
  if (calcBtn) {
    calcBtn.addEventListener('click', async () => {
      const cotacao = parseFloat(cotacaoEl ? cotacaoEl.value : 0) || 0;
      const brlValue = parseBRLString(brlEl ? brlEl.value : '0') || 0;
      const freteBrl = parseBRLString(freteBrlEl ? freteBrlEl.value : '0') || 0;
      const totalBrl = brlValue + freteBrl;

      if (cotacao <= 0) {
        alert('Favor atualizar a cotação do dólar antes (ou informar manualmente).');
        return;
      }

      const totalUsd = totalBrl / cotacao;
      const icmsRate = parseFloat(estadoEl.selectedOptions[0].dataset.icms) || 0.18;

      if (totalUsd > 50) {
        showModal('⚠️ O valor informado ultrapassa US$ 50. Será aplicada a alíquota de 60% (com desconto de US$ 20 na base de cálculo).');
      }

      const res = calculateFromUSD(totalUsd, cotacao, icmsRate);
      if (resultadoDiv) {
        resultadoDiv.innerHTML = `
          <div>
            <div>Valor em Reais (produto + frete): <strong>${formatBRLvalueFromNumber(res.valorBRL)}</strong></div>
            <div>Valor em Dólar (US$): <strong>${totalUsd.toFixed(2)} US$</strong></div>
            <div>Alíquota aplicada: <strong>${(res.aliquota * 100).toFixed(0)}%</strong></div>
            <div>Imposto de Importação: <strong>${formatBRLvalueFromNumber(res.impostoImportacaoBRL)}</strong></div>
            <div>ICMS estimado: <strong>${formatBRLvalueFromNumber(res.icms)}</strong></div>
            <div>Valor Total Estimado: <strong>${formatBRLvalueFromNumber(res.total)}</strong></div>
          </div>
        `;
      }
    });
  }

  // Fechar modal
  const modalClose = document.getElementById('modalClose');
  const modalOk = document.getElementById('modalOk');
  if (modalClose) modalClose.addEventListener('click', hideModal);
  if (modalOk) modalOk.addEventListener('click', hideModal);

  // Resetar formulário
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (brlEl) brlEl.value = '';
      if (freteBrlEl) freteBrlEl.value = '0';
      if (resultadoDiv) resultadoDiv.innerHTML = '';
      updateRateToInput();
      hideModal();
    });
  }

});
