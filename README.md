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
Export JSON (sauvegarde) et CSV (à montrer au psychiatre) dans *Réglages*.

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
