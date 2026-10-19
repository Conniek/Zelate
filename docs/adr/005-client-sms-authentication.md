# ADR-005 — Authentification client par SMS

- **Statut :** Acceptée
- **Décideur :** Koni

## Contexte

Le parcours client doit fonctionner sans mot de passe et permettre d'identifier un numéro de téléphone unique.

## Décision

Authentifier les clients par code à usage unique avec Supabase Auth (`signInWithOtp`) sur leur numéro. L'envoi du SMS passe par le Send SMS Hook et le fournisseur retenu.

Un client invité possède un compte Auth sans e-mail et un profil `is_guest = true`. Le profil n'est créé qu'au premier parcours qui demande son prénom (`join_queue`, `check_in_appointment`, `salon-signup` ou `activate-invitation`). Les membres du personnel ont `is_guest = false`.

## Conséquences

- Aucun mot de passe client n'est requis.
- La création Auth seule ne crée pas de profil applicatif.
- Les parcours client et personnel partagent le mécanisme d'identité, mais distinguent les profils invités.

## Référence

Décision source : [TRD §5, ADR-005](../TRD.md#5-décisions-darchitecture-adr), notamment K30.
