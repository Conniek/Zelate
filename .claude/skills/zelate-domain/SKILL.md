---
name: zelate-domain
description: Zelaté business domain map — vocabulary, ticket lifecycle, queue rules H1-H10, salon appointments, notification policy, privacy rules and where each decision lives in the docs. Use whenever a task touches Zelaté's queue, tickets, stylists, salons, appointments, notifications or user stories, before writing a story, an ADR, a schema change, engine code or a test.
---

# Zelaté domain (v1 · 19/10/2026)

Zelaté is a virtual queue for hair salons in France. Clients join a salon's queue (or come for an appointment the salon entered) and follow their real waiting time; stylists call, start and finish clients from their own phone; the manager runs the queue from a dashboard.

**This skill is a map, not a source.** The rules live in `docs/PRD.md` (business, Ely decides) and `docs/TRD.md` (technical, Koni decides). Before relying on a rule, open the section cited here: if it says something different, the document wins and this skill must be fixed. Never fill a gap with a guess: a missing rule is a question to Koni.

## 1. Vocabulary

Full glossary: PRD §10. The terms that cause mistakes:

| Say                | Code                     | Careful                                                                                                                                      |
| ------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Salon              | `salon`                  | One queue per salon (H1). A salon sees only its own data.                                                                                    |
| Gérant             | `manager`                | Can also cut hair: switch « Je coiffe » (`is_hairdressing`).                                                                                 |
| Coiffeur           | `stylist`                | Uses Zelaté Pro on **his own phone** in lot 1 (ADR-007); shared tablets are lot 2.                                                           |
| Ticket             | `ticket`                 | A client's place in one salon's queue for **one service day**. Never carried to the next day.                                                |
| Code du ticket     | `short_code`             | 5 characters, no 0/O/1/I; the client gives it to the stylist on arrival (H7).                                                                |
| Coiffeur demandé   | `requested_member_id`    | Optional choice of the client.                                                                                                               |
| Coiffeur pressenti | `estimated_member_id`    | Engine's guess for the estimate only (ADR-015); `assigned_member_id` is set at the call.                                                     |
| Heure de passage   | `estimated_start_at`     | Estimated service start. Shown with the time of the last update.                                                                             |
| Rendez-vous        | `kind = 'appointment'`   | A ticket with `scheduled_at`, stylist fixed at entry (H10, ADR-016). Taken elsewhere (Planity, paper) and entered or confirmed by the salon. |
| À confirmer        | `pending_confirmation`   | Appointment the client signalled on arrival; visible but **out of the calculation** until the salon confirms.                                |
| Walk-in            | `channel = 'front_desk'` | Client registered at the desk by the manager.                                                                                                |
| Position           | —                        | Number of clients **before him at his stylist** (E13), not the salon rank. No position for an appointment.                                   |

## 2. Ticket lifecycle

Statuses (`ticket_status`, BACKEND_SCHEMA §3): `pending_confirmation` → `waiting` → `called` → `in_service` → `completed`, or `cancelled` / `no_show`. Active = the first four.

Transitions are numbered in **PRD §5.2 « Cycle de vie du ticket »** (1, 1b, 2 to 8). Quote the number when you refer to one. Key facts:

- Arrival is a timestamp (`arrived_at`), not a status.
- A client only moves **back** through « Prendre le suivant » (`take_next`), only after a declared delay, at most 2 places in total (H5, transition 3).
- `called → no_show` happens at `release_due_at`: 10 min after the call, or the announced arrival time if later (H4, E2, K13).
- Each call increments `call_count` (keys `your_turn:<n>`, `arrival_reminder:<n>`); leaving `called` clears `called_at`, `reminder_sent_at`, `release_due_at` (K31). A called client whose stylist becomes unavailable goes back to the head of the queue (E6; E36's written proposal is the default; see `docs/stories/README.md`).
- Cancelling is free even once called, and is not an absence (E3).
- Every queue write goes through the shared transaction module (`_shared/queue-transaction`: per-salon lock, engine, writes, outbox), used by `queue-command`, `queue-tick`, `deactivate-member` and `account-delete` (ADR-003, K38); commands carry a `command_id` (ADR-004). Commands and their error codes: TRD §6.2.

## 3. Rules H1-H10

Validated table: **PRD §5.1**. Engine detail: **PRD §5.2** (wait formula, distribution rules 1-8, stylist statuses, queue states, end of day). One line each, to find them:

| Rule | About                                                                                      | Engine detail      |
| ---- | ------------------------------------------------------------------------------------------ | ------------------ |
| H1   | One queue, first free stylist who masters the service                                      | Distribution 1-5   |
| H2   | Wait simulated stylist by stylist; +5/+15/+30/+45 min                                      | Formula `T_k`      |
| H3   | T-30 (with answer), T-10, « votre tour »; 3 SMS max                                        | §5.4               |
| H4   | 10-min countdown after the call, reminder at 5 min                                         | Transition 7       |
| H5   | No free reordering; back at most 2 places, justified                                       | Transition 3       |
| H6   | Client phone never shown to salon or stylist                                               | ADR-011            |
| H7   | Arrival validated by the ticket code                                                       | Transition 4       |
| H8   | Client may declare an arrival time                                                         | Distribution 3     |
| H9   | End of day: one warning from 2 h before the last closing; manager decides at closing       | « Fin de journée » |
| H10  | Appointments: fixed slot; a walk-in passes before only if he finishes before it (margin 0) | Distribution 6-8   |

Other validated rules (one active ticket per client, reassignment never moves a client back without his consent, 10-min explanation threshold, pause still calls, etc.): PRD §5.1 « Autres règles validées ». Ely's answers E1-E16 and R1-R7: PRD §11.

## 4. Appointments in one paragraph

An appointment is a normal ticket of kind `appointment` handled by the same engine (ADR-016). The salon enters it (`create_appointment`, manager or the stylist for himself), or the client signals it on arrival through the QR poster (`check_in_appointment` → `pending_confirmation`) and the salon confirms in one gesture (`confirm_appointment`, with merge into an entered appointment, K14). The engine fills the gaps between appointments with walk-in clients without ever delaying an appointment (invariant), and publishes the next free slot per service (`salons.next_free_slots`, ADR-017). A client whose appointment runs late is warned before leaving, by steps of 10 min (R5, `appointment_delay`).

## 5. Notifications

Policy: **PRD §5.4**; texts: `packages/i18n/src/fr/notifications.json`; keys: TRD §9.

- Push first; SMS only without active push, except « votre tour » (push **and** SMS, always, even past the cap, E1).
- Cap: 3 SMS per ticket, excluding `your_turn`, `cancelled_by_salon` and `no_show_warning` (E28).
- Consent « Me prévenir » is per ticket (`tickets.notifications_consent_at`, K18), unticked by default. It only governs the four **anticipation** messages: `turn_approaching`, `get_ready`, `estimate_changed`, `end_of_day_risk`. Every other client message is essential and always sent (E17). Consent and the SMS cap apply to clients only, never to salon members.
- Every change of 10 min or more, measured from `last_notified_start_at`, is explained with a reason from `estimate_change_reason` (E11, K19, K26).
- SMS: 160 GSM-7 characters at maximum variable length (TRD §9, K5, K20).

## 6. Privacy and safety (never break)

- No client phone number in any table, RPC, realtime message or log readable by a salon or a stylist (H6, ADR-011, `private.ticket_contacts`).
- `tracking_token` and `tracking_short_code` never returned to staff.
- No client first name and no free text in `ticket_events` / `salon_events` (K10).
- Nothing about clients persisted on a stylist's phone: memory cache only (ADR-007).
- Salon isolation by RLS on every `public` table; `private` never exposed.

## 7. Invariants (test anchors)

Each must hold after any command or tick; name tests after them.

1. At most one active ticket per client and per phone number.
2. At most one `called` or `in_service` ticket per stylist.
3. `postpone_count` ≤ 2; a ticket only moves back through `take_next`.
4. Reassignment never makes a client's time later without his acceptance (E9).
5. A walk-in client never delays an appointment (H10, rule 6).
6. One end-of-day warning per ticket at most (H9).
7. A published next free slot always fits the service duration (R7).
8. `pending_confirmation` tickets never count in any estimate.
9. No ticket survives its service day.

## 8. Where decisions stand

- Decided by written answers or default proposals: H1-H10, R1-R7, E1-E39 and K1-K45. Check the current PRD, TRD and `docs/stories/README.md`; business defaults can be revised only by Ely and technical defaults only by Koni.
- For E32-E39 and K42-K45, the proposals recorded in `docs/stories/README.md` are the working defaults; do not silently treat later changes as approved.
- Open in PRD §9: pilot salons, data retention, Planity sync, appointment margin, brand, lot 2, penalties, SMS billing.
