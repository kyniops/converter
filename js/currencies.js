const CURRENCIES = {
  USD: { name: 'Dollar américain', flag: '🇺🇸', popular: true },
  EUR: { name: 'Euro', flag: '🇪🇺', popular: true },
  GBP: { name: 'Livre sterling', flag: '🇬🇧', popular: true },
  JPY: { name: 'Yen japonais', flag: '🇯🇵', popular: true },
  CHF: { name: 'Franc suisse', flag: '🇨🇭', popular: true },
  CAD: { name: 'Dollar canadien', flag: '🇨🇦', popular: true },
  AUD: { name: 'Dollar australien', flag: '🇦🇺', popular: true },
  CNY: { name: 'Yuan chinois', flag: '🇨🇳', popular: true },
  INR: { name: 'Roupie indienne', flag: '🇮🇳', popular: true },
  BRL: { name: 'Real brésilien', flag: '🇧🇷', popular: true },
  MXN: { name: 'Peso mexicain', flag: '🇲🇽', popular: true },
  KRW: { name: 'Won sud-coréen', flag: '🇰🇷' },
  SGD: { name: 'Dollar de Singapour', flag: '🇸🇬' },
  HKD: { name: 'Dollar de Hong Kong', flag: '🇭🇰' },
  NOK: { name: 'Couronne norvégienne', flag: '🇳🇴' },
  SEK: { name: 'Couronne suédoise', flag: '🇸🇪' },
  DKK: { name: 'Couronne danoise', flag: '🇩🇰' },
  PLN: { name: 'Zloty polonais', flag: '🇵🇱' },
  CZK: { name: 'Couronne tchèque', flag: '🇨🇿' },
  HUF: { name: 'Forint hongrois', flag: '🇭🇺' },
  RON: { name: 'Leu roumain', flag: '🇷🇴' },
  TRY: { name: 'Livre turque', flag: '🇹🇷' },
  ZAR: { name: 'Rand sud-africain', flag: '🇿🇦' },
  THB: { name: 'Baht thaïlandais', flag: '🇹🇭' },
  IDR: { name: 'Roupie indonésienne', flag: '🇮🇩' },
  MYR: { name: 'Ringgit malaisien', flag: '🇲🇾' },
  PHP: { name: 'Peso philippin', flag: '🇵🇭' },
  ILS: { name: 'Shekel israélien', flag: '🇮🇱' },
  AED: { name: 'Dirham des Émirats', flag: '🇦🇪' },
  SAR: { name: 'Riyal saoudien', flag: '🇸🇦' },
  NZD: { name: 'Dollar néo-zélandais', flag: '🇳🇿' },
  RUB: { name: 'Rouble russe', flag: '🇷🇺' },
  ARS: { name: 'Peso argentin', flag: '🇦🇷' },
  CLP: { name: 'Peso chilien', flag: '🇨🇱' },
  COP: { name: 'Peso colombien', flag: '🇨🇴' },
  PEN: { name: 'Sol péruvien', flag: '🇵🇪' },
  EGP: { name: 'Livre égyptienne', flag: '🇪🇬' },
  MAD: { name: 'Dirham marocain', flag: '🇲🇦' },
  TND: { name: 'Dinar tunisien', flag: '🇹🇳' },
  XOF: { name: 'Franc CFA (BCEAO)', flag: '🌍' },
  XAF: { name: 'Franc CFA (BEAC)', flag: '🌍' },
  ISK: { name: 'Couronne islandaise', flag: '🇮🇸' },
  BGN: { name: 'Lev bulgare', flag: '🇧🇬' },
  HRK: { name: 'Kuna croate', flag: '🇭🇷' },
  UAH: { name: 'Hryvnia ukrainienne', flag: '🇺🇦' },
  VND: { name: 'Dong vietnamien', flag: '🇻🇳' },
  PKR: { name: 'Roupie pakistanaise', flag: '🇵🇰' },
  BDT: { name: 'Taka bangladais', flag: '🇧🇩' },
  NGN: { name: 'Naira nigérian', flag: '🇳🇬' },
  KES: { name: 'Shilling kényan', flag: '🇰🇪' },
  QAR: { name: 'Riyal qatari', flag: '🇶🇦' },
  KWD: { name: 'Dinar koweïtien', flag: '🇰🇼' },
  BHD: { name: 'Dinar bahreïni', flag: '🇧🇭' },
  OMR: { name: 'Rial omanais', flag: '🇴🇲' },
  JOD: { name: 'Dinar jordanien', flag: '🇯🇴' },
  LKR: { name: 'Roupie srilankaise', flag: '🇱🇰' },
};

const POPULAR_CODES = Object.entries(CURRENCIES)
  .filter(([, c]) => c.popular)
  .map(([code]) => code);

const STORAGE_KEY = 'converter_prefs';

function getCurrency(code) {
  return CURRENCIES[code] || { name: code, flag: '💱' };
}

function formatAmount(value, code) {
  const noDecimals = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'XOF', 'XAF'];
  const decimals = noDecimals.includes(code) ? 0 : 2;

  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function parseAmount(str) {
  if (!str || !str.trim()) return 0;
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
