// ====================================================
// ========= Simula Taxas Brasil - APP.JS =============
// ====================================================

// --- TABELA DE ICMS ---
const icmsRates = {
  "Acre": 0.17, "Alagoas": 0.18, "Amapa": 0.18, "Amazonas": 0.18, "Bahia": 0.18, "Ceara": 0.18,
  "Distrito Federal": 0.18, "Espirito Santo": 0.17, "Goias": 0.17, "Maranhao": 0.18, "Mato Grosso": 0.17,
  "Mato Grosso do Sul": 0.17, "Minas Gerais": 0.18, "Para": 0.18, "Paraiba": 0.18, "Parana": 0.18,
  "Pernambuco": 0.18, "Piaui": 0.18, "Rio de Janeiro": 0.20, "Rio Grande do Norte": 0.18,
  "Rio Grande do Sul": 0.18, "Rondonia": 0.17, "Roraima": 0.18, "Santa Catarina": 0.17,
  "Sao Paulo": 0.18, "Sergipe": 0.18, "Tocantins": 0.18
};

// =====================================================
// 1) BUSCA COTAÇÃO AO CLICAR NO BOTÃO — manual
// =====================================================
async function fetchDollar() {
  try {
    const resp = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await resp.json();
    return parseFloat(data['USDBRL'].bid);
  } catch (e) {
    console.warn("Erro ao buscar dólar ao vivo:", e);
    return null;
  }
}

// =====================================================
// 2) CARREGAR COTAÇÃO LOCAL DA ÚLTIMA SEMANA (fallback)
// =====================================================
async function loadLocalRate() {
  try {
    const resp = await fetch("cotacao.json");
    const json = await resp.json();
    return json;
  } catch (e) {
    return { ultimaCotacao: 5.60, data: "indisponível" };
  }
}

// =====================================================
// FORMATAÇÕES PARA INPUT BRL
// =====================================================
function parseBRLString(str) {
  if (!str) return 0;
  str = str.replace(/\./g, "").replace(/\s/g, "").replace(/R\$/g, "");
  str = str.replace(/,/g, ".");
  return parseFloat(str) || 0;
}

function formatBRLvalueFromNumber(num) {
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// máscara: remove zeros à esquerda e reforça padrão
function setupBRLInputMask(inputEl) {
  inputEl.addEventListener("input", () => {
    let raw = inputEl.value.replace(/[^\d]/g, "");
    if (raw.length > 1) raw = raw.replace(/^0+/, "");

    if (raw.length === 0) {
      inputEl.value = "";
      return;
    }

    if (raw.length === 1) {
      inputEl.value = "0,0" + raw;
    } else if (raw.length === 2) {
      inputEl.value = "0," + raw;
    } else {
      const cents = raw.slice(-2);
      const reais = raw.slice(0, -2);
      inputEl.value = formatBRLvalueFromNumber(Number(reais + "." + cents));
    }
  });

  inputEl.addEventListener("blur", () => {
    const num = parseBRLString(inputEl.value);
    if (!isNaN(num)) inputEl.value = formatBRLvalueFromNumber(num);
  });
}

// =====================================================
// CÁLCULO
// =====================================================
function calculateFromUSD(totalUsd, cotacao, icmsRate) {
  const usdThreshold = 50.0;
  let aliquota = totalUsd <= usdThreshold ? 0.20 : 0.60;

  let impostoImportacaoBRL = 0;
  if (totalUsd <= usdThreshold) {
    impostoImportacaoBRL = totalUsd * cotacao * aliquota;
  } else {
    const baseUsd = Math.max(0, totalUsd - 20);
    impostoImportacaoBRL = baseUsd * cotacao * aliquota;
  }

  const icms = impostoImportacaoBRL * icmsRate;
  const valorBRL = totalUsd * cotacao;
  const total = valorBRL + impostoImportacaoBRL + icms;

  return { valorBRL, aliquota, impostoImportacaoBRL, icms, total };
}

// =====================================================
// MODAL
// =====================================================
function showModal(text) {
  const modal = document.getElementById("modal");
  const modalText = document.getElementById("modalText");
  if (!modal) return;
  modalText.textContent = text;
  modal.setAttribute("aria-hidden", "false");
}

function hideModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.setAttribute("aria-hidden", "true");
}

// =====================================================
// DOMContentLoaded
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  
  const valorEl = document.getElementById("valor");
  const estadoEl = document.getElementById("estado");
  const calcBtn = document.getElementById("calcular");
  const resultadoDiv = document.getElementById("resultado");
  const uploadBtn = document.getElementById("uploadFoto");
  const fotoInput = document.getElementById("fotoInput");
  const refreshBtn = document.getElementById("refreshRate");
  const cotacaoEl = document.getElementById("cotacao") || document.getElementById("cotacaoInput");
  const infoCotacaoEl = document.getElementById("infoCotacao");

  // ========== PREENCHE ESTADOS ==========
  Object.keys(icmsRates).forEach(uf => {
    const opt = document.createElement("option");
    opt.value = uf;
    opt.dataset.icms = icmsRates[uf];
    opt.textContent = uf;
    if (uf === "Sao Paulo") opt.selected = true;
    estadoEl.appendChild(opt);
  });

  // ========== CONFIGURAR MÁSCARA ==========
  setupBRLInputMask(valorEl);

  // ========== CARREGAR COTAÇÃO LOCAL ==========
  const localRate = await loadLocalRate();
  cotacaoEl.value = localRate.ultimaCotacao.toFixed(4);

  if (infoCotacaoEl) {
    infoCotacaoEl.innerHTML =
      `Cotação base: <strong>R$ ${localRate.ultimaCotacao.toFixed(2)}</strong> 
       (atualizada em <strong>${localRate.data}</strong>)`;
  }

  // =====================================================
  // BOTÃO ATUALIZAR COTAÇÃO
  // =====================================================
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = "Atualizando...";

      const live = await fetchDollar();
      const hoje = new Date().toLocaleDateString("pt-BR");

      if (live) {
        cotacaoEl.value = live.toFixed(4);
        if (infoCotacaoEl) {
          infoCotacaoEl.innerHTML =
            `Cotação atual: <strong>R$ ${live.toFixed(2)}</strong> (atualizado em ${hoje})`;
        }
      } else {
        alert("Erro ao atualizar cotação.");
      }

      refreshBtn.textContent = "Atualizar cotação";
      refreshBtn.disabled = false;
    });
  }

  // =====================================================
  // BOTÃO DE CAMERA (somente ícone)
  // =====================================================
  uploadBtn.innerHTML = "📷";  // somente ícone
  uploadBtn.addEventListener("click", () => fotoInput.click());

  // =====================================================
  // OCR (LEITURA DO PRINT)
  // =====================================================
  fotoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = "⏳";

    try {
      const worker = Tesseract.createWorker({ logger: m => {} });
      await worker.load();
      await worker.loadLanguage("por");
      await worker.initialize("por");

      const reader = new FileReader();
      const imgData = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });

      const { data: { text } } = await worker.recognize(imgData);
      await worker.terminate();

      const regex = /(\d{1,3}(?:\.\d{3})*(?:,\d{2}))|(\d+,\d{2})/;
      const match = text.match(regex);

      if (match) {
        const val = match[0];
        valorEl.value = val;
      } else {
        alert("Não consegui identificar um valor. Edite manualmente.");
      }

    } catch (err) {
      alert("Erro lendo a imagem.");
    }

    uploadBtn.disabled = false;
    uploadBtn.innerHTML = "📷";
  });

  // =====================================================
  // CALCULAR
  // =====================================================
  calcBtn.addEventListener("click", () => {

    const cotacao = parseFloat(cotacaoEl.value) || 0;
    if (cotacao <= 0) {
      alert("Cotação inválida. Atualize antes.");
      return;
    }

    const valorBRL = parseBRLString(valorEl.value);
    const totalUsd = valorBRL / cotacao;
    const icmsRate = parseFloat(estadoEl.selectedOptions[0].dataset.icms) || 0.18;

    if (totalUsd > 50) {
      showModal("⚠️ Passou de US$ 50 → alíquota de 60% aplicada.");
    }

    const res = calculateFromUSD(totalUsd, cotacao, icmsRate);

    resultadoDiv.innerHTML = `
      <div>Valor em Reais: <strong>${formatBRLvalueFromNumber(res.valorBRL)}</strong></div>
      <div>Valor em Dólar: <strong>${totalUsd.toFixed(2)}</strong></div>
      <div>Alíquota: <strong>${(res.aliquota * 100).toFixed(0)}%</strong></div>
      <div>Imposto: <strong>${formatBRLvalueFromNumber(res.impostoImportacaoBRL)}</strong></div>
      <div>ICMS: <strong>${formatBRLvalueFromNumber(res.icms)}</strong></div>
      <div>Total final: <strong>${formatBRLvalueFromNumber(res.total)}</strong></div>
    `;
  });

});
