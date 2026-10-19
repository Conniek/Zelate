# ADR-001 — Backend Supabase en région UE

- **Statut :** Acceptée (TRD, 13/10)
- **Décideur :** Koni

## Contexte

Le MVP a besoin d'authentification, de temps réel, de Row Level Security et de fonctions serveur, avec une charge d'exploitation réduite.

## Décision

Utiliser Supabase comme backend, hébergé dans une région de l'Union européenne.

## Conséquences

- Auth, Postgres, RLS, Realtime et Edge Functions sont fournis par la même plateforme.
- Le projet dépend d'un fournisseur ; le schéma reste fondé sur PostgreSQL standard afin de préserver une possibilité de migration.

## Référence

Décision source : [TRD §5, ADR-001](../TRD.md#5-décisions-darchitecture-adr).
