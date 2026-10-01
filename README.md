# Convertisseur de devises

Application mobile légère pour convertir rapidement des montants entre devises, avec taux en temps réel.

## Fonctionnalités

- Conversion instantanée pendant la saisie
- Plus de 50 devises (USD, EUR, GBP, JPY, CHF, etc.)
- Taux en direct via [Exchange Rate API](https://www.exchangerate-api.com/)
- Sauvegarde automatique du montant et des devises choisies
- Fonctionne hors ligne avec les derniers taux connus
- Installable sur téléphone (PWA)

## Application Android (APK / Play Store)

- Tests perso (live Pages) : voir **[UPDATE.md](UPDATE.md)** → `npm run build:apk:beta`
- **Publication Play Store** : voir **[STORE.md](STORE.md)** → `npm run build:release`
---

## Utilisation web (PWA)

> **Important :** en `http://` (adresse IP locale), le téléphone ne crée qu’un **raccourci navigateur**, pas une vraie app. Il faut utiliser **HTTPS**.

### Installation (recommandé)

1. Double-cliquez sur **`demarrer.bat`** dans le dossier `converter`
2. Notez l’adresse affichée, ex. `https://192.168.1.100:8443`
3. Sur votre téléphone (même Wi-Fi), ouvrez cette adresse
4. **Acceptez l’avertissement de sécurité** (certificat local, sans danger)
5. Installez l’app :
   - **Android (Chrome)** : menu ⋮ → **Installer l’application** ou **Ajouter à l’écran d’accueil**
   - **iPhone (Safari)** : Partager → **Sur l’écran d’accueil**

L’app s’ouvrira en **plein écran**, sans barre du navigateur.

### Ancienne méthode HTTP (raccourci seulement)

```bash
python -m http.server 8080
```

Ne permet qu’un raccourci vers la page web, pas une installation PWA complète.

## Structure

```
converter/
├── index.html
├── manifest.json
├── sw.js
├── css/style.css
├── js/
│   ├── app.js
│   └── currencies.js
└── icons/icon.svg
```

## Notes

- Aucune installation requise (HTML/CSS/JS pur)
- Les préférences sont stockées dans le navigateur (`localStorage`)
- Les taux sont mis à jour à chaque ouverture de l'application
