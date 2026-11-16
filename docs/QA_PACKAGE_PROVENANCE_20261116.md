# Provenance des téléchargements embarqués — 16 novembre 2026

Le contrôle après téléchargement du paquet CI `8d5749e` a détecté une incohérence réelle : le COMMIT racine et build-info étaient corrects, mais les métadonnées de `standalone-dist/downloads` conservaient le SHA historique `fa9cf63`. L’archive source embarquée était récente ; ses métadonnées ne l’étaient pas.

Le générateur ne copie plus les anciennes métadonnées de publication dans les nouvelles archives. Les classeurs de conception restent conservés. Chaque ZIP source reçoit son propre COMMIT.txt. Le téléchargement source embarqué reçoit un manifeste et des empreintes recalculés à partir de ses vrais octets ; il ne prétend pas contenir le hash du ZIP portable qui l’enveloppe (référence circulaire impossible). Les empreintes du paquet portable restent dans le manifeste extérieur.

La recette d’archive compare désormais la révision racine, celle du ZIP source, les métadonnées de téléchargement et les empreintes du source embarqué. Les fichiers historiques du dépôt ne sont pas réécrits et les sources de jeu ne changent pas. Le quota de déploiements Vercel a bloqué la publication du commit intégré ; cette correction ne change ni l’abonnement, ni les secrets, ni les protections.
