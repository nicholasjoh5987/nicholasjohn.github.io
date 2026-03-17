const BASE = 'USD';
const PAIRS = ['EUR','GBP','JPY','CAD','AUD','CHF','CNY','INR','MXN','SGD','HKD','KRW'];

const currencyNames = {
  EUR: 'Euro', GBP: 'British Pound', JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar', AUD: 'Australian Dollar', CHF: 'Swiss Franc',
  CNY: 'Chinese Yuan', INR: 'Indian Rupee', MXN: 'Mexican Peso',
  SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar', KRW: 'South Korean Won'
};

let rates      = {};
let prevRates  = {};
let activePair = null;
let activeDays = 7;
let fxChart    = null;

// ── NEWS TICKER ──
async function loadNewsTicker() {
  const RSS_URL = 'https://www.forexlive.com/feed/news';
  const API_URL = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(RSS_URL)}&count=20`;

  try {
    const res  = await fetch(API_URL);
    const data = await res.json();

    if (!data.items || data.items.length === 0) throw new Error('No items');

    const forex_keywords = ['currency','forex','dollar','euro','yen','pound','yuan','fed','ecb','rate','exchange','inflation','central bank','gdp','trade'];

    const items = data.items.filter(item =>
      forex_keywords.some(kw =>
        (item.title + ' ' + (item.description || '')).toLowerCase().includes(kw)
      )
    ).slice(0, 15);

    const display = items.length > 0 ? items : data.items.slice(0, 15);

    // Double the items so the ticker loops seamlessly
    const allItems = [...display, ...display];

    const content = document.getElementById('tickerContent');
    content.innerHTML = allItems.map(item => `
      <a href="${item.link}" target="_blank" rel="noopener" class="ticker-item">
        <span class="ticker-source">Reuters</span>
        ${item.title}
      </a>
    `).join('');

    // Adjust animation speed based on content length
    const totalItems = allItems.length;
    const duration   = totalItems * 4;
    content.style.animationDuration = `${duration}s`;

  } catch(e) {
    // Fallback to static headlines if RSS fails
    const fallback = [
      'Fed signals potential rate pause amid mixed economic data',
      'Euro strengthens as ECB maintains hawkish stance on inflation',
      'Japanese Yen under pressure as BOJ holds ultra-loose policy',
      'Dollar index retreats from multi-week highs on jobs data',
      'Emerging market currencies face headwinds from strong USD',
      'GBP rallies after better-than-expected UK inflation figures',
      'CNY stabilizes as PBOC sets firmer daily fixing rate',
      'Gold rises as real yields decline across G10 currencies',
    ];
    const allFallback = [...fallback, ...fallback];
    const content = document.getElementById('tickerContent');
    content.innerHTML = allFallback.map(title => `
      <span class="ticker-item">
        <span class="ticker-source">FX News</span>
        ${title}
      </span>
    `).join('');
  }
}

// ── POPULATE SELECTS ──
const allCurrencies = [BASE, ...PAIRS];
['fromCurrency','toCurrency'].forEach((id, i) => {
  const sel = document.getElementById(id);
  allCurrencies.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (i === 0 && c === 'USD') opt.selected = true;
    if (i === 1 && c === 'EUR') opt.selected = true;
    sel.appendChild(opt);
  });
});

// ── FETCH LIVE RATES ──
async function fetchRates() {
  try {
    const res  = await fetch(`https://api.frankfurter.app/latest?from=${BASE}&to=${PAIRS.join(',')}`);
    const data = await res.json();
    prevRates  = { ...rates };
    rates      = data.rates;
    renderRateCards();
    updateConverter();
    const now = new Date();
    document.getElementById('lastUpdated').textContent =
      'Updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch(e) {
    document.getElementById('lastUpdated').textContent = 'Error fetching data';
  }
}

// ── RATE CARDS ──
function renderRateCards() {
  const grid = document.getElementById('rateGrid');
  grid.innerHTML = '';
  PAIRS.forEach((pair, i) => {
    const rate = rates[pair];
    const prev = prevRates[pair];
    let changeClass = 'flat', changeIcon = '—', changeTxt = 'Unchanged';
    if (prev) {
      const diff = ((rate - prev) / prev * 100);
      if (diff > 0.001)       { changeClass = 'up';   changeIcon = '▲'; changeTxt = '+' + diff.toFixed(4) + '%'; }
      else if (diff < -0.001) { changeClass = 'down'; changeIcon = '▼'; changeTxt = diff.toFixed(4) + '%'; }
    }

    const card = document.createElement('div');
    card.className = 'rate-card' + (activePair === pair ? ' active' : '');
    card.style.animationDelay = (i * 0.04) + 's';
    card.innerHTML = `
      <div class="rate-pair">USD / ${pair} <span class="rate-name">${currencyNames[pair] || ''}</span></div>
      <div class="rate-value">${formatRate(rate, pair)}</div>
      <div class="rate-change ${changeClass}">
        <span>${changeIcon}</span><span>${changeTxt}</span>
      </div>`;
    card.addEventListener('click', () => selectPair(pair, card));
    grid.appendChild(card);
  });
}

function formatRate(rate, pair) {
  if (['JPY','KRW','INR'].includes(pair)) return rate.toFixed(2);
  return rate.toFixed(4);
}

// ── CONVERTER ──
function updateConverter() {
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  const from   = document.getElementById('fromCurrency').value;
  const to     = document.getElementById('toCurrency').value;

  let result;
  if (from === to) {
    result = amount;
  } else if (from === BASE) {
    result = amount * (rates[to] || 1);
  } else if (to === BASE) {
    result = amount / (rates[from] || 1);
  } else {
    result = (amount / (rates[from] || 1)) * (rates[to] || 1);
  }

  const rate = (from === to) ? 1 :
    (from === BASE) ? rates[to] :
    (to   === BASE) ? 1 / rates[from] :
    (1 / rates[from]) * rates[to];

  document.getElementById('resultValue').textContent =
    result.toLocaleString('en-US', { maximumFractionDigits: 4 }) + ' ' + to;
  document.getElementById('resultRate').textContent =
    `1 ${from} = ${rate ? rate.toFixed(6) : '—'} ${to}`;
}

['amount','fromCurrency','toCurrency'].forEach(id =>
  document.getElementById(id).addEventListener('input', () => {
    updateConverter();
    const to = document.getElementById('toCurrency').value;
    if (to !== BASE) {
      activePair = to;
      document.querySelectorAll('.rate-card').forEach(c => {
        c.classList.toggle('active', c.querySelector('.rate-pair')?.textContent.trim().startsWith(`USD / ${to}`));
      });
      loadChart();
    }
  }));

document.getElementById('swapBtn').addEventListener('click', () => {
  const f = document.getElementById('fromCurrency');
  const t = document.getElementById('toCurrency');
  [f.value, t.value] = [t.value, f.value];
  updateConverter();
});

// ── CHART ──
function selectPair(pair, cardEl) {
  activePair = pair;
  document.querySelectorAll('.rate-card').forEach(c => c.classList.remove('active'));
  cardEl.classList.add('active');
  loadChart();
}

async function loadChart() {
  if (!activePair) return;
  showChartLoading(true);

  const end   = new Date();
  const start = new Date();
  if (activeDays === 99999) {
    start.setFullYear(1999); start.setMonth(0); start.setDate(4);
  } else {
    start.setDate(end.getDate() - activeDays);
  }
  const fmt = d => d.toISOString().split('T')[0];

  try {
    const res  = await fetch(
      `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${BASE}&to=${activePair}`
    );
    const data = await res.json();
    const labels = Object.keys(data.rates).sort();
    const values = labels.map(d => data.rates[d][activePair]);

    const first = values[0];
    const last  = values[values.length - 1];
    const pct   = ((last - first) / first * 100);
    const sign  = pct >= 0 ? '+' : '';
    const color = pct >= 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('chartTitle').textContent = `USD / ${activePair} — ${periodLabel()}`;
    document.getElementById('chartSubtitle').innerHTML =
      `${labels[0]} → ${labels[labels.length-1]} · ${labels.length} data points &nbsp;
      <span style="color:${color}; font-weight:500;">${sign}${pct.toFixed(2)}%</span>`;

    drawChart(labels, values);
  } catch(e) {
    document.getElementById('chartLoading').innerHTML = '<span>Failed to load chart data</span>';
  } finally {
    showChartLoading(false);
  }
}

function periodLabel() {
  return {
    7: '1 Week',
    30: '1 Month',
    90: '3 Months',
    180: '6 Months',
    365: '1 Year',
    1095: '3 Years',
    1825: '5 Years',
    3650: '10 Years',
    9125: '25 Years',
    99999: 'Max (1999–Present)'
  }[activeDays];
}

function drawChart(labels, values) {
  const ctx = document.getElementById('fxChart').getContext('2d');
  if (fxChart) fxChart.destroy();

  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, 'rgba(201,168,76,0.25)');
  grad.addColorStop(1, 'rgba(201,168,76,0)');

  fxChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: '#c9a84c',
        borderWidth: 2,
        backgroundColor: grad,
        fill: true,
        tension: 0.3,
        pointRadius: labels.length > 60 ? 0 : 3,
        pointHoverRadius: 5,
        pointBackgroundColor: '#c9a84c',
        pointBorderColor: '#0a1628',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#112240',
          borderColor: 'rgba(201,168,76,0.4)',
          borderWidth: 1,
          titleColor: '#8a9bb5',
          bodyColor: '#f5f0e8',
          bodyFont: { family: 'Cormorant Garamond', size: 16, weight: '500' },
          titleFont: { family: 'DM Sans', size: 11 },
          padding: 12,
          callbacks: {
            label: ctx => `  ${ctx.parsed.y.toFixed(4)} ${activePair}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(201,168,76,0.05)', drawBorder: false },
          ticks: {
            color: '#8a9bb5', font: { family: 'DM Sans', size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          border: { color: 'rgba(201,168,76,0.1)' }
        },
        y: {
          position: 'right',
          grid: { color: 'rgba(201,168,76,0.07)', drawBorder: false },
          ticks: {
            color: '#8a9bb5', font: { family: 'DM Sans', size: 10 },
            maxTicksLimit: 6,
            callback: v => v.toFixed(4)
          },
          border: { color: 'rgba(201,168,76,0.1)' }
        }
      }
    }
  });
}

function showChartLoading(show) {
  const el = document.getElementById('chartLoading');
  if (show) {
    el.innerHTML = '<div class="spinner"></div><span>Loading chart…</span>';
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

// ── PERIOD BUTTONS ──
document.querySelectorAll('.period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeDays = parseInt(btn.dataset.days);
    if (activePair) loadChart();
    setTimeout(() => loadVolatility(), 100);
    setTimeout(() => loadCorrelation(), 200);
  });
});

// ── CORRELATION TABLE ──
async function loadCorrelation() {
  document.getElementById('corrLoading').style.display = 'flex';
  document.getElementById('corrWrap').style.display    = 'none';

  const end   = new Date();
  const start = new Date();
  if (activeDays === 99999) {
    start.setFullYear(1999); start.setMonth(0); start.setDate(4);
  } else {
    start.setDate(end.getDate() - activeDays);
  }
  const fmt = d => d.toISOString().split('T')[0];

  try {
    const res  = await fetch(
      `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${BASE}&to=${PAIRS.join(',')}`
    );
    const data = await res.json();
    const dates = Object.keys(data.rates).sort();

    const returns = {};
    PAIRS.forEach(p => { returns[p] = []; });
    for (let i = 1; i < dates.length; i++) {
      PAIRS.forEach(p => {
        const prev = data.rates[dates[i-1]][p];
        const curr = data.rates[dates[i]][p];
        returns[p].push((curr - prev) / prev);
      });
    }

    function pearson(a, b) {
      const n  = a.length;
      const ma = a.reduce((s,v) => s+v, 0) / n;
      const mb = b.reduce((s,v) => s+v, 0) / n;
      const num = a.reduce((s,v,i) => s + (v-ma)*(b[i]-mb), 0);
      const da  = Math.sqrt(a.reduce((s,v) => s+(v-ma)**2, 0));
      const db  = Math.sqrt(b.reduce((s,v) => s+(v-mb)**2, 0));
      return (da && db) ? num/(da*db) : 0;
    }

    function corrColor(r) {
      if (r >= 0.99) return 'rgba(201,168,76,0.5)';
      if (r > 0) return `rgba(76,175,130,${0.15 + r * 0.7})`;
      return `rgba(224,92,92,${0.15 + Math.abs(r) * 0.7})`;
    }

    const table = document.getElementById('corrTable');
    table.innerHTML = '';

    const thead = document.createElement('tr');
    const emptyTh = document.createElement('th');
    emptyTh.className = 'row-label';
    thead.appendChild(emptyTh);
    PAIRS.forEach(p => {
      const th = document.createElement('th');
      th.textContent = p;
      thead.appendChild(th);
    });
    table.appendChild(thead);

    PAIRS.forEach(rowPair => {
      const tr = document.createElement('tr');
      const labelTd = document.createElement('td');
      labelTd.className = 'row-label';
      labelTd.textContent = rowPair;
      tr.appendChild(labelTd);

      PAIRS.forEach(colPair => {
        const td = document.createElement('td');
        const r  = rowPair === colPair ? 1 : pearson(returns[rowPair], returns[colPair]);
        td.textContent = r.toFixed(2);
        td.style.background = corrColor(r);
        td.title = `${rowPair} / ${colPair}: ${r.toFixed(4)}`;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });

    document.getElementById('corrPeriod').textContent = periodLabel();
    document.getElementById('corrLoading').style.display = 'none';
    document.getElementById('corrWrap').style.display    = 'block';

  } catch(e) {
    document.getElementById('corrLoading').innerHTML = '<span>Failed to load correlation data</span>';
  }
}

// ── VOLATILITY ──
async function loadVolatility() {
  document.getElementById('volLoading').style.display = 'flex';
  document.getElementById('volGrid').style.display    = 'none';

  const end   = new Date();
  const start = new Date();
  if (activeDays === 99999) {
    start.setFullYear(1999); start.setMonth(0); start.setDate(4);
  } else {
    start.setDate(end.getDate() - activeDays);
  }
  const fmt = d => d.toISOString().split('T')[0];

  try {
    const res  = await fetch(
      `https://api.frankfurter.app/${fmt(start)}..${fmt(end)}?from=${BASE}&to=${PAIRS.join(',')}`
    );
    const data = await res.json();
    const dates = Object.keys(data.rates).sort();

    // Calculate annualized volatility for each pair
    const results = PAIRS.map(pair => {
      const returns = [];
      for (let i = 1; i < dates.length; i++) {
        const prev = data.rates[dates[i-1]][pair];
        const curr = data.rates[dates[i]][pair];
        returns.push((curr - prev) / prev);
      }
      const mean  = returns.reduce((s,v) => s+v, 0) / returns.length;
      const variance = returns.reduce((s,v) => s+(v-mean)**2, 0) / returns.length;
      const dailyVol = Math.sqrt(variance);
      const annualVol = dailyVol * Math.sqrt(252) * 100;
      return { pair, vol: annualVol };
    });

    // Find max for scaling bars
    const maxVol = Math.max(...results.map(r => r.vol));

    const grid = document.getElementById('volGrid');
    grid.innerHTML = '';

    results.forEach(({ pair, vol }) => {
      const pct     = (vol / maxVol) * 100;
      const label   = vol < 6 ? 'Low' : vol < 12 ? 'Medium' : 'High';
      const cls     = vol < 6 ? 'low' : vol < 12 ? 'medium' : 'high';
      const barColor = vol < 6
        ? 'var(--green)'
        : vol < 12
        ? 'var(--gold)'
        : 'var(--red)';

      const item = document.createElement('div');
      item.className = 'vol-item';
      item.innerHTML = `
        <div class="vol-item-header">
          <span class="vol-pair">USD / ${pair}</span>
          <span class="vol-pct">${vol.toFixed(2)}%</span>
        </div>
        <div class="vol-bar-track">
          <div class="vol-bar-fill" style="width:${pct}%; background:${barColor};"></div>
        </div>
        <span class="vol-label ${cls}">${label} Volatility</span>`;
      grid.appendChild(item);
    });

    document.getElementById('volPeriod').textContent = periodLabel();
    document.getElementById('volLoading').style.display = 'none';
    document.getElementById('volGrid').style.display    = 'grid';

  } catch(e) {
    document.getElementById('volLoading').innerHTML = '<span>Failed to load volatility data</span>';
  }
}

// ── INIT ──
loadNewsTicker();
fetchRates().then(() => {
  activePair = 'EUR';
  document.querySelectorAll('.rate-card').forEach(c => {
    c.classList.toggle('active', c.querySelector('.rate-pair')?.textContent.trim().startsWith('USD / EUR'));
  });
 loadChart();
  setTimeout(() => loadVolatility(), 300);
  setTimeout(() => loadCorrelation(), 600);
});
setInterval(fetchRates, 60000);
