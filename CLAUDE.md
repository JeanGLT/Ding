# Ding : horaires de bus Citybus en direct (Hong Kong)

Projet perso de Jean (utilisateur quotidien de Citybus à Wan Chai). L'app officielle est mauvaise, seule la donnée en direct est utile. Ding la remplace par une interface faite pour lui : seulement ses lignes, un gros compte à rebours, zéro menu.

Langue de travail : français. Réponses courtes, ton naturel. Jean débute en code : explique les étapes qui demandent un clic de sa part (GitHub, iPhone, Scriptable), ne suppose rien.

## Deux livrables

1. `index.html` : web app (un seul fichier, HTML + CSS + JS vanilla, aucune dépendance sauf Google Fonts). Hébergée sur GitHub Pages : https://jeanglt.github.io/Ding/ (dépôt https://github.com/JeanGLT/Ding, branche `main`, fichier à la racine).
2. `widget/ding-widget.js` : widget iPhone pour l'app Scriptable. Même identité visuelle. Un tap sur le widget ouvre la web app (URL mémorisée dans le script, réglable via son menu).

Règle : le design et les données doivent rester cohérents entre les deux. Si tu changes une couleur ou une règle d'affichage dans l'un, change l'autre.

## Données : API open data Citybus (gratuite, sans clé)

Base : `https://rt.data.gov.hk/v2/transport/citybus`

- `/route/CTB/{ligne}` : infos ligne (`orig_en`, `dest_en`)
- `/route-stop/CTB/{ligne}/{outbound|inbound}` : arrêts du sens, avec `seq` et `stop`
- `/stop/{id}` : nom de l'arrêt (`name_en`, `name_tc`)
- `/eta/CTB/{id_arret}/{ligne}` : prochains passages. Champs utiles : `dir` ("O" ou "I"), `eta` (ISO 8601 ou vide)

Les réponses sont de la forme `{ data: ... }`. Filtrer `eta` vide, garder le bon `dir`, calculer les minutes avec `Math.floor`.

## Identité visuelle (ne pas changer sans demander)

- Nom : **Ding** (sonnette des bus de HK). Logo : carré arrondi ambre avec un bus sombre et deux ondes (voir le SVG dans l'en-tête de `index.html`, redessiné par code dans `makeLogo()` côté widget).
- Ambre `#FFB61E` pour l'accent. Vert nuit `#091316` (fond sombre), `#122126` (surface). Clair : fond `#EDF2F0`, surface `#FFFFFF`. Vert "bus qui arrive" `#0B8F5F` / `#3FE0A0`.
- Chaque ligne a une pastille de couleur stable, choisie par hash du numéro parmi 6 couleurs (même fonction `hash` dans les deux fichiers).
- Typo : Barlow Condensed (chiffres, titres) + Figtree (texte). Dans le widget iOS, police système `AvenirNextCondensed-Heavy` (pas de police externe possible).
- Thème clair et sombre automatiques. Gros chiffre des minutes, puis les deux passages suivants, puis une frise 0 à 30 min dans la web app.

## Comportements à garder

- Lignes de départ : 37A, 90, 5X, 26 (Citybus uniquement). L'utilisateur choisit ses lignes, le sens (aller/retour) et son arrêt. Un arrêt mémorisé par sens et par ligne.
- La web app détecte si l'API répond. Sinon elle passe en mode démo avec un bandeau « Horaires simulés ». En direct, rafraîchissement toutes les 30 s et au retour sur l'app.
- Le widget demande un rafraîchissement toutes les 5 min, mais iOS décide du moment réel (compter 5 à 15 min). À ne pas présenter comme du temps réel à la seconde.
- Le widget ouvre la web app via `widget.url`. Sur les tailles moyen et grand, un seul lien pour tout le widget.

## État au départ de ce chantier

- La web app a été écrite et publiée dans un environnement qui ne pouvait pas joindre l'API. **Les appels réels à l'API n'ont jamais été testés de bout en bout.** Première priorité : ouvrir https://jeanglt.github.io/Ding/ et vérifier que le bandeau « Horaires simulés » disparaît. Si l'API refuse les appels depuis la page (CORS), il faudra un petit relais (Cloudflare Worker gratuit).
- Jean a eu une erreur 404 sur GitHub Pages : le dépôt contient bien `index.html` à la racine, mais il faut vérifier que Pages est activé (Settings → Pages → Deploy from a branch → main → / root).
- La ligne 5X n'a pas été vérifiée dans l'API (peut ne pas exister chez Citybus). Le code affiche une erreur claire si la ligne est introuvable.
- Le widget Scriptable n'a pas été testé sur un iPhone.

## Prochaines étapes (par ordre)

1. Faire fonctionner le direct (voir ci-dessus), corriger ce qui casse.
2. Rendre la web app installable proprement sur l'écran d'accueil : `manifest.webmanifest`, icône `apple-touch-icon` en PNG (180x180) générée depuis le logo, `<meta name="apple-mobile-web-app-title">`.
3. Cache de la liste des arrêts pour que l'ajout d'une ligne soit instantané la 2e fois.
4. Plusieurs arrêts par ligne (trajet du matin, trajet du soir) ou un mode "Maison / Bureau" qui bascule selon l'heure.
5. Ajouter KMB (même logique, API `https://rt.data.gov.hk/v1/transport/kmb`).
6. Option : lien par ligne dans le widget (une carte = un lien profond vers la ligne dans la web app, via `#37A`).
7. Idée à explorer plus tard : petit écran physique à la maison qui affiche les mêmes arrivées (mini-écran + microcontrôleur). Ne pas commencer sans que Jean le demande.

## Commandes utiles

- Tester en local : `python3 -m http.server 8000` dans ce dossier, puis ouvrir http://localhost:8000
- Vérifier la syntaxe JS du widget : `node --check widget/ding-widget.js`
- Déployer : `git add -A && git commit -m "message" && git push` (GitHub Pages se met à jour en 1 à 2 minutes)

## Règles de travail

- Garder `index.html` en un seul fichier tant que ça reste lisible.
- Pas de dépendance npm, pas de framework, sauf besoin clair.
- Tester avec les vraies données avant d'annoncer que ça marche. Dire ce qui n'a pas pu être testé.
- Écrire les textes de l'interface en français, simples et directs.
