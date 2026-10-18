# Documentation Zelaté

Six documents de référence, à lire dans cet ordre avant de coder.

| Document | Question à laquelle il répond |
| --- | --- |
| [PRD](./PRD.md) | Quoi et pourquoi : aperçu, objectifs, cibles, exigences, UI, métriques de succès |
| [TRD](./TRD.md) | Comment : stack, outils, API, décisions d'architecture (ADR), sécurité, conventions |
| [APP_FLOW](./APP_FLOW.md) | Où et quand : routes, navigation, effet de chaque clic, rôle par rôle |
| [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) | À quoi ça ressemble : couleurs, typographie, icônes, composants, jetons Tailwind |
| [BACKEND_SCHEMA](./BACKEND_SCHEMA.md) | Quelles données : tables, colonnes, contraintes, droits (RLS), tâches planifiées |
| [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md) | Dans quel ordre : Planification → Exigences → Design → Développement → Test |

**Règles** : en cas de contradiction, le PRD fait foi pour une règle métier et le TRD pour un choix technique. Tout changement de règle, de route, de schéma ou de décision met à jour le document concerné dans la même pull request que le code. Documents en français ; code, noms techniques, commits et branches en anglais.

Sources : cahiers des charges Utilisateurs, Salon et Coiffeur ; « Synthèse du cahier des charges & plan d'action » (13/10/2026) ; « Spécification fonctionnelle du MVP » v0.1 (13/10/2026).
