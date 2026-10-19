# Revue de code de la pull request d'exemple (DEV-0)

> 19/10/2026 · agent `code-reviewer` · PR #14 `fix(deploy): deploy client and pro as two Vercel projects` (commit `8b10c83`, parent `efdaf23`) · résultat : **aucun défaut actionnable**

La PR #14 sert de pull request d'exemple pour la Definition of Done de DEV-0. Elle a été mergée avec une CI verte et a déployé une préversion de chacune des deux apps.

## Constats

Aucun défaut actionnable.

- **Build Pro avec `base: '/'`** : le build passe. `dist/index.html` charge `/assets/index-*.js` et `/assets/index-*.css`. Le routeur reçoit `basename: import.meta.env.BASE_URL`, qui vaut maintenant `/` (`apps/pro/src/main.tsx:20`).
- **Build client** : il passe.
- **Références restantes** : plus aucune référence à `/pro` ni au `vercel.json` racine dans le code, la CI (`.github/workflows/ci.yml`), les tests, `packages/*`, `docs/APP_FLOW.md` ou les skills. Seules restent les lignes d'historique volontaires de `docs/IMPLEMENTATION_PLAN.md`.
- **Repli SPA** : `apps/client/vercel.json` et `apps/pro/vercel.json` renvoient toutes les URL vers `/index.html`. C'est cohérent avec un projet Vercel par Root Directory, puisque les fichiers existants, comme `/assets/*`, sont servis en premier.
- **Reformatage de `docs/TRD.md` par Prettier** : comparé sur le texte normalisé, il n'y a que deux différences de contenu.
  - `*Send SMS Hook*` devient `_Send SMS Hook_` : même rendu.
  - La ligne « Hébergement front » est mise à jour, comme prévu par la PR.
- **Documents** : `README.md`, `docs/TRD.md` et `docs/IMPLEMENTATION_PLAN.md` concordent et suivent l'ADR-002, qui prévoit deux origines.

## Vérifications

| Vérification                                                             | Résultat                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `git diff efdaf23 8b10c83`                                               | Lu                                                              |
| Comparaison du TRD sur texte normalisé                                   | 2 écarts, voulus                                                |
| `git grep` sur `/pro`, `vercel.json`, `BASE_URL`, `basename`, `services` | Rien d'obsolète                                                 |
| `corepack pnpm --filter @zelate/pro build`                               | OK                                                              |
| `corepack pnpm --filter @zelate/client build`                            | OK                                                              |
| `corepack pnpm typecheck`                                                | OK                                                              |
| `corepack pnpm lint`                                                     | OK                                                              |
| `corepack pnpm format:check`                                             | OK                                                              |
| `corepack pnpm test`                                                     | Non lancé : la PR ne touche ni `packages/ui` ni `packages/i18n` |
| Tests base de données                                                    | Non lancés : la PR ne touche pas `supabase/`                    |
| Déploiements Vercel                                                      | Constatés fonctionnels par Koni (deux projets, Vite)            |
