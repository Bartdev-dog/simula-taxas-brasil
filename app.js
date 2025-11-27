/* ============================================================
   APP.JS — versão final integrada ao seu index.html atual
   ============================================================ */

/* ====== TABELA DE ICMS ====== */
const icmsRates = {
  "Acre": 0.17, "Alagoas": 0.18, "Amapa": 0.18, "Amazonas": 0.18, "Bahia": 0.18,
  "Ceara": 0.18, "Distrito Federal": 0.18, "Espirito Santo": 0.17, "Goias": 0.17,
  "Maranhao": 0.18, "Mato Grosso": 0.17, "Mato Grosso do Sul": 0.17, "Minas Gerais": 0.18,
  "Para": 0.18, "Paraiba": 0.18, "Parana": 0.18, "Pernambuco": 0.18, "Piaui": 0.18,
  "Rio de Janeiro": 0.20, "Rio Grande do Norte": 0.18, "Rio Grande do Sul": 0.18,
  "Rondonia": 0.17, "Roraima": 0.18, "Santa Catarina": 0.17,
  "Sao Paulo": 0.18, "Sergipe": 0.18, "Tocantins": 0.18
};

/* ===== COTAÇÃO GLOBAL ===== */
let cotacaoAtual = 0;

/* ===== BUSCA COTAÇÃO ===== */
async function fetchDollar() {
  try {
    const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
    const j = await r.json();
    return parseFloat(j.USDBRL.bid);
  } catch (e) {
    console.warn("Erro ao buscar dólar", e);
    return 5.50; // fallback
  }
}

async function updateCotacao() {
  cotacaoAtual = await fetchDollar();
  if (!cotacaoAtual || cotacaoAtual <= 0) cotacaoAtual = 5.50;
  console.log("Cotação atualizada:", cotacaoAtual);
}

/* ===== MÁSCARA BRL — DIGITOU 32142 = 321,42 ===== */
function setupBRLInputMask(inputEl) {
  inputEl.addEventListener("input", () => {
    let raw = inputEl.value.replace(/\D/g, "");

    if (!raw) {
      inputEl.value = "";
      return;
    }

    while (raw.length < 3) raw = "0" + raw;

    const cents = raw.slice(-2);
    const reais = raw.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    inputEl.value = `${reais},${cents}`;
  });

  inputEl.addEventListener("blur", () => {
    if (!inputEl.value.includes(",")) {
      inputEl.value += ",00";
    }
  });
}

/* ===== PARSE BRL → NÚMERO ===== */
function parseBRL(v) {
  if (!v) return 0;
  return parseFloat(v.replace(/\./g, "").replace(",", "."));
}

/* ===== FORMATAR NÚMERO → BRL ===== */
function formatBRL(n) {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
}

/* ===== CÁLCULO DE IMPOSTO ===== */
function calcularImpostos(totalUsd, icmsRate) {
  let imposto = 0;

  if (totalUsd <= 50) {
    imposto = totalUsd * cotacaoAtual * 0.20;
  } else {
    const base = (totalUsd - 20) * cotacaoAtual;
    imposto = base * 0.60;
  }

  const valorBRL = totalUsd * cotacaoAtual;
  const icms = imposto * icmsRate;
  const total = valorBRL + imposto + icms;

  return { valorBRL, imposto, icms, total };
}

/* ============================================================
   DOM READY
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {

  const valorEl = document.getElementById("valor");
  const estadoEl = document.getElementById("estado");
  const uploadBtn = document.getElementById("uploadFoto");
  const inputFoto = document.getElementById("fotoInput");
  const resultadoEl = document.getElementById("resultado");

  /* ==== Atualiza dólar ao carregar ==== */
  await updateCotacao();

  /* ==== Aplicar máscara BRL ==== */
  setupBRLInputMask(valorEl);

  /* ==== Lista UFs ==== */
  Object.keys(icmsRates).forEach(uf => {
    const opt = document.createElement("option");
    opt.value = uf;
    opt.textContent = uf;
    estadoEl.appendChild(opt);
  });

  /* ==== Ajustar botão 📸 ==== */
  uploadBtn.textContent = "📸";

  /* ============================================================
     OCR DO PRINT
     ============================================================ */
  uploadBtn.addEventListener("click", () => inputFoto.click());

  inputFoto.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    uploadBtn.textContent = "⏳";

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      const imgData = await new Promise(resolve => {
        reader.onload = () => resolve(reader.result);
      });

      const worker = await Tesseract.createWorker("por");
      const ocr = await worker.recognize(imgData);
      await worker.terminate();

      const text = ocr.data.text;

      const valorEncontrado = text.match(/(\d{1,3}(?:\.\d{3})*,\d{2})/);

      if (valorEncontrado) {
        valorEl.value = valorEncontrado[0];
        resultadoEl.innerHTML = `<p style="color:#8ae6c1">Valor detectado: ${valorEncontrado[0]}</p>`;
      } else {
        resultadoEl.innerHTML = `<p style="color:#f6c85f">Não consegui identificar um valor na imagem.</p>`;
      }

    } catch (error) {
      resultadoEl.innerHTML = `<p style="color:#ff6b6b">Erro ao processar imagem.</p>`;
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = "📸";
  });

  /* ============================================================
     BOTÃO CALCULAR
     ============================================================ */
  document.getElementById("calcular").addEventListener("click", () => {
    const valorProduto = parseBRL(valorEl.value);

    const totalBRL = valorProduto;
    const totalUSD = totalBRL / cotacaoAtual;

    const icmsRate = icmsRates[estadoEl.value];

    const r = calcularImpostos(totalUSD, icmsRate);

    resultadoEl.innerHTML = `
      <p>Valor em Reais: <strong>R$ ${formatBRL(r.valorBRL)}</strong></p>
      <p>Imposto de Importação: <strong>R$ ${formatBRL(r.imposto)}</strong></p>
      <p>ICMS: <strong>R$ ${formatBRL(r.icms)}</strong></p>
      <p style="margin-top:10px;font-size:18px"><strong>Total: R$ ${formatBRL(r.total)}</strong></p>
    `;
  });

});
