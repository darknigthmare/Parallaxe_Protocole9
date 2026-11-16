# Reprise des chantiers — manette, sauvegardes, mesures

## Révision et périmètre
Base exacte : `a73add4b2cd56524f07f2034505deb44dbf8f5cf`, branche `continuation/observations-20261110`, PR #5. Ce document accompagne les sources du lot ; seule la CI du SHA final prouve sa compilation complète. Les résultats locaux et les essais physiques restent distincts.

Catalogue inchangé : **119/120** ; `hall_stretch` reste exclu avant sa recette de confort humain. Cinq lieux, campagne à trois secteurs, 600 clés de suivi, 28 lots et 124 recettes QA historiques ouvertes. Ni fusion main, ni publication. Aucun changement de dépendance/lock, du catalogue ou des textes A/B d’origine.

## W17 — menus à la manette
Les menus s’utilisent avec une manette exposée par le navigateur avec `mapping: standard` : croix/stick gauche pour parcourir, A/× pour activer, B/○ ou Menu pour revenir, gauche/droite pour ajuster un curseur ou une liste. Le premier pad connecté compatible est choisi même s’il n’est pas dans le slot zéro. Les pads non standard sont ignorés plutôt que de deviner leurs boutons. Si plusieurs pads sont connectés, le premier compatible conserve la priorité.

Le focus est visible et limité au panneau courant (clavier virtuel, dialogue, écran d’erreur, résultat ou accueil). Les éléments invisibles/désactivés sont exclus. La navigation suit l’ordre des contrôles, pas leur position géométrique. La répétition directionnelle démarre après 420 ms puis 130 ms, sans rafale au retour d’une interruption. Les confirmations ne se répètent pas.

Un champ de texte ouvre un clavier virtuel original : lettres, chiffres, accents et ponctuation, changement de casse et effacement. Valider ne fait que remplir le champ ; un message n’est envoyé qu’avec son bouton d’envoi. Annuler ne modifie pas la valeur. Changer d’écran invalide le brouillon. Les raccourcis de jeu ne sont jamais simulés par ce clavier.

L’attachement, le changement d’écran, la perte de focus ou la reconnexion nécessitent un retour au neutre. La garde du jeu est remise à zéro dès l’événement, même si aucun frame n’observe la déconnexion. La garde indépendante LB/PTT et le ticket de session sont conservés. Les commandes souris/clavier/tactile ne sont pas remplacées.

**À réceptionner :** vrai pad XInput/PlayStation, navigateurs et dispositifs d’assistance. Un clic programmatique provenant d’une manette peut ne pas autoriser les boîtes système (fichier, microphone, plein écran) : effectuer alors un clic ou une touche physique. Ce lot ne remappe pas les boutons du pad, ne traduit pas toutes les dispositions clavier et ne certifie pas un parcours système sans souris. Le bouton PTT n’est pas transformé en bascule microphone par un simple clic de menu.

## W16 — sauvegarde transférable sans solution cachée
Paramètres → Sauvegarde solo et découvertes. Exporter produit un petit JSON portable contenant mode, lieu, palier, série, erreurs, total correct et découvertes. Ni graine, anomalie active, observateurs, nom, jeton de salon, ni autorisation vocale ne sont exportés. La reprise est une **nouvelle référence** avec une nouvelle graine ; le consentement nominatif reste désactivé. Une progression terminée exporte seulement les découvertes.

Importer depuis l’accueil affiche un aperçu puis une confirmation explicite ; lire un fichier ne remplace rien. Maximum 64 Ko, format/version explicites, liste de champs fermée, nombres entiers bornés, cohérence campagne/lieu unique et IDs du catalogue contrôlés. Une lecture lente ne peut pas remplacer le dernier fichier choisi ou intervenir après lancement d’une inspection.

L’import conserve les découvertes existantes et ajoute celles du fichier. Avant remplacement, l’ancienne progression brute et ses archives sont copiées localement sous `parallaxe-before-import`. Cette copie n’est pas exportée. Si elle ne peut pas être écrite, l’import n’a pas lieu. Une écriture partielle déclenche la restauration des deux anciennes clés ; une restauration elle-même refusée est annoncée comme incomplète, jamais comme réussie. « Récupérer la copie précédente » propose à nouveau un aperçu et une confirmation.

**Limites :** localStorage n’est pas une base transactionnelle ; fermeture brutale, quotas et règles de confidentialité de chaque navigateur restent à tester. Pas de cloud, de transfert de session coop ou de garantie anti-triche pour les fichiers solo. Les données locales importées ne constituent pas une preuve serveur.

## W12 — mesure technique locale, pas benchmark inventé
Préparer 30 secondes, 60 secondes ou 30 minutes **actives** depuis les paramètres d’une référence solo, puis fermer le panneau. Le capteur exige aussi que la scène elle-même soit dans sa référence propre. Une inspection et une partie réseau sont exclues ; on ne peut pas utiliser les nombres de triangles pour déduire une anomalie cachée.

Le rapport indique les intervalles réels entre images (moyenne, médiane et p95 par histogrammes de 1 ms, maximum), la durée CPU de `scene.update` incluant la soumission graphique, les appels et triangles dessinés, les compteurs de géométries/textures et la résolution/qualité. Le reset de `renderer.info` est fait une fois par image extérieure : les captures de reflets s’y additionnent. Ces compteurs sont lus sans parcourir les objets de la scène à chaque image.

Les grandes pauses visibles ne sont pas supprimées. Les menus, onglets masqués et pertes de focus sont exclus, avec remise à zéro de la référence temporelle même s’il n’y a pas eu de frame pendant la pause. Un changement de lieu/passage, résolution ou qualité arrête la série au lieu de mélanger les conditions. Les histogrammes utilisent une mémoire bornée pour la capture longue ; un test accéléré de 180 000 échantillons **n’est pas** un test thermique matériel de 30 minutes.

Les rapports ne sont transmis nulle part. Ils n’incluent aucun nom, pseudonyme, secret, seed, indice, localisation réseau ou identification GPU. Le lieu n’est pas exporté : noter séparément quel parcours de référence a été mesuré. Mesurer un même parcours après échauffement et ne changer qu’un paramètre à la fois.

**Limites :** temps CPU de scène ≠ temps CPU total de l’interface ≠ temps GPU. Les compteurs mémoire sont des nombres de ressources, pas des octets VRAM. Consommation, coût GPU, latence réelle et FPS cible exigent une recette matérielle. Aucun gain de performances n’est annoncé par l’ajout du capteur.

## Contrôles et portée
- `npm run test:workstreams` : garde pad, navigation DOM et commandes natives, format portable/rollback, capteur borné, véritables callbacks des panneaux de sauvegarde et mesure avec hooks/DOM contrôlés.
- `npm test` et `npm run test:radio-ui` : anciennes protections réseau/PTT conservées ; les harnais reçoivent les nouvelles gardes nécessaires, sans supprimer les assertions historiques.
- `npm run test:scene` : vrai Three.js pour géométries/rayons/matrices, renderer explicitement simulé ; compteur par image et admissibilité référence testés.
- Toutes les suites permanentes, TypeScript complet, deux builds et lancement du ZIP extrait à exécuter sur la CI finale avant d’annoncer la livraison complète.
- `python3 scripts/validate-open-workbook.py` : rapprochement du XLSX avec les 600 lignes, les 120 A/B et les 28 lots. Les archives précédentes restent intactes.

Localement, les tests nommés ont passé avec Node 22.16.0, Three.js 0.186.1 et TypeScript 5.9.3 extraits de l’artefact précédent. L’accès réseau npm étant indisponible, **aucun npm ci ou build complet local réussi n’est revendiqué**. La validation d’interface exécute des callbacks avec une frontière hooks/DOM contrôlée ; ce n’est pas une certification React réelle, pixels WebGL, ergonomie ou matériel. Le résultat final exact de CI est consigné dans la PR après exécution.

## Revue complète du reste
`CHANTIERS_20261112.md`, son CSV et `chantiers-20261112.json` décrivent les 28 lots et leur prochaine preuve. W12, W16 et W17 gagnent du code ; W23/W24 gagnent des contrôles et des états rapprochés du code. Les autres lots gardent leur recette ou production explicitement ouverte. Les cinq lignes de production P28/P44/P49/P51/P52 sont actualisées sans modifier les anciennes formulations archivées.

## Sources techniques consultées
- Gamepad, mapping standard : https://w3c.github.io/gamepad/
- Gamepad mapping : https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/mapping
- WebGLRenderer.info : https://threejs.org/docs/pages/WebGLRenderer.html
- requestAnimationFrame : https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- performance.now : https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
- Guides épinglés `input-systems` et `performance-optimization` du commit `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9` de gamedev-skills/awesome-gamedev-agent-skills ; cinq skills locaux de Parallaxe lus et inchangés.
