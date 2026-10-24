# Recette client — corrections du 23/10/2026

Branche `fix/client-open-hours`. Retours de Koni sur le parcours client (recette en local, vendredi 21h35, salons fermant à 19h00).

## Constats

| Constat                                                                                              | Cause                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| « Créneau libre maintenant » et « ~60 min » à 21h35, « Prochain créneau libre à 15h38 » sur la fiche | L'accueil, la carte et la fiche ne regardaient que le bouton Ouvrir / Pause / Fermer, pas les horaires ; en local, la tâche `queue-tick` ne tournait pas, donc rien n'était recalculé |
| Parcours complet jusqu'au récapitulatif, puis « La file est complète pour aujourd'hui »              | Le refus ne venait que du moteur, à la dernière étape                                                                                                                                 |
| « Ce numéro a déjà une place en cours » alors que « Ma place » est vide                              | Une place d'un jour précédent restée active (tâche manquée) bloquait le numéro ; « Ma place » ne montre que le jour même                                                              |
| Tableau du gérant : « 1 client en attente » mais « Aucun client dans la file »                       | Compteur du salon resté sur les chiffres de la veille                                                                                                                                 |
| « Complet aujourd'hui » peu lisible, « à vérifier » inquiétant                                       | Choix d'affichage de l'APP_FLOW F-C1                                                                                                                                                  |

## Ce qui change

- **Horaires d'abord** : `search_salons` et `get_salon_public` donnent `accepting` et `closes_at` (dernière fermeture du jour, fermetures exceptionnelles comprises) et `next_opening_at` dès la fermeture. Après 19h00, un salon resté « ouvert » est « Fermé · ouvre demain à 9h00 », grisé, sans attente ni créneau ; « Ouvert maintenant » le masque.
- **Refus avant le parcours** : `/salons/:slug/join` et `/check-in` renvoient vers la fiche quand le salon est fermé, en pause ou complet ; la fiche dit pourquoi et propose les salons proches.
- **Badges** : « ~25 min » ; « Aucune attente » (vert) ; « Complet aujourd'hui » (rouge clair) dès que le prochain client passerait après la fermeture ; « Fermé » et « En pause » (grisé). Même badge sur la carte.
- **Fraîcheur** : « mis à jour il y a 12 min », puis « mis à jour à 14h05 » au-delà d'une heure, au lieu de « à vérifier ».
- **Sa propre place** : sur la fiche du salon où le client a déjà une place, « Vous avez une place dans ce salon » et « Voir ma place », au lieu de le compter parmi les personnes avant lui.
- **Aucune place ne survit à son jour** : `private.close_past_days()` annule, comme le moteur à minuit (motif `end_of_day`), les places d'un jour précédent encore actives et ferme leurs copies de numéro. Dans chaque commande de file, sous le verrou du salon, elle ne touche que les places du client ou du numéro concerné ; toutes les heures, elle couvre tous les salons et remet à zéro les chiffres d'un salon datant de la veille (lignes déjà verrouillées sautées, jamais attendues).
- **Moteur** : un jour sans horaires (jour de fermeture, fermeture exceptionnelle), la file refuse les nouveaux clients (`queue_closed`), comme l'écran client l'affiche.
- **Local** : `corepack pnpm dev:cron` donne aux tâches planifiées l'adresse et le secret des Edge Functions (à relancer après `supabase db reset`).

## Revue

Revue de code : 8 points, corrigés.

- Le balayage écrivait `null` dans `next_free_slots` (colonne non nulle) : toutes les commandes auraient échoué après minuit. Il écrit `[]`.
- Ordre des verrous inverse de `queue-tick` (risque d'interblocage) : dans les commandes, le balayage passe après le verrou du salon et ne touche que le client ou le numéro concerné ; le balayage de tous les salons reste à la tâche horaire.
- Une prestation restée en cours était « terminée » par le SQL et « annulée » par le moteur : même règle partout, annulée avec le motif de fin de journée.
- Client et moteur ne disaient pas la même chose un jour sans horaires : le moteur refuse aussi.
- La fiche annonçait « ouvre demain » pendant une longue fermeture (calcul sans les fermetures exceptionnelles) : seule la date du serveur est utilisée.
- Créneaux comparés comme du texte : comparés comme des instants.
- Tests renforcés : créneau pgTAP hors de la fenêtre de minuit, salon fermé avec un créneau périmé dans le test de bout en bout, test d'intégration Postgres (place de la veille puis inscription, balayage horaire).
- Story U-01 et types générés mis à jour.

## Vérifications

- pgTAP `026` : salon ouvert dans ses horaires, fermé un jour de fermeture malgré la file ouverte (pas de créneau, ouverture le lendemain), fiche identique ; place de la veille annulée, numéro libéré, chiffres remis à zéro.
- Tests unitaires : un client dont la place de la veille est restée active peut rejoindre aujourd'hui ; le moteur refuse un nouveau client un jour sans horaires.
- Test d'intégration Postgres : place de la veille annulée avant l'inscription, balayage horaire sans erreur.
- Test de bout en bout `dev-8-home` : salon fermé aujourd'hui affiché « Fermé » sans créneau ; son `/join` renvoie vers la fiche qui dit « Fermé · ouvre … ».

## Choix par défaut

- Un salon fermé ce jour-là (pas d'horaires ou fermeture exceptionnelle) refuse aussi les clients à l'accueil, même si le gérant ouvre la file : pour une ouverture exceptionnelle, il ajoute des horaires du jour (à confirmer avec Ely).
- La place d'un jour précédent annulée par le balayage ne reçoit pas de message (la journée est finie ; le message d'excuse part normalement à minuit par `queue-tick`).
- Pendant la coupure de midi, la file reste ouverte (le moteur accepte les inscriptions jusqu'à la dernière fermeture du jour) ; seul l'après-fermeture et les jours fermés comptent comme « Fermé ».
- « Complet aujourd'hui » s'affiche quand `is_full` est vrai ou quand maintenant + attente dépasse la dernière fermeture.
- La carte à plusieurs salons (regroupement, fiche en bas de carte) fait l'objet d'une PR suivante.

## Suite : la carte avec beaucoup de salons (24/10)

Branche `feat/client-map-clusters`, validée par Koni le 23/10.

- Repères compacts : la pastille ne montre que le badge du salon (« ~25 min », « Aucune attente », « Complet aujourd'hui », « Fermé »), aux couleurs de la liste.
- Salons dont les pastilles se chevaucheraient : une seule pastille « 3 salons » ; la toucher zoome jusqu'à les séparer. Regroupement recalculé à la fin de chaque déplacement de la carte (`lib/map-groups.ts`, testé).
- Toucher un salon ouvre sa fiche juste sous la carte : nom, badge, adresse, créneau libre, fraîcheur, « Voir le salon » et « Fermer » ; le focus va sur la fiche, Échap ou « Fermer » le ramène sur le repère.
- Salons trop proches pour être séparés même au zoom maximal (même galerie) : la pastille ouvre la liste de ces salons.
- Revue d'accessibilité (10 points, corrigés) : les classes de positionnement de MapLibre sont gardées (les repères restaient décalés) ; le focus suit son salon quand les pastilles se regroupent ou se séparent ; ordre de tabulation = ordre de la liste ; chevauchement calculé sur la largeur réelle des pastilles, groupe posé sur le salon le plus proche ; fiche sous la carte (plus de repère caché ni de fiche coupée à 320 px ou à 200 %) ; bordure de pastille visible sur le fond de carte ; boutons du design system.
- Choix par défaut : la carte n'est pas couverte par les tests de bout en bout (tuiles externes) ; le regroupement l'est par des tests unitaires, les premiers de l'app client.
