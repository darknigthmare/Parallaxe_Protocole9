# Interruptions graphiques et entrées — 16 novembre 2026

Base : `712e886d40350eef21d7b310d11cd2af2f972eea`. Catalogue inchangé : 119/120. Cinq lieux, campagne et textes A/B conservés. Ce lot avance W03/W11/W13/W14/W23 sans certifier de réception humaine.

## Perte et restauration du contexte WebGL

L’événement `webglcontextlost` est annulé pour autoriser le protocole de restauration du navigateur. La scène devient indisponible immédiatement : arrêt de l’update, des déplacements et du regard, invalidation de la sélection et de l’historique de reflet. Game coupe commandes, calibration, lecture radio, transmission et capture du microphone, masque le relevé et présente un message d’incident technique. Aucun nouveau diagnostic ni début de partie ne passe par un ancien callback tant que la scène est indisponible. La présence coopérative continue : cela ne met pas le serveur ni les équipiers en pause.

Après `webglcontextrestored`, les contenus de cibles GPU ne sont pas supposés intacts. L’environnement PMREM est recalculé, l’ancien est libéré, les cibles des miroirs sont invalidées et la qualité est réappliquée. Géométries, positions, valeurs de référence et progression ne sont pas remplacées. La scène redevient disponible mais l’inspection reste en pause, sans microphone réactivé. La reprise nécessite une action du joueur. Un échec de reconstruction garde les contrôles bloqués avec un message générique ; les détails privés et messages du pilote ne sont pas publiés. La destruction retire les écouteurs pour éviter les allocations tardives.

Références primaires :
- https://registry.khronos.org/webgl/specs/latest/1.0/
- https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/
- https://threejs.org/docs/pages/WebGLRenderer
- Guide gamedev lu au commit épinglé dans docs/gamedev-sources.json : threejs-scene-setup.

## Tactile, focus et reprise

Une capture de pointeur refusée ne laisse plus d’origine de geste active. Les coordonnées non finies sont rejetées ; un événement de déplacement corrompu annule uniquement son geste. Les boutons secondaires ne démarrent pas de glissement. Les changements de taille/orientation invalident les deux origines, le mouvement et la transmission ; `pagehide` réutilise l’arrêt de focus. Les gestes des autres pointeurs restent protégés par leur identifiant.

Le message graphique passe avant la pause dans la navigation manette et le piège de focus clavier. La reprise est désactivée tant que le rendu n’est pas disponible. Le message distingue un incident technique d’une anomalie diégétique.

## Vérifications

Avant correction, les 29 contrôles tactiles existants passaient, les sept nouveaux échouaient. Après correction : 36/36. Quatre scénarios CPU de contexte s’ajoutent aux 62 contrôles de scène existants (66 au total) : gel immédiat, restauration sans changement de géométrie/pose, reconstruction échouée, destruction suivie d’un événement tardif. Sept tests exécutent les vrais callbacks Game et le choix du panneau manette.

`test:browser-runtime` sert le jeu réellement compilé, démarre Chromium avec SwiftShader logiciel, entre dans la référence par les vrais menus puis demande une perte et une restauration via WEBGL_lose_context. Il contrôle l’avertissement, le focus, le bouton de reprise, la sauvegarde inchangée, l’absence de demande de micro et d’exception navigateur. Il produit trois PNG et un rapport dans `outputs/browser-interruptions`. Le résultat doit être consulté sur la CI exacte ; la présence du script ne vaut pas exécution réussie. Aucun accès à la production, aucune permission micro, aucune donnée de salon n’est nécessaire.

La tentative locale Chromium est bloquée par `ERR_BLOCKED_BY_ADMINISTRATOR`. Aucun contournement de cette politique n’a été effectué. La compilation complète et le navigateur logiciel sont vérifiés séparément sur le runner CI. Les ressources verrouillées du projet ne sont pas mises à jour.

## Limites

SwiftShader ne représente pas une carte graphique physique. Les captures ne certifient ni FPS, énergie, thermiques, contraste de tous les effets, tous les miroirs ou pilotes. Les tests tactiles/manette sont simulés ; appareils physiques, écoute, TURN et coopération humaine restent ouverts. Les décors visités restent en mémoire selon la stratégie précédente. `hall_stretch` reste hors tirage.

Le classeur complémentaire `PARALLAXE_Suivi_Interruptions_2026-11-16.xlsx` conserve les huit onglets historiques hors synthèse cellule/formule par cellule/formule et ajoute le registre daté des 28 chantiers. Les 600 clés et 124 recettes historiques ne sont pas clôturées automatiquement.

## Correction du harnais navigateur

Le premier essai CI a réellement initialisé WebGL2 avec SwiftShader, puis le harnais a échoué en tentant de sérialiser un élément DOM React complet. Les conditions d’attente sont désormais converties en booléens dans la page avant transfert CDP. La recette exige aussi une sauvegarde solo de référence non nulle avant de comparer sa conservation ; deux valeurs nulles ne peuvent pas être prises pour une preuve. Une capture d’échec facilite la revue, sans modifier les contrôles du jeu.

## Reprise exacte du 17 novembre 2026

Le deuxième essai (43963401167, de30f8c) avait réussi les cinq contrôles de perte, restauration et reprise volontaire, puis la capture finale a dépassé le délai CDP uniforme de 15 secondes. Sa capture de diagnostic montre le décor revenu. Cela ne suffit pas à déclarer cette recette réussie.

Le délai des captures est maintenant borné à 60 secondes, sans relance automatique ; l’évaluation de page dispose aussi de 60 secondes pour laisser finir l’initialisation des shaders, les commandes de transport gardent 15 secondes. L'encodage PNG utilise optimizeForSpeed. Le rapport conserve navigateur, pilote logiciel, dimensions et durées de capture (qui ne sont pas des temps d'image). La recette exige de nouveaux appels de dessin WebGL après la reprise, les trois PNG complets et une nouvelle vérification de la sauvegarde, du contexte, des exceptions et des demandes de micro après la dernière capture. Aucun détail graphique ni résolution du jeu n'est réduit. Les résultats finaux sont ceux du commit exact, pas ceux des deux essais interrompus.

Références du protocole : https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot et https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate .

Le troisième essai (44009984069) a expiré pendant Runtime.evaluate au démarrage, avant les contrôles de la recette ; sa capture montre le menu correctement rendu. Le compteur de dessin ne fait plus d’interrogation du pilote à chaque appel ; l’état du contexte reste vérifié aux étapes explicites. Ces budgets sont spécifiques au rendu logiciel du runner, pas une promesse de performances du jeu.
