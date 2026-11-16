# Reprise des chantiers — 16 novembre 2026

Base source : a73add4b2cd56524f07f2034505deb44dbf8f5cf. Le commit de transport 46f0d60 n’avait pas appliqué le lot : la compilation s’arrêtait sur une accolade JSX manquante dans le clavier virtuel.

Cette reprise corrige le composant et ajoute un test des diagnostics de syntaxe de tous les nouveaux panneaux et de leur intégration Game. Le contrôle TypeScript complet reste obligatoire. Les tests de callbacks seuls n’étaient pas suffisants.

Le lot récupéré traite la navigation des menus à la manette avec retour au neutre, l’import/export confirmé des points de reprise solo, et une capture locale des temps d’images et des compteurs de rendu. Le registre de 28 lots et les 600 clés sont conservés. Le classeur nommé Chantiers du 12 novembre reste l’édition documentaire récupérée, pas un faux nouvel essai matériel daté du 12.

Les validations GPU, manette physique, audio, TURN inter-réseaux, coopération humaine et lanceur Windows restent ouvertes. Le compteur reste 119/120 ; hall_stretch demeure exclu. Les résultats de CI doivent être attachés au commit final exact. Cette reprise ne fusionne pas main et ne publie pas le jeu.

## Contrôles supplémentaires de cette reprise

La compilation complète a également détecté une assertion de type ambiguë entre les déclarations DOM navigateur et Worker pour SELECT. La vérification réelle du tag est conservée avant l’assertion explicite ; une régression exerce le choix d’option, les bornes, les options désactivées et l’événement change.

Trois régressions nouvelles reproduisaient des défauts d’import avant correction : mode/difficulté sous forme de tableau converti en chaîne, propriétés héritées de Object acceptées comme identifiants et dépassement de 64 Kio en caractères UTF-8 multioctets. Les comparaisons sont désormais strictes, les découvertes doivent être des propriétés propres du catalogue et le plafond est contrôlé en octets. Les anciens fichiers valides restent compatibles. Aucune autorisation vocale ni session coopérative n’est importée.
