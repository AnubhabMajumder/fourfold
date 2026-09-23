# Research: Sync backend for Fourfold v1

Resolves [#2](https://github.com/AnubhabMajumder/fourfold/issues/2) (child of map #1). Researched 2026-09-24 against vendor docs, pricing pages, and GitHub repos. This is input to a later decision, not the decision itself.

## Requirements (from map #1)

- **Offline-first:** writing, placing, completing, and editing Tasks must work fully offline, survive a reload, and sync on reconnect.
- **Private per-user data:** no sharing, so per-user scoping is all that's needed. Conflicts only happen between one user's own devices.
- **Sign-in** required for sync.
- **Web now, mobile later** (probably React Native/Expo). The same backend must serve both.
- **Hobby scale:** free or cheap at first.

The hard filter is **offline writes that are stored durably and survive a reload**. Many "realtime/sync" products only offer optimistic updates while the tab stays open.

## Summary table

| Option | Durable offline writes | Conflict default | Auth | Web / RN | Hobby pricing | Self-host | Maturity / status |
|---|---|---|---|---|---|---|---|
| **PowerSync** (+ Supabase or own Postgres) | Yes: local SQLite + upload queue | Per-field LWW, **deletes win** | Any JWT (Supabase, Firebase, Auth0, Clerk…) | Web, RN/Expo, Flutter, Swift, Kotlin | Free: 2 GB synced/mo, 50 concurrent clients, **deactivated after 1 week idle**. Pro $49/mo | Yes, Open Edition (FSL, becomes Apache-2.0 after 2 years) | Production, actively developed |
| **Firebase / Firestore** | Yes: built into SDK | LWW | Firebase Auth (built in) | Web (official JS SDK), RN via community React Native Firebase | Spark free: 1 GiB, 50K reads / 20K writes per day, 50K MAU | No | Very mature |
| **ElectricSQL + TanStack DB** | Only with TanStack DB `offline-transactions` (you write the write path) | You decide (your API) | Your own (proxy/API) | Web, RN/Expo (TanStack DB persistence) | Cloud pay-as-you-go, bills under $5/mo waived | Yes (open source) | Electric is solid. TanStack DB is **pre-1.0, persistence alpha** |
| Supabase alone | **No** built-in offline sync | – | Supabase Auth | Web, RN | Free: 500 MB, 50K MAU, **paused after 1 week idle** | Yes | Mature |
| Convex | **No** ("doesn't currently provide a full offline sync mechanism") | – | Built in / JWT | Web, RN | Free 1M function calls/mo | Yes (OSS backend) | Mature, but not offline-first |
| Zero (Rocicorp) | **No** ("Zero does not support offline writes") | – | JWT | Web, RN | Cloud Zero or self-host | Yes | Active |
| Replicache | Yes | Server-authoritative rebase | Yours | Web, RN | – | – | GitHub repo archived; Rocicorp's focus is now Zero |
| InstantDB | Yes | LWW | Built in | Web, RN | **New signups closed** | Yes (OSS) | **Cloud shuts down 2027-08-31** (team joined OpenAI) |
| Triplit | Yes | LWW | JWT | Web, RN | – | Yes (AGPL) | **Team acquired by Supabase Oct 2025**; last commit Sep 2025 |
| Jazz | Yes (local-first) | Eventually consistent, git-like history | JWT-claim policies | Web, Expo/RN | Usage-based, small free allowance | Yes (MIT) | **v2 is alpha** (full API rewrite) |

## Findings per option

### PowerSync

- **Offline writes:** clients read and write a local SQLite database. Changes go into an ordered upload queue (PUT/PATCH/DELETE) that your backend applies when the device is online. The server has the final say. [Handling update conflicts](https://docs.powersync.com/handling-writes/handling-update-conflicts)
- **Conflicts:** *"the last update (as received by the server) to each individual field wins"* and *"Deletes always win: If one client deletes a row, any future updates to that row are ignored."* You can add custom rules on the backend. Writes must be idempotent, and each operation carries a per-client incrementing ID for deduplication. [same page](https://docs.powersync.com/handling-writes/handling-update-conflicts)
- **Per-user scoping:** Sync Streams, e.g. `SELECT * FROM lists WHERE owner_id = auth.user_id()`, which creates one bucket per user. [Sync Streams overview](https://docs.powersync.com/sync/streams/overview)
- **Auth:** JWTs via `fetchCredentials()`. Supabase, Firebase Auth, and Auth0 have dedicated guides. Clerk, Cognito, Keycloak, WorkOS, and custom JWTs also work. [Authentication setup](https://docs.powersync.com/installation/authentication-setup)
- **With Supabase:** replicates from Supabase Postgres via WAL. Uploads go through supabase-js, with RLS protecting the write path. Supabase Auth JWTs are verified via JWKS. [Supabase + PowerSync guide](https://docs.powersync.com/integrations/supabase/guide)
- **SDKs:** JS Web, React Native & Expo, Flutter, Kotlin, Swift, Node, and Capacitor (beta). [llms.txt index](https://docs.powersync.com/llms.txt). The RN SDK uses `op-sqlite`. Expo Go needs the JS adapter `@powersync/adapter-sql-js` because the native adapter doesn't run in Expo Go's sandbox. [RN & Expo SDK](https://docs.powersync.com/client-sdks/reference/react-native-and-expo)
- **Pricing:** Free gives 2 GB synced/mo, 500 MB hosted, 50 peak concurrent clients, and *"Free projects are deactivated after 1 week of inactivity"*. Pro is from $49/mo. Self-hosted Open Edition is free. [Pricing](https://www.powersync.com/pricing)
- **License:** the service is FSL-1.1-ALv2 (source-available, becomes Apache-2.0 two years after each release). [LICENSE](https://github.com/powersync-ja/powersync-service/blob/main/LICENSE)

### Firebase / Cloud Firestore

- **Offline:** built into the SDK. On Android/iOS it's on by default. On web it's **off by default** and you opt in (IndexedDB). Web offline support covers Chrome, Safari, and Firefox. You can choose single-tab or multi-tab persistence. Conflicts are **last-write-wins**. [Enable offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- **React Native:** there's no official Google RN SDK. [React Native Firebase](https://rnfirebase.io/firestore/usage) is a community project by Invertase that wraps the native SDKs, and offline persistence is on by default there.
- **Pricing (Spark, free):** 1 GiB stored, 50K reads/day, 20K writes/day, 20K deletes/day, 10 GiB egress/month. Auth: 50K MAU. [Pricing](https://firebase.google.com/pricing)
- **Trade-offs:** NoSQL document model, no self-hosting, and vendor lock-in. On the plus side, auth and offline come in one package, it is the most mature option here, and hobby projects don't get paused for inactivity.

### Supabase (on its own)

- Postgres + Auth + Realtime, but **no built-in offline sync**. [Architecture](https://supabase.com/docs/guides/getting-started/architecture)
- Supabase's stated strategy (Oct 2025, when Triplit joined) is to *"[make] Supabase an excellent partner to other syncing systems such as ElectricSQL, Zero, and PowerSync."* [Triplit joins Supabase](https://supabase.com/blog/triplit-joins-supabase)
- **Pricing:** Free gives 500 MB DB and 50K MAU, but *"Free projects are paused after 1 week of inactivity. Limit of 2 active projects."* Pro is $25/mo. [Pricing](https://supabase.com/pricing)
- On its own it's out, but it's the natural Postgres + Auth half of a **PowerSync** stack.

### ElectricSQL (+ TanStack DB)

- *"Electric does read-path sync… Electric does not do write-path sync."* You pick a write pattern: online writes, optimistic state, persistent optimistic state, or through-the-DB (PGlite). [Writes guide](https://electric.ax/docs/guides/writes)
- For durable offline writes, the current path is TanStack DB's `@tanstack/offline-transactions`: a persistent outbox, retry with backoff, and multi-tab leader election. It pairs with `@tanstack/electric-db-collection`. [offline-transactions](https://github.com/TanStack/db/tree/main/packages/offline-transactions), [Electric collection](https://tanstack.com/db/latest/docs/collections/electric-collection)
- TanStack DB 0.6 adds SQLite persistence for browser, React Native, Expo, and more. It's **pre-1.0** and *"the first alpha release of persistence."* [TanStack DB 0.6](https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes)
- **Pricing:** Electric Cloud charges $1 per 1M writes and $0.10/GB-month retention. Reads and egress are free. Pay-as-you-go bills under $5/mo are waived. [Pricing](https://electric.ax/pricing)
- **Trade-off:** most open and flexible, but you build the write API, auth, and conflict rules yourself, on young client libraries.

### Ruled out

- **Convex:** *"Convex doesn't currently provide a full offline sync mechanism."* It handles network blips, not offline-first. [convex.dev/sync](https://www.convex.dev/sync)
- **Zero:** *"Zero does not support offline writes. When the client is in the `disconnected`, `error`, or `needs-auth` states, reads from synced data continue to work, but writes are rejected."* [Zero offline](https://zero.rocicorp.dev/docs/offline)
- **Replicache:** the `rocicorp/replicache` GitHub repo is archived (GitHub API: `archived=true`). Rocicorp's active product is Zero, which has no offline writes. Too risky to start on now.
- **InstantDB:** the team joined OpenAI (announced 2026-08-22). New signups are closed and *"all cloud apps shut down on August 31st, 2027"*. It remains open source and self-hostable. [Announcement](https://www.instantdb.com/essays/instant_team_joins_openai)
- **Triplit:** co-founder acqui-hired by Supabase (2025-10-08). The `aspen-cloud/triplit` repo's last commit was 2025-09-11. It's effectively unmaintained. [Supabase blog](https://supabase.com/blog/triplit-joins-supabase)
- **Jazz:** v2 is an **alpha** with *"an entirely new API"* (a rewrite of "Classic Jazz"). The design is attractive (local-first, MIT, Expo support), but too unstable for a build-ready spec today. [jazz.tools](https://jazz.tools/), [repo](https://github.com/garden-co/jazz)

## Recommended shortlist

1. **PowerSync + Supabase (Postgres + Supabase Auth)** — *lead recommendation.* PowerSync is built for exactly this: durable offline writes in local SQLite on web and React Native/Expo with the same model. Its default conflict rule (per-field LWW, deletes win) already answers most of map #1's "conflict rules" fog. Supabase supplies relational Postgres, RLS, and Auth, and Supabase itself names PowerSync as a sync partner. Both can be self-hosted, so there's no dead end. **Cost:** two vendors to wire together, and both free tiers deactivate or pause after 1 week of inactivity, so a hobby app nobody opens for a week goes to sleep. Pro is $25 + $49 per month, or self-host.
2. **Firebase (Firestore + Firebase Auth)**: the simplest, most mature option. Offline and auth come built in, and the free tier doesn't pause. **Cost:** web offline persistence is opt-in with tab caveats, the RN path relies on community-maintained React Native Firebase, the data model is NoSQL, there is no self-hosting, and conflicts are LWW with little control.
3. **ElectricSQL + TanStack DB (on any Postgres, own auth)**: the most open option (Apache-licensed and portable), with cheap usage-based cloud. **Cost:** you build the write path, auth, and conflict handling yourself, and TanStack DB's persistence is alpha and pre-1.0. Worth keeping on the list only if avoiding vendor lock-in matters more than speed of delivery.

## Implications for other tickets

- **Sign-in ticket:** the backend choice largely decides auth (Supabase Auth, or Firebase Auth). PowerSync accepts any JWT provider, so option 1 still leaves room for Clerk etc.
- **Conflict-rules fog (map #1):** with PowerSync or Firestore the default is LWW. With PowerSync, "edited on one device while deleted on another" means **delete wins**. Racing a completion against a Quadrant move changes different fields, so under per-field LWW both changes survive.
- **Web framework ticket:** every viable option keeps data in a client-side store (SQLite-WASM / IndexedDB), which favours a client-rendered SPA over server-side rendering. TanStack DB has no SSR yet. React on web makes the move to React Native easier with all three options.
- **Hosting ticket:** free-tier inactivity pausing (Supabase, PowerSync Cloud) is a real hobby-scale constraint. Weigh it against self-hosting or paid plans.
