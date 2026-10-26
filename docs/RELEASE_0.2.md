# PARALLAXE — Protocole 9 · édition 0.2

26 octobre 2026. Extension du jeu original, de ses outils de conception et de son édition autonome.

## Les changements de cette édition

Les inspecteurs communiquent avec des talkies : activation explicite du microphone, touche maintenue pour émettre, voix en direct, filtrage radio et interférences propres à chaque perception. Un test local de calibration et son relevé écrit restent utilisables sans microphone et en mode silencieux. Une erreur technique de la liaison n’est jamais considérée comme une preuve d’anomalie.

Les corps des inspecteurs sont articulés et équipés. Le joueur peut voir son propre corps, ses coéquipiers et leurs reflets. La tenue, les gestes du talkie et les reflets servent aussi de supports à de nouvelles anomalies.

Trois lieux composent la traversée : l’hôtel Saint-Clair, le métro Terminus 09 et la clinique Aile blanche. Chaque lieu possède sa propre référence. La campagne demande trois validations dans chaque secteur ; une erreur efface uniquement les validations du secteur en cours. Le mode « Lieu au choix » conserve les neuf validations consécutives dans un seul décor.

Le classeur de conception accompagne le code dans `docs/PARALLAXE_Design_Complet.xlsx`. Il distingue les anomalies effectivement implémentées, les vérifications exécutées, les validations sur matériel à réaliser et les extensions conçues pour la suite.

## Compatibilité

- Les sauvegardes solo de l’édition 0.1 sont reprises comme inspections autonomes de l’hôtel.
- La voix nécessite l’autorisation du navigateur et un contexte sécurisé : HTTPS ou localhost. Une adresse IP locale en HTTP permet le jeu et le chat écrit, mais ne donne pas accès au microphone.
- Les réseaux Internet qui bloquent les connexions directes nécessitent un relais TURN configuré par l’hébergeur. La configuration est décrite dans la documentation radio ; aucun identifiant de service n’est intégré au dépôt.
- L’édition portable précompilée fonctionne avec Node.js 22.13 ou ultérieur. Ses dépendances client sont déjà compilées.

## Vérification

Le bilan détaillé, les commandes et les limites sont dans [QA.md](QA.md). Les contrôles de géométrie et les tests réseau ne constituent pas une validation visuelle sur GPU ni un essai de microphones physiques. Les éléments restant à vérifier ne sont pas marqués comme validés dans le classeur.

