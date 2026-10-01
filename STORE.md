# Publication Play Store

## Fichier à uploader
```bash
npm run build:release
```
→ `Convertisseur-play.aab` sur le Bureau.

## Une seule fois
1. Compte [Google Play Console](https://play.google.com/console) (~25 $)
2. `npm run keystore` (si pas encore fait) → **sauvegarde** `android/upload-keystore.jks` + `android/key.properties`
3. Créer l’app : package `com.hugo.convertisseur2`

## Fiche store (à remplir dans la Console)
- **Politique de confidentialité** : https://kyniops.github.io/converter/privacy.html
- Captures d’écran téléphone (min. 2)
- Icône 512×512 + bannière 1024×500
- Texte court + description
- Questionnaire contenu / Data safety :
  - Données collectées : aucune donnée perso côté développeur
  - Données locales (préférences) sur l’appareil
  - Données partagées : requêtes de taux vers API tierce (pas d’identifiant utilisateur)

## Technique déjà en place
- Signature release via `android/key.properties`
- AAB signé (pas d’APK debug)
- Assets web **embarqués** (pas de GitHub Pages live)
- Mode `store` activé pendant le build release (lien Play pour les maj)
- targetSdk 35

## App Store (iOS)
Pas encore : besoin d’un Mac + `npx cap add ios` + compte Apple Developer.
