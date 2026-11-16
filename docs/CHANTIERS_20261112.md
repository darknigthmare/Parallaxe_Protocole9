# Revue des 28 chantiers — 12 novembre 2026

Base : `a73add4`. Les trois lots fonctionnels de cette reprise sont **W12 (mesures), W16 (sauvegardes) et W17 (manette)**. W23/W24 bénéficient du rapprochement des états et de la réduction des données exportées. Tous les lots restent ouverts jusqu’à leur critère propre ; une revue n’est pas une implémentation.

| Lot | Domaine | Situation | Prochaine recette / production |
|---|---|---|---|
| W01 | Radio / PTT | Matériel audio | Deux puis quatre personnes, casques/micros ; capture des états sans voix enregistrées. |
| W02 | Réseau / TURN | Service et réseaux | Deux réseaux NAT distincts et serveur TURN configuré avec autorisation ; logs ICE expurgés. |
| W03 | GPU / reflets | Rendu GPU | Références/effets des dix surfaces réfléchissantes sur les cinq lieux et profils de qualité. |
| W04 | Coop / vérité serveur | Coopération humaine | Unanimité/désaccord, timeout et succession avec joueurs réels ; conserver les gardes serveur. |
| W05 | Parcours campagne | Parcours humain | Finir les neuf validations de campagne avec 2–4 joueurs sans saut de secteur. |
| W06 | Chalet | Parcours humain | Rejouer le Chalet à neuf validations sur la même livraison ; distinguer protocole HTTP et joueurs. |
| W07 | Équité des anomalies | Lisibilité et équité | Réception visuelle/sonore des 119 cas avec comparaison normale/A/B/reset par lieu réel. |
| W08 | 1 anomalie restant à intégrer | Production conditionnée | Respecter la recette de confort de hall_stretch ; rester à 119/120 en attendant. |
| W09 | Corps / avatar | Assets et performances | Rig final/animations/LOD à produire ; réception croisée et miroir du corps actuel. |
| W10 | Radio / anomalies | Audio humain | Comparer les 12 profils et relevés en silence puis au casque ; aucune panne technique comme preuve. |
| W11 | Comportement tactile | Mobile physique | Portrait/paysage, gestes simultanés, interruption et surface tactile réelle. |
| W12 | Performance | Instrumentation livrée | Relever les cinq références sur mêmes appareils ; mesurer ensuite GPU/énergie avec outils externes. |
| W13 | Effets entre tours | Couverture exhaustive | Table par ID des resets CPU existants puis passages joués/reload sur les cinq lieux. |
| W14 | Accessibilité | Accessibilité humaine | Recevoir remappage, FOV, taille 150 %, mode silencieux et les nouveaux menus au pad. |
| W15 | Direction artistique | Art et rendu | Raffiner matériaux/textures/éclairage avec comparaisons GPU et préserver la lisibilité des indices. |
| W16 | Sauvegardes | Import/export livré | Navigateur réel, quotas, fichiers hors format, récupération après fermeture brutale ; pas de cloud ajouté. |
| W17 | Menu / manette | Menus pad livrés | Parcours de bout en bout sur pad standard réel ; tester focus, clavier virtuel, réglages et reprise. |
| W18 | Validation réseau client | Réseau physique | Rejouer réponses tardives, perte/reprise et transitions simultanées sur plusieurs navigateurs. |
| W19 | Équilibrage | Playtest et métriques | Collecter un échantillon volontaire anonymisé ; ne pas modifier les probabilités sans données. |
| W20 | Niveaux futurs | Extensions partielles | Recevoir O9 déjà intégré ; archives/dénouements et autres annexes restent de la production. |
| W21 | Hébergement / invités | Compte/hébergement | Parcours invité réel sur hébergement configuré ; aucune publication automatique dans ce lot. |
| W22 | Distribution | Distribution Windows | Installateur/machine propre Windows et dépendance Node ; les ZIP Linux testés ne valent pas cette réception. |
| W23 | Traçabilité Excel | Traçabilité continue | Relecture humaine du registre rapproché du code ; vérifier les preuves de la dernière révision. |
| W24 | Sûreté et données | Audit de données | Nouvel export sur liste blanche ; poursuivre revue des logs/permissions, sans secret dans les preuves. |
| W25 | Collisions / lisibilité | Caméra et terrain | Contrôles humains des passages des cinq lieux au pad/souris/tactile ; tests géométrie maintenus. |
| W26 | Narration / diégèse | Écriture diégétique | Compléter notes/conséquences/débriefs et revue de localisation, sans indices hors contexte. |
| W27 | Cross-perspective | Captures synchronisées | Deux à quatre vues normales/affectées simultanées ; le profiler reste hors inspection pour ne pas aider le verdict. |
| W28 | Actualisation classeurs | Éditions historiques | Le classeur courant est régénéré ; rééditions du maître/des suivis historiques restent à traiter sans écrasement. |

Le CSV et le JSON reprennent les mêmes 28 identifiants. Le registre Excel garde ses 600 clés et les 120 fiches originales ; seul `hall_stretch` reste absent du catalogue. Les autres travaux ne sont pas effacés au profit de ce compteur.
