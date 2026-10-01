(function () {
  const $ = (id) => document.getElementById(id);
  const HISTORY_KEY = 'converter_history';
  const FAVORITES_KEY = 'converter_favorites';
  const MAX_HISTORY = 8;
  const cfg = window.APP_CONFIG || {};
  const APP_VERSION = cfg.version || '2.9';
  const APP_VERSION_CODE = cfg.versionCode || 0;

  const els = {
    amount: $('amount'),
    result: $('result'),
    fromCode: $('fromCode'),
    fromName: $('fromName'),
    fromFlag: $('fromFlag'),
    toCode: $('toCode'),
    toName: $('toName'),
    toFlag: $('toFlag'),
    rateStatus: $('rateStatus'),
    rateDetail: $('rateDetail'),
    swapBtn: $('swapBtn'),
    fromCurrency: $('fromCurrency'),
    toCurrency: $('toCurrency'),
    modal: $('currencyModal'),
    modalClose: $('modalClose'),
    modalTitle: $('modalTitle'),
    currencySearch: $('currencySearch'),
    searchClear: $('searchClear'),
    quickChips: $('quickChips'),
    listScroll: $('listScroll'),
    currencyList: $('currencyList'),
    resultCard: $('resultCard'),
    copyBtn: $('copyBtn'),
    copyLabel: $('copyLabel'),
    historyCard: $('historyCard'),
    historyList: $('historyList'),
    clearHistory: $('clearHistory'),
    toast: $('toast'),
  };

  let state = {
    from: 'USD',
    to: 'EUR',
    amount: '',
    rate: null,
    ratesDate: null,
    modalTarget: null,
    fetching: false,
    favorites: [],
    history: [],
  };

  const ratesCache = new Map();
  let saveTimer = null;
  let fetchTimer = null;
  let historyTimer = null;
  let toastTimer = null;

  function updateModalViewport() {
    const vv = window.visualViewport;
    if (!vv || els.modal.hidden) return;
    document.documentElement.style.setProperty('--modal-height', `${vv.height}px`);
    document.documentElement.style.setProperty('--modal-offset', `${vv.offsetTop}px`);
  }

  function bindViewport() {
    if (!window.visualViewport) return;
    window.visualViewport.addEventListener('resize', updateModalViewport);
    window.visualViewport.addEventListener('scroll', updateModalViewport);
  }

  function haptic() {
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (_) {}
  }

  function showToast(message) {
    els.toast.hidden = false;
    els.toast.textContent = message;
    requestAnimationFrame(() => els.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.classList.remove('show');
      setTimeout(() => {
        els.toast.hidden = true;
      }, 200);
    }, 1600);
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.from && CURRENCIES[prefs.from]) state.from = prefs.from;
        if (prefs.to && CURRENCIES[prefs.to]) state.to = prefs.to;
        if (prefs.amount != null) state.amount = String(prefs.amount);
        if (prefs.rate && prefs.from === state.from && prefs.to === state.to) {
          state.rate = prefs.rate;
          state.ratesDate = prefs.ratesDate;
        }
      }
    } catch (_) {}

    try {
      const favs = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      if (Array.isArray(favs)) state.favorites = favs.filter((c) => CURRENCIES[c]);
    } catch (_) {}

    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      if (Array.isArray(hist)) state.history = hist.slice(0, MAX_HISTORY);
    } catch (_) {}
  }

  function savePrefs() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          from: state.from,
          to: state.to,
          amount: state.amount,
          rate: state.rate,
          ratesDate: state.ratesDate,
        })
      );
    }, 150);
  }

  function saveFavorites() {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(state.favorites));
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
  }

  function updateCurrencyUI(target) {
    const code = state[target];
    const info = getCurrency(code);
    const prefix = target === 'from' ? 'from' : 'to';
    $(`${prefix}Code`).textContent = code;
    $(`${prefix}Name`).textContent = info.name;
    $(`${prefix}Flag`).textContent = info.flag;
  }

  function updateRateStatus(online) {
    const textEl = els.rateStatus.querySelector('.status-text');

    if (!state.ratesDate) {
      textEl.textContent = 'Chargement…';
      els.rateStatus.className = 'status-pill';
      return;
    }

    const date = new Date(state.ratesDate);
    const timeStr = date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

    if (online) {
      textEl.textContent = `Live · ${timeStr}`;
      els.rateStatus.className = 'status-pill live';
    } else {
      textEl.textContent = `Hors ligne · ${timeStr}`;
      els.rateStatus.className = 'status-pill offline';
    }
  }

  function convert() {
    const amount = parseAmount(state.amount);

    if (!state.rate) {
      els.result.textContent = amount > 0 ? '…' : '—';
      els.rateDetail.textContent = '';
      els.copyBtn.hidden = true;
      return;
    }

    const converted = amount * state.rate;
    els.result.textContent = amount > 0 ? formatAmount(converted, state.to) : '—';
    els.copyBtn.hidden = amount <= 0;

    const inv = state.rate !== 0 ? 1 / state.rate : 0;
    els.rateDetail.textContent =
      `1 ${state.from} = ${formatAmount(state.rate, state.to)} ${state.to}` +
      `  ·  1 ${state.to} = ${formatAmount(inv, state.from)} ${state.from}`;

    if (amount > 0) scheduleHistorySave(amount, converted);
  }

  function scheduleHistorySave(amount, converted) {
    clearTimeout(historyTimer);
    historyTimer = setTimeout(() => {
      pushHistory(amount, converted);
    }, 900);
  }

  function pushHistory(amount, converted) {
    const entry = {
      from: state.from,
      to: state.to,
      amount: String(amount),
      result: converted,
      rate: state.rate,
      at: Date.now(),
    };

    state.history = state.history.filter(
      (h) => !(h.from === entry.from && h.to === entry.to && h.amount === entry.amount)
    );
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    if (!state.history.length) {
      els.historyCard.hidden = true;
      els.historyList.innerHTML = '';
      return;
    }

    els.historyCard.hidden = false;
    els.historyList.innerHTML = '';

    state.history.forEach((h) => {
      const from = getCurrency(h.from);
      const to = getCurrency(h.to);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-item';
      btn.innerHTML = `
        <div>
          <div class="history-main">${formatAmount(parseAmount(h.amount), h.from)} ${h.from} → ${formatAmount(h.result, h.to)} ${h.to}</div>
          <div class="history-sub">1 ${h.from} = ${formatAmount(h.rate, h.to)} ${h.to}</div>
        </div>
        <span class="history-flags">${from.flag} ${to.flag}</span>
      `;
      btn.addEventListener('click', () => {
        state.from = h.from;
        state.to = h.to;
        state.amount = h.amount;
        els.amount.value = h.amount;
        updateCurrencyUI('from');
        updateCurrencyUI('to');
        ratesCache.delete(state.from);
        scheduleFetch();
        savePrefs();
        haptic();
      });
      li.appendChild(btn);
      els.historyList.appendChild(li);
    });
  }

  function applyRateFromCache(base) {
    const cached = ratesCache.get(base);
    if (!cached || !cached.rates[state.to]) return false;
    state.rate = cached.rates[state.to];
    state.ratesDate = cached.date;
    updateRateStatus(cached.online);
    return true;
  }

  async function fetchRatesFromOpenEr(base) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!res.ok) throw new Error('open-er http');
    const data = await res.json();
    if (data.result !== 'success' || !data.rates) throw new Error('open-er bad');
    return { rates: data.rates, date: data.time_last_update_utc || new Date().toISOString() };
  }

  async function fetchRatesFromFrankfurter(base) {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${base}`);
    if (!res.ok) throw new Error('frank http');
    const data = await res.json();
    if (!data.rates) throw new Error('frank bad');
    const rates = { ...data.rates, [base]: 1 };
    return { rates, date: data.date ? `${data.date}T12:00:00Z` : new Date().toISOString() };
  }

  async function fetchRatesFromFawaz(base) {
    const lower = base.toLowerCase();
    const urls = [
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${lower}.min.json`,
      `https://latest.currency-api.pages.dev/v1/currencies/${lower}.min.json`,
    ];
    let lastErr;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('fawaz http');
        const data = await res.json();
        const bag = data[lower];
        if (!bag) throw new Error('fawaz bag');
        const rates = {};
        for (const [k, v] of Object.entries(bag)) {
          rates[k.toUpperCase()] = Number(v);
        }
        rates[base] = 1;
        return { rates, date: data.date || new Date().toISOString() };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error('fawaz fail');
  }

  async function fetchLatestRates(base) {
    const errors = [];
    for (const fn of [fetchRatesFromOpenEr, fetchRatesFromFrankfurter, fetchRatesFromFawaz]) {
      try {
        return await fn(base);
      } catch (e) {
        errors.push(e);
      }
    }
    throw errors[0] || new Error('all rate apis failed');
  }

  async function fetchRate(force = false) {
    if (state.from === state.to) {
      state.rate = 1;
      state.ratesDate = new Date().toISOString();
      updateRateStatus(navigator.onLine);
      convert();
      savePrefs();
      return;
    }

    if (!force && applyRateFromCache(state.from)) {
      convert();
      savePrefs();
      return;
    }

    if (force) ratesCache.delete(state.from);

    state.fetching = true;
    els.resultCard.classList.add('loading');

    try {
      const data = await fetchLatestRates(state.from);
      const rate = data.rates[state.to];
      if (rate == null || isNaN(rate)) throw new Error('pair missing');

      ratesCache.set(state.from, {
        rates: data.rates,
        date: data.date,
        online: true,
      });

      state.rate = rate;
      state.ratesDate = data.date;
      updateRateStatus(true);
      if (force) showToast('Taux actualisés');
    } catch (_) {
      if (!applyRateFromCache(state.from)) {
        try {
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            const prefs = JSON.parse(stored);
            if (prefs.rate && prefs.from === state.from && prefs.to === state.to) {
              state.rate = prefs.rate;
              state.ratesDate = prefs.ratesDate;
              updateRateStatus(false);
            }
          }
        } catch (_) {}
        if (force) showToast('Impossible d’actualiser');
      }
    } finally {
      state.fetching = false;
      els.resultCard.classList.remove('loading');
      convert();
      savePrefs();
    }
  }

  function parseVersion(v) {
    return String(v || '0')
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((n) => parseInt(n, 10) || 0);
  }

  function isNewerVersion(remote, local) {
    const a = parseVersion(remote);
    const b = parseVersion(local);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x > y) return true;
      if (x < y) return false;
    }
    return false;
  }

  function hideUpdateBanner() {
    const banner = $('updateBanner');
    if (banner) banner.hidden = true;
  }

  function openExternal(url) {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function showUpdateBanner(manifest) {
    const banner = $('updateBanner');
    if (!banner) return;
    const title = $('updateBannerTitle');
    const notes = $('updateBannerNotes');
    const btn = $('updateBannerBtn');
    if (title) title.textContent = `Mise à jour ${manifest.version}`;
    if (notes) {
      notes.textContent = manifest.notes || cfg.defaultNotes || 'Une nouvelle version est disponible.';
      notes.hidden = !notes.textContent;
    }
    if (btn) {
      btn.textContent = manifest.buttonLabel || 'Mettre à jour';
      btn.onclick = () => {
        const url = manifest.apkUrl || manifest.url || manifest.storeUrl;
        if (!url) {
          showToast('Lien de téléchargement manquant');
          return;
        }
        openExternal(url);
      };
    }
    banner.hidden = false;
  }

  function githubRepo() {
    const owner = (cfg.github && cfg.github.owner || '').trim();
    const repo = (cfg.github && cfg.github.repo || 'converter').trim();
    if (!owner) return null;
    return { owner, repo };
  }

  function pagesBaseUrl(repoInfo) {
    return `https://${repoInfo.owner}.github.io/${repoInfo.repo}`;
  }

  async function fetchManifestJson(repoInfo) {
    const urls = [
      `${pagesBaseUrl(repoInfo)}/update.json?t=${Date.now()}`,
      `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/main/update.json?t=${Date.now()}`,
      `https://cdn.jsdelivr.net/gh/${repoInfo.owner}/${repoInfo.repo}@main/update.json`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && (data.version || data.versionName)) return data;
      } catch (_) {}
    }
    return null;
  }

  async function fetchGithubLatestRelease(repoInfo) {
    const res = await fetch(
      `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases/latest`,
      {
        headers: { Accept: 'application/vnd.github+json' },
        cache: 'no-store',
      }
    );
    if (!res.ok) throw new Error('github release http');
    const data = await res.json();
    const tag = String(data.tag_name || '').replace(/^v/i, '');
    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apk =
      assets.find((a) => /\.apk$/i.test(a.name) && /release|prod/i.test(a.name)) ||
      assets.find((a) => /\.apk$/i.test(a.name));
    return {
      version: tag || data.name,
      versionCode: null,
      notes: data.body || cfg.defaultNotes,
      apkUrl: apk ? apk.browser_download_url : data.html_url,
      url: data.html_url,
    };
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isIOS() {
    return /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  async function checkStoreUpdates(manual) {
    const play = cfg.stores && cfg.stores.playUrl;
    const ios = cfg.stores && cfg.stores.appStoreUrl;
    if (isAndroid() && play) {
      showUpdateBanner({
        version: APP_VERSION,
        notes: 'Ouvre le Play Store pour vérifier / installer la dernière version.',
        storeUrl: play,
        buttonLabel: 'Ouvrir Play Store',
      });
      if (manual) showToast('Redirection Play Store');
      return;
    }
    if (isIOS() && ios) {
      showUpdateBanner({
        version: APP_VERSION,
        notes: 'Ouvre l’App Store pour vérifier / installer la dernière version.',
        storeUrl: ios,
        buttonLabel: 'Ouvrir App Store',
      });
      if (manual) showToast('Redirection App Store');
      return;
    }
    if (manual) showToast('Liens store non configurés');
  }

  async function checkSideloadUpdates(manual) {
    const repoInfo = githubRepo();
    if (!repoInfo) {
      if (manual) showToast('Indique github.owner dans js/config.js');
      return;
    }

    let manifest = await fetchManifestJson(repoInfo);
    if (!manifest) {
      try {
        manifest = await fetchGithubLatestRelease(repoInfo);
      } catch (_) {
        if (manual) showToast('Vérification impossible');
        return;
      }
    }

    const remote = manifest.version || manifest.versionName;
    const remoteCode = Number(manifest.versionCode || 0);
    const newerByName = remote && isNewerVersion(remote, APP_VERSION);
    const newerByCode = remoteCode > 0 && remoteCode > APP_VERSION_CODE;

    if (newerByName || newerByCode) {
      if (!manifest.apkUrl && !manifest.url) {
        try {
          const rel = await fetchGithubLatestRelease(repoInfo);
          manifest.apkUrl = rel.apkUrl;
          manifest.url = rel.url;
          if (!manifest.notes) manifest.notes = rel.notes;
        } catch (_) {}
      }
      showUpdateBanner(manifest);
      if (manual) showToast(`Version ${remote} disponible`);
    } else {
      hideUpdateBanner();
      if (manual) showToast('Application à jour');
    }
  }

  async function checkForUpdates(manual = false) {
    if ((cfg.distribution || 'sideload') === 'store') {
      // En mode store : bannière seulement si l’utilisateur demande (les stores gèrent le reste)
      if (!manual) return;
      return checkStoreUpdates(manual);
    }
    return checkSideloadUpdates(manual);
  }

  function scheduleFetch(force = false) {
    clearTimeout(fetchTimer);
    fetchTimer = setTimeout(() => fetchRate(force), force ? 0 : 200);
  }

  function toggleFavorite(code, event) {
    event.stopPropagation();
    haptic();
    if (state.favorites.includes(code)) {
      state.favorites = state.favorites.filter((c) => c !== code);
    } else {
      state.favorites = [code, ...state.favorites.filter((c) => c !== code)].slice(0, 12);
    }
    saveFavorites();
    renderQuickChips();
    renderCurrencyList(els.currencySearch.value);
  }

  function renderQuickChips() {
    els.quickChips.innerHTML = '';
    const codes = [
      ...state.favorites,
      ...POPULAR_CODES.filter((c) => !state.favorites.includes(c)),
    ].slice(0, 12);

    codes.forEach((code) => {
      const c = CURRENCIES[code];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (code === state[state.modalTarget] ? ' active' : '');
      btn.innerHTML = `<span class="chip-flag">${c.flag}</span>${code}`;
      btn.addEventListener('click', () => selectCurrency(code));
      els.quickChips.appendChild(btn);
    });
  }

  function openModal(target) {
    state.modalTarget = target;
    els.modalTitle.textContent = target === 'from' ? 'Devise source' : 'Devise cible';
    els.currencySearch.value = '';
    els.searchClear.hidden = true;
    els.quickChips.style.display = '';
    renderQuickChips();
    renderCurrencyList('');
    els.modal.hidden = false;
    document.body.style.overflow = 'hidden';
    updateModalViewport();
    els.listScroll.scrollTop = 0;
  }

  function closeModal() {
    els.currencySearch.blur();
    els.modal.hidden = true;
    state.modalTarget = null;
    document.body.style.overflow = '';
    document.documentElement.style.removeProperty('--modal-height');
    document.documentElement.style.removeProperty('--modal-offset');
  }

  function selectCurrency(code) {
    if (!state.modalTarget) return;
    state[state.modalTarget] = code;
    updateCurrencyUI(state.modalTarget);
    closeModal();
    scheduleFetch();
    savePrefs();
    haptic();
  }

  function renderCurrencyList(query) {
    const q = query.toLowerCase().trim();
    const allCodes = Object.keys(CURRENCIES);

    const filtered = allCodes.filter((code) => {
      if (!q) return true;
      const c = CURRENCIES[code];
      return code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    });

    els.currencyList.innerHTML = '';

    if (!filtered.length) {
      els.currencyList.innerHTML = '<li class="empty-state">Aucune devise trouvée</li>';
      return;
    }

    const favorites = filtered.filter((c) => state.favorites.includes(c));
    const popular = filtered.filter((c) => POPULAR_CODES.includes(c) && !state.favorites.includes(c));
    const others = filtered.filter((c) => !POPULAR_CODES.includes(c) && !state.favorites.includes(c));

    function appendSection(label, codes) {
      if (!codes.length) return;
      const section = document.createElement('li');
      section.className = 'currency-section-label';
      section.textContent = label;
      els.currencyList.appendChild(section);

      codes.forEach((code) => {
        const c = CURRENCIES[code];
        const isFav = state.favorites.includes(code);
        const li = document.createElement('li');
        li.className = 'currency-item';
        li.setAttribute('role', 'option');
        if (code === state[state.modalTarget]) li.classList.add('selected');
        li.innerHTML = `
          <div class="item-flag-wrap">${c.flag}</div>
          <div class="item-info">
            <div class="item-code">${code}</div>
            <div class="item-name">${c.name}</div>
          </div>
          <span class="item-check"></span>
          <button type="button" class="fav-btn${isFav ? ' active' : ''}" aria-label="Favori">★</button>
        `;
        li.querySelector('.fav-btn').addEventListener('click', (e) => toggleFavorite(code, e));
        li.addEventListener('click', (e) => {
          if (e.target.closest('.fav-btn')) return;
          els.currencySearch.blur();
          selectCurrency(code);
        });
        els.currencyList.appendChild(li);
      });
    }

    if (!q) {
      appendSection('Favoris', favorites);
      appendSection('Populaires', popular);
      appendSection('Toutes les devises', others);
    } else {
      appendSection(`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`, filtered);
    }
  }

  function swapCurrencies() {
    [state.from, state.to] = [state.to, state.from];
    updateCurrencyUI('from');
    updateCurrencyUI('to');
    scheduleFetch();
    savePrefs();
    haptic();
  }

  function onAmountInput(e) {
    let val = e.target.value.replace(/[^0-9.,]/g, '');
    const parts = val.replace(',', '.').split('.');
    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
    state.amount = val;
    e.target.value = val;
    convert();
    savePrefs();
  }

  function onSearchInput(e) {
    const val = e.target.value;
    els.searchClear.hidden = !val;
    renderCurrencyList(val);
    els.quickChips.style.display = val ? 'none' : '';
  }

  async function copyResult() {
    const amount = parseAmount(state.amount);
    if (!amount || !state.rate) return;
    const converted = amount * state.rate;
    const text = `${formatAmount(amount, state.from)} ${state.from} = ${formatAmount(converted, state.to)} ${state.to}`;
    try {
      await navigator.clipboard.writeText(text);
      els.copyBtn.classList.add('copied');
      els.copyLabel.textContent = 'Copié';
      showToast('Résultat copié');
      haptic();
      setTimeout(() => {
        els.copyBtn.classList.remove('copied');
        els.copyLabel.textContent = 'Copier';
      }, 1400);
    } catch (_) {
      showToast('Copie impossible');
    }
  }

  function switchScreen(name) {
    const convert = $('screenConvert');
    const markets = $('screenMarkets');
    const navConvert = $('navConvert');
    const navMarkets = $('navMarkets');

    if (name === 'markets') {
      convert.hidden = true;
      markets.hidden = false;
      navConvert.classList.remove('active');
      navMarkets.classList.add('active');
      if (window.Markets) {
        window.Markets.syncFromConverter(state.from, state.to);
        window.Markets.show();
      }
    } else {
      markets.hidden = true;
      convert.hidden = false;
      navMarkets.classList.remove('active');
      navConvert.classList.add('active');
    }
    haptic();
  }

  function openPairModal() {
    state._marketsPick = false;
    state._pairMode = true;
    openModal('from');
    els.modalTitle.textContent = 'Devise source';
  }

  const _selectCurrency = selectCurrency;
  selectCurrency = function (code) {
    const pairMode = state._pairMode;
    const wasTarget = state.modalTarget;
    _selectCurrency(code);

    if (pairMode && wasTarget === 'from') {
      state._pairMode = true;
      setTimeout(() => {
        openModal('to');
        els.modalTitle.textContent = 'Devise cible';
      }, 180);
    } else if (pairMode && wasTarget === 'to') {
      state._pairMode = false;
      if (window.Markets) window.Markets.setPair(state.from, state.to);
    } else if (window.Markets && !$('screenMarkets').hidden) {
      window.Markets.syncFromConverter(state.from, state.to);
    }
  };

  function init() {
    loadPrefs();
    bindViewport();

    els.amount.value = state.amount;
    updateCurrencyUI('from');
    updateCurrencyUI('to');
    renderHistory();

    if (state.rate) {
      updateRateStatus(navigator.onLine);
      convert();
    }

    fetchRate();

    els.amount.addEventListener('input', onAmountInput);
    els.swapBtn.addEventListener('click', swapCurrencies);
    els.fromCurrency.addEventListener('click', () => {
      state._pairMode = false;
      openModal('from');
    });
    els.toCurrency.addEventListener('click', () => {
      state._pairMode = false;
      openModal('to');
    });
    els.modalClose.addEventListener('click', closeModal);
    els.currencySearch.addEventListener('input', onSearchInput);
    els.currencySearch.addEventListener('focus', updateModalViewport);
    els.copyBtn.addEventListener('click', copyResult);
    els.rateStatus.addEventListener('click', () => {
      if (state.fetching) return;
      scheduleFetch(true);
      haptic();
    });

    els.clearHistory.addEventListener('click', () => {
      state.history = [];
      saveHistory();
      renderHistory();
      showToast('Historique effacé');
    });

    els.searchClear.addEventListener('click', () => {
      els.currencySearch.value = '';
      els.searchClear.hidden = true;
      els.quickChips.style.display = '';
      renderCurrencyList('');
      els.currencySearch.focus();
    });

    $('navConvert').addEventListener('click', () => switchScreen('convert'));
    $('navMarkets').addEventListener('click', () => switchScreen('markets'));

    const versionBadge = document.querySelector('.version-badge');
    if (versionBadge) {
      versionBadge.style.cursor = 'pointer';
      versionBadge.title = 'Vérifier les mises à jour';
      versionBadge.addEventListener('click', () => {
        haptic();
        checkForUpdates(true);
      });
    }
    const dismissBtn = $('updateBannerDismiss');
    if (dismissBtn) dismissBtn.addEventListener('click', hideUpdateBanner);

    window.addEventListener('online', () => scheduleFetch(true));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        scheduleFetch(true);
        checkForUpdates(false);
      }
    });

    window.ConverterApp = {
      showToast,
      haptic,
      openPairModal,
      getPair: () => ({ from: state.from, to: state.to }),
      checkForUpdates,
      APP_VERSION,
    };

    if (window.Markets) window.Markets.init();
    checkForUpdates(false);
  }

  init();
})();
