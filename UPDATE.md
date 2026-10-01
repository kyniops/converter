# Mises à jour Convertisseur

## Deux modes

| Mode | Usage | Comment ça se met à jour |
|------|--------|---------------------------|
| **sideload** (défaut) | Tests perso | Bannière → APK GitHub Releases **ou** APK beta live via Pages |
| **store** | Play Store / App Store | Bannière → ouvre le store |

Change `distribution` dans `js/config.js`.

## Setup rapide (tests sans renvoyer d’APK)

1. Repo GitHub : `kyniops/converter` (public recommandé pour Pages).
2. `github.owner` est déjà renseigné dans `js/config.js`.
3. Push le projet sur `main`.
4. Sur GitHub → **Settings → Pages** → Source = **GitHub Actions**.
5. Une fois Pages en ligne (`https://kyniops.github.io/converter/`), build l’APK beta :
   ```bash
   npm run build:apk:beta
   ```
6. Installe **cette APK une seule fois** sur ton téléphone.

Ensuite : tu modifies le code → `npm run sync` → push → l’app recharge le web à l’ouverture. **Plus besoin d’envoyer l’APK** pour les changements JS/CSS/HTML.

Clique sur le badge version dans l’app pour forcer une vérif. Au démarrage / retour au premier plan, la bannière apparaît s’il y a une nouvelle APK.

## Release APK complète (changement natif / version officielle)

1. Bumpe `version` / `versionCode` dans `package.json`, `js/config.js`, `android/app/build.gradle`, `update.json`.
2. Commit + push sur `main`.
3. Lance :
   ```bash
   npm run release
   # ou: npm run release -- -Version 2.10
   ```

Le workflow `Release APK` build, publie l’APK sur GitHub Releases et met à jour `update.json`. L’app sideload affiche la bannière « Mettre à jour ».

## Passage stores

1. `distribution: 'store'` dans `js/config.js`
2. Remplis `stores.playUrl` / `stores.appStoreUrl`
3. Build **sans** `capacitor.config.beta.json` (assets embarqués) :
   ```bash
   npm run build:apk
   ```
4. Publie le AAB/IPA via Play Console / App Store Connect

Les mises à jour passent alors par les stores (obligatoire pour iOS ; recommandé Android).
