# PRD — Zelaté

> **Product Requirements Document** · version 1.0 · 16/10/2026 · statut : validé en atelier avec Ely le 16/10/2026
> Sources : cahiers des charges Utilisateurs, Salon et Coiffeur ; « Synthèse du cahier des charges & plan d'action » (13/10) ; « Spécification fonctionnelle du MVP » v0.1 (13/10) ; atelier de validation de l'étape 0 (16/10).
> Documents liés : [TRD](./TRD.md) · [APP_FLOW](./APP_FLOW.md) · [DESIGN_SYSTEM](./DESIGN_SYSTEM.md) · [BACKEND_SCHEMA](./BACKEND_SCHEMA.md) · [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)

Ce document dit **quoi** construire et **pourquoi**. Le **comment** est dans le TRD et le schéma backend. En cas de contradiction entre deux documents, c'est ce PRD qui fait foi pour une règle métier, et le TRD pour un choix technique ; la contradiction est signalée et corrigée dans les deux.

Depuis la v1.0, ce PRD **remplace la spec MVP v0.1** comme référence : les règles du moteur de file y sont reprises (§5.2) avec les décisions de l'atelier. Le journal des décisions est au §11.

---

## 1. Aperçu

### Le problème
Dans un salon de coiffure sans rendez-vous, le client ne sait pas combien de temps il va attendre. Il attend sur place, renonce, ou revient trop tard. Le salon, lui, perd des clients aux heures pleines et n'a aucune visibilité sur sa file. Le coiffeur jongle entre la prestation en cours et les questions des clients qui attendent.

### La solution
Zelaté est une **file d'attente virtuelle** qui relie en temps réel trois interfaces :

| Interface | Pour qui | Support | App installable |
| --- | --- | --- | --- |
| App client | Particuliers | Smartphone, navigateur | **Zelaté** (PWA) |
| Espace coiffeur | Coiffeurs du salon | **Lot 1 : le téléphone du coiffeur**, avec son propre compte · Lot 2 : petites tablettes louées par le salon | **Zelaté Pro** (PWA) |
| Dashboard salon | Gérant | Ordinateur, tablette ou téléphone | **Zelaté Pro** (même app) |
| Back-office | Équipe plateforme | Ordinateur | Zelaté Pro, espace `/admin` |

Le client rejoint la file d'un salon proche depuis l'app, ou en scannant le QR code affiché au salon, sans rien installer. Il suit sa position et son heure de passage, reçoit une alerte quand son tour approche, et arrive juste à temps. Il donne son code de ticket au coiffeur, qui le prend en charge et termine en un geste. Chaque action recalcule l'attente de tous.

### La phrase produit
> Trouvez votre style, pas une salle d'attente.

---

## 2. Objectifs

### Objectifs du MVP (pilote de 1 à 3 salons)
1. **Prouver la boucle** : un client rejoint la file, un coiffeur l'appelle, le prend en charge et termine, et l'attente se recalcule pour tous en moins de 2 secondes.
2. **Annoncer une heure fiable** : 80 % des clients commencent à 10 minutes près de l'heure annoncée 30 minutes avant (indicateur principal, §8).
3. **Ne rien ajouter à la charge du salon** : une inscription walk-in prend 10 secondes, une action coiffeur tient en un geste sur son téléphone.
4. **Servir les clients sans app** : le QR code de l'affiche et le SMS couvrent les clients qui n'installent rien (estimés à 70 % au départ dans le cahier Salon).

### Objectifs business (après le pilote)
- Démontrer aux salons un gain mesurable : moins d'abandons, file mieux répartie entre coiffeurs.
- Préparer la V1 payante (créneau à 2 €, heures creuses) sur une base de données d'usage réelle.

### Non-objectifs du MVP
- Pas de prise de rendez-vous à heure fixe ni de créneau payant (V1).
- Pas d'avis, de favoris, de fidélité, de paiement, de pénalité d'annulation (V1 et au-delà).
- Pas de bouton « Appeler le client » avec numéro masqué : au pilote, messages prédéfinis par SMS (V1).
- Pas de tablette partagée au salon : elle arrive au lot 2 (location financée par Innov'Up).
- Pas d'import CSV depuis Planity ou Booksy, pas de multi-salons (V1 et V2).
- Pas d'application native iOS ou Android ; la PWA pourra être empaquetée plus tard (Capacitor).
- Pas de multi-langues : **français uniquement, marché France**.
- Pas de prédiction d'affluence par IA : la règle de fin de journée (§5.2) est un calcul déterministe ; la prédiction viendra en V2, quand l'historique existera.
- Pas de chiffres d'impact (gains, retour sur investissement) sur le site avant les résultats du pilote.

---

## 3. Cibles et personas

| Persona | Profil | Ce qu'il veut | Ce qui le ferait abandonner |
| --- | --- | --- | --- |
| **Client** | Particulier, 18-55 ans, smartphone, coiffure sans rendez-vous (coupe, barbe, tresses, couleur) | Savoir combien il attend et ne pas perdre sa place s'il s'absente | Une heure annoncée fausse, une inscription longue, une place perdue sans explication |
| **Client invité** | Passe devant le salon ou s'inscrit à l'accueil, n'installe rien | Être prévenu par SMS | Devoir créer un compte |
| **Coiffeur** | Salarié ou indépendant au fauteuil, mains occupées, utilise son propre téléphone au lot 1 | Voir son prochain client et agir sans interrompre sa prestation | Plus de gestes que la feuille papier, des données clients sur son téléphone personnel |
| **Gérant** | Patron du salon, coiffe parfois lui-même | Une vue claire de la file et de l'équipe, moins de clients perdus | Une configuration longue, un outil qui contredit son planning |
| **Admin plateforme** | Équipe Zelaté | Valider les salons légitimes, tracer les incidents | Des faux salons, des litiges sans trace |

**Rôles combinés** : le gérant a un interrupteur **« Je coiffe »**. Activé, il reçoit des clients comme un coiffeur ; désactivé, il n'en reçoit plus automatiquement mais garde un bouton « Je prends le prochain ». Il le change à tout moment.

---

## 4. Périmètre par version

| Acteur | MVP (pilote) | V1 | V2 et au-delà |
| --- | --- | --- | --- |
| Client | Liste + carte des salons, fiche salon, rejoindre la file gratuite (app ou QR de l'affiche, sans installation), identification par code SMS, coiffeur demandé en option, suivi en temps réel, notifications push + SMS de secours, réponse à « votre tour approche », alerte de fin de journée, annulation, retard signalé | Avis et notes, favoris, créneau payant 2 €, offres heures creuses, historique, réservation pour un tiers, pénalités éventuelles | Fidélité et parrainage, recommandations, coiffeurs à domicile |
| Coiffeur | Espace coiffeur sur son téléphone (compte personnel), disponible / pause / fin de journée, ma file, appeler, valider l'arrivée par le code du ticket, commencer avec durée, ajuster +5 / +15 / +30 / +45 min, terminer, client en retard | Tablettes partagées du salon avec code PIN (lot 2), bouton « Appeler » à numéro masqué, tutoriel, notes privées, statistiques personnelles | Badges, formation, profil et marketplace emploi |
| Salon | Inscription + vérification SIRET, wizard (horaires, équipe, prestations), QR code de l'affiche, test et publication, ouvrir / pause / fermer, interrupteur « Je coiffe », dashboard temps réel, walk-in en 10 s, absence et retard d'un coiffeur, retrait motivé, réaffectation, fin de journée | Import CSV, tour guidé, heures creuses manuelles, rapport détaillé, gestion des avis, confirmation des RDV payants par le gérant, appel masqué | Multi-salons, intégrations, marketing automatisé, prédiction d'affluence |
| Plateforme | Validation manuelle des salons, journal d'audit, limitation des abus | Validation automatique (SIRET actif + code NAF coiffure), paiements et remboursements | Analytique avancée, tests A/B |

---

## 5. Exigences fonctionnelles

### 5.1 Règles métier structurantes

Toutes ces règles sont **validées** (atelier du 16/10/2026).

| Code | Règle |
| --- | --- |
| H1 | **Une file unique par salon, distribution automatique.** Le client peut demander un coiffeur (option) ; sinon il est pris par le premier coiffeur qui se libère et maîtrise la prestation. |
| H2 | L'attente est **simulée coiffeur par coiffeur** à partir des durées prédéfinies des prestations. Pendant la prestation, le coiffeur ajuste en un geste : **+5, +15, +30, +45 min**. |
| H3 | Notifications à **T-30 min** avec réponse du client, à **T-10 min** et **« votre tour »** ; **3 SMS maximum** par ticket. |
| H4 | Client appelé : **compteur de 10 min** visible par le client et le coiffeur ; **rappel à 5 min** (notification, sans SMS) ; **place libérée automatiquement à 10 min**. |
| H5 | **Aucune réorganisation libre** ; un ticket ne recule que sur retard déclaré du client, de **2 places au plus**, avec motif affiché et journal d'audit. |
| H6 | Le **numéro du client n'est jamais affiché** au salon ni au coiffeur ; les messages partent de la plateforme. L'appel à numéro masqué vient en V1. |
| H7 | **L'arrivée se valide par le code du ticket** (5 caractères) que le client donne au coiffeur. Pas de QR à l'arrivée, pas de GPS. |
| H8 | Le client peut **déclarer son heure d'arrivée** ; si son tour vient avant, le suivant passe et le client reprend la tête de file dès son arrivée. |
| H9 | **Fin de journée** : à partir de 2 h avant la fermeture, le moteur prévient une fois chaque client qui finirait après la fermeture ; à la fermeture, le gérant décide pour ceux qui sont restés. |

**Décisions d'Ely (cahier Coiffeur), à respecter partout :**
- Jamais de numéro de téléphone client visible par les coiffeurs ni par les salons.
- Réorganisation et retrait de la file strictement encadrés, toujours justifiés au client.
- Un rendez-vous est confirmé par le gérant, pas par le coiffeur (s'applique au créneau payant de la V1).

**Autres règles validées :**
- Un client n'a **qu'un seul ticket actif** à la fois, tous salons confondus.
- Changer le coiffeur d'un client ne le fait **jamais reculer**, sauf accord du client.
- Le client **annule sans pénalité** avant d'être appelé (un système de pénalité pourra être étudié plus tard).
- Le client peut déclarer un **retard de 5 à 30 min** ; au-delà, il annule et se réinscrit.
- Toute variation d'heure de **10 min ou plus** et tout recul sont **expliqués** au client.
- **Absences répétées** : avertissement seul après **5 absences en 30 jours**.
- Seul le **gérant** inscrit un client présent au salon (walk-in).
- Chaque salon ne voit que ses propres données (isolation par salon).
- **Aucune donnée client n'est stockée sur le téléphone du coiffeur** : affichage seulement, rien en cache, déconnexion à distance par le gérant.

### 5.2 Règles du moteur de file

Reprises de la spec MVP v0.1 et mises à jour avec l'atelier ; c'est la référence du module `queue-engine`.

**Cycle de vie du ticket**

| # | Transition | Déclencheur | Acteur | Conditions | Effets |
| --- | --- | --- | --- | --- | --- |
| 1 | Création → En attente | Rejoindre la file, scan du QR de l'affiche, inscription à l'accueil | Client ou gérant | File ouverte et non complète ; aucun autre ticket actif pour ce numéro | Rang, coiffeur pressenti, heure estimée, notification d'inscription |
| 2 | En attente → Appelé | « Appeler » | Coiffeur, gérant qui coiffe | Premier ticket éligible pour ce coiffeur (règle 4 ci-dessous, H8) ; coiffeur disponible | Attribution définitive au coiffeur ; « votre tour » par push et SMS ; compteur de 10 min lancé |
| 3 | Appelé → En attente | « Prendre le suivant » | Coiffeur | Retard déclaré par le client ; recul de 2 places au plus | Notification avec raison ; journal |
| 4 | Appelé → En prestation | « Commencer » | Coiffeur | Arrivée validée par le code du ticket | Durée prévue enregistrée ; recalcul |
| 5 | En prestation → Terminé | « Terminer » | Coiffeur | — | Durée réelle ; coiffeur disponible ; recalcul |
| 6 | En attente ou Appelé → Annulé | Annulation, retrait, fermeture, fin de journée | Client, gérant avec motif, système | — | Notification avec motif ; les suivants avancent |
| 7 | Appelé → Absent | 10 min sans arrivée | Système | Rappel envoyé à 5 min | Compteur d'absences du client ; les suivants avancent |
| 8 | En attente → En attente (choix demandé) | Coiffeur demandé absent, en retard ou partant plus tôt | Système, gérant | — | Le client choisit « attendre » ou « premier disponible » ; sans réponse en 10 min : premier disponible si le coiffeur est absent toute la journée, sinon il attend |

L'arrivée au salon n'est pas un état mais un horodatage. Un client déjà arrivé et en tête peut être pris directement : l'appel et le début s'enchaînent.

**Calcul de l'heure de passage (H2)**

```latex
T_k = t_0 + R_c + \sum_{i<k} d_i \qquad R_c = \max\left(m,\; D_{\text{en cours}} - E\right)
```

- t0 = maintenant, ou fin de pause / heure d'arrivée prévue du coiffeur si elle est plus tardive.
- R = temps restant de la prestation en cours : durée prévue moins temps écoulé, avec un minimum m = 5 min quand elle déborde ; 0 si le coiffeur est libre.
- d = durée de la prestation de chaque ticket placé avant chez ce coiffeur ; 30 min quand le client a choisi « je ne sais pas encore ».
- Attente affichée = le plus tardif entre T et l'arrivée déclarée, moins maintenant, arrondi aux 5 min supérieures, avec l'heure de la dernière mise à jour.

**Distribution (H1)**
1. **Ticket avec coiffeur demandé** : réservé à ce coiffeur s'il travaille ce jour-là ; sinon le client est prévenu avant validation et peut choisir « premier disponible ».
2. **Ticket sans préférence** : aucun coiffeur n'est fixé à l'inscription. Pour estimer l'heure, le moteur simule la distribution et retient un **coiffeur pressenti** : celui qui maîtrise la prestation et se libère le plus tôt ; à égalité, celui qui a servi le moins de clients dans la journée.
3. **Ordre** : ordre d'inscription au salon, sauf ticket non encore arrivé à son heure déclarée (H8) ou retard déclaré (H5).
4. **Quand un coiffeur se libère**, son prochain client est le premier ticket éligible de la file : un ticket qui le demande, ou un ticket sans préférence dont il maîtrise la prestation. Les tickets qui demandent un autre coiffeur sont sautés sans perdre leur rang.
5. **Gérant** : « Je coiffe » activé = coiffeur ordinaire ; désactivé = exclu de la distribution, avec un bouton « Je prends le prochain ».

**Statuts du coiffeur**

| Statut | Qui le change | Reçoit de nouveaux clients | Effet sur l'attente |
| --- | --- | --- | --- |
| Hors ligne | Automatique en début de journée | Non | Exclu du calcul |
| Disponible | Coiffeur (« Je suis prêt ») | Oui | Inclus |
| En prestation | Automatique au démarrage | Oui, après la prestation | Temps restant ajouté |
| En pause | Coiffeur ou gérant, avec type (repas, courte, imprévu) et durée | Oui, après la pause | Durée restante ajoutée ; clients notifiés si leur heure bouge de 10 min ou plus |
| En retard | Gérant, avec heure d'arrivée prévue | Oui, après l'heure prévue | Calculé à partir de l'heure prévue |
| Absent | Gérant | Non | Tickets qui le demandent : choix du client (transition 8) |
| Fin de journée | Coiffeur ou gérant, avec heure de fin | Non après cette heure | Tickets qui dépasseraient : redistribués ou choix du client |

**États de la file du salon**

| État | Effet |
| --- | --- |
| Fermée | Aucun nouveau ticket ; affichée « Fermé » avec la prochaine ouverture |
| Ouverte | Tickets acceptés tant que l'heure estimée de fin reste avant la fermeture |
| En pause | Aucun nouveau ticket ; les tickets en cours restent et sont traités à la reprise |
| Complète (automatique) | La prochaine prestation finirait après la fermeture : nouveaux tickets refusés, salons proches proposés |

**Fin de journée (H9)**
- À partir de **2 h avant la fermeture** (valeur réglable par salon), chaque événement relance le calcul. Tout client dont la fin estimée dépasse l'heure de fermeture reçoit **une seule** alerte : « Vous risquez de ne pas être pris avant la fermeture », avec le choix **« Je reste »** ou **« J'annule »**.
- Si son heure redevient sûre, il est simplement notifié du changement d'heure (règle des 10 min).
- À l'heure de fermeture, le gérant voit les clients restants et choisit, pour chacun ou pour tous : **« Servir »** ou **« Annuler avec excuses »**. Sans action de sa part, ils sont **annulés automatiquement 15 min après la fermeture**, avec un message d'excuse et des salons proches.
- Aucun ticket ne passe d'un jour à l'autre.

### 5.3 Exigences par acteur

Priorité : **I** = indispensable au MVP, **S** = souhaitable au MVP. Les identifiants reprennent ceux de la spec MVP ; les critères détaillés (Given / When / Then) seront écrits en phase Exigences (REQ-2).

**Salon (gérant)**

| ID | Exigence | Prio. |
| --- | --- | --- |
| S-01 | Inscrire son salon : nom, adresse suggérée par la Base Adresse Nationale, téléphone, SIRET vérifié en ligne (code NAF 96.02A ou B, sinon dossier « à vérifier ») ; brouillon sauvegardé en continu et conservé 7 jours | I |
| S-02 | Indiquer s'il coiffe avec l'interrupteur « Je coiffe », modifiable à tout moment depuis le dashboard | I |
| S-03 | Définir horaires d'ouverture (plusieurs plages par jour possibles) et fermetures exceptionnelles ; « copier sur la semaine » | I |
| S-04 | Ajouter ses coiffeurs (prénom, nom, spécialités, e-mail) ; invitation envoyée ; 20 maximum | I |
| S-05 | Définir ses prestations : nom, durée de 15 à 180 min, prix, spécialité requise ; suggestions pré-remplies | I |
| S-06 | Télécharger le QR code de l'affiche du salon en PDF A4 ; régénérable en cas d'abus | I |
| S-07 | Tester le parcours avec un client fictif, puis publier après validation de la plateforme | I |
| S-08 | Ouvrir, mettre en pause et fermer la file en un clic ; visible côté client en moins de 2 s | I |
| S-09 | Voir en temps réel la file et chaque coiffeur (statut, client en cours, fin estimée, prochains clients), sans aucun numéro de téléphone | I |
| S-10 | Inscrire en 10 s un client présent : prénom, téléphone, prestation, coiffeur optionnel ; SMS de confirmation avec lien de suivi | I |
| S-11 | Déclarer un coiffeur absent, en retard ou partant plus tôt ; aperçu de l'impact avant confirmation | I |
| S-12 | Retirer un ticket en cas d'urgence, avec motif obligatoire envoyé au client | I |
| S-13 | Réaffecter un ticket à un autre coiffeur, seulement si l'heure du client ne recule pas (sinon accord du client) | S |
| S-14 | Recevoir un récapitulatif de fin de journée par e-mail et sur le dashboard | S |
| S-15 | Voir, à partir de 2 h avant la fermeture, les clients à risque ; à la fermeture, choisir « Servir » ou « Annuler avec excuses » pour les clients restants | I |
| S-16 | Déconnecter à distance le compte d'un coiffeur (téléphone perdu, départ du salon) | I |

**Coiffeur (espace coiffeur, sur son téléphone)**

| ID | Exigence | Prio. |
| --- | --- | --- |
| C-01 | Activer son compte depuis l'invitation (lien à usage unique, 72 h), installer Zelaté Pro sur son téléphone et se connecter par lien magique | I |
| C-02 | Se déclarer disponible, en pause (type et durée) ou en fin de journée ; recalcul immédiat | I |
| C-03 | Voir sa file : prochains clients (qui le demandent ou sans préférence), prénom, prestation, durée, statut d'approche, réponse à T-30 ; prochain client en haut ; bandeau rouge et actions bloquées si la connexion est perdue | I |
| C-04 | Appeler le prochain client éligible ; deux appels simultanés impossibles ; « votre tour » envoyé en moins de 5 s | I |
| C-05 | Valider l'arrivée d'un client en saisissant le code de son ticket ; code d'un autre salon ou déjà utilisé refusé | I |
| C-06 | Commencer la prestation en confirmant prestation et durée | I |
| C-07 | Ajuster la durée en cours : +5, +15, +30, +45 min | I |
| C-08 | Terminer la prestation ; durée réelle enregistrée ; prochain client mis en avant | I |
| C-09 | Gérer un client appelé qui n'arrive pas : compteur de 10 min, « Prendre le suivant » si le client a déclaré un retard (2 places max) ; libération automatique à 10 min | I |
| C-10 | Voir son bilan du jour | S |

**Client**

| ID | Exigence | Prio. |
| --- | --- | --- |
| U-01 | Voir les salons ouverts autour de soi en liste et sur carte (rayon 5 km, tri par distance, attente et fraîcheur de l'information) ; recherche par adresse si la géolocalisation est refusée ; salons non inscrits absents de la carte | I |
| U-02 | Consulter la fiche d'un salon : photos, horaires, prestations et prix, coiffeurs, attente | I |
| U-03 | S'identifier par numéro de téléphone : code à 6 chiffres, 5 min, 3 essais, renvoi après 30 s | I |
| U-04 | Rejoindre la file : prestation, coiffeur demandé ou premier disponible, heure d'arrivée, consentement aux notifications ; récapitulatif avec la règle des 10 min ; un seul ticket actif | I |
| U-05 | Rejoindre la file en scannant le QR de l'affiche du salon, dans le navigateur, sans installation | I |
| U-06 | Suivre sa position et son heure de passage en temps réel (moins de 2 s page ouverte, sinon toutes les 30 s) ; code du ticket bien visible | I |
| U-07 | Répondre à « votre tour approche » : à l'heure, en retard de 5 à 30 min, ou j'annule | I |
| U-08 | Annuler sa place sans pénalité | I |
| U-09 | Installer l'application et activer les notifications, avec guide pour iPhone ; refus sans conséquence | I |
| U-10 | Savoir pourquoi son heure de passage change | S |
| U-11 | Être prévenu une fois s'il risque de ne pas être pris avant la fermeture, et choisir « Je reste » ou « J'annule » | I |
| U-12 | Choisir « attendre » ou « premier disponible » quand le coiffeur demandé devient indisponible | I |

**Plateforme**

| ID | Exigence | Prio. |
| --- | --- | --- |
| P-01 | Valider ou refuser un salon à la main, avec résultat SIRET affiché ; refus motivé envoyé au gérant | I |
| P-02 | Consulter le journal d'audit : qui, quand, quoi, motif ; filtrable par salon | I |
| P-03 | Limiter les abus : un ticket actif par numéro, plafonds de codes SMS par numéro et par IP, avertissement après 5 absences en 30 jours | S |

### 5.4 Notifications

Le push est le canal par défaut ; le SMS ne part que si le client n'a pas de push actif, sauf « votre tour » qui part toujours par les deux canaux. **Plafond : 3 SMS par ticket**, hors annulation par le salon. Pendant le pilote, les SMS sont **pris en charge par Zelaté** ; le modèle de facturation sera décidé avec le coût réel mesuré.

| Événement | Déclencheur | Push | SMS |
| --- | --- | --- | --- |
| Inscription | Ticket créé | Oui | Si pas de push (SMS 1) |
| Votre tour approche | Heure de passage à 30 min ou moins, une fois | Oui, avec trois réponses | Non, la page de suivi porte les réponses |
| Préparez-vous | Heure de passage à 10 min ou moins | Oui | Si pas de push (SMS 2) |
| Votre tour | Le coiffeur appelle | Oui, priorité haute | Toujours (SMS 3) |
| Rappel | 5 min après l'appel sans arrivée | Oui | Non |
| Place libérée | 10 min après l'appel sans arrivée | Oui | Non |
| Changement d'heure | Variation de 10 min ou plus | Oui | Non |
| Recul | Retard déclaré (H5) | Oui | Non |
| Choix de coiffeur | Coiffeur demandé indisponible | Oui | Si pas de push, dans la limite du plafond |
| Risque de fin de journée | H9, une fois | Oui | Si pas de push, dans la limite du plafond |
| Annulation par le salon | Retrait, fermeture, fin de journée | Oui | Oui, hors plafond |

Le détail de ce que voit chaque écran est dans [APP_FLOW §7](./APP_FLOW.md#7-événements-système-et-notifications).

---

## 6. Exigences non fonctionnelles

| Exigence | Cible |
| --- | --- |
| Propagation d'une action (espace coiffeur → dashboard et client) | < 2 s pour 95 % des événements (1 s visé) |
| Repli sans temps réel | Rafraîchissement toutes les 30 s côté client, 10 s côté coiffeur et dashboard |
| Accueil client sur mobile 4G | Affiché en < 3 s |
| Fiche salon | Chargée en < 2 s |
| Charge du pilote | 3 salons × 5 coiffeurs × 100 tickets par jour, sans dégradation |
| Perte de connexion de l'espace coiffeur | Bandeau rouge, actions bloquées, reconnexion automatique, aucune donnée perdue |
| Appareil du coiffeur | Aucune donnée client conservée sur le téléphone (pas de cache des données, pas de stockage local) ; déconnexion à distance |
| Navigateurs | Safari iOS 16.4+, Chrome Android récent (clients et coiffeurs) ; Chrome, Edge, Safari, Firefox sur ordinateur ; tablettes au lot 2 |
| Installation | Deux PWA installables ; Lighthouse PWA et performance > 90 |
| Accessibilité | RGAA niveau AA ; cibles tactiles ≥ 44 px ; clavier et lecteur d'écran |
| Sécurité | OWASP ASVS niveau 2 ; isolation par salon testée automatiquement ; journal d'audit inaltérable |
| Données personnelles | Hébergement UE ; téléphone masqué ; consentements tracés ; prénom et historique client effacés après **12 mois** (à confirmer avec un conseil RGPD), statistiques anonymes conservées |
| Langue et marché | Français uniquement en V1 ; formats fr-FR ; numéros +33 ; adresses BAN ; SIRET |
| Dictionnaire des textes | Aucun texte en dur dans le code ; fichiers par typologie ; clés en anglais et typées |
| Code | Entièrement en anglais (noms, fichiers, commentaires, commits) ; seuls les textes affichés sont en français |

Le détail technique de chaque exigence est dans le [TRD](./TRD.md).

---

## 7. Interface (UI)

### 7.1 Principes d'expérience
1. **Un ticket en moins d'une minute**, avec ou sans app.
2. **Une action, un geste** dans l'espace coiffeur : appeler, commencer, terminer. Les gestes critiques refusent le double déclenchement.
3. **Transparence** : chaque changement d'heure ou de position affiche sa raison. L'heure de dernière mise à jour est toujours visible.
4. **État de connexion visible** : un écran qui n'est plus synchronisé le dit et bloque les actions.
5. **Lisible d'un coup d'œil** : l'espace coiffeur se lit sur un téléphone posé au poste, mains occupées.
6. **Chaleureux et direct** : le ton du prototype, vouvoiement, phrases courtes.

### 7.2 Écrans du MVP

| Espace | Écrans | Déjà dans le prototype |
| --- | --- | --- |
| Client | Accueil (liste + carte), fiche salon, rejoindre la file (prestation, coiffeur, heure d'arrivée), identification par code SMS, récapitulatif, ticket avec son code, suivi en temps réel, compteur après appel, réponse T-30, alerte de fin de journée, choix de coiffeur, annulation, suivi par lien SMS, guide d'installation, compte | Recherche liste + carte, fiche salon en panneau, choix de l'heure, bandeau ticket |
| Espace coiffeur (téléphone) | Connexion, ma file, prochain client, appel en cours avec compteur, saisie du code d'arrivée, prestation en cours, client en retard, pause, bilan du jour | File coiffeur, prochaine cliente (à adapter au téléphone) |
| Dashboard | Connexion, inscription salon, attente de validation, wizard (horaires, équipe, prestations, QR de l'affiche, test), vue temps réel, interrupteur « Je coiffe », inscription walk-in, déclaration d'absence, retrait, réaffectation, fin de journée, équipe, prestations, horaires, journal, récapitulatif | Charge par coiffeur |
| Admin | Liste des dossiers, détail d'un dossier, journal d'audit | — |

La navigation et l'effet de chaque clic sont décrits dans [APP_FLOW](./APP_FLOW.md) ; les composants et les jetons visuels dans [DESIGN_SYSTEM](./DESIGN_SYSTEM.md).

---

## 8. Métriques de succès

L'indicateur principal du pilote, validé le 16/10, est la **précision de l'heure annoncée**. Les autres cibles marquées « proposition » seront revues au bilan du pilote ; tout est mesuré dès le premier jour.

| Métrique | Définition | Cible pilote | Origine |
| --- | --- | --- | --- |
| **Précision de l'heure annoncée** (indicateur principal) | Écart entre l'heure annoncée à T-30 et le début réel de la prestation | 80 % des tickets à ±10 min | Validé (atelier du 16/10) |
| Écart à l'inscription | Écart entre l'heure annoncée à l'inscription et le début réel, par salon et par prestation | Suivi, sert à calibrer les durées | Spec MVP |
| Temps pour obtenir un ticket | De l'ouverture de la fiche salon (ou du scan QR) au ticket créé | Médiane < 60 s | Spec MVP |
| Temps d'inscription walk-in | De l'ouverture du formulaire à la création du ticket | Médiane ≤ 10 s | S-10 |
| Taux de complétion | Tickets terminés / tickets créés | ≥ 85 % | Proposition (exemple du cahier Coiffeur : 89 %) |
| Taux d'absence (no-show) | Tickets « absent » / tickets créés | ≤ 8 % | Proposition (exemple du cahier Coiffeur : 5 %) |
| Taux d'annulation client | Tickets annulés par le client / tickets créés | Suivi | Cahier Coiffeur |
| Clients non servis en fin de journée | Tickets annulés pour fin de journée / tickets créés | Suivi | H9 |
| Part de tickets numériques | Tickets app + QR / tous les tickets | ≥ 50 % en semaine 4 | Proposition |
| Activation des notifications push | Clients avec push actif / clients avec ticket | Suivi, base du budget SMS | Cahier Utilisateurs |
| Coût SMS par ticket | Coût SMS total / tickets créés | Mesuré pendant le pilote, sert à fixer le modèle de facturation | Atelier du 16/10 |
| Latence temps réel | Délai action → affichage sur les autres écrans | p95 < 2 s | NFR |
| Rétention des salons pilotes | Salons qui utilisent Zelaté chaque jour d'ouverture | Tous après 4 semaines | Proposition |
| Satisfaction gérant | Note sur 5 après 4 semaines | ≥ 4,5 / 5 | Cahier Salon |
| Délai de validation d'un salon | Soumission → décision | < 24 h (48 h maximum) | Cahier Salon |

**Instrumentation** : chaque métrique est calculée à partir des tables `tickets` et `ticket_events` (horodatages), sans outil d'analytique tiers pour les données nominatives. La mesure d'audience du site reste sans cookie.

---

## 9. Questions ouvertes et risques

### Questions ouvertes
1. **Salons pilotes** : lesquels, combien (1 à 3), à partir de quand. *Bloque la clôture de l'étape 0.*
2. Durée de conservation de 12 mois : à confirmer avec un conseil RGPD.
3. Disponibilité de la marque « Zelaté » à l'INPI (les domaines zelate.com et zelate.fr étaient libres le 16/10).
4. Lot 2 : nombre de tablettes, calendrier de la location et du financement Innov'Up.
5. Système de pénalité d'annulation : à étudier après le pilote.
6. Modèle de facturation des SMS : à fixer avec le coût réel du pilote.

### Risques

| Risque | Effet | Parade |
| --- | --- | --- |
| Heure annoncée peu fiable au début | Les clients reviennent attendre au salon | Mesure dès le jour 1, durées ajustables par le coiffeur, calibrage en V1 |
| Notifications web limitées sur iPhone (PWA installée requise, iOS 16.4+) | Clients non prévenus | SMS de secours obligatoire, guide d'installation |
| Coût SMS pris en charge par Zelaté pendant le pilote | Dépense non maîtrisée | Plafond de 3 SMS par ticket, push d'abord, suivi du coût par ticket |
| Coiffeurs sur leur téléphone personnel | Réticence, téléphone oublié ou déchargé, données clients exposées | Aucune donnée stockée sur l'appareil, déconnexion à distance, le gérant peut agir à sa place depuis le dashboard ; tablettes au lot 2 |
| Adoption par les coiffeurs | Retour au papier | Gestes uniques, test terrain avant le pilote |
| Fraude au trafic SMS (codes OTP) | Facture SMS | Plafonds par numéro, par IP et par pays (+33 uniquement) |

---

## 10. Glossaire

| Terme métier | Terme technique | Définition |
| --- | --- | --- |
| Salon | `salon` | Établissement de coiffure inscrit, avec une seule file |
| Gérant | `manager` | Responsable du salon ; peut aussi coiffer (« Je coiffe ») |
| Coiffeur | `stylist` | Membre de l'équipe qui reçoit des clients |
| Espace coiffeur | `/stylist` | Partie de Zelaté Pro utilisée par le coiffeur, sur son téléphone au lot 1 |
| Ticket | `ticket` | Place d'un client dans la file d'un salon pour une journée |
| Code du ticket | `short_code` | 5 caractères que le client donne au coiffeur à son arrivée |
| Prestation | `service` | Ce que le client vient faire, avec une durée et un prix |
| File | `queue` | Ensemble des tickets actifs d'un salon |
| Coiffeur demandé | `requested_member_id` | Coiffeur choisi par le client (option) |
| Coiffeur pressenti | `estimated_member_id` | Coiffeur retenu par la simulation pour estimer l'heure d'un ticket sans préférence |
| Heure de passage | `estimated_start_at` | Heure estimée du début de la prestation |
| Walk-in | `front_desk` | Client inscrit à l'accueil par le gérant |
| Appel | `called` | Le coiffeur demande au client de venir ; le compteur de 10 min démarre |
| Absent | `no_show` | Client appelé qui n'est pas venu dans les 10 min |
| Fin de journée | `end_of_day` | Fenêtre de 2 h avant la fermeture où les clients à risque sont prévenus |
| T-30, T-10 | `turn_approaching`, `get_ready` | Alertes 30 et 10 min avant l'heure de passage |
| Tablette (lot 2) | `device` | Appareil partagé du salon, appairé par le gérant, déverrouillé par PIN |

---

## 11. Journal des décisions

Atelier de validation de l'étape 0 avec Ely, 16/10/2026, et précisions du même jour.

| N° | Sujet | Décision |
| --- | --- | --- |
| 1 | File (H1) | File unique, distribution automatique au premier coiffeur libre ; coiffeur demandé en option |
| 2 | Durées (H2) | Durées prédéfinies par prestation ; ajustement +5 / +15 / +30 / +45 min par le coiffeur |
| 3 | Notifications (H3) | Validé ; 3 SMS maximum pour le moment |
| 4 | Client absent (H4) | Compteur de 10 min, rappel à 5 min, place libérée automatiquement à 10 min |
| 5 | Réorganisation (H5) | Validé |
| 6 | Téléphone (H6) | Validé ; bouton « Appeler » à numéro masqué en V1 |
| 7 | Arrivée (H7) | Par le code du ticket ; pas de QR à l'arrivée ; QR de l'affiche conservé pour rejoindre la file |
| 8-11 | Une place à la fois, pas de recul par réaffectation, annulation sans pénalité, retard de 5 à 30 min | Validé |
| 12 | Gérant qui coiffe | Interrupteur « Je coiffe » à tout moment ; bouton « Je prends le prochain » quand il est coupé |
| 13 | Hors première version | Validé |
| 14 | Heure d'arrivée déclarée (H8) | A : le suivant passe, le client reprend la tête de file à son arrivée |
| 15 | Coiffeur demandé indisponible sans réponse | A : premier disponible si absent toute la journée, sinon il attend |
| 16 | Walk-in | Le gérant seulement |
| 17 | Absences répétées | 5 absences en 30 jours, avertissement seul |
| 18 | Appareil des coiffeurs | Lot 1 : leur propre téléphone, sans donnée client stockée ; lot 2 : petites tablettes louées (financement Innov'Up) |
| 19 | Fin de journée (H9) | Alerte à partir de 2 h avant la fermeture par un calcul simple ; à la fermeture, le gérant décide ; sinon annulation automatique 15 min après |
| 20 | Validation des salons | À la main au pilote, automatique en V1 |
| 21 | Conservation | 12 mois, à confirmer avec un conseil RGPD |
| 22 | Place pour un tiers | Pas dans la première version |
| 23 | Salons non inscrits sur la carte | Non, pas encore |
| 24 | Données sensibles coiffeur | Hors première version, avis juridique avant la V2 |
| 25 | Nom | « Zelaté » et « Zelaté Pro » ; zelate.com et zelate.fr disponibles |
| 26 | SMS | Pris en charge pendant le pilote, modèle décidé ensuite |
| 27 | Chiffres d'impact | Aucun chiffre avant les résultats du pilote |
| 28 | Indicateur principal | 80 % des clients à 10 min près de l'heure annoncée à T-30 |
| 29 | Salons pilotes | À désigner |
| 30 | Qui tranche | Ely pour les règles métier, Koni pour les choix techniques |
