# PARALLAXE 0.4.1 — Sources réconciliées et sessions fiables

**29 octobre 2026.** Cette édition réunit les sources 0.4.0 du Site (`6c8784e0cf5d64f6386f3448434b0bc659d3fc15`) et les correctifs de la PR #2, repris après `2ec5d3a343f3cdd0e86f729d7b0cb1c6c622bd65`. Aucun moteur ni version de bibliothèque n'a changé.

## Contenu conservé

Les quatre lieux et les **96 anomalies** sont présents dans le code. La campagne conserve Saint-Clair, Terminus 09 et Aile blanche, trois validations par secteur et neuf diagnostics au total. Le Chalet de service reste un lieu optionnel à neuf validations consécutives.

Les lectures privées des objets, le registre d'équipe, les douze anomalies radio, la calibration DTMF et la sortie mono sont conservés. En solo, Alpha et Bêta restent deux perceptions du même inspecteur. Le talkie reste utilisable au clavier et avec ses boutons pendant la lecture d'une observation ou du carnet.

Les 42 anomalies supplémentaires par rapport à l'ancienne branche GitHub proviennent des éditions 0.3 et 0.4 récupérées. Elles ne sont pas présentées comme de nouveaux contenus inventés pendant cette reprise. Le classeur principal conserve 120 fiches : 96 intégrées, 24 prévues.

## Correctifs réunis

- Les décisions `start`, `next` et `vote` portent le contexte du passage observé. Une ancienne décision est rejetée avec la vue privée actuelle ; elle n'est pas automatiquement rejouée.
- Les réponses, sondages et callbacks d'un salon abandonné ne peuvent plus restaurer son identité ni modifier une nouvelle session. Les votes et priorités de chef périmés sont invalidés après une interruption de présence.
- Les opérations RTC périmées sont ignorées. Le PTT manette doit être relâché puis pressé volontairement après une interruption ; une pression continue ne réactive pas la transmission après sa limite.
- Une pause, une observation, un verdict, une modale, un changement de session ou une perte de focus réinitialise le déplacement et les origines des gestes. Chaque pointeur conserve la propriété de son geste.
- Le reflet retardé conserve environ une seconde d'historique à haute fréquence. La pose d'épaule de l'avatar 0.4, déjà corrigée, est couverte par les régressions de retour à la normale.
- Une calibration radio est annulée immédiatement lors d'un changement de session. Ses réponses, erreurs et fins d'opération ne peuvent pas écraser une nouvelle calibration.
- Le serveur portable conserve les protections de chemins normalisés de la 0.4, les lectures privées et le Chalet à quatre joueurs, avec les nouveaux rejets de décisions périmées.

## Livraison et preuves

Le [Site privé 0.4.1](https://parallaxe-protocole-neuf.darknigthmare.chatgpt.site) est publié depuis le 29 octobre 2026 à 16:07 UTC (17:07 à Paris), avec un déploiement réussi depuis la source `064a2157b64787228966ea108b683f735f2e3dc6`. Les exécutables et les archives correspondent au code GitHub propre `fa9cf6306705c750106467d0d6caddf96767b0e7`. La PR #2 reste ouverte et la CI est encore en file d’attente au relevé.

Le packaging produit les archives PC et sources, `COMMIT.txt`, `SHA256SUMS.txt` et un manifeste. La vérification compare les ressources compilées, vérifie les archives, puis lance le serveur depuis une extraction neuve. Le parcours portable comprend une partie Chalet à quatre clients jusqu'à la victoire.

Consulter [le rapport actuel](qa-final-v0.4.1.json), [QA.md](QA.md), [la réconciliation](SOURCE_RECONCILIATION_2026-10-29.md) et [le suivi de reprise](PARALLAXE_Suivi_Reprise_2026-10-28.xlsx) pour les révisions testées et l'état effectif de livraison.

Les tests CPU et les simulations des frontières navigateur ne remplacent pas la vérification des images, des performances GPU, du tactile physique, des microphones et de TURN entre réseaux. Aucun résultat de ces essais n'est revendiqué ici.
