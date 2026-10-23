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
- **Aucune place ne survit à son jour** : `private.close_past_days()` annule (motif `end_of_day`) les places d'un jour précédent encore actives, termine une prestation restée en cours, ferme leurs copies de numéro et remet à zéro les chiffres d'un salon datant de la veille. Appelée au début de chaque commande de file et toutes les heures.
- **Local** : `corepack pnpm dev:cron` donne aux tâches planifiées l'adresse et le secret des Edge Functions (à relancer après `supabase db reset`).

## Vérifications

- pgTAP `026` : salon ouvert dans ses horaires, fermé un jour de fermeture malgré la file ouverte (pas de créneau, ouverture le lendemain), fiche identique ; place de la veille annulée, numéro libéré, chiffres remis à zéro.
- Test unitaire : un client dont la place de la veille est restée active peut rejoindre aujourd'hui.
- Test de bout en bout `dev-8-home` : salon fermé aujourd'hui affiché « Fermé » sans créneau ; son `/join` renvoie vers la fiche qui dit « Fermé · ouvre … ».

## Choix par défaut

- Pendant la coupure de midi, la file reste ouverte (le moteur accepte les inscriptions jusqu'à la dernière fermeture du jour) ; seul l'après-fermeture et les jours fermés comptent comme « Fermé ».
- « Complet aujourd'hui » s'affiche quand `is_full` est vrai ou quand maintenant + attente dépasse la dernière fermeture.
- La carte à plusieurs salons (regroupement, fiche en bas de carte) fait l'objet d'une PR suivante.
