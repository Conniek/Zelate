# DESIGN SYSTEM — Zelaté

> version 0.3 · 18/10/2026 · statut : première version à reprendre dans Figma
> v0.3 : rendez-vous du salon (PRD v1.1) — statuts « rendez-vous » et « à confirmer », badge de créneau libre, `AppointmentBadge`, `PendingConfirmationCard`, `ReassignmentPrompt`, `TimePicker` réutilisé pour l'heure du rendez-vous ; case de consentement décochée par défaut.
> v0.2 : espace coiffeur conçu pour le téléphone du coiffeur (lot 1) ; code du ticket à la place du QR d'arrivée ; compteur de 10 min ; boutons de durée +5 / +15 / +30 / +45 ; `PinPad` reporté au lot 2.
> Base : jetons du prototype Figma Make (polices DM Sans et Manrope ; encre `#1c1831`, violet `#7146e8`, crème `#f8f7f3`, vert `#13795b`). Les autres valeurs sont **proposées** et marquées 🟡 ; elles se valident ou se corrigent dans Figma, puis ce fichier est mis à jour.
> Documents liés : [PRD](./PRD.md) · [TRD](./TRD.md) · [APP_FLOW](./APP_FLOW.md) · [BACKEND_SCHEMA](./BACKEND_SCHEMA.md) · [IMPLEMENTATION_PLAN](./IMPLEMENTATION_PLAN.md)

**Règle de fonctionnement** : Figma et le code partagent **les mêmes noms de jetons**. Un composant n'utilise jamais une couleur, une taille ou un espacement en valeur brute, seulement un jeton. Toute nouvelle valeur passe d'abord par ce document.

---

## 1. Principes

1. **Chaleureux et clair** : fond crème, encre profonde, un seul accent violet ; pas de dégradés décoratifs.
2. **Lisible d'un coup d'œil dans l'espace coiffeur** (téléphone posé au poste, mains occupées) : textes d'action ≥ 18 px, boutons de 56 px de haut dans une barre en bas d'écran, contrastes AA au minimum.
3. **Une couleur = un sens** : le violet pour l'action principale, le vert pour « c'est votre tour / arrivé », l'ambre pour « attention », le rouge pour « problème ». Jamais la couleur seule : toujours une icône ou un texte.
4. **Accessible par construction** : RGAA AA, focus toujours visible, cibles ≥ 44 px, mouvement réduit respecté.
5. **Sobre** : deux familles de polices auto-hébergées en woff2 et sous-ensemble latin, icônes à la pièce, pas d'image décorative lourde.

---

## 2. Couleurs

### 2.1 Palette de base

| Jeton | Valeur | Source | Usage |
| --- | --- | --- | --- |
| `ink-900` | `#1c1831` | Prototype | Texte principal, titres |
| `ink-700` | `#3a3550` | 🟡 | Texte sur fonds teintés |
| `ink-500` | `#5f5a73` | 🟡 | Texte secondaire |
| `ink-400` | `#8c879c` | 🟡 | Bordures de champs, icônes inactives |
| `ink-200` | `#d9d6e0` | 🟡 | Séparateurs |
| `ink-100` | `#e7e5df` | 🟡 | Bordures décoratives de cartes |
| `cream-50` | `#f8f7f3` | Prototype | Fond des pages |
| `white` | `#ffffff` | — | Surfaces (cartes, panneaux) |
| `violet-50` | `#efeafd` | 🟡 | Fond de sélection, puces |
| `violet-100` | `#ddd3fb` | 🟡 | Fond survolé |
| `violet-500` | `#7146e8` | Prototype | Action principale |
| `violet-600` | `#5b36c9` | 🟡 | Action principale survolée, liens |
| `violet-700` | `#4a2ba6` | 🟡 | Action principale pressée |
| `green-50` | `#e6f4ee` | 🟡 | Fond succès |
| `green-600` | `#13795b` | Prototype | Succès, « votre tour », « arrivé » |
| `green-700` | `#0f5e46` | 🟡 | Texte succès sur fond clair |
| `amber-50` | `#fef3c7` | 🟡 | Fond avertissement |
| `amber-700` | `#b54708` | 🟡 | Icônes avertissement |
| `amber-800` | `#92400e` | 🟡 | Texte avertissement |
| `red-50` | `#fdecea` | 🟡 | Fond erreur |
| `red-700` | `#b42318` | 🟡 | Erreur, action destructive |
| `blue-700` | `#1d5fa8` | 🟡 | Information |

### 2.2 Jetons sémantiques (ceux qu'utilisent les composants)

| Jeton | Valeur | Rôle |
| --- | --- | --- |
| `bg` | `cream-50` | Fond de page |
| `surface` | `white` | Cartes, panneaux, boîtes de dialogue |
| `surface-muted` | `cream-50` | Zones secondaires dans une carte |
| `text` | `ink-900` | Texte courant |
| `text-muted` | `ink-500` | Texte secondaire, métadonnées |
| `text-on-primary` | `white` | Texte sur bouton principal |
| `border` | `ink-100` | Contour des cartes (décoratif) |
| `border-strong` | `ink-400` | Contour des champs et contrôles (doit atteindre 3:1) |
| `primary` | `violet-500` | Bouton principal, élément actif |
| `primary-hover` | `violet-600` | Survol |
| `primary-active` | `violet-700` | Pression |
| `primary-subtle` | `violet-50` | Sélection, puce active |
| `link` | `violet-600` | Liens dans le texte |
| `success` / `success-subtle` / `success-text` | `green-600` / `green-50` / `green-700` | Votre tour, arrivé, terminé |
| `warning` / `warning-subtle` / `warning-text` | `amber-700` / `amber-50` / `amber-800` | Retard, pause, « à vérifier » |
| `danger` / `danger-subtle` / `danger-text` | `red-700` / `red-50` / `red-700` | Erreur, absent, retrait, connexion perdue |
| `info` | `blue-700` | Information neutre |
| `focus-ring` | `violet-600`, 2 px + décalage 2 px | Focus clavier |

### 2.3 Contrastes vérifiés (WCAG 2.1)

| Paire | Ratio | Utilisable pour |
| --- | --- | --- |
| `ink-900` sur `cream-50` | 16,0 | Tout texte |
| `white` sur `violet-500` | 5,61 | Texte de bouton (AA) |
| `violet-500` sur `cream-50` | 5,23 | Texte et icônes (AA) |
| `violet-600` sur `white` | 7,46 | Liens (AAA) |
| `violet-600` sur `violet-50` | 6,34 | Puce active |
| `green-600` sur `white` | 5,37 | Texte succès |
| `green-700` sur `green-50` | 6,84 | Bandeau succès |
| `amber-800` sur `amber-50` | 6,37 | Bandeau avertissement |
| `red-700` sur `white` | 6,57 | Texte d'erreur |
| `red-700` sur `red-50` | 5,75 | Bandeau d'erreur |
| `ink-500` sur `cream-50` | 6,13 | Texte secondaire |
| `ink-400` sur `white` | 3,46 | Contours de champs (≥ 3:1) ; **pas** pour du texte |
| `ink-100` sur `white` | 1,26 | Décoratif seulement |

### 2.4 Couleur des statuts

| Statut | Fond | Texte / icône | Icône | Libellé |
| --- | --- | --- | --- | --- |
| Ticket `pending_confirmation` | `warning-subtle` | `warning-text` | `hourglass` | À confirmer |
| Ticket `waiting` | `surface-muted` | `text` | `clock` | En attente |
| Rendez-vous (type `appointment`) | `primary-subtle` | `link` | `calendar-clock` | RDV 14h30 |
| Rendez-vous en retard | `warning-subtle` | `warning-text` | `calendar-clock` | RDV 14h30 · +20 min |
| Ticket `called` | `success-subtle` | `success-text` | `bell-ring` | C'est votre tour |
| Ticket `in_service` | `primary-subtle` | `link` | `scissors` | En prestation |
| Ticket `completed` | `surface-muted` | `text-muted` | `check` | Terminé |
| Ticket `cancelled` | `surface-muted` | `text-muted` | `x` | Annulé |
| Ticket `no_show` | `danger-subtle` | `danger-text` | `user-x` | Absent |
| Approche « en retard » | `warning-subtle` | `warning-text` | `timer` | En retard de X min |
| Coiffeur `available` | `success-subtle` | `success-text` | `circle-check` | Disponible |
| Coiffeur `on_break` | `warning-subtle` | `warning-text` | `coffee` | En pause |
| Coiffeur `absent` | `danger-subtle` | `danger-text` | `circle-off` | Absent |
| File `open` | `success-subtle` | `success-text` | `door-open` | Ouverte |
| File `paused` | `warning-subtle` | `warning-text` | `pause` | En pause |
| File `closed` | `surface-muted` | `text-muted` | `door-closed` | Fermée |
| Créneau libre | `success-subtle` | `success-text` | `calendar-plus` | Créneau libre à 15h20 |

**Thème sombre** : hors MVP. Les jetons sémantiques permettent de l'ajouter sans toucher aux composants.

---

## 3. Typographie

| Famille | Rôle | Graisses | Chargement |
| --- | --- | --- | --- |
| **Manrope** | Titres, chiffres clés (attente, heure, position) | 600, 700, 800 | woff2 auto-hébergé, sous-ensemble latin, `font-display: swap` |
| **DM Sans** | Texte courant, interface | 400, 500, 600 | Idem |

Repli : `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`. Chiffres tabulaires (`font-variant-numeric: tabular-nums`) pour les heures, minuteurs et positions.

### Échelle 🟡

| Jeton | Taille / interligne | Famille, graisse | Usage |
| --- | --- | --- | --- |
| `display` | 40 / 44 px | Manrope 800 | Heure de passage, position sur le ticket |
| `h1` | 30 / 36 px | Manrope 700 | Titre d'écran |
| `h2` | 24 / 30 px | Manrope 700 | Titre de section, prénom du prochain client (espace coiffeur) |
| `h3` | 20 / 26 px | Manrope 600 | Titre de carte |
| `body-lg` | 18 / 26 px | DM Sans 400 | Texte de l'espace coiffeur |
| `body` | 16 / 24 px | DM Sans 400 | Texte courant (minimum sur mobile) |
| `body-sm` | 14 / 20 px | DM Sans 400 | Métadonnées, aides de champ |
| `label` | 14 / 20 px | DM Sans 600 | Libellés de champs, puces |
| `caption` | 12 / 16 px | DM Sans 500 | Mentions « mis à jour à… » (jamais pour une information essentielle) |
| `button` | 16 / 20 px (mobile), 18 / 24 px (espace coiffeur) | DM Sans 600 | Boutons |

Règles : longueur de ligne ≤ 70 caractères ; pas de texte en majuscules continues ; tailles en `rem` pour respecter le zoom du navigateur.

---

## 4. Espacements, formes et mise en page

### Espacements (base 4 px)
`space-0` 0 · `space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-12` 48 · `space-16` 64 (px). L'échelle par défaut de Tailwind v4 (`--spacing: 0.25rem`) la produit déjà.

### Rayons 🟡
`radius-sm` 8 px (puces, champs) · `radius-md` 12 px (boutons) · `radius-lg` 16 px (cartes) · `radius-xl` 24 px (panneaux, feuilles mobiles) · `radius-full` (avatars, badges ronds).

### Ombres 🟡
`shadow-sm` : `0 1px 2px rgb(28 24 49 / 0.06)` (cartes) · `shadow-md` : `0 4px 12px rgb(28 24 49 / 0.08)` (menus, carte épinglée) · `shadow-lg` : `0 12px 32px rgb(28 24 49 / 0.12)` (boîtes de dialogue).

### Points de rupture et gabarits

| Nom | Largeur | Gabarit |
| --- | --- | --- |
| mobile | < 640 px | Une colonne, marges 16 px, barre d'action fixée en bas ; gabarit de référence de l'app client **et de l'espace coiffeur** |
| `sm` | ≥ 640 px | Mobile large |
| `md` | ≥ 768 px | Tablette portrait (dashboard ; espace coiffeur au lot 2) |
| `lg` | ≥ 1024 px | Dashboard en colonnes par coiffeur ; espace coiffeur en deux colonnes (file / en cours) au lot 2 |
| `xl` | ≥ 1280 px | Dashboard large, contenu centré à 1280 px |

### Profondeur (z-index)
`z-base` 0 · `z-sticky` 10 (barres fixées) · `z-overlay` 40 · `z-dialog` 50 · `z-toast` 60.

### Mouvement
Durées `fast` 120 ms, `base` 200 ms, `slow` 320 ms ; courbe `cubic-bezier(0.2, 0, 0, 1)`. Avec `prefers-reduced-motion: reduce`, les transitions de position deviennent des fondus de 120 ms et aucune animation ne boucle.

---

## 5. Implémentation Tailwind v4

Fichier `packages/ui/src/theme.css`, importé par les deux apps. Les classes produites suivent les jetons : `bg-surface`, `text-text-muted`, `border-border-strong`, `bg-primary`, `rounded-lg`, `shadow-md`, `font-display`.

```css
@import "tailwindcss";

@theme {
  /* Base palette */
  --color-ink-900: #1c1831;
  --color-ink-700: #3a3550;
  --color-ink-500: #5f5a73;
  --color-ink-400: #8c879c;
  --color-ink-200: #d9d6e0;
  --color-ink-100: #e7e5df;
  --color-cream-50: #f8f7f3;
  --color-violet-50: #efeafd;
  --color-violet-100: #ddd3fb;
  --color-violet-500: #7146e8;
  --color-violet-600: #5b36c9;
  --color-violet-700: #4a2ba6;
  --color-green-50: #e6f4ee;
  --color-green-600: #13795b;
  --color-green-700: #0f5e46;
  --color-amber-50: #fef3c7;
  --color-amber-700: #b54708;
  --color-amber-800: #92400e;
  --color-red-50: #fdecea;
  --color-red-700: #b42318;
  --color-blue-700: #1d5fa8;

  /* Semantic tokens */
  --color-bg: var(--color-cream-50);
  --color-surface: #ffffff;
  --color-surface-muted: var(--color-cream-50);
  --color-text: var(--color-ink-900);
  --color-text-muted: var(--color-ink-500);
  --color-text-on-primary: #ffffff;
  --color-border: var(--color-ink-100);
  --color-border-strong: var(--color-ink-400);
  --color-primary: var(--color-violet-500);
  --color-primary-hover: var(--color-violet-600);
  --color-primary-active: var(--color-violet-700);
  --color-primary-subtle: var(--color-violet-50);
  --color-link: var(--color-violet-600);
  --color-success: var(--color-green-600);
  --color-success-subtle: var(--color-green-50);
  --color-success-text: var(--color-green-700);
  --color-warning: var(--color-amber-700);
  --color-warning-subtle: var(--color-amber-50);
  --color-warning-text: var(--color-amber-800);
  --color-danger: var(--color-red-700);
  --color-danger-subtle: var(--color-red-50);
  --color-danger-text: var(--color-red-700);
  --color-info: var(--color-blue-700);

  /* Typography */
  --font-display: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --text-display: 2.5rem;
  --text-display--line-height: 2.75rem;
  --text-h1: 1.875rem;
  --text-h1--line-height: 2.25rem;
  --text-h2: 1.5rem;
  --text-h2--line-height: 1.875rem;
  --text-h3: 1.25rem;
  --text-h3--line-height: 1.625rem;
  --text-body-lg: 1.125rem;
  --text-body-lg--line-height: 1.625rem;
  --text-body: 1rem;
  --text-body--line-height: 1.5rem;
  --text-body-sm: 0.875rem;
  --text-body-sm--line-height: 1.25rem;
  --text-caption: 0.75rem;
  --text-caption--line-height: 1rem;

  /* Shape */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  --shadow-sm: 0 1px 2px rgb(28 24 49 / 0.06);
  --shadow-md: 0 4px 12px rgb(28 24 49 / 0.08);
  --shadow-lg: 0 12px 32px rgb(28 24 49 / 0.12);

  /* Motion */
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}

@layer base {
  html { color-scheme: light; }
  body { @apply bg-bg text-text font-sans text-body antialiased; }
  :focus-visible { outline: 2px solid var(--color-link); outline-offset: 2px; }
}
```

Polices déclarées dans `packages/ui/src/fonts.css` (`@font-face` vers `/fonts/*.woff2`), préchargement de DM Sans 400 et Manrope 700 seulement.

---

## 6. Icônes

- Bibliothèque : **lucide-react**, import à la pièce (`import { Clock } from "lucide-react"`).
- Tailles : 16 px (dans le texte), 20 px (boutons, champs), 24 px (navigation, espace coiffeur), 32 px (états vides). Trait 1,75.
- Une icône seule dans un bouton a un nom accessible (`aria-label` issu du dictionnaire). Une icône à côté d'un texte est `aria-hidden`.

| Sens | Icône |
| --- | --- |
| Attente, heure | `clock` |
| Position dans la file | `users` |
| Distance, adresse | `map-pin` |
| Itinéraire | `navigation` |
| Votre tour | `bell-ring` |
| Prestation, coiffeur | `scissors` |
| Arrivé, validé | `check`, `circle-check` |
| Retard | `timer` |
| Rendez-vous | `calendar-clock` |
| À confirmer | `hourglass` |
| Créneau libre | `calendar-plus` |
| Changement de coiffeur | `repeat` |
| Pause | `coffee` (coiffeur), `pause` (file) |
| Absent | `user-x` (client), `circle-off` (coiffeur) |
| Code du ticket | `ticket` |
| QR de l'affiche | `qr-code` |
| Connexion perdue | `wifi-off` |
| Ajouter | `plus` |
| Fermer | `x` |
| Menu | `menu` |
| Retour | `arrow-left` |
| Verrouiller | `lock` |
| Information, avertissement, erreur | `info`, `triangle-alert`, `circle-alert` |

Logo et icônes d'app : à concevoir (Zelaté et Zelaté Pro se distinguent par un marqueur « Pro »). Formats : SVG, PNG 192 et 512 px, version *maskable*, icône Apple 180 px.

---

## 7. Composants

Chaque composant vit dans `packages/ui/src/components/<Name>/` avec son fichier, ses tests et ses variantes. Les primitives interactives (dialogue, menu, onglets, interrupteur, toast) s'appuient sur Radix UI.

### 7.1 Actions

**Button**

| Propriété | Valeurs |
| --- | --- |
| `variant` | `primary` (fond `primary`, texte `text-on-primary`), `secondary` (fond `surface`, contour `border-strong`, texte `text`), `ghost` (sans fond, texte `link`), `success` (fond `success`), `danger` (fond `danger`, pour les actions destructives) |
| `size` | `sm` 36 px (dashboard dense uniquement, zone tactile étendue à 44 px), `md` 44 px, `lg` 52 px (mobile, action principale), `xl` 56 px (actions de l'espace coiffeur) |
| États | repos, survol, pressé, focus, désactivé (opacité 50 %, `aria-disabled`), **en cours** (indicateur, libellé conservé, clics ignorés) |
| `fullWidth` | Pour la barre d'action mobile |
| Règles | Un seul bouton `primary` par écran ; libellé verbe + objet (« Rejoindre la file ») ; `danger` toujours suivi d'une confirmation |

**IconButton** : 44 × 44 px minimum, `aria-label` obligatoire. **HoldButton** (espace coiffeur, « Terminer ») : appui long de 600 ms avec remplissage progressif ; alternative clavier : Entrée puis confirmation.

**SegmentedControl** : commutateur de la file (Ouvrir / Pause / Fermer), onglets Liste / Carte ; rôle `radiogroup`.

### 7.2 Champs

| Composant | Détails |
| --- | --- |
| `TextField` | Libellé toujours visible au-dessus (pas de libellé flottant), aide, message d'erreur lié par `aria-describedby`, hauteur 48 px, contour `border-strong` |
| `PhoneField` | Préfixe +33 fixe, saisie à 9 chiffres, format affiché « 06 12 34 56 78 », `inputmode="tel"`, `autocomplete="tel-national"` |
| `OtpField` | 6 cases, `inputmode="numeric"`, `autocomplete="one-time-code"`, collage d'un code entier, retour arrière entre cases |
| `CodeField` | Saisie du code du ticket : 5 cases, majuscules automatiques, alphabet sans 0/O ni 1/I, `inputmode="text"`, `autocapitalize="characters"` ; erreur claire si le code est inconnu |
| `PinPad` (lot 2) | Pavé 3 × 4, touches de 72 px, points de saisie sans afficher les chiffres |
| `Select`, `Combobox` | Liste accessible (Radix), recherche dans la liste au-delà de 7 options |
| `AddressField` | Combobox avec autocomplétion Géoplateforme, annonce du nombre de suggestions |
| `TimePicker` | Pas de 5 min, limité aux horaires d'ouverture ; sert aussi à l'heure d'un rendez-vous (saisie par le salon ou annoncée par le client) |
| `Checkbox`, `Radio`, `Switch` | 24 px, zone tactile 44 px, libellé cliquable ; une case de consentement n'est jamais cochée par défaut |
| `ChoiceCard` | Carte sélectionnable (prestation, coiffeur) : rôle `radio`, état sélectionné par contour 2 px `primary` + icône `check` |

### 7.3 Affichage

| Composant | Contenu | Remarques |
| --- | --- | --- |
| `SalonCard` | Photo, nom, distance, `WaitBadge`, état de la file | Toute la carte est un lien (`<a>`), pas un `article` cliquable |
| `WaitBadge` | « ~25 min » + « il y a 2 min » ; variante `stale` (« à vérifier ») au-delà de 5 min | Chiffres tabulaires |
| `FreeSlotBadge` | « Créneau libre à 15h20 » (§2.4), sur `SalonCard`, `SalonMarker` et la liste des prestations | Absent quand aucun trou ne tient la prestation |
| `AppointmentBadge` | « RDV 14h30 », et le retard (« +20 min ») quand il dépasse 10 min | Sur `QueueItem`, `StylistColumn`, `TicketCard` |
| `StatusBadge` | Pastille icône + libellé selon §2.4 | Jamais la couleur seule |
| `TicketCard` | Code du ticket en grand (`display`, chiffres tabulaires, espacé), position, heure de passage, coiffeur, mise à jour ; pour un rendez-vous : heure du rendez-vous et heure de passage réelle, sans position | Écran plein en état `called`, avec `CountdownBadge` |
| `CountdownBadge` | Compteur jusqu'à la libération (10 min après l'appel, ou heure d'arrivée annoncée) (mm:ss) ; passe en `warning` à 5 min | `aria-live="polite"` à 5 min et à 1 min seulement |
| `QueueItem` (espace coiffeur) | Prénom (`h3`), prestation, durée, statut d'approche, réponse T-30 | Hauteur ≥ 72 px |
| `NextClientCard` (espace coiffeur) | Version épinglée de `QueueItem` + bouton `xl` « Appeler » | `shadow-md` |
| `ServiceTimer` (espace coiffeur) | Temps écoulé / prévu, barre de progression, boutons +5 / +15 / +30 / +45 | `aria-live="polite"` toutes les minutes seulement |
| `StylistColumn` (dashboard) | Avatar, statut, client en cours, fin estimée, tickets assignés, rendez-vous à leur heure | — |
| `PendingConfirmationCard` (espace coiffeur, dashboard) | Prénom, heure annoncée, coiffeur ; boutons « Confirmer » et « Refuser » ; rapprochement proposé avec un rendez-vous saisi | Annoncée par `aria-live="polite"` à l'arrivée |
| `ReassignmentPrompt` (client) | Nouveau coiffeur, nouvelle heure, « Accepter » et « Refuser », temps restant pour répondre | Même gabarit que le bandeau « coiffeur indisponible » |
| `Avatar` | Photo ou initiales sur `primary-subtle` | 32, 40, 56 px |
| `Stepper` | Étapes du parcours (« 2 sur 5 ») | Texte lisible par les lecteurs d'écran |
| `QrCode` | QR de l'affiche du salon (dashboard et PDF) : noir sur blanc, marge de 4 modules, taille ≥ 200 px | Lien texte affiché dessous |
| `MapView` | MapLibre, repères `SalonMarker` (nom + attente) | Liste équivalente toujours disponible (alternative accessible) |
| `EmptyState` | Icône 32 px, phrase, action | — |
| `Skeleton` | Blocs `surface-muted` animés (fondu, sans animation en mouvement réduit) | — |

### 7.4 Retours et superpositions

| Composant | Usage | Règles |
| --- | --- | --- |
| `Banner` | Information persistante : connexion perdue (`danger`), heure modifiée (`warning`), succès | Rôle `status` ou `alert` selon l'urgence |
| `ConnectionBanner` | Variante de `Banner` pour l'espace coiffeur et le dashboard | Bloque les actions tant qu'il est affiché |
| `Toast` | Confirmation brève (« Client inscrit ») | 4 s, pas pour les erreurs bloquantes, jamais seul porteur d'une information critique |
| `Dialog` | Confirmations, formulaires courts (walk-in) | Piège de focus, fermeture par Échap et bouton, retour du focus à l'élément d'origine |
| `Sheet` | Fiche salon sur mobile | Glisser pour fermer **et** bouton « Fermer » |
| `ConfirmDialog` | Actions destructives (annuler une place, retirer un ticket, annuler avec excuses en fin de journée) | Bouton destructif à droite, libellé explicite (« Oui, retirer de la file ») |

---

## 8. Textes et ton

- Vouvoiement, phrases courtes, verbe d'action en tête.
- Toujours dire **pourquoi** quand l'heure ou la position change.
- Heures au format 24 h (« 14h30 »), durées en minutes (« ~25 min »).
- Pas de jargon technique dans l'interface (« synchronisé », pas « WebSocket connecté »).
- Tous les textes vivent dans le dictionnaire (`packages/i18n`), jamais dans les composants.

---

## 9. Accessibilité : liste de contrôle par composant

- [ ] Nom accessible pour chaque contrôle ; libellés visibles pour chaque champ.
- [ ] Navigation complète au clavier, ordre logique, focus visible (`focus-ring`).
- [ ] Contrastes conformes au §2.3 ; aucune information portée par la couleur seule.
- [ ] Cibles tactiles ≥ 44 px (≥ 56 px pour les actions de l'espace coiffeur).
- [ ] Changements dynamiques annoncés avec `aria-live` sans saturer (position, heure : une annonce par changement significatif).
- [ ] `lang="fr"` sur les deux apps ; titres de page uniques par route.
- [ ] Zoom à 200 % sans perte de contenu ; mise en page fluide à 320 px de large.
- [ ] `prefers-reduced-motion` respecté.
- [ ] Aucune violation axe sérieuse ou critique.

---

## 10. Passage dans Figma

| Figma | Correspond à |
| --- | --- |
| Collection de variables **Primitives** | §2.1 (noms identiques : `ink/900`, `violet/500`…) |
| Collection **Semantic** (mode Light) | §2.2 (`bg`, `surface`, `primary`…) ; mode Dark plus tard |
| Styles de texte | §3 (`display`, `h1`… `caption`) |
| Variables **Spacing**, **Radius** | §4 |
| Page **Components** | §7, une variante Figma par propriété `variant` et `size` |
| Pages **Client**, **Espace coiffeur**, **Dashboard**, **Admin** | Écrans de [APP_FLOW](./APP_FLOW.md), un cadre par route et par état important |

Quand une valeur change dans Figma, ce fichier et `theme.css` changent dans la même pull request.
