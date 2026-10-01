/**
 * Configuration centralisée des mises à jour.
 *
 * 1) Remplis github.owner (et repo si besoin)
 * 2) Pour tester sans renvoyer d’APK à chaque fois :
 *    - push sur main → GitHub Pages déploie www/
 *    - installe UNE fois l’APK « beta » (npm run build:apk:beta)
 *    L’app charge alors le site en live.
 * 3) Pour Play Store / App Store plus tard : distribution = 'store'
 */
window.APP_CONFIG = {
  version: '2.9',
  versionCode: 12,

  /**
   * sideload = tests perso (GitHub Releases + évent. Pages live)
   * store    = builds destinés aux stores (lien Play / App Store)
   */
  distribution: 'sideload',

  github: {
    owner: 'kyniops',
    repo: 'converter',
  },

  stores: {
    playUrl: 'https://play.google.com/store/apps/details?id=com.hugo.convertisseur2',
    appStoreUrl: '', // à remplir après publication iOS
  },

  /** Affiché dans la bannière si notes absentes */
  defaultNotes: 'Une nouvelle version est disponible.',
};
