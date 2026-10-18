# TRD — Zelaté

> **Technical Requirements Document** · version 0.2 · 16/10/2026 · statut : à valider avant le lot DEV-0
> v0.2 : décisions de l'atelier du 16/10 (PRD §11) — espace coiffeur sur le téléphone du coiffeur avec compte personnel (ADR-007), tablettes au lot 2, arrivée par code sans lecture de QR, compteur de 10 min, fin de journée, distribution au premier coiffeur libre (ADR-015).
> Documents liés : [PRD](./PRD.md) · [APP_FLOW](./APP_FLOW.md) · [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) · [BACKEND_SCHEMA](./BACKEND_SCHEMA.md) · [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)

Ce document fixe **toutes les décisions techniques** pour qu'aucune ne soit devinée pendant le développement. Une décision absente d'ici se pose comme question avant d'être codée, puis s'ajoute dans la section 5 (ADR).

**Légende des statuts** : ✅ décidé · 🟡 proposé, à confirmer au lot indiqué · 🔬 à trancher par un essai technique (section 14).

---

## 1. Principes

1. **Une seule source de vérité pour les règles de file** : le module `queue-engine`, en TypeScript pur, testé exhaustivement. Aucune règle de file n'est réécrite ailleurs (ni en SQL, ni dans l'interface).
2. **Le serveur écrit, le client lit.** Les tickets, la file et les présences ne sont modifiés que par des fonctions serveur. Le navigateur n'écrit jamais directement dans ces tables.
3. **La base protège les données**, pas l'interface : chaque droit est appliqué par Row Level Security (RLS).
4. **Pas de donnée personnelle dans le temps réel** : les canaux diffusent « quelque chose a changé », l'interface relit ses données avec ses droits.
5. **Code en anglais**, textes affichés en français dans le dictionnaire.
6. **Sobriété** : pas de dépendance sans besoin démontré, budgets de poids par page (RGESN).

---

## 2. Vue d'ensemble

```
                ┌──────────────────────┐     ┌───────────────────────────────┐
                │  apps/client (PWA)   │     │  apps/pro (PWA)               │
                │  « Zelaté »          │     │  « Zelaté Pro »               │
                │  smartphone          │     │  /stylist /dashboard  /admin  │
                └──────────┬───────────┘     └──────────────┬────────────────┘
                           │  lectures : supabase-js (RLS) + RPC de lecture
                           │  écritures : Edge Function queue-command
                           │  temps réel : canaux Broadcast privés
                ┌──────────▼──────────────────────────────────▼────────────────┐
                │                Supabase (région UE)                          │
                │  Auth (OTP SMS, e-mail)   Postgres + PostGIS + RLS           │
                │  Realtime (Broadcast)     Storage (photos, PDF QR)           │
                │  Edge Functions (Deno) ── packages/queue-engine (TS pur)     │
                │  pg_cron ── queue-tick chaque minute, tâches quotidiennes    │
                └──────────┬──────────────────────────┬────────────────────────┘
                           │ outbox notifications     │ appels sortants
                ┌──────────▼──────────┐   ┌───────────▼───────────────────────────┐
                │ Web Push (VAPID)    │   │ Géoplateforme (adresses), Recherche   │
                │ SMS (fournisseur 🔬)│   │ d'entreprises (SIRET), tuiles carte 🔬 │
                │ E-mail transactionnel│  └───────────────────────────────────────┘
                └─────────────────────┘
```

**Flux d'une action** : l'espace coiffeur envoie la commande `call_ticket` à `queue-command` → la fonction verrouille la file du salon, applique la règle du moteur, écrit tickets, événements et notifications en une transaction → après validation, elle diffuse `queue_updated` sur le canal du salon et `ticket_updated` sur celui de chaque ticket touché → chaque écran relit ce qui le concerne. L'outbox des notifications est traitée par `send-notifications`.

---

## 3. Stack

| Couche | Choix | Statut | Rôle et remarques |
| --- | --- | --- | --- |
| Langage | TypeScript, mode `strict` + `noUncheckedIndexedAccess` | ✅ | Partout, y compris Edge Functions |
| Interface | React 19 | ✅ | Reprise du prototype |
| Build | Vite (dernière version stable) | ✅ | Prototype déjà sous Vite ; plugins Figma Make retirés |
| CSS | **Tailwind CSS v4** (configuration CSS-first, `@theme`) | ✅ | Jetons dans `packages/ui/src/theme.css` (voir DESIGN_SYSTEM) |
| Composants accessibles | Radix UI Primitives, stylés en Tailwind (approche shadcn/ui, code copié dans `packages/ui`) | 🟡 DEV-0 | Dialogues, menus, onglets, toasts accessibles sans les réécrire |
| Icônes | lucide-react (import par icône) | ✅ | Voir DESIGN_SYSTEM §6 |
| Routage | React Router v7, mode données (`createBrowserRouter`) | ✅ | Chargement paresseux par espace |
| Données serveur | TanStack Query v5 | ✅ | Cache, invalidation sur événement temps réel, repli par intervalle |
| Formulaires | react-hook-form + zod | ✅ | Schémas zod partagés avec les Edge Functions (`packages/contracts`) |
| Dictionnaire | i18next + react-i18next, ressources typées | ✅ | Une seule langue (`fr`) chargée ; espaces de noms par fichier |
| Dates | date-fns + date-fns-tz | ✅ | Stockage UTC, affichage `Europe/Paris` |
| Téléphone | libphonenumber-js (métadonnées « min ») | ✅ | Validation +33, format E.164 |
| PWA | vite-plugin-pwa (Workbox, stratégie `injectManifest`) | ✅ | Un service worker par app, gestion du push |
| Carte | MapLibre GL JS | ✅ | Chargé seulement à l'ouverture de la carte |
| Tuiles de carte | OpenFreeMap ou MapTiler | 🔬 | Pas les serveurs de tuiles d'openstreetmap.org en production (politique d'usage) |
| QR code | `qrcode` (génération du QR de l'affiche et de son PDF) | ✅ | Aucune lecture de QR dans l'app : l'arrivée se valide par le code du ticket (H7), donc pas de caméra |
| Backend | **Supabase, région UE** : Postgres, Auth, Realtime, Storage, Edge Functions, pg_cron | ✅ | Décision du 13/10 |
| Extensions Postgres | PostGIS, pg_cron, pg_net, pgcrypto | ✅ | Recherche par rayon, tâches planifiées, appels HTTP |
| Edge Functions | Deno (runtime Supabase), client Postgres direct pour les transactions | ✅ | Voir ADR-003 |
| Push | Web Push avec clés VAPID, bibliothèque `web-push` côté Edge Function | ✅ | iOS : seulement si la PWA est installée (16.4+) |
| SMS | Fournisseur français ou européen : Brevo, OVHcloud ou Twilio | 🔬 | Derrière une interface `SmsProvider` ; aussi branché sur Auth via le *Send SMS Hook* |
| E-mail | Brevo (transactionnel) | 🟡 DEV-3 | Invitations, validation salon, récapitulatif |
| Adresses | API de géocodage de la Géoplateforme (IGN), qui remplace l'API Adresse | ✅ | `https://data.geopf.fr/geocodage/search` |
| SIRET | API Recherche d'entreprises (data.gouv.fr) | ✅ | `https://recherche-entreprises.api.gouv.fr/search` ; champs exacts à confirmer à l'essai |
| Hébergement front | Vercel (sites statiques, préversion par pull request) | 🟡 DEV-0 | Netlify en alternative |
| Erreurs | Sentry, région UE | 🟡 DEV-0 | Sans donnée personnelle dans les événements |
| Audience | Plausible ou Matomo, sans cookie | 🟡 DEV-11 | Pas de bandeau de consentement nécessaire pour cette mesure |
| Gestionnaire de paquets | pnpm (workspaces) | ✅ | Node LTS |
| Tests | Vitest, Testing Library, Playwright, pgTAP (`supabase test db`), axe-core, Lighthouse CI | ✅ | Section 10 |
| Qualité | ESLint (typescript-eslint, jsx-a11y, i18next/no-literal-string), Prettier, Husky + lint-staged, commitlint | ✅ | Section 10 |
| CI | GitHub Actions | ✅ | Bloque la fusion si un contrôle échoue |
| Paiement (V1) | Stripe | Hors MVP | — |

**Ce qu'on n'utilise pas, et pourquoi** : pas de Redux ni Zustand (TanStack Query + état local suffisent) ; pas de Next.js (pas de besoin SEO au MVP) ; pas de Google Maps ni Google Fonts (coût, RGPD) ; pas de GPS en arrière-plan ni de Bluetooth (impossibles en PWA) ; pas de WebSocket maison (Supabase Realtime).

---

## 4. Structure du dépôt

```
zelate/
├─ apps/
│  ├─ client/                 # PWA « Zelaté » (smartphone)
│  │  ├─ src/
│  │  │  ├─ routes/           # un dossier par écran (voir APP_FLOW)
│  │  │  ├─ features/         # salon-search, join-queue, ticket-tracking, auth-otp…
│  │  │  ├─ sw.ts             # service worker (push, cache)
│  │  │  └─ main.tsx
│  │  └─ vite.config.ts
│  └─ pro/                    # PWA « Zelaté Pro » (espace coiffeur, dashboard, admin)
│     └─ src/routes/{stylist,dashboard,admin,auth}/
├─ packages/
│  ├─ queue-engine/           # moteur de file, TypeScript pur, aucune dépendance
│  ├─ contracts/              # schémas zod des commandes et réponses, types partagés
│  ├─ db-types/               # types générés : supabase gen types typescript
│  ├─ ui/                     # composants, jetons Tailwind (theme.css), icônes
│  ├─ i18n/                   # fr/*.json, configuration i18next, types des clés
│  └─ config/                 # eslint, tsconfig, prettier partagés
├─ supabase/
│  ├─ migrations/             # SQL versionné, une migration par changement
│  ├─ functions/              # Edge Functions (Deno) ; _shared/ importe queue-engine et contracts
│  ├─ tests/                  # pgTAP : RLS, contraintes, fonctions
│  └─ seed.sql                # données de démonstration (salons fictifs)
├─ e2e/                       # Playwright multi-rôles
├─ docs/                      # ces documents + adr/
├─ .claude/                   # skills et agents (voir IMPLEMENTATION_PLAN)
├─ CLAUDE.md
└─ .github/workflows/
```

**Règles de dépendance** (vérifiées par ESLint) : `queue-engine` n'importe rien ; `contracts` n'importe que zod ; les apps n'importent jamais `supabase/functions` ; une app n'importe jamais l'autre.

---

## 5. Décisions d'architecture (ADR)

Chaque ADR a son fichier dans `docs/adr/NNN-titre.md` au lot DEV-0 ; voici leur résumé.

| N° | Décision | Statut | Raison | Conséquence |
| --- | --- | --- | --- | --- |
| 001 | Backend **Supabase en région UE** | ✅ 13/10 | Temps réel, auth SMS, RLS et fonctions intégrés ; peu d'exploitation | Dépendance à un fournisseur ; schéma SQL standard, migrable |
| 002 | **Monorepo, deux apps PWA** (`client`, `pro`) partageant des paquets | ✅ | Deux manifestes, deux icônes, deux périmètres de cache ; code commun partagé | Deux déploiements, deux sous-domaines (ex. `zelate.fr`, `pro.zelate.fr`) |
| 003 | **Toutes les écritures de file passent par l'Edge Function `queue-command`**, qui exécute le moteur TS dans une transaction Postgres, sous **verrou par salon** (`pg_advisory_xact_lock`) | ✅ | Une seule implémentation des règles ; aucune course entre deux coiffeurs ou un double clic | Les tables de file ne sont pas modifiables par le client ; latence d'un aller-retour serveur |
| 004 | **Idempotence** : chaque commande porte un `command_id` (UUID créé par l'interface) ; une commande déjà traitée renvoie le même résultat | ✅ | Double clic, réseau instable, nouvel essai automatique | Table `private.processed_commands` |
| 005 | **Identification client par code SMS** via Supabase Auth (`signInWithOtp` sur le téléphone), SMS envoyé par le *Send SMS Hook* vers notre fournisseur | ✅ | Pas de mot de passe ; un numéro = un compte | Un client « invité » a quand même un compte Auth, sans e-mail ni profil complété (`profiles.is_guest = true`) |
| 006 | **Lien de suivi par jeton** : chaque ticket a un `tracking_token` aléatoire (32 octets) ; `/t/:token` affiche le ticket sans session et permet de l'annuler | ✅ | Clients inscrits à l'accueil ou sans session sur l'appareil | Le jeton est un secret : jamais journalisé, jamais dans une URL partagée par l'app hors SMS |
| 007 | **Lot 1 : chaque coiffeur utilise Zelaté Pro sur son propre téléphone, avec son compte personnel** (invitation par e-mail, connexion par lien magique, session de 30 jours révocable par le gérant). **Aucune donnée client n'est stockée sur l'appareil** : cache TanStack Query en mémoire seulement, aucune persistance locale des données, service worker limité aux fichiers statiques. Lot 2 : tablette partagée appairée par le gérant et déverrouillée par PIN (annexe A) | ✅ 16/10 | Décision de l'atelier (Q18) ; pas de matériel à fournir au pilote | Chaque commande est attribuée au compte connecté ; écran coiffeur conçu d'abord pour téléphone ; l'appairage et le PIN sont reportés au lot 2 |
| 008 | **Notifications par outbox** : les commandes insèrent des lignes `notifications` (statut `pending`) dans la transaction ; `send-notifications` les envoie | ✅ | Pas de notification envoyée pour une transaction annulée ; nouvel essai possible | Délai de l'ordre de la seconde ; plafond SMS appliqué à l'envoi |
| 009 | **Temps réel par invalidation** : canaux Broadcast privés `salon:{id}` et `ticket:{id}`, messages sans donnée personnelle ; l'interface relit via TanStack Query | ✅ | Aucune fuite par le temps réel ; droits appliqués à la relecture | Une requête de plus par événement, acceptable au volume du pilote |
| 010 | **Temps** : `timestamptz` en UTC en base, affichage en `Europe/Paris` ; la « journée de service » d'un ticket est une `date` calculée en heure de Paris | ✅ | Changement d'heure, fermeture à minuit | Toute comparaison d'horaires passe par une fonction utilitaire unique |
| 011 | **Téléphone hors des tables lues par les salons** : celui du client connecté reste dans `auth.users` ; celui d'un walk-in est dans `private.ticket_contacts`, inaccessible par l'API | ✅ | Décision d'Ely (H6) | Les SMS partent uniquement des Edge Functions |
| 012 | **Recherche de proximité avec PostGIS** (`geography`, index GIST, `ST_DWithin`) | ✅ | Rayon de 5 km, tri par distance | Extension PostGIS activée |
| 013 | **Pas de stockage de position GPS** du client ; la position sert seulement à la requête de recherche | ✅ | Minimisation RGPD | La recherche se fait par RPC avec latitude et longitude en paramètres |
| 014 | **Dictionnaire de textes** en fichiers JSON par typologie, clés en anglais typées | ✅ 14/10 | Décision du 14/10 | Voir section 9 |
| 015 | **Distribution au moment de l'appel** : un ticket sans préférence n'a pas de coiffeur fixé avant d'être appelé ; le moteur calcule un `estimated_member_id` (coiffeur pressenti) pour l'estimation, et fixe `assigned_member_id` à l'appel | ✅ 16/10 | Décision H1 : le premier coiffeur libre prend le client ; aucune réassignation à gérer avant l'appel | La file d'un coiffeur se calcule à la lecture (tickets qui le demandent + tickets sans préférence éligibles) |

---

## 6. API et contrats

### 6.1 Edge Functions (écriture et intégrations)

Toutes valident leur entrée avec le schéma zod de `packages/contracts`, renvoient `{ ok: true, data }` ou `{ ok: false, error: { code, messageKey } }` (`messageKey` = clé du dictionnaire `errors`), et ne journalisent jamais de téléphone ni de jeton.

| Fonction | Méthode | Appelée par | Rôle |
| --- | --- | --- | --- |
| `queue-command` | POST | Client, espace coiffeur, dashboard | Toutes les commandes de file (tableau 6.2) |
| `queue-tick` | POST (cron) | pg_cron, chaque minute | Déclencheurs temporels : T-30, T-10, rappel à 5 min, libération à 10 min, alertes de fin de journée (à partir de 2 h avant la fermeture), annulation 15 min après la fermeture sans décision du gérant, recalcul des estimations |
| `send-notifications` | POST (cron + déclencheur) | pg_cron chaque minute, et appel après chaque commande | Envoie l'outbox : push, SMS, e-mail ; applique le plafond SMS |
| `ticket-public` | GET | Page `/t/:token` | Renvoie l'état du ticket pour un jeton (sans session) |
| `auth-send-sms` | POST (hook Auth) | Supabase Auth | Envoie le code de connexion par le fournisseur SMS ; applique les plafonds par numéro et par IP |
| `salon-signup` | POST | Inscription salon | Crée salon, gérant, dossier de validation ; appelle `verify-siret` |
| `verify-siret` | POST | `salon-signup`, admin | Interroge Recherche d'entreprises ; renvoie état, NAF, adresse |
| `invite-member` | POST | Dashboard (équipe) | Crée l'invitation d'un coiffeur et envoie l'e-mail |
| `activate-invitation` | POST | Page d'invitation | Vérifie le lien, crée ou rattache le compte du coiffeur, envoie le lien magique de connexion |
| `revoke-member-sessions` | POST | Dashboard (équipe) | Le gérant déconnecte toutes les sessions d'un coiffeur (S-16) |
| `push-subscribe` | POST | Client | Enregistre un abonnement push (session ou jeton de ticket) |
| `admin-decide-salon` | POST | Admin | Valide ou refuse un dossier, avec motif |
| `salon-daily-summary` | POST (cron) | pg_cron, à la fermeture | Récapitulatif de fin de journée (S-14) |

### 6.2 Commandes de `queue-command`

Corps commun : `{ command: string, command_id: uuid, payload: {...} }`. Contexte d'autorisation déduit de la session (client, coiffeur, gérant) ou du `tracking_token`.

| Commande | Contexte autorisé | Charge utile | Effet principal |
| --- | --- | --- | --- |
| `join_queue` | Client connecté | `salon_id`, `service_id` ou `unknown_service`, `requested_member_id?`, `declared_arrival_at?`, `channel` (`app`, `qr`), `notifications_consent` | Crée le ticket, calcule le coiffeur pressenti et l'heure ; notification `ticket_created` |
| `register_walk_in` | Gérant | `first_name`, `phone`, `service_id?`, `requested_member_id?` | Crée le ticket `front_desk` et le contact privé ; SMS avec lien de suivi |
| `respond_eta` | Client ou jeton | `ticket_id`, `response` (`on_time`, `late`, `cancel`), `delay_minutes?` (5 à 30) | Enregistre la réponse T-30 ; recul possible (H5) |
| `cancel_ticket` | Client ou jeton | `ticket_id` | Annule ; les suivants avancent |
| `resolve_stylist_change` | Client ou jeton | `ticket_id`, `choice` (`wait`, `first_available`) | Réponse du client quand le coiffeur demandé devient indisponible (U-12) |
| `respond_end_of_day` | Client ou jeton | `ticket_id`, `choice` (`stay`, `cancel`) | Réponse à l'alerte de fin de journée (U-11) |
| `confirm_arrival` | Coiffeur, gérant | `short_code` (5 caractères) | Horodate l'arrivée ; refuse un code d'un autre salon ou d'un ticket clos |
| `call_ticket` | Coiffeur, gérant qui coiffe (« Je prends le prochain » si « Je coiffe » est coupé) | — (le serveur choisit le premier ticket éligible, règle 4) | `waiting → called` ; fixe `assigned_member_id` ; notification `your_turn` ; compteur de 10 min |
| `start_service` | Coiffeur attribué | `ticket_id`, `service_id`, `planned_duration_minutes` | `called → in_service` ; coiffeur `in_service` |
| `adjust_duration` | Coiffeur attribué | `ticket_id`, `delta_minutes` (+5, +15, +30, +45) | Recalcul ; notifications si ±10 min |
| `complete_service` | Coiffeur attribué | `ticket_id` | `in_service → completed` ; coiffeur `available` |
| `take_next` | Coiffeur attribué | `ticket_id` (celui qui a déclaré un retard) | Recul de 2 places max ; notification `postponed` ; le suivant est appelé |
| `remove_ticket` | Gérant | `ticket_id`, `reason_code`, `reason_text?` | `cancelled` avec motif ; notification `cancelled_by_salon` |
| `reassign_ticket` | Gérant | `ticket_id`, `member_id`, `client_agreed?` | Refusé si l'heure recule sans accord |
| `set_presence` | Coiffeur (soi-même), gérant (tous) | `member_id`, `status`, `break_type?`, `until?`, `shift_end_at?`, `reason?` | Change le statut ; choix demandé aux clients qui le demandaient ; notifications ±10 min |
| `set_hairdressing` | Gérant (soi-même) | `is_hairdressing` | Interrupteur « Je coiffe » ; recalcul |
| `set_queue_status` | Gérant | `salon_id`, `status` (`open`, `paused`, `closed`) | Ouvre, met en pause, ferme la file |
| `resolve_closing` | Gérant | `ticket_ids`, `decision` (`serve`, `cancel`) | Après l'heure de fermeture : sert ou annule avec excuses les clients restants |
| `create_test_ticket` | Gérant (salon non publié) | `salon_id` | Ticket fictif marqué `is_test` pour S-07 |

La libération à 10 min (`called → no_show`) est faite par `queue-tick`, sans commande manuelle.

**Codes d'erreur métier** (préfixe `queue.`) : `queue_closed`, `queue_full`, `already_has_active_ticket`, `no_eligible_ticket`, `not_assigned_to_you`, `invalid_transition`, `postpone_limit_reached`, `would_delay_client`, `unknown_code`, `ticket_other_salon`, `rate_limited`.

### 6.3 Lectures (RLS ou RPC)

| Lecture | Moyen | Pour |
| --- | --- | --- |
| Salons proches | RPC `search_salons(lat, lng, radius_m, text?)` | Accueil client |
| Fiche salon | Vue `public_salons` + `services`, `opening_hours`, vue `public_stylists` | Fiche salon |
| Mon ticket actif | RPC `my_active_ticket()` | App client |
| File d'un coiffeur | RPC `get_stylist_queue()` (coiffeur connecté) | Espace coiffeur |
| Vue du salon | RPC `get_salon_board(salon_id)` | Dashboard |
| Équipe, prestations, horaires | Tables, RLS gérant | Dashboard (écriture directe autorisée par RLS pour ces tables de configuration) |
| Journal | RPC `get_audit_log(salon_id?, from, to, cursor)` | Dashboard, admin |

Les tables de **configuration** (horaires, fermetures, prestations, spécialités des membres, infos du salon) sont modifiées directement par le gérant via supabase-js, sous RLS. Les tables de **file** (tickets, présences, événements, notifications) ne le sont jamais (ADR-003).

### 6.4 Temps réel

| Canal | Qui peut s'abonner | Messages |
| --- | --- | --- |
| `salon:{salon_id}` (privé) | Gérant et coiffeurs actifs du salon (appareils au lot 2) | `queue_updated { version }`, `queue_status_changed`, `presence_changed` |
| `ticket:{ticket_id}` (privé) | Propriétaire du ticket | `ticket_updated { version }` |

Autorisation par les politiques RLS de `realtime.messages` (Realtime Authorization). Repli : `refetchInterval` de 30 s côté client, 10 s côté espace coiffeur et dashboard, et relecture au retour au premier plan.

### 6.5 Services externes

| Service | Usage | Appelé depuis | Données envoyées |
| --- | --- | --- | --- |
| Géoplateforme, géocodage (`/geocodage/search`, autocomplétion) | Adresse du salon, recherche client par adresse | Navigateur | Texte de l'adresse saisie |
| Recherche d'entreprises (`/search?q=SIRET`) | Vérification SIRET, NAF, état actif | Edge Function | SIRET |
| Fournisseur SMS 🔬 | Codes de connexion, SMS de file | Edge Functions | Numéro, texte (sans donnée sensible) |
| Services de push des navigateurs | Notifications | Edge Function | Charge chiffrée (Web Push) |
| Brevo | E-mails transactionnels | Edge Functions | E-mail, prénom |
| Tuiles de carte 🔬 | Fond de carte | Navigateur | Zone affichée |

Chaque fournisseur recevant des données personnelles fait l'objet d'un contrat de sous-traitance et d'une ligne au registre des traitements.

---

## 7. Sécurité

| Sujet | Règle |
| --- | --- |
| Référentiel | OWASP ASVS niveau 2 ; revue par l'agent `security-reviewer` sur chaque pull request sensible |
| RLS | Activée sur **toutes** les tables du schéma `public` ; schéma `private` jamais exposé par l'API ; tests pgTAP qui tentent de lire et d'écrire chez un autre salon |
| Fonctions SQL | `security definer` seulement si nécessaire, avec `set search_path = ''` et contrôle explicite des droits en tête |
| Codes SMS | 6 chiffres, 5 min, 3 essais, renvoi après 30 s ; plafonds par numéro (5 par heure), par IP (20 par heure) ; numéros +33 uniquement |
| Gérant | E-mail + mot de passe (12 caractères minimum) ou lien magique ; MFA proposée |
| Coiffeur (lot 1) | Compte personnel, connexion par lien magique, session de 30 jours ; le gérant révoque toutes ses sessions (S-16) ; un coiffeur désactivé perd l'accès immédiatement ; aucune donnée client persistée sur l'appareil (pas de `persistQueryClient`, pas de `localStorage` ni d'IndexedDB pour les données, réponses d'API exclues du cache du service worker) |
| Tablette (lot 2) | Compte d'appareil révocable ; PIN haché (Argon2id) ; 5 essais puis blocage 5 min ; verrouillage après 5 min d'inactivité (annexe A) |
| Admin | Table `platform_admins` ; MFA obligatoire ; chaque lecture de donnée client journalisée |
| Jetons | `tracking_token`, liens d'invitation : aléatoires (≥ 32 octets), stockés hachés pour les invitations, jamais dans les journaux |
| En-têtes | CSP stricte (sources listées), HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (caméra et micro désactivés ; géolocalisation seulement sur l'app client) |
| Secrets | Variables d'environnement Supabase et Vercel ; jamais dans le dépôt ; `.env.example` sans valeur |
| Dépendances | `pnpm audit` et Dependabot ; analyse CodeQL en CI |
| Journal d'audit | `ticket_events` et `salon_events` en ajout seul : mise à jour et suppression refusées par déclencheur |

---

## 8. Données personnelles (RGPD)

- Hébergement : Supabase région UE (Francfort ou Paris selon disponibilité), Sentry UE, Vercel pour des fichiers statiques sans donnée personnelle.
- Minimisation : pas de position stockée ; téléphone jamais exposé aux salons ; prénom seulement affiché côté salon ; rien du client conservé sur le téléphone du coiffeur.
- Consentements distincts et horodatés : notifications de suivi (nécessaire au service, demandé au ticket), offres marketing (opt-in, hors MVP), mesure d'audience (sans cookie).
- Conservation : brouillons d'inscription salon 7 jours ; tickets anonymisés après **12 mois** (à confirmer avec un conseil RGPD) — prénom, client et contact effacés, horodatages gardés pour les statistiques.
- Droits : export et suppression du compte client depuis `/account` (suppression = anonymisation des tickets passés).
- Registre des traitements et contrats de sous-traitance avant le pilote.

---

## 9. Dictionnaire de textes (i18n)

```
packages/i18n/src/fr/
  common.json         boutons, statuts, unités, jours, formats
  client.json         écrans de l'app Zelaté
  pro-stylist.json    espace coiffeur
  pro-manager.json    dashboard gérant et admin
  notifications.json  push, SMS et e-mails (modèles avec variables)
  errors.json         erreurs métier et de validation
  legal.json          consentements, CGU, confidentialité
```

- Clés hiérarchiques en anglais : `client.ticket.tracking.title`.
- Types générés depuis `fr` : une clé manquante ou mal écrite ne compile pas.
- ESLint `i18next/no-literal-string` interdit les textes en dur dans les composants.
- Pluriels et variables au format ICU (`i18next-icu`).
- Un test vérifie que **chaque modèle SMS** tient en 160 caractères GSM-7 avec des valeurs de longueur maximale.
- Chaque app ne charge que ses espaces de noms (`common` + les siens).

---

## 10. Qualité et conventions

### 10.1 Stratégie de tests

| Niveau | Outil | Ce qui est testé | Seuil |
| --- | --- | --- | --- |
| Moteur de file | Vitest | Chaque règle H1-H8, chaque transition, cas limites (pause, débordement, absence, changement d'heure) ; tests par propriétés (fast-check) sur les invariants | Couverture ≥ 95 % des lignes |
| Contrats | Vitest | Schémas zod, codes d'erreur | — |
| Base | pgTAP | Contraintes, RLS (lecture et écriture interdites chez un autre salon), journal en ajout seul | Chaque table et chaque politique |
| Edge Functions | Deno test + base locale | Commandes, idempotence, verrou (deux appels simultanés) | Chaque commande |
| Composants | Vitest + Testing Library | Comportement et accessibilité des composants `ui` | — |
| Bout en bout | Playwright | Parcours multi-rôles : client + coiffeur + dashboard dans le même scénario | Chaque user story « I » |
| Accessibilité | axe-core dans Playwright | Aucune violation sérieuse ou critique | 0 |
| Performance | Lighthouse CI | Accueil client, fiche salon, espace coiffeur | Performance et PWA ≥ 90 |
| Charge | k6 ou script Playwright | 3 salons × 5 coiffeurs × 100 tickets, 50 clients connectés | p95 < 2 s |

### 10.2 Conventions
- **Code, commentaires, commits, branches et pull requests en anglais.**
- Commits Conventional Commits (`feat(queue-engine): …`) ; branches `feat/…`, `fix/…`, `chore/…`.
- Fichiers de composants en `PascalCase.tsx`, autres en `kebab-case.ts` ; tables et colonnes en `snake_case` ; enums en `snake_case` minuscules.
- Une pull request = une user story ou une tâche technique ; modèle de PR avec story liée, captures, tests ajoutés.
- Definition of Done : voir [IMPLEMENTATION_PLAN §8](./IMPLEMENTATION_PLAN.md#8-definition-of-done).

### 10.3 Intégration continue
Ordre : installation → lint et formatage → types → tests unitaires → base locale (`supabase start`, migrations, pgTAP) → tests Edge Functions → build des deux apps → Playwright + axe sur préversion → Lighthouse CI. La fusion est bloquée si une étape échoue.

---

## 11. Environnements

| Environnement | Supabase | Front | Données |
| --- | --- | --- | --- |
| Local | `supabase start` (Docker) | `pnpm dev` | `seed.sql` (salons fictifs) |
| Préversion | Projet Supabase « staging » (UE) | Préversion Vercel par pull request | Jeu de démonstration |
| Production | Projet Supabase « production » (UE) | Vercel production | Réelles |

Variables d'environnement (noms définitifs, valeurs hors dépôt) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, `VITE_MAP_STYLE_URL`, `VITE_SENTRY_DSN` ; côté fonctions : `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER`, `EMAIL_API_KEY`, `PHONE_HASH_SECRET`, `APP_CLIENT_URL`, `APP_PRO_URL`.

---

## 12. Observabilité

- Sentry sur les deux apps et les Edge Functions, sans corps de requête ni donnée personnelle.
- Journal structuré des Edge Functions : `command`, `salon_id`, `duration_ms`, `result` ; jamais de téléphone ni de jeton.
- Tableau de suivi du pilote (requêtes SQL) : précision de l'heure annoncée, no-show, coût SMS, latence.

---

## 13. Ce qui existe déjà

| Élément | État | Ce qu'on en fait |
| --- | --- | --- |
| Prototype Figma Make | React 19, Vite, Tailwind v4, un seul `App.tsx` (350 lignes), 3 vues statiques, données en dur | On garde la direction visuelle, les jetons et certains écrans ; on reconstruit le code dans le monorepo |
| Jetons du prototype | DM Sans et Manrope ; encre `#1c1831`, violet `#7146e8`, crème `#f8f7f3`, vert `#13795b` | Repris dans DESIGN_SYSTEM ; polices auto-hébergées |
| À corriger du prototype | `article` cliquables au clavier impossible, modales sans piège de focus ni Échap, `lang="en"`, Google Fonts et Unsplash, plugins Figma Make dans `vite.config.ts` | Corrigé dans la reconstruction |
| Docs | Synthèse et plan d'action, spec MVP v0.1 (remplacée par le PRD v1.0), atelier du 16/10, ces six documents | Le PRD v1.0 fait référence pour les règles |
| Décisions | Supabase UE, nouveau dépôt GitHub, français seulement, code en anglais | Intégrées ici |

---

## 14. Essais techniques à mener (lot PLN-3)

| Essai | Question | Critère de réussite |
| --- | --- | --- |
| Push iOS et Android | Les notifications arrivent-elles PWA installée, écran verrouillé ? | Réception < 5 s sur iPhone (iOS 16.4+) et Android |
| Charge temps réel | 3 salons, 15 coiffeurs connectés + 50 clients simulés tiennent-ils les 2 s ? | p95 < 2 s, aucune incohérence de file |
| SMS | Coût, délai et délivrabilité chez deux fournisseurs ; compatibilité *Send SMS Hook* | Délai < 10 s, coût connu, expéditeur alphanumérique possible |
| Tuiles de carte | OpenFreeMap ou MapTiler : conditions, poids, rendu | Conditions compatibles avec la production |
| Recherche d'entreprises | Champs de NAF et d'état actif, limites de débit | Champs identifiés, appel documenté dans `verify-siret` |
| Verrou par salon | Deux `call_ticket` simultanés sur le même ticket | Un seul réussit, l'autre reçoit `invalid_transition` |

---

## Annexe A · Lot 2 : tablettes partagées

Prévu après le pilote (tablettes louées, financement Innov'Up). Ce qui s'ajoute alors, sans changer le moteur ni les commandes :

| Élément | Rôle |
| --- | --- |
| Table `salon_devices` + compte Auth d'appareil | Tablette appairée par le gérant, révocable |
| Edge Function `device-pairing` | La tablette affiche un code à 6 caractères ; `claim` récupère sa session une fois approuvée |
| Edge Function `pair-device` | Le gérant saisit le code et approuve ; `revoke` coupe l'appareil |
| Table `stylist_sessions` + Edge Function `unlock-stylist` | Le coiffeur déverrouille la tablette avec son PIN ; session de 5 min glissantes ; 5 essais puis blocage 5 min |
| Table `private.member_pins` | PIN haché (Argon2id) |
| Contexte des commandes | Appareil + `stylist_session_id` au lieu du compte personnel |

