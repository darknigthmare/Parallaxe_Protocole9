# Hébergement public Vercel

Cette cible ajoute l’hébergement public du jeu 0.4.1 aux cibles Cloudflare D1
et PC/LAN existantes. Base : `a1774830149d485af800133f688e94b208940883`.
Elle réutilise l’interface indépendante, les scènes, les règles et les lectures
privées de cette révision. Aucun contenu ni moteur n’est remplacé.

## Architecture

`npm run build:vercel` compile l’interface Vite dans `standalone-dist`.
`api/session.ts` adapte les requêtes HTTP Vercel au contrat existant
`GET/POST /api/session`. `src/vercel/session-handler.ts` conserve les décisions,
les projections `projectRoom()`, l’authentification individuelle, les signaux
radio et les réessais CAS des handlers D1. Le domaine `src/game/session.ts`
reste l’autorité commune, sans modification.

Les salles sont conservées dans un schéma Postgres privé de Supabase. Chaque
mutation vérifie atomiquement la révision attendue. Un conflit relit la salle
et réévalue l’intention originale, avec son `decisionEpoch` original. Il ne
transforme pas une ancienne décision en nouvelle décision. La durée de vie est
de douze heures après la dernière écriture ; les lectures et les CAS refusent
les salles expirées. Une création nettoie au plus 25 salles expirées.

Le runtime appelle seulement trois RPC REST :

| Fonction | Paramètres en plus de `p_store_token` | Résultat |
| --- | --- | --- |
| `parallaxe_web_read` | `p_code` | ligne `{code,version,data,updated_at,expires_at}` ou `null` |
| `parallaxe_web_insert` | `p_code,p_version,p_data,p_updated_at,p_expires_at` | booléen |
| `parallaxe_web_cas` | les mêmes, plus `p_expected_version` | booléen |

`data` reste le texte JSON du `StoredRoom` existant. Les dates sont des entiers
en millisecondes. Le CAS exige `p_version = p_expected_version + 1` et une salle
encore valide selon l’horloge de la base. Le SQL de référence est
[vercel-session-store.sql](vercel-session-store.sql). Il se provisionne une fois
par l’administrateur, avec un jeton aléatoire de 256 bits dont seule l’empreinte
SHA-256 est stockée dans `runtime_credentials`. Aucun jeton n’est suivi dans Git.

Le schéma et ses tables n’accordent aucun accès à `anon` ou `authenticated` ;
RLS est activé. Les RPC `SECURITY DEFINER` ont un `search_path` vide et vérifient
le jeton serveur avant tout accès. Les droits d’exécution publics implicites
sont révoqués ; seuls ces trois points d’entrée sont accordés au rôle `anon`.
La clé publique Supabase seule ne donne aucun accès aux salles.

## Configuration

Projet : `parallaxe-protocole-9`, équipe `darknigthmares-projects`.
Vercel : framework Vite, Node 24, installation `npm ci`, commande
`npm run build:vercel`, sortie `standalone-dist`. La fonction a une durée maximale
de 30 secondes et les réponses de session portent `Cache-Control: no-store, private`.

Variables **serveur uniquement**, chiffrées dans Vercel :

- `SUPABASE_URL` : origine HTTPS de Supabase ;
- `SUPABASE_PUBLISHABLE_KEY` : clé publique API (ou `SUPABASE_ANON_KEY` historique) ;
- `PARALLAXE_STORE_TOKEN` : jeton hexadécimal aléatoire de 64 caractères.

Aucune de ces valeurs ne porte de préfixe `VITE_` ou `NEXT_PUBLIC_`, et aucune
n’est renvoyée au navigateur. Aucune clé `service_role` n’est requise.
Le navigateur utilise uniquement les jetons individuels de sa salle.
Une configuration manquante échoue en 503 ; elle ne bascule pas vers une
mémoire locale éphémère. Les erreurs du fournisseur restent côté serveur,
sans inclure ses réponses ni les identifiants dans les journaux.

Les variables radio facultatives existantes restent `PARALLAXE_STUN_URLS`,
`PARALLAXE_TURN_URLS` et `PARALLAXE_TURN_SECRET`. La signalisation passe par la
même salle persistante. Le son utilise le WebRTC existant et ne transite pas
dans la base. Aucun relais TURN payant n’est créé par cette cible.

## Vérification

Contrôles locaux du 13 novembre 2026 : `npm run typecheck`, `npm test`,
`npm run test:vercel`, `npm run build:vercel`, `npm run build`,
`npm run test:radio-config` et `npm run test:portable` réussis. Le test Vercel exécute
le vrai adaptateur HTTP avec quatre clients, neuf tours de consensus,
les références des trois lieux, les projections privées et la signalisation
radio. Le service REST y est un **double CAS**, incluant une écriture concurrente
intercalée et une nouvelle instance de stockage ; ce contrôle ne prouve pas à
lui seul la persistance Supabase réelle ni le rendu GPU public.

Après publication, exécuter `PARALLAXE_TEST_URL=<origine autorisée> npm run
test:network` contre le service réel puis jouer avec deux clients navigateur
indépendants. Les preuves publiques doivent indiquer le SHA effectivement
déployé, l’identifiant du déploiement et les vérifications observées. Les
captures et rapports historiques 0.4.1 ne sont pas réétiquetés comme preuves
du nouveau backend. Les microphones physiques, l’intelligibilité et les
réseaux nécessitant TURN demandent toujours leurs essais séparés.

Les consignes de [GAMEDEV_GUIDANCE.md](GAMEDEV_GUIDANCE.md),
[RADIO.md](RADIO.md) et les contrats du domaine guident cette cible. Le catalogue
de fiches référencé par le dépôt ne possède pas de guide propre à notre backend
HTTP/WebRTC : aucune API Godot ou migration de moteur n’est introduite.
