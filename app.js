// Simula Taxas Brasil V4
// Main features: input in BRL, convert to USD, apply tax rules, ICMS by state, promotions (Shopee + Shein)

const icmsRates = {
  "Acre": 0.17, "Alagoas": 0.18, "Amapa": 0.18, "Amazonas": 0.18, "Bahia": 0.18, "Ceara": 0.18,
  "Distrito Federal": 0.18, "Espirito Santo": 0.17, "Goias": 0.17, "Maranhao": 0.18, "Mato Grosso": 0.17, "Mato Grosso do Sul": 0.17,
  "Minas Gerais": 0.18, "Para": 0.18, "Paraiba": 0.18, "Parana": 0.18, "Pernambuco": 0.18, "Piaui": 0.18,
  "Rio de Janeiro": 0.20, "Rio Grande do Norte": 0.18, "Rio Grande do Sul": 0.18, "Rondonia": 0.17, "Roraima": 0.18, "Santa Catarina": 0.17,
  "Sao Paulo": 0.18, "Sergipe": 0.18, "Tocantins": 0.18
};

const promotions = {
  "Shopee": [
    {"title":"Vestido Estilo","price_brl":129,"img":"https://via.placeholder.com/400x260?text=Vestido","url":"https://s.shopee.com.br/3qERZiYxrv"},
    {"title":"Fone Bluetooth","price_brl":79,"img":"https://via.placeholder.com/400x260?text=Fone","url":"https://s.shopee.com.br/5VMfYq4w8H"},
    {"title":"Relógio Inteligente","price_brl":188,"img":"https://via.placeholder.com/400x260?text=Relogio","url":"https://s.shopee.com.br/40XrmDP5DK"},
    {"title":"T\u00eanis Bege","price_brl":199,"img":"https://via.placeholder.com/400x260?text=Tenis","url":"https://s.shopee.com.br/1BDgP52yzt"}
  ],
  "Shein":[
    {"title":"Vestido Floral","price_brl":99,"img":"https://via.placeholder.com/400x260?text=Shein+Vestido","url":"https://www.shein.com"},
    {"title":"Blusa Casual","price_brl":59,"img":"https://via.placeholder.com/400x260?text=Shein+Blusa","url":"https://www.shein.com"}
  ]
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

function formatBRL(v){ return v.toLocaleString('pt-BR',{style:'currency', currency:'BRL'}); }

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
  const brlEl = document.getElementById('brl');
  const freteBrlEl = document.getElementById('frete_brl');
  const cotacaoEl = document.getElementById('cotacao');
  const estadoEl = document.getElementById('estado');
  const calcBtn = document.getElementById('calcular');
  const resetBtn = document.getElementById('reset');
  const refreshBtn = document.getElementById('refreshRate');
  const exportBtn = document.getElementById('exportPdf');
  const productCards = document.getElementById('productCards');

  const modal = document.getElementById('modal');
  const modalText = document.getElementById('modalText');
  const modalClose = document.getElementById('modalClose');
  const modalOk = document.getElementById('modalOk');

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

  function renderPromotions(store='Shopee'){
    productCards.innerHTML = '';
    const list = promotions[store] || [];
    list.forEach(p=>{
      const art = document.createElement('article');
      art.className = 'product';
      art.innerHTML = `
        <img src="${p.img}" alt="${p.title}">
        <h4>${p.title}</h4>
        <p class="muted">${store}</p>
        <div class="actionRow">
          <div class="price">R$ ${p.price_brl}</div>
          <div>
            <a class="btn" href="${p.url}" target="_blank" rel="noopener">Ver promoção</a>
          </div>
        </div>
      `;
      productCards.appendChild(art);
    });
  }

  async function updateRateToInput(){
    const rate = await fetchDollar();
    if(rate){
      cotacaoEl.value = rate.toFixed(4);
    } else {
      cotacaoEl.value = 5.65;
    }
  }

  // tabs
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click', (e)=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    renderPromotions(e.currentTarget.dataset.store);
  }));

  populateStates();
  renderPromotions();
  await updateRateToInput();

  refreshBtn.addEventListener('click', async ()=> {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Atualizando...';
    await updateRateToInput();
    refreshBtn.disabled = false;
    refreshBtn.textContent = 'Atualizar dólar';
  });

  function showModal(text){
    modalText.textContent = text;
    modal.setAttribute('aria-hidden', 'false');
  }
  function hideModal(){
    modal.setAttribute('aria-hidden', 'true');
  }
  modalClose.addEventListener('click', hideModal);
  modalOk.addEventListener('click', hideModal);

  calcBtn.addEventListener('click', ()=>{
    const cotacao = parseFloat(cotacaoEl.value) || 0;
    let brlValue = parseFloat(brlEl.value) || 0;
    const freteBrl = parseFloat(freteBrlEl.value) || 0;
    const totalBrl = brlValue + freteBrl;

    if(cotacao <= 0){
      alert('Favor atualizar a cotação do dólar antes (ou informar manualmente).');
      return;
    }

    const totalUsd = totalBrl / cotacao;
    const icmsRate = parseFloat(estadoEl.selectedOptions[0].dataset.icms) || 0.18;

    if(totalUsd > 50){
      showModal('⚠️ O valor informado ultrapassa US$ 50. Será aplicada a alíquota de 60% (com desconto de US$ 20 na base de cálculo), conforme regra vigente.');
    }

    const res = calculateFromUSD(totalUsd, cotacao, icmsRate);
    document.getElementById('valorBR').textContent = formatBRL(res.valorBRL);
    document.getElementById('valorUSD').textContent = totalUsd.toFixed(2) + ' US$';
    document.getElementById('aliquota').textContent = (res.aliquota*100).toFixed(0) + '%';
    document.getElementById('imposto').textContent = formatBRL(res.impostoImportacaoBRL);
    document.getElementById('icms').textContent = formatBRL(res.icms);
    document.getElementById('total').textContent = formatBRL(res.total);
  });

  resetBtn.addEventListener('click', ()=>{
    brlEl.value = '';
    freteBrlEl.value = '0';
    document.getElementById('valorBR').textContent = '-';
    document.getElementById('valorUSD').textContent = '-';
    document.getElementById('aliquota').textContent = '-';
    document.getElementById('imposto').textContent = '-';
    document.getElementById('icms').textContent = '-';
    document.getElementById('total').textContent = '-';
    updateRateToInput();
    hideModal();
  });

  exportBtn.addEventListener('click', ()=>{
    const element = document.getElementById('resultado');
    const opt = {
      margin:       0.3,
      filename:     'simulacao_taxas.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  });

});
