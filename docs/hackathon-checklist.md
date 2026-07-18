# Hackathon Playbook

The order of operations for tomorrow. Follow it top to bottom. The whole point of this
boilerplate is that steps 1–3 are renames, not builds.

## 0. Before the problem drops (done — this is the boilerplate)
- [x] Stack installed, both apps boot, DB migrated + seeded, health green.
- [x] Auth + RBAC, transactions, state machine, notifications, audit, concurrency primitives.
- [x] Landing page, themed auth, app shell, Items round-trip, System Status.

## 1. Problem selection (first 30 min)
- [ ] Identify the ONE core entity (Asset / Vehicle / Table / PurchaseOrder / Room / Booking).
- [ ] Identify its statuses → these become the `ItemStatus` enum values.
- [ ] Identify the ONE hard rule that scores points: is it **no-overlap** (use the EXCLUDE
      primitive in migration 002) or **conditional uniqueness** (use the partial unique index)?
      Pick the primitive now so you're renaming, not researching, at hour 18.

## 2. Domain model replacement (rename, don't rebuild)
- [ ] `server/prisma/schema.prisma`: rename `Item` → your entity; rename/add fields; update the
      `ItemStatus` enum values.
- [ ] `server/src/modules/items/` → rename folder + files to your entity, OR copy it as a new
      module and leave `items` as a reference.
- [ ] `transitions.js`: rewrite the transition graph for your statuses.
- [ ] `server/prisma/seed.js`: update `DEMO_ITEMS`. **Keep `DEMO_USERS` in sync with**
      `client/src/lib/demo-credentials.js` — the landing-page login depends on it.
- [ ] Migration: `npm run db:migrate --prefix server -- --name rename_item_to_<entity>`.
- [ ] Frontend: rename `pages/Items.jsx`, `api/items.js`, `StatusBadge` status map.

## 3. API contract freeze (before splitting work)
- [ ] Update `docs/api-contract.md` with the real entity's payload.
- [ ] All four members read it. The envelope does NOT change — only the `data` shape.
- [ ] Assign: who owns which endpoints / pages. Push to feature branches off `dev`.

## 4. MVP checkpoints (map to the review checkpoints)
- [ ] **CP1** — entity renamed, migrated, seeded; list + create round-trip works end-to-end.
- [ ] **CP2** — the scoring rule enforced by a DB constraint; 409/422 maps cleanly to the UI.
- [ ] **CP3** — RBAC visible: two roles see different things; ownership scoping wired (uncomment
      the layer-3 example in `requireRole.js`).
- [ ] **CP4** — notifications + audit on the key action; System Status green.
- [ ] **CP5** — polish: empty/loading/error states, landing copy, demo path rehearsed.

## 5. Demo backup (do this at hour 20, not hour 23)
- [ ] Rehearse the exact click path: landing → demo login → list → create → see notification.
- [ ] Screen-record the working round-trip as a fallback if live fails.
- [ ] `npm run db:seed` returns to a known state — run it right before demoing.
- [ ] Note the psql path for a live DB question: `C:\PostgreSQL Download File\bin\psql.exe`.

## 6. Submission verification
- [ ] `npm run install:all` on a clean clone works (delete `node_modules`, re-run).
- [ ] `npm run test` green (both apps). `npm run build` green.
- [ ] `.env.example` present and accurate; **no real `.env` committed** (`git status` clean of it).
- [ ] All four members have visible commits (`git shortlog -sn`). Judges evaluate this.
- [ ] README setup steps work start-to-finish on one teammate's fresh machine.

## Git flow (agreed)
- Feature branches → `dev`. Only the team lead merges `dev` → `main`.
- Small, frequent, self-describing commits from every member.
- Never commit `.env`, `node_modules`, or `dist`.
