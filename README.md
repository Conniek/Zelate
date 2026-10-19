# Zelaté

File d'attente virtuelle pour salons de coiffure : les clients rejoignent la file d'un salon proche (ou viennent pour un rendez-vous) et suivent leur attente réelle ; les coiffeurs appellent, prennent en charge et terminent depuis leur téléphone ; le gérant pilote la file depuis un tableau de bord.

**État** : phase Développement, lot DEV-0 (fondations) en cours.

| Document                                                   | Contenu                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| [docs/PRD.md](docs/PRD.md)                                 | Produit : règles métier, exigences, métriques, décisions |
| [docs/TRD.md](docs/TRD.md)                                 | Technique : stack, API, décisions d'architecture         |
| [docs/APP_FLOW.md](docs/APP_FLOW.md)                       | Parcours et navigation, écran par écran                  |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)             | Couleurs, typographie, composants, jetons Tailwind       |
| [docs/BACKEND_SCHEMA.md](docs/BACKEND_SCHEMA.md)           | Tables, colonnes, droits d'accès                         |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Phases, lots, portes de validation                       |

Les instructions pour Claude sont dans [CLAUDE.md](CLAUDE.md).

## Développement local

Prérequis : Node.js 22.14 ou supérieur, Corepack, et Docker Desktop pour la pile Supabase locale. Une connexion à Docker Desktop n'est pas nécessaire pour les images publiques.

```sh
corepack pnpm install
corepack pnpm --filter @zelate/client dev
corepack pnpm --filter @zelate/pro dev
```

Les deux applications de démonstration sont indépendantes et chargent uniquement les textes français. La pile Supabase locale est configurée et démarre avec `supabase start` lorsque Docker Desktop fonctionne. L'API, Studio et Mailpit ont été vérifiés.

Si le shell ne trouve pas `docker` sur macOS, ajoutez son répertoire au `PATH` de la session avant les commandes Supabase :

```sh
export PATH="$HOME/.docker/bin:$PATH"
docker info
supabase start
```

**Sécurité locale :** Supabase publie certains ports sur toutes les interfaces (`0.0.0.0`), et Studio, pgMeta et analytics n'ont pas d'authentification. Utilisez la pile uniquement sur un poste et un réseau de confiance ; ne l'exposez pas à Internet et ne configurez pas de redirection de ports. Les clés et secrets par défaut sont réservés au développement local, jamais à la production. `supabase status` affiche des identifiants locaux : ne collez pas sa sortie dans un ticket, un chat ou un dépôt. Ne fournissez jamais de jeton Docker, de clé Supabase `service_role` ou de secret dans le dépôt ou dans une conversation.

## Déploiement Vercel

Le fichier [`vercel.json`](./vercel.json) configure un seul projet Vercel multi-services. Lors de l'import du dépôt, choisir la racine du dépôt comme répertoire racine du projet (ne pas sélectionner `apps/client` ou `apps/pro`) afin que Vercel lise cette configuration. Le service `client` reçoit `/` et tous les chemins qui ne commencent pas par `/pro`; le service `pro` reçoit `/pro` et `/pro/*`. Le routage interne retire le préfixe pour sélectionner les fichiers du service Pro, tandis que l'URL du navigateur conserve `/pro` et que le routeur client le reconnaît comme base. Les deux services sont publics, et aucun binding inter-service n'est nécessaire : ces applications ne s'appellent pas entre elles.

Les pull requests produisent des déploiements de préversion pour les deux services dans le même projet. Configurer les variables d'environnement Supabase et Sentry dans les environnements Vercel appropriés ; ne jamais ajouter de clé de service ou de secret au dépôt.
