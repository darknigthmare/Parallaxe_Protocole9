# Réunification du jeu et de l’hébergement — 16 novembre 2026

## Sources et portée

Deux historiques conservés, sans écrasement ni réécriture :

- branche de production : `02fcdddae3b174a1a84510a7d0679916f7ef5da7` (PR #6, fonction Node Vercel et stockage persistant) ;
- branche de continuation : `9f58b7ae05359c5d048571537e094bac71a06b80` (PR #5, cinq lieux, commandes accessibles, menus manette, sauvegardes solo et mesures locales).

Les scripts et étapes CI des deux branches sont réunis. Le verrouillage de dépendances reprend celui de main ; seuls les moteurs Node différaient de la continuation. Les six fichiers Obscura ajoutés à main sont conservés, comme les cinq skills P9 déjà présents. Ce document ne certifie pas leur activation chez l’utilisateur.

## Frontière du stockage et confidentialité

Huit nouveaux tests exécutent les vrais gestionnaires Request/Response et l’adaptateur REST, avec doubles de stockage et de réseau. Cinq régressions échouaient avant les corrections :

1. un corps fournisseur non JSON pouvait apparaître dans une erreur de parsing ; il est remplacé par une erreur fixe ;
2. les requêtes authentifiées vers le stockage refusaient implicitement moins de redirections que prévu ; `redirect: error` interdit désormais leur suivi ;
3. une exception inattendue pouvait révéler son contenu dans les journaux ; les logs et la réponse publique sont expurgés ;
4. la limite de 16 Kio du gestionnaire partagé comptait des caractères au lieu d’octets UTF-8 ; le chemin Node compilé comptait déjà les octets ;
5. une ligne expirant exactement à l’instant courant restait acceptée un instant de plus ; la borne est désormais exclusive.

Les autres cas couvrent les corps JSON invalides sans écriture, la création de l’Observatoire sans fuite de graine ni de hash de jeton, et le rejet des réponses REST mal formées. Aucun changement de schéma SQL, permission de base de données ou secret de production n’est requis par ce lot.

## Identification des distributions

Chaque build autonome produit `build-info.json` : identifiant du jeu, version, cible (`vercel` ou `portable`) et commit exact lorsqu’il est disponible. Les champs sont explicitement autorisés ; aucune variable d’environnement complète, adresse de base de données, clé ou donnée de salon n’est publiée. Une révision indisponible est `null`, jamais inventée. Quatre tests contrôlent cette identité et son écriture.

La compilation Vercel et la compilation PC vident toutes deux `standalone-dist`. La CI construit Vercel **avant** l’édition locale, afin que le paquet PC conserve son serveur local et son identité `portable`. Le test d’archive extraite reste obligatoire.

## Vérification et limites

Les tests locaux ajoutés passent : 8 frontières Vercel + 4 identités de build. Les résultats de toutes les suites, les trois builds et l’archive doivent être consultés sur la CI du commit intégré exact. Un résultat de l’ancienne branche ne vaut pas preuve de la fusion.

La tentative de navigation Chromium locale du 16 novembre est bloquée par `ERR_BLOCKED_BY_ADMINISTRATOR`. Aucun contournement ni capture WebGL validée n’est annoncé. Les tests de données et de protocole ne remplacent pas la réception humaine.

Les critères GPU, manette physique, microphone, écoute, TURN inter-réseaux, coopération humaine et lanceur Windows restent ouverts. Le catalogue reste **119/120**, avec `hall_stretch` exclu ; 600 clés et 28 lots ne sont pas déclarés terminés. Les anciens classeurs sont conservés et leur validation reste active.
