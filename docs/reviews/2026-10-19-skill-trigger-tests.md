# Test de déclenchement des skills (DEV-0)

> 19/10/2026 · `zelate-domain`, `feature-workflow`, `db-migration-rls` · résultat : **18/18**

**But** (DoD de DEV-0) : chaque skill écrit se déclenche sur une demande pertinente et pas sur une demande hors sujet.

**Méthode**

- 6 demandes par skill : 3 qui doivent le déclencher et 3 « presque » hors sujet, qui partagent des mots-clés sans relever du skill. Les jeux de test sont dans `.claude/skills/<skill>/evals/trigger-eval.json`.
- Chaque demande est passée à `claude -p` dans une copie du dépôt, avec les vrais skills de `.claude/skills/` (modèle de la session, 4 tours au plus, outils d'écriture et réseau désactivés). Le skill compte comme déclenché s'il est chargé (outil `Skill` ou lecture de son `SKILL.md`) pendant ces tours. Script : `scripts/skills/trigger-test.py`.
- Le script `run_eval` de `skill-creator` a d'abord été essayé dans un projet vide. Il donnait 9/9 hors sujet bien rejetés, mais beaucoup de faux négatifs : il compte un échec dès que le premier outil n'est pas le skill (par exemple un `Glob` pour chercher les documents). Le test en conditions réelles ci-dessous est retenu.

**Résultats**

| Skill              | Attendu           | Déclenché | Résultat | Demande                                                                                                                                                                                        |
| ------------------ | ----------------- | --------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `zelate-domain`    | déclencher        | oui       | ✅       | Pour Zelaté, explique-moi précisément quand un ticket passe de « appelé » à « absent », et ce qui se passe si le client avait annoncé un retard de 20 minutes.                                 |
| `zelate-domain`    | déclencher        | oui       | ✅       | I'm about to write the test file for the Zelaté queue engine: which invariants must hold after every command, and what are the rules about appointments versus walk-in clients?                |
| `zelate-domain`    | déclencher        | oui       | ✅       | Dans Zelaté, un coiffeur se met en pause : est-ce que les clients qui l'ont demandé doivent choisir un autre coiffeur ? Vérifie dans les règles avant de répondre.                             |
| `zelate-domain`    | ne pas déclencher | non       | ✅       | Écris-moi un composant React générique de bouton avec un état de chargement, en TypeScript, pour n'importe quel projet.                                                                        |
| `zelate-domain`    | ne pas déclencher | non       | ✅       | Explique-moi comment fonctionne la RLS de Postgres en général, avec un exemple simple sur une table de blog.                                                                                   |
| `zelate-domain`    | ne pas déclencher | non       | ✅       | Rédige un post LinkedIn pour annoncer que je lance une application de file d'attente pour les boulangeries.                                                                                    |
| `feature-workflow` | déclencher        | oui       | ✅       | Implémente la story C-04 de Zelaté (appeler le prochain client) : tests, code, documentation, en suivant le plan d'implémentation.                                                             |
| `feature-workflow` | déclencher        | oui       | ✅       | Let's build Zelaté user story U-08 (cancel my place) end to end: read the docs, write the tests first, then the code, then update the docs and open the PR.                                    |
| `feature-workflow` | déclencher        | oui       | ✅       | On attaque la story S-10 de Zelaté, inscrire un client à l'accueil : fais tout le cycle jusqu'à la validation.                                                                                 |
| `feature-workflow` | ne pas déclencher | non       | ✅       | Dans Zelaté, faut-il qu'un client avec rendez-vous soit prévenu quand le salon déplace son rendez-vous ? Donne-moi ton avis sur la règle métier.                                               |
| `feature-workflow` | ne pas déclencher | non       | ✅       | Corrige la faute de frappe dans le README à la ligne 12, « deploiment » au lieu de « déploiement ».                                                                                            |
| `feature-workflow` | ne pas déclencher | non       | ✅       | Explique-moi la différence entre Vite et Webpack pour un débutant.                                                                                                                             |
| `db-migration-rls` | déclencher        | oui       | ✅       | Pour Zelaté, écris la migration Supabase qui crée la table tickets avec ses contraintes et sa politique RLS, et le test pgTAP qui prouve qu'un gérant ne lit pas les tickets d'un autre salon. |
| `db-migration-rls` | déclencher        | oui       | ✅       | I need to add an index and a check constraint on Zelaté's private.ticket_contacts table; design the migration and its pgTAP test.                                                              |
| `db-migration-rls` | déclencher        | oui       | ✅       | Ajoute à Zelaté la fonction SQL get_stylist_queue en security definer, avec le contrôle des droits, dans une migration.                                                                        |
| `db-migration-rls` | ne pas déclencher | non       | ✅       | Dans Zelaté, écris le composant React de l'écran « Ma file » du coiffeur avec ses textes du dictionnaire.                                                                                      |
| `db-migration-rls` | ne pas déclencher | non       | ✅       | Explique-moi ce qu'est une base de données relationnelle, pour un cours d'introduction.                                                                                                        |
| `db-migration-rls` | ne pas déclencher | non       | ✅       | Écris une requête SQL pour calculer le chiffre d'affaires mensuel dans mon fichier Excel de ventes exporté en CSV.                                                                             |

Les descriptions des skills ne sont pas modifiées. Relancer le test après chaque changement de description :

```
git clone . /tmp/zelate-copy
python3 scripts/skills/trigger-test.py /tmp/zelate-copy /tmp/trigger-results.json
```
