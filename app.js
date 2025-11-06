// app.js - versão com máscara BRL, upload foto (OCR) e cálculo

const icmsRates = {
  "Acre": 0.17, "Alagoas": 0.18, "Amapa": 0.18, "Amazonas": 0.18, "Bahia": 0.18, "Ceara": 0.18,
  "Distrito Federal": 0.18, "Espirito Santo": 0.17, "Goias": 0.17, "Maranhao": 0.18, "Mato Grosso": 0.17, "Mato Grosso do Sul": 0.17,
  "Minas Gerais": 0.18, "Para": 0.18, "Paraiba": 0.18, "Parana": 0.18, "Pernambuco": 0.18, "Piaui": 0.18,
  "Rio de Janeiro": 0.20, "Rio Grande do Norte": 0.18, "Rio Grande do Sul": 0.18, "Rondonia": 0.17, "Roraima": 0.18, "Santa Catarina": 0.17,
  "Sao Paulo": 0.18, "Sergipe": 0.18, "Tocantins": 0.18
};

async function fetchDollar(){
  try{
    const resp = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const data = await resp.json();
    const rate = parseFloat(data['USDBRL'].bid);
    return rate;
  }catch(e){
    console.warn('Não foi possível obter cotação automática', e);
    return null;
  }
}

function formatBRLvalueFromNumber(num){
  if (isNaN(num)) return '';
  // formata para 1.234,56
  return num.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function parseBRLString(str){
  // aceita '1.234,56' ou '1234.56' ou '1234,56' ou '1234'
  if(!str) return 0;
  // remover espaços
  str = String(str).trim();
  // remover pontos de milhar
  const tmp = str.replace(/\./g,'').replace(/\s/g,'').replace(/R\$/g,'');
  // trocar vírgula por ponto
  const normalized = tmp.replace(/,/g,'.');
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
}

// máscara de input BRL (formatação ao digitar)
function setupBRLInputMask(inputEl){
  function formatToBRL(valueStr){
    // tira tudo que não é dígito
    const digits = valueStr.replace(/\D/g,'');
    if(digits.length === 0) return '';
    // garante ao menos 3 dígitos para manipular centavos
    const cents = digits.slice(-2);
    const intPart = digits.slice(0, -2) || '0';
    // formata intPart com pontos
    const intFormatted = parseInt(intPart,10).toLocaleString('pt-BR');
    return `${intFormatted},${cents.padStart(2,'0')}`;
  }

  inputEl.addEventListener('input', (e)=>{
    const cursorPos = inputEl.selectionStart;
    const raw = inputEl.value;
    const formatted = formatToBRL(raw);
    inputEl.value = formatted;
    // tenta preservar posição do cursor (simples)
    inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);
  });

  // quando perder foco, se vazio, limpa; senão garante 2 casas
  inputEl.addEventListener('blur', ()=>{
    if(!inputEl.value) return;
    const n = parseBRLString(inputEl.value);
    inputEl.value = formatBRLvalueFromNumber(n);
  });
}

function showModal(text){
  const modal = document.getElementById('modal');
  const modalText = document.getElementById('modalText');
  if(!modal || !modalText) return;
  modalText.textContent = text;
  modal.setAttribute('aria-hidden','false');
}

function hideModal(){
  const modal = document.getElementById('modal');
  if(!modal) return;
  modal.setAttribute('aria-hidden','true');
}

function calculateFromUSD(totalUsd, cotacao, icmsRate){
  const usdThreshold = 50.00;
  let aliquota;
  let impostoImportacaoBRL = 0;
  const valorBRL = totalUsd * cotacao;

  if(totalUsd <= usdThreshold){
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

  return {valorBRL, aliquota, impostoImportacaoBRL, icms, total};
}

document.addEventListener('DOMContentLoaded', async ()=> {
  const brlEl = document.getElementById('brl') || document.getElementById('valor'); // nome varia
  const freteBrlEl = document.getElementById('frete_brl');
  const cotacaoEl = document.getElementById('cotacao');
  const estadoEl = document.getElementById('estado');
  const calcBtn = document.getElementById('calcular');
  const resetBtn = document.getElementById('reset');
  const refreshBtn = document.getElementById('refreshRate');
  const uploadBtn = document.getElementById('uploadFoto');
  const fotoInput = document.getElementById('fotoInput');
  const productCards = document.getElementById('productCards') || document.getElementById('promocoes') || null;
  const resultadoDiv = document.getElementById('resultado');

  // make sure upload button shows camera emoji
  if(uploadBtn) uploadBtn.innerHTML = '📸 Ler valor do print';

  // populate estados
  function populateStates(){
    estadoEl.innerHTML = '';
    Object.keys(icmsRates).forEach(uf=>{
      const opt = document.createElement('option');
      opt.value = uf;
      opt.dataset.icms = icmsRates[uf];
      opt.textContent = uf;
      if(uf==='Sao Paulo') opt.selected = true;
      estadoEl.appendChild(opt);
    });
  }

  // mask on brl input
  if(brlEl) setupBRLInputMask(brlEl);

  // fetch initial rate
  async function updateRateToInput(){
    const rate = await fetchDollar();
    if(rate){
      if(cotacaoEl) cotacaoEl.value = rate.toFixed(4);
    } else {
      if(cotacaoEl) cotacaoEl.value = 5.65;
    }
  }

  populateStates();
  await updateRateToInput();

  if(refreshBtn) refreshBtn.addEventListener('click', async ()=>{
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Atualizando...';
    await updateRateToInput();
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Atualizar dólar';
  });

  // upload button opens file dialog
  if(uploadBtn && fotoInput){
    uploadBtn.addEventListener('click', ()=> fotoInput.click());
  }

  // OCR on file chosen
  if(fotoInput){
    fotoInput.addEventListener('change', async (e)=>{
      const file = e.target.files && e.target.files[0];
      if(!file) return;
      // show loading feedback
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Lendo imagem...';
      try{
        // Tesseract is available from CDN we asked to include
        const { createWorker } = Tesseract;
        const worker = createWorker({
          logger: m => { /* console.log(m) */ }
        });
        await worker.load();
        await worker.loadLanguage('por');
        await worker.initialize('por');
        // convert file to data URL
        const imgData = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload = ()=> res(reader.result);
          reader.onerror = rej;
          reader.readAsDataURL(file);
        });
        const { data: { text } } = await worker.recognize(imgData);
        await worker.terminate();
        // try to extract currency value like R$ 199,90 or 199.90 or $19.99
        const lines = (text || '').split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
        let found = null;
        // regex to find R$ or numbers
        const currencyRegex = /R\\$\\s?([\\d\\.\\,]+)/i;
        const genericRegex = /([\\d]{1,3}(?:[\\.\\s]\\d{3})*(?:[\\,\\.]\\d{2})|\\d+[\\,\\.]\\d{2})/g;
        for(const line of lines){
          let m = currencyRegex.exec(line);
          if(m && m[1]){ found = m[1]; break; }
          // try generic regex
          let gm;
          while((gm = genericRegex.exec(line)) !== null){
            // pick the largest value found (heuristic)
            const candidate = gm[1];
            // ignore things like 2021, 10/05 etc: prefer numbers with decimal separators
            if(/[\\,\\.]/.test(candidate)) { found = candidate; break; }
          }
          if(found) break;
        }
        if(!found && lines.length){
          // fallback: search all digits in the whole text
          const allText = lines.join(' ');
          const gm = genericRegex.exec(allText);
          if(gm) found = gm[1];
        }
        if(found){
          // normalize: turn '1.234,56' or '1234.56' to number then format as BRL string
          const tmp = found.replace(/\\./g,'').replace(/\\s/g,'').replace(/,/g,'.');
          const n = parseFloat(tmp);
          if(!isNaN(n)){
            brlEl.value = formatBRLvalueFromNumber(n);
            // show short message to user in resultadoDiv
            if(resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#8ae6c1">Valor lido: R$ ${formatBRLvalueFromNumber(n)} — edite se necessário e clique em Calcular.</p>`;
          } else {
            if(resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#f6c85f">Não foi possível reconhecer um valor claro na imagem. Edite manualmente.</p>`;
          }
        }else{
          if(resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#f6c85f">Não foi possível identificar valor na imagem. Edite manualmente.</p>`;
        }
      }catch(err){
        console.error(err);
        if(resultadoDiv) resultadoDiv.innerHTML = `<p style="color:#f87171">Erro durante leitura da imagem.</p>`;
      }finally{
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '📸 Ler valor do print';
      }
    });
  }

  if(calcBtn){
    calcBtn.addEventListener('click', async ()=>{
      // get values
      const cotacao = parseFloat(cotacaoEl ? cotacaoEl.value : 0) || 0;
      const brlValue = parseBRLString(brlEl ? brlEl.value : '0') || 0;
      const freteBrl = parseBRLString(freteBrlEl ? freteBrlEl.value : '0') || 0;
      const totalBrl = brlValue + freteBrl;
      if(cotacao <= 0){
        alert('Favor atualizar a cotação do dólar antes (ou informar manualmente).');
        return;
      }
      const totalUsd = totalBrl / cotacao;
      const icmsRate = parseFloat(estadoEl.selectedOptions[0].dataset.icms) || 0.18;
      if(totalUsd > 50){
        showModal('⚠️ O valor informado ultrapassa US$ 50. Será aplicada a alíquota de 60% (com desconto de US$ 20 na base de cálculo).');
      }
      const res = calculateFromUSD(totalUsd, cotacao, icmsRate);
      if(resultadoDiv){
        resultadoDiv.innerHTML = `
          <div>
            <div>Valor em Reais (produto + frete): <strong>${formatBRLvalueFromNumber(res.valorBRL)}</strong></div>
            <div>Valor em Dólar (US$): <strong>${totalUsd.toFixed(2)} US$</strong></div>
            <div>Alíquota aplicada: <strong>${(res.aliquota*100).toFixed(0)}%</strong></div>
            <div>Imposto de Importação: <strong>${formatBRLvalueFromNumber(res.impostoImportacaoBRL)}</strong></div>
            <div>ICMS estimado: <strong>${formatBRLvalueFromNumber(res.icms)}</strong></div>
            <div>Valor Total Estimado: <strong>${formatBRLvalueFromNumber(res.total)}</strong></div>
          </div>
        `;
      }
    });
  }

  // modal close
  const modalClose = document.getElementById('modalClose');
  const modalOk = document.getElementById('modalOk');
  if(modalClose) modalClose.addEventListener('click', hideModal);
  if(modalOk) modalOk.addEventListener('click', hideModal);

  if(resetBtn){
    resetBtn.addEventListener('click', ()=>{
      if(brlEl) brlEl.value = '';
      if(freteBrlEl) freteBrlEl.value = '0';
      if(resultadoDiv) resultadoDiv.innerHTML = '';
      updateRateToInput();
      hideModal();
    });
  }

});
