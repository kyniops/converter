(function (global) {
  const PERIODS = {
    '1D': {
      label: '24 dernières heures',
      yahoo: { interval: '5m', range: '1d' },
      days: 2,
      samples: 288,
    },
    '1W': {
      label: '1 semaine',
      yahoo: { interval: '1h', range: '5d' },
      days: 7,
      samples: 120,
    },
    '1M': {
      label: '1 mois',
      yahoo: { interval: '1d', range: '1mo' },
      days: 30,
      samples: 40,
    },
    '6M': {
      label: '6 mois',
      yahoo: { interval: '1d', range: '6mo' },
      days: 182,
      samples: 130,
    },
    '1Y': {
      label: '1 an',
      yahoo: { interval: '1d', range: '1y' },
      days: 365,
      samples: 260,
    },
    '5Y': {
      label: 'Cinq dernières années',
      yahoo: { interval: '1wk', range: '5y' },
      days: 365 * 5,
      samples: 260,
    },
    MAX: {
      label: 'Maximum',
      yahoo: { interval: '1mo', range: 'max' },
      days: 365 * 20,
      samples: 240,
    },
  };

  const PAIR_KEY = 'markets_pair';
  const FRANKFURTER = 'https://api.frankfurter.dev/v1';

  let markets = {
    from: 'EUR',
    to: 'USD',
    period: '1D',
    points: [],
    live: null,
    scrubIndex: null,
    chartLayout: null,
  };

  let fetchId = 0;
  let scrubbing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function formatRate(value, code) {
    if (value == null || isNaN(value)) return '—';
    const noDec = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'XOF', 'XAF'];
    const digits = noDec.includes(code) ? 2 : value < 0.01 ? 6 : value < 1 ? 4 : 2;
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  function formatChange(value, code) {
    const abs = Math.abs(value);
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    return `${sign}${formatRate(abs, code)}`;
  }

  function formatPct(pct) {
    const sign = pct > 0 ? '+' : pct < 0 ? '−' : '';
    return `${sign}${Math.abs(pct).toFixed(2).replace('.', ',')} %`;
  }

  function formatDateLabel(point) {
    let d;
    if (point.ts) d = new Date(point.ts * 1000);
    else d = new Date(String(point.date).length <= 10 ? point.date + 'T12:00:00' : point.date);
    if (isNaN(d.getTime())) return '';

    if (markets.period === '1D' || markets.period === '1W') {
      return d.toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function dateOffset(days) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - days);
    return d.toISOString().slice(0, 10);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function savePair() {
    try {
      localStorage.setItem(PAIR_KEY, JSON.stringify({ from: markets.from, to: markets.to }));
    } catch (_) {}
  }

  function loadPair() {
    try {
      const raw = localStorage.getItem(PAIR_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (p.from && CURRENCIES[p.from]) markets.from = p.from;
      if (p.to && CURRENCIES[p.to]) markets.to = p.to;
    } catch (_) {}
  }

  function updatePairUI() {
    const from = getCurrency(markets.from);
    const to = getCurrency(markets.to);
    $('pairFromFlag').textContent = from.flag;
    $('pairToFlag').textContent = to.flag;
    $('pairLabel').textContent = `${markets.from} / ${markets.to}`;
    $('marketsQuote').textContent = markets.to;
    const nameEl = $('marketsCurrencyName');
    if (nameEl) nameEl.textContent = `${from.name} → ${to.name}`;
  }

  function isUpOverall(points) {
    if (!points.length) return true;
    return points[points.length - 1].value >= points[0].value;
  }

  function variance(points) {
    if (points.length < 2) return 0;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return max - min;
  }

  function drawChart(points, scrubIndex) {
    const canvas = $('chartCanvas');
    if (!canvas || !points.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width || 300, 280);
    const h = Math.max(rect.height || 220, 200);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 36, right: 12, bottom: 28, left: 8 };
    const values = points.map((p) => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    // Garde une échelle lisible même si le spread est faible
    const mid = (min + max) / 2 || 1;
    let spread = max - min;
    if (spread < Math.abs(mid) * 0.0008) {
      spread = Math.abs(mid) * 0.0008 || 0.0001;
      min = mid - spread / 2;
      max = mid + spread / 2;
    }
    const padRange = (max - min) * 0.12 || Math.abs(mid) * 0.01 || 0.01;
    min -= padRange;
    max += padRange;
    const range = max - min;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const up = isUpOverall(points);
    const color = up ? '#00c805' : '#ff5000';
    const gray = '#555';
    const activeIndex =
      scrubIndex == null ? points.length - 1 : Math.max(0, Math.min(points.length - 1, scrubIndex));

    markets.chartLayout = { pad, plotW, plotH, w, h, points };

    function xy(i, val) {
      return {
        x: pad.left + (i / Math.max(points.length - 1, 1)) * plotW,
        y: pad.top + plotH - ((val - min) / range) * plotH,
      };
    }

    const open = values[0];
    const baseY = pad.top + plotH - ((open - min) / range) * plotH;
    ctx.beginPath();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.moveTo(pad.left, baseY);
    ctx.lineTo(w - pad.right, baseY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    for (let i = 0; i <= activeIndex; i++) {
      const { x, y } = xy(i, points[i].value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const activeEnd = xy(activeIndex, points[activeIndex].value);
    ctx.lineTo(activeEnd.x, h - pad.bottom);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad.top, 0, h);
    grad.addColorStop(0, up ? 'rgba(0,200,5,0.22)' : 'rgba(255,80,0,0.22)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fill();

    if (activeIndex < points.length - 1) {
      ctx.beginPath();
      for (let i = activeIndex; i < points.length; i++) {
        const { x, y } = xy(i, points[i].value);
        if (i === activeIndex) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = gray;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    ctx.beginPath();
    for (let i = 0; i <= activeIndex; i++) {
      const { x, y } = xy(i, points[i].value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    if (scrubIndex != null) {
      const pt = xy(activeIndex, points[activeIndex].value);
      ctx.beginPath();
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.moveTo(pt.x, pad.top - 8);
      ctx.lineTo(pt.x, h - pad.bottom + 4);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = up ? 'rgba(0,200,5,0.25)' : 'rgba(255,80,0,0.25)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      const dateEl = $('scrubDate');
      if (dateEl) {
        dateEl.hidden = false;
        dateEl.textContent = formatDateLabel(points[activeIndex]);
        const labelW = dateEl.offsetWidth || 90;
        let left = Math.max(labelW / 2 + 4, Math.min(w - labelW / 2 - 4, pt.x));
        dateEl.style.left = `${left}px`;
        dateEl.style.transform = 'translateX(-50%)';
      }
    } else {
      const end = xy(points.length - 1, values[values.length - 1]);
      ctx.beginPath();
      ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      const dateEl = $('scrubDate');
      if (dateEl) dateEl.hidden = true;
    }
  }

  function updateHeaderForIndex(index) {
    const points = markets.points;
    if (!points.length) return;
    const open = points[0].value;
    const current = points[index].value;
    const high = Math.max(...points.map((p) => p.value));
    const low = Math.min(...points.map((p) => p.value));
    const diff = current - open;
    const pct = open !== 0 ? (diff / open) * 100 : 0;
    const meta = PERIODS[markets.period];
    const quote = markets.to;

    $('marketsPrice').textContent = formatRate(current, quote);
    $('changeAbs').textContent = `${formatChange(diff, quote)} ${quote}`;
    $('changePct').textContent = formatPct(pct);
    $('changePct').classList.add('pill');
    $('changePeriod').textContent = scrubbing
      ? `· ${formatDateLabel(points[index])}`
      : `· ${meta.label}`;
    $('marketsChange').className =
      'markets-change ' + (diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');

    if ($('statHigh')) $('statHigh').textContent = formatRate(high, quote);
    if ($('statLow')) $('statLow').textContent = formatRate(low, quote);
    if ($('statOpen')) $('statOpen').textContent = formatRate(open, quote);
    if ($('chartHigh')) $('chartHigh').textContent = `H ${formatRate(high, quote)}`;
    if ($('chartLow')) $('chartLow').textContent = `B ${formatRate(low, quote)}`;
  }

  function renderPoints(points) {
    markets.points = points;
    markets.scrubIndex = null;
    scrubbing = false;
    updateHeaderForIndex(points.length - 1);
    requestAnimationFrame(() => drawChart(points, null));
  }

  function indexFromX(x) {
    const layout = markets.chartLayout;
    if (!layout || !markets.points.length) return 0;
    const t = Math.max(0, Math.min(1, (x - layout.pad.left) / layout.plotW));
    return Math.round(t * (markets.points.length - 1));
  }

  function scrubTo(clientX) {
    const canvas = $('chartCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const idx = indexFromX(clientX - rect.left);
    markets.scrubIndex = idx;
    scrubbing = true;
    updateHeaderForIndex(idx);
    drawChart(markets.points, idx);
  }

  function endScrub() {
    if (!scrubbing) return;
    scrubbing = false;
    markets.scrubIndex = null;
    if (markets.points.length) {
      updateHeaderForIndex(markets.points.length - 1);
      drawChart(markets.points, null);
    }
  }

  function bindScrub() {
    const wrap = $('chartWrap');
    if (!wrap) return;

    wrap.addEventListener(
      'pointerdown',
      (e) => {
        wrap.setPointerCapture(e.pointerId);
        scrubTo(e.clientX);
      },
      { passive: true }
    );
    wrap.addEventListener(
      'pointermove',
      (e) => {
        if (!scrubbing) return;
        scrubTo(e.clientX);
      },
      { passive: true }
    );
    wrap.addEventListener('pointerup', endScrub);
    wrap.addEventListener('pointercancel', endScrub);
    wrap.addEventListener('pointerleave', endScrub);
  }

  function downsample(points, maxPoints) {
    if (points.length <= maxPoints) return points;
    const step = Math.ceil(points.length / maxPoints);
    const out = [];
    for (let i = 0; i < points.length; i += step) out.push(points[i]);
    if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1]);
    return out;
  }

  async function apiJson(url) {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 Convertisseur/2.7',
      },
    });
    if (!res.ok) throw new Error('http ' + res.status);
    const text = await res.text();
    if (!text || text.trimStart().startsWith('<')) throw new Error('not json');
    const data = JSON.parse(text);
    return data;
  }

  async function fetchYahooPair(from, to, periodKey) {
    const meta = PERIODS[periodKey];
    const { interval, range } = meta.yahoo;
    const attempts = [
      { symbol: `${from}${to}=X`, invert: false },
      { symbol: `${to}${from}=X`, invert: true },
    ];
    const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

    let lastErr;
    for (const host of hosts) {
      for (const attempt of attempts) {
        try {
          const url =
            `https://${host}/v8/finance/chart/${encodeURIComponent(attempt.symbol)}` +
            `?interval=${interval}&range=${range}&includePrePost=false`;
          const data = await apiJson(url);
          const result = data.chart && data.chart.result && data.chart.result[0];
          if (!result || !result.timestamp) throw new Error('empty');

          const quote = (result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
          const adj =
            (result.indicators && result.indicators.adjclose && result.indicators.adjclose[0] && result.indicators.adjclose[0].adjclose) ||
            [];
          const closes = quote.close || adj || [];

          let points = result.timestamp
            .map((ts, i) => {
              let value = closes[i];
              if (value == null || isNaN(value)) return null;
              if (attempt.invert) value = 1 / value;
              return { ts, date: new Date(ts * 1000).toISOString(), value };
            })
            .filter(Boolean);

          if (periodKey === '1D' && points.length) {
            const lastTs = points[points.length - 1].ts;
            points = points.filter((p) => p.ts >= lastTs - 24 * 3600);
          }

          if (points.length < 2) throw new Error('too few');
          if (variance(points) === 0 && periodKey !== '1D') throw new Error('flat series');
          return downsample(points, meta.samples);
        } catch (e) {
          lastErr = e;
        }
      }
    }
    throw lastErr || new Error('yahoo fail');
  }

  async function fetchFrankfurterPair(from, to, days) {
    if (from === to) {
      return [
        { date: dateOffset(days), ts: Math.floor(Date.now() / 1000) - days * 86400, value: 1 },
        { date: todayISO(), ts: Math.floor(Date.now() / 1000), value: 1 },
      ];
    }
    const start = dateOffset(Math.min(days, 365 * 25));
    const end = todayISO();
    const url = `${FRANKFURTER}/${start}..${end}?from=${from}&to=${to}`;
    const data = await apiJson(url);
    const dates = Object.keys(data.rates || {}).sort();
    const points = dates
      .map((d) => ({
        date: d,
        ts: Math.floor(new Date(d + 'T12:00:00Z').getTime() / 1000),
        value: data.rates[d][to],
      }))
      .filter((p) => p.value != null && !isNaN(p.value));
    if (points.length < 2) throw new Error('frank empty');
    return points;
  }

  async function fetchFawazDay(fromLower, date) {
    const bases = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${fromLower}.min.json`,
      `https://${date}.currency-api.pages.dev/v1/currencies/${fromLower}.min.json`,
    ];
    let lastErr;
    for (const url of bases) {
      try {
        const data = await apiJson(url);
        const bag = data[fromLower];
        if (!bag) throw new Error('no bag');
        return bag;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('fawaz day');
  }

  async function fetchFawazPair(from, to, days, samples) {
    if (from === to) {
      return [
        { date: dateOffset(days), ts: Math.floor(Date.now() / 1000) - days * 86400, value: 1 },
        { date: todayISO(), ts: Math.floor(Date.now() / 1000), value: 1 },
      ];
    }
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    const n = Math.max(8, Math.min(samples, 60));
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      const offset = Math.round((days * i) / Math.max(n - 1, 1));
      dates.push(dateOffset(offset));
    }
    const uniqueDates = [...new Set(dates)];
    const points = [];

    for (let i = 0; i < uniqueDates.length; i++) {
      const d = uniqueDates[i];
      try {
        const bag = await fetchFawazDay(fromLower, d);
        const value = bag[toLower];
        if (value == null || isNaN(value)) continue;
        points.push({
          date: d,
          ts: Math.floor(new Date(d + 'T12:00:00Z').getTime() / 1000),
          value: Number(value),
        });
      } catch (_) {
        // ignore missing days
      }
      if (i % 4 === 3) await new Promise((r) => setTimeout(r, 30));
    }

    points.sort((a, b) => a.ts - b.ts);
    if (points.length < 2) throw new Error('fawaz empty');
    return points;
  }

  async function fetchLiveRate(from, to) {
    if (from === to) return 1;

    try {
      const pts = await fetchYahooPair(from, to, '1D');
      if (pts.length) return pts[pts.length - 1].value;
    } catch (_) {}

    try {
      const data = await apiJson(`https://open.er-api.com/v6/latest/${from}`);
      if (data.rates && data.rates[to] != null) return data.rates[to];
    } catch (_) {}

    try {
      const data = await apiJson(`${FRANKFURTER}/latest?from=${from}&to=${to}`);
      if (data.rates && data.rates[to] != null) return data.rates[to];
    } catch (_) {}

    try {
      const bag = await fetchFawazDay(from.toLowerCase(), 'latest');
      if (bag[to.toLowerCase()] != null) return Number(bag[to.toLowerCase()]);
    } catch (_) {}

    return null;
  }

  async function loadHistory(from, to, period) {
    const meta = PERIODS[period];
    const errors = [];

    // Intraday: Yahoo d'abord. Sinon historiques journaliers.
    if (period === '1D') {
      try {
        return await fetchYahooPair(from, to, period);
      } catch (e) {
        errors.push(e);
      }
    }

    try {
      return downsample(await fetchFrankfurterPair(from, to, meta.days), meta.samples);
    } catch (e) {
      errors.push(e);
    }

    if (period !== '1D') {
      try {
        return await fetchYahooPair(from, to, period);
      } catch (e) {
        errors.push(e);
      }
    }

    try {
      return downsample(await fetchFawazPair(from, to, meta.days, meta.samples), meta.samples);
    } catch (e) {
      errors.push(e);
    }

    throw errors[0] || new Error('history fail');
  }

  async function fetchSeries() {
    const id = ++fetchId;
    const { from, to, period } = markets;
    const meta = PERIODS[period];

    endScrub();
    updatePairUI();
    $('marketsPrice').textContent = '…';
    $('changePeriod').textContent = `· ${meta.label}`;

    let points = [];
    let live = null;

    live = await fetchLiveRate(from, to);
    if (id !== fetchId) return;
    markets.live = live;
    if (live != null) $('marketsPrice').textContent = formatRate(live, to);

    try {
      points = await loadHistory(from, to, period);
    } catch (_) {
      points = [];
    }

    if (id !== fetchId) return;

    // Fusionne le prix live sans écraser toute la série
    if (live != null && points.length) {
      const nowTs = Math.floor(Date.now() / 1000);
      const last = points[points.length - 1];
      if (Math.abs(last.value - live) / Math.max(Math.abs(live), 1e-12) > 1e-5) {
        points = points.concat([{ ts: nowTs, date: new Date().toISOString(), value: live }]);
      } else {
        last.value = live;
        last.ts = nowTs;
      }
    }

    // Refuse une fausse droite plate de 2 points identiques
    if ((!points.length || (points.length < 3 && variance(points) === 0)) && live != null) {
      try {
        const daily = downsample(await fetchFrankfurterPair(from, to, Math.max(meta.days, 30)), meta.samples);
        if (daily.length >= 2 && variance(daily) > 0) points = daily;
      } catch (_) {}
    }

    if (!points.length) {
      $('marketsPrice').textContent = '—';
      if (global.ConverterApp && global.ConverterApp.showToast) {
        global.ConverterApp.showToast('Impossible de charger le cours');
      }
      return;
    }

    renderPoints(points);
  }

  function setPeriod(period) {
    markets.period = period;
    document.querySelectorAll('.period-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });
    fetchSeries();
    if (global.ConverterApp && global.ConverterApp.haptic) global.ConverterApp.haptic();
  }

  function setPair(from, to) {
    if (CURRENCIES[from]) markets.from = from;
    if (CURRENCIES[to]) markets.to = to;
    savePair();
    updatePairUI();
    fetchSeries();
  }

  function syncFromConverter(from, to) {
    if (from && CURRENCIES[from]) markets.from = from;
    if (to && CURRENCIES[to]) markets.to = to;
    savePair();
    updatePairUI();
    fetchSeries();
  }

  function initMarkets() {
    loadPair();
    markets.period = '1D';
    document.querySelectorAll('.period-pill').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.period === '1D');
    });
    updatePairUI();
    bindScrub();

    document.querySelectorAll('.period-pill').forEach((btn) => {
      btn.addEventListener('click', () => setPeriod(btn.dataset.period));
    });

    $('marketsRefresh').addEventListener('click', () => {
      fetchSeries();
      if (global.ConverterApp && global.ConverterApp.haptic) global.ConverterApp.haptic();
      if (global.ConverterApp && global.ConverterApp.showToast) {
        global.ConverterApp.showToast('Cours actualisé');
      }
    });

    $('pairBtn').addEventListener('click', () => {
      if (global.ConverterApp && global.ConverterApp.openPairModal) {
        global.ConverterApp.openPairModal();
      }
    });

    window.addEventListener('resize', () => {
      if (markets.points.length) drawChart(markets.points, markets.scrubIndex);
    });

    setInterval(() => {
      if (document.visibilityState === 'visible' && !$('screenMarkets').hidden && !scrubbing) {
        fetchSeries();
      }
    }, 60000);
  }

  global.Markets = {
    init: initMarkets,
    show: () => {
      updatePairUI();
      fetchSeries();
    },
    syncFromConverter,
    setPair,
    getPair: () => ({ from: markets.from, to: markets.to }),
  };
})(window);
