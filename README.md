# Bip – humeur du jour

Petit site pour suivre son humeur au quotidien quand on vit avec un trouble bipolaire
(pensé en particulier pour le **type 2**, où la phase haute est difficile à repérer soi-même).

**5 secondes par soir** : 4 curseurs (humeur, énergie, sommeil, irritabilité), on enregistre.
Les curseurs reprennent les valeurs de la veille, on ne touche que ce qui a changé.

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

Tout est stocké dans le navigateur (`localStorage`) de l'appareil. Rien n'est envoyé.
Export JSON (sauvegarde) et CSV (à montrer au psychiatre) dans *Réglages*.

## Lancer

Site statique, aucun build : ouvrir `index.html`, ou servir le dossier
(`python3 -m http.server`) / publier via GitHub Pages. Installable sur l'écran d'accueil.

> Bip n'est pas un outil de diagnostic et ne remplace pas l'avis d'un psychiatre.
