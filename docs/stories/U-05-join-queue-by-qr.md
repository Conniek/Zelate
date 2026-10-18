# U-05 · Rejoindre la file en scannant le QR code du salon

**En tant que** client qui passe devant le salon, **je veux** rejoindre sa file en scannant le QR code de l'affiche, dans mon navigateur et sans rien installer, **afin d'**obtenir une place en moins d'une minute.

- Priorité : I (PRD §5.3)
- Règles appliquées : H7 (pas de QR à l'arrivée ; le QR de l'affiche sert seulement à rejoindre la file, décision n° 7, PRD §11) ; mêmes règles que U-04 (H1, H2, H4, H8, un seul ticket actif) ; navigateurs Safari iOS 16.4+ et Chrome Android récent (PRD §6)
- Parcours : F-C4 → F-C3 (étapes 1 à 5) → F-C5 (APP_FLOW §3) ; « J'ai rendez-vous » → F-C12 (U-14) ; suivi par lien SMS F-C10 ; garde « ticket actif » (APP_FLOW §2.3)
- Commandes et données : RPC `resolve_qr_token(qr_token)` · `join_queue` avec `channel` = `qr` (codes `queue.queue_closed`, `queue.queue_paused`, `queue.queue_full`, `queue.already_has_active_ticket`, `queue.service_unavailable`, `queue.stylist_unavailable`, TRD §6.2) · `check_in_appointment` (U-14) · Edge Function `ticket-public` (lien court) · tables `salons` (`qr_token`, `status`), `tickets` (`channel`, `tracking_token`, `tracking_short_code`), `notifications` (`ticket_created`)

## Scénarios

### 1. Scan d'un QR valide
- **Étant donné** un salon publié dont le QR code de l'affiche est à jour
- **Quand** je scanne le QR avec l'appareil photo de mon téléphone
- **Alors** mon navigateur s'ouvre sur `/q/:qrToken`, sans installation
- **Et** deux choix me sont proposés : « Rejoindre la file » et « J'ai rendez-vous »
- **Quand** je touche « Rejoindre la file »
- **Alors** l'étape 1 de « Rejoindre la file » s'affiche avec l'en-tête « Vous êtes chez *nom du salon* »

### 1 bis. « J'ai rendez-vous » (renvoi vers U-14)
- **Étant donné** que j'ai scanné un QR valide et que les deux choix sont affichés
- **Quand** je touche « J'ai rendez-vous »
- **Alors** le parcours « Se signaler pour un rendez-vous » s'ouvre (`/salons/:slug/check-in`, F-C12)
- **Et** aucune étape de « Rejoindre la file » n'est affichée

### 2. Parcours complet dans le navigateur
- **Étant donné** que j'ai scanné le QR et que je ne suis pas connecté
- **Quand** je choisis ma prestation, mon coiffeur et mon heure, je m'identifie par code SMS et je touche « Confirmer ma place »
- **Alors** un ticket « En attente » est créé avec le canal `qr`
- **Et** l'écran « Mon ticket » s'affiche dans le navigateur, sans que l'app soit installée

### 3. SMS d'inscription avec le lien de suivi
- **Étant donné** que je viens de rejoindre la file par le QR et que je n'ai pas de push actif
- **Quand** le ticket est créé
- **Alors** je reçois le SMS d'inscription (SMS 1) avec le lien court de suivi `zelate.fr/t/xxxxxxxx` (8 caractères)
- **Et** ce SMS part même si je n'ai pas coché « Me prévenir » (message indispensable, K11)
- **Quand** j'ouvre ce lien
- **Alors** le lien court est résolu par `ticket-public`
- **Et** le suivi de mon ticket s'affiche sans session (F-C10)

### 4. QR régénéré
- **Étant donné** que le gérant a régénéré le QR code du salon
- **Quand** je scanne l'ancien QR
- **Alors** le message « Ce QR code n'est plus valide, demandez à l'accueil » s'affiche
- **Et** aucune étape de « Rejoindre la file » n'est proposée

### 5. Jeton inconnu
- **Étant donné** un QR dont le jeton ne correspond à aucun salon
- **Quand** je le scanne
- **Alors** le message « Ce QR code n'est plus valide, demandez à l'accueil » s'affiche

### 6. Déjà un ticket actif
- **Étant donné** que je suis connecté dans ce navigateur avec un ticket actif
- **Quand** je scanne le QR d'un salon et que je touche « Rejoindre la file » ou « J'ai rendez-vous »
- **Alors** je suis redirigé vers `/ticket`
- **Et** le message « Vous avez déjà une place » s'affiche

### 7. File fermée, en pause ou complète au moment de confirmer
- **Étant donné** que j'ai scanné le QR, choisi « Rejoindre la file », et que la file est fermée, en pause ou complète au moment où je confirme
- **Quand** je touche « Confirmer ma place »
- **Alors** aucun ticket n'est créé
- **Et** le message d'erreur `queue.queue_closed`, `queue.queue_paused` ou `queue.queue_full` s'affiche avec « Salons proches »

### 8. Navigateurs pris en charge
- **Étant donné** un iPhone sous Safari iOS 16.4 ou plus, ou un Android avec un Chrome récent
- **Quand** je scanne le QR et que je fais tout le parcours
- **Alors** je peux obtenir un ticket sans installer d'application

## Textes à prévoir
| Clé (anglais) | Texte (français) | Contrainte |
| --- | --- | --- |
| `client.qr.header` | « Vous êtes chez {salonName} » | `salonName` jusqu'à 80 caractères |
| `client.qr.choice.join_queue` | « Rejoindre la file » | — |
| `client.qr.choice.have_appointment` | « J'ai rendez-vous » | Partagé avec U-14 |
| `client.qr.invalid` | « Ce QR code n'est plus valide, demandez à l'accueil » | — |
| `errors.queue.queue_paused` | La file est en pause : aucune nouvelle inscription pour le moment. Réessayez à sa reprise. | Partagé avec U-04 |
| `notifications.ticket_created.sms` | {salon_name} : inscription confirmée. {count, plural, =0 {Personne avant vous} one {# client avant vous} other {# clients avant vous}}, passage vers {time}. Code {code}. Suivi : {link} | Partagé avec U-04 ; SMS : 160 caractères GSM-7 au plus, avec lien court `zelate.fr/t/xxxxxxxx` ; prénom ≤ 30, nom du salon tronqué à 40, accents translittérés (K5) |

## Questions ouvertes
- **APP_FLOW F-C4** : l'entrée par QR mène directement aux deux choix puis à l'étape 1, sans passer par la fiche qui affiche « Fermé », « File en pause » ou « Complet pour aujourd'hui ». Faut-il montrer cet état dès le scan, ou seulement au moment de confirmer (erreur `queue.queue_closed`, `queue.queue_paused` ou `queue.queue_full`) ? Le choix « J'ai rendez-vous » reste-t-il proposé quand la file est en pause ou complète (`check_in_appointment` ne refuse que `queue_closed`, TRD §6.2) ?
- **Résolu le 18/10** (K5) — Lien du SMS : lien court `zelate.fr/t/xxxxxxxx` (8 caractères), résolu par l'Edge Function `ticket-public` ; voir scénario 3.
- **APP_FLOW F-C4 / BACKEND_SCHEMA §8.1** : `resolve_qr_token` ne renvoie que les salons publiés. Quel message affiche le scan du QR d'un salon non publié ou suspendu : « Ce QR code n'est plus valide » ou un autre ?
- **APP_FLOW F-C4 / F-C9** : sur Android, un client venu par QR peut-il activer le push dans le navigateur sans installer l'app ? Si oui, le SMS d'inscription ne part pas et le lien de suivi n'arrive pas par SMS (voir U-09).
