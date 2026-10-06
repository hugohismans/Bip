# Bip – humeur du jour

Petit site pour suivre son humeur au quotidien quand on vit avec un trouble bipolaire
(pensé en particulier pour le **type 2**, où la phase haute est difficile à repérer soi-même).

**5 secondes par soir** : humeur, énergie, sommeil + quelques symptômes de 0 à 3, on enregistre.
Les valeurs de la veille sont reprises, on ne touche que ce qui a changé.

## Les curseurs

| Curseur | Échelle | Pourquoi |
|---|---|---|
| Humeur | −3 … +3 | base de la NIMH Life Chart Method et de MONARCA |
| Énergie / activité | −3 … +3 | l'activité augmente souvent avant l'humeur en phase haute |
| Sommeil | heures | le besoin de sommeil réduit est le signe précoce le plus fiable |
| Irritabilité *(conseillé)* | 0 … 3 | phase haute, phase basse et états mixtes |
| Anxiété *(conseillé)* | 0 … 3 | fréquente, marqueur des états mixtes |
| Pensées rapides *(conseillé)* | 0 … 3 | signe le plus spécifique de l'hypomanie (type 2) |
| Impulsivité, concentration, stress, alcool | 0 … 3 | optionnels, à activer dans *Réglages* |

Le choix se fait dans *Réglages*, idéalement avec son psychiatre.

## 1, 2 ou 3 relevés par jour

L'humeur peut changer au fil de la journée. Dans *Réglages → Relevés dans la journée* :
1 relevé (journée), 2 (matinée ; après-midi et soirée) ou 3 (matinée ; après-midi ; soirée),
chacun avec son heure de rappel. L'écran de saisie propose automatiquement le bon moment.

- Humeur et énergie du jour = **moyenne** des relevés ; symptômes = **maximum** de la journée ;
  sommeil, traitement et note sont communs à la journée.
- L'**écart dans la journée** (relevé le plus bas → le plus haut) est dessiné sur le graphe ;
  un écart ≥ 3 points deux jours sur trois déclenche une alerte (possible état mixte).
- Notification par moment (« Comment s'est passée ta matinée ? »…) si ce moment n'est pas encore noté,
  dans les 3 h qui suivent. Sans serveur, elles ne partent que si l'app est ouverte ou en arrière-plan.

## Traitement

*Réglages → Mon traitement* : on indique ce qu'on prend (médicament, dose, moment) et depuis quand,
puis chaque **changement de traitement** (ajout, arrêt, dose) avec sa date et une note. Chaque changement
trace une ligne 💊 sur le graphe d'humeur, et la carte *Effet des changements de traitement* compare
les 28 jours avant et après : indice moyen, jours en zone haute / basse, variabilité, sommeil.
À discuter avec son psychiatre : un traitement peut mettre des semaines à agir.

## Ma façon de noter (étalonnage personnel)

Chacun utilise les curseurs à sa façon. Après 21 relevés, Bip apprend sur les 6 derniers mois
le **repère** (médiane) et l'**amplitude habituelle** (écart moyen à la médiane) de chaque curseur,
et raisonne ensuite en écarts à ces habitudes :

- quelqu'un qui ne note presque jamais l'irritabilité : un **1** compte déjà comme un signal ;
- quelqu'un qui la note souvent à 2 : il faut un **3** pour déclencher une alerte ;
- humeur et énergie : un +1 pèse plus chez quelqu'un de très mesuré (jamais moins chez les autres) ;
- sommeil : une « nuit courte » dépend de la régularité habituelle des nuits.

Garde-fou : pour l'humeur, l'énergie et le sommeil, l'ajustement peut seulement rendre plus attentif
(chez quelqu'un de mesuré), jamais moins, pour qu'une longue phase basse ou haute ne devienne pas
« la normale » et ne fasse pas taire les alertes. L'ajustement dans les deux sens ne concerne que les symptômes.
Le détail est visible (et désactivable) dans *Réglages → Ma façon de noter*.

## Signes d'alerte personnels et plan d'action

Dans *Réglages*, on choisit ses propres signes avant-coureurs (suggestions fournies), chacun rattaché
à la phase haute ou basse, et on écrit son plan d'action avec son psychiatre. Les signes se cochent
en un geste le soir ; plusieurs signes en quelques jours déclenchent une alerte, et le plan s'affiche
dans la carte « Que faire » sous les alertes.

## Récapitulatif pour la consultation

*Historique → Récapitulatif* : depuis la dernière consultation notée (ou 3 mois), relevés, indice moyen,
jours en zone haute / basse, sommeil, phases repérées, graphes, symptômes, signes, plan et notes.
Impression / PDF (toujours en clair) ou fichier .html à envoyer.

## Ce que l'app calcule

- **Indice du jour** (−3 à +3) = 50 % humeur + 30 % énergie + 20 % écart de sommeil
  par rapport à son sommeil habituel (1 h de moins = +1).
- **Phase** : moyenne des 7 derniers jours (haute ≥ +1, tendance haute ≥ +0,5,
  tendance basse ≤ −0,5, basse ≤ −1).
- **Direction** : pente de la tendance sur 7 jours (montée / descente / stable).
- **Alertes avec bouton d'appel** (psychiatre, proche) :
  - 4 jours d'affilée en zone haute (durée d'un épisode hypomaniaque) ;
  - ≥ 2 nuits sur 3 avec 2 h de sommeil en moins **et** énergie haute (signe précoce) ;
  - signes mixtes (humeur basse + agitation/irritabilité) ;
  - 7 puis 14 jours en zone basse ;
  - changement brutal, irritabilité fréquente, plusieurs jours sans relevé.
- Si l'humeur est notée à −3 ou en cas de signes mixtes : numéros d'écoute
  (3114 FR, 0800 32 123 BE, 143 CH, 988 CA, 112).

## Sources

- NIMH Life Chart Method – relevé quotidien de la polarité et de la sévérité de l'humeur
  ([validation de l'app life-chart](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4367878/)).
- Altman Self-Rating Mania Scale – humeur, confiance, **sommeil**, parole, activité
  ([ASRM](https://en.wikipedia.org/wiki/Altman_Self-Rating_Mania_Scale)).
- Étude MONARCA – auto-évaluation quotidienne sur smartphone (humeur −3..+3, sommeil, activité, irritabilité)
  ([PMC3731717](https://pmc.ncbi.nlm.nih.gov/articles/PMC3731717)).

## Données et vie privée

Tout est stocké dans le navigateur (`localStorage`) de l'appareil : pas de compte, pas de serveur,
pas de base de données. Une *Content-Security-Policy* (`connect-src 'none'`) empêche la page
d'envoyer la moindre requête réseau, et aucune ressource externe (police, script, statistiques) n'est chargée.
Dans *Réglages* :
- **Sauvegarder (.json)** : relevés + réglages. Sur mobile, passe par le menu Partager
  (Enregistrer dans Fichiers, iCloud/Google Drive, mail à soi-même). Rappel affiché après 30 jours sans sauvegarde.
- **Importer** : aperçu du fichier (nombre de relevés, dates, doublons), puis *Fusionner* ou *Remplacer tout*.
  Chaque relevé est vérifié ; les lignes illisibles sont ignorées. Sert aussi à changer de téléphone.
- **Exporter pour le psychiatre (.csv)** : tableau lisible dans Excel / Numbers.
- **Démo** : `./?demo` affiche un an de données fictives, en mémoire uniquement (le vrai suivi n'est pas touché).

## Lancer

Site statique, aucun build : servir le dossier (`python3 -m http.server`) ou publier via GitHub Pages
(HTTPS nécessaire pour l'installation et le mode hors ligne).

## Installer sur mobile (PWA)

- **iPhone / iPad** : Safari → bouton *Partager* → *Sur l'écran d'accueil*. L'app affiche ces instructions
  au premier lancement. À faire avant de commencer : sur iOS, l'app installée a son propre stockage, séparé
  de Safari (on peut transférer avec export / import).
- **Android** : Chrome propose *Installer l'application* ; Bip affiche aussi un bouton *Installer*.

Une fois installée, Bip s'ouvre en plein écran et fonctionne hors connexion (service worker).

> Bip n'est pas un outil de diagnostic et ne remplace pas l'avis d'un psychiatre.
