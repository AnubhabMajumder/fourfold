# Research: Neon as the database for Fourfold v1's sync backend

Follow-up to `research/sync-backend.md` (issue #2), which picked **PowerSync + Supabase** as the lead. That pairing has a known weakness: both free tiers pause or deactivate after a week of inactivity. This note asks whether **Neon** (serverless Postgres) could replace Supabase in a **$0** v1, and how the two compare. Researched 2026-09-24 against vendor docs, pricing pages, and GitHub. This is input to a decision, not the decision itself.

## TL;DR

- **PowerSync supports Neon officially.** It has a dedicated guide with a demo app that uses Neon Auth for JWTs and the Neon Data API for uploads. Neon's Free plan includes logical replication.
- **The catch is compute hours.** A connected logical-replication subscriber, such as PowerSync, stops Neon's compute from ever scaling to zero. The smallest Free compute (0.25 CU) running 24/7 uses about **180 CU-hours a month**, but the Free plan gives **100**. So the compute would be **suspended around day 16–17 of each month** until the next billing period. That fails the $0, always-syncing requirement.
- **Neon Auth doesn't fit Fourfold's clients yet.** It supports Next.js, Vite + React, and TanStack Router. React Native/Expo is not listed, and "standalone frontend + backend" setups are "coming soon".
- **Bottom line:** Neon never pauses a project for inactivity, but PowerSync keeps it awake, so the free compute runs out mid-month. **Don't add Neon + PowerSync Cloud to the $0 shortlist.** Neon becomes reasonable once the budget allows its Launch plan (roughly $19/mo of compute for an always-on 0.25 CU). It would also fit if the sync engine didn't keep a replication connection open all the time.

## 1. PowerSync on Neon: support, logical replication, and scale-to-zero

**Support: yes, official.**
- PowerSync's source-database setup page has a Neon section: enable **Settings → Logical Replication** in the Neon Console, create a `powersync_role` with `REPLICATION BYPASSRLS`, and `CREATE PUBLICATION powersync FOR ALL TABLES`. [PowerSync: Source DB setup](https://docs.powersync.com/configuration/source-db/setup)
- There's a full "Neon + PowerSync" integration guide. It covers enabling Neon Auth and the Data API, and runs a `react-neon-tanstack-query-notes` demo. Client writes are *"stored in an upload queue that gets processed via the Neon Data API when network connectivity is available."* So, as with supabase-js on Supabase, you don't need a custom write server. [PowerSync: Neon integration](https://docs.powersync.com/integrations/neon)

**Logical replication on Neon Free: yes.**
- Neon's plans page lists public network transfer for every plan, Free included, and says it *"includes data sent via logical replication to any destination."* The Free plan gets 5 GB per project per month. [Neon plans](https://neon.com/docs/introduction/plans)
- Enabling it is **one-way**, and it restarts computes: *"Enabling logical replication changes the PostgreSQL `wal_level` setting from `replica` to `logical`… Once changed, it cannot be reverted. Enabling logical replication also restarts all computes."* [Neon: Logical replication](https://neon.com/docs/guides/logical-replication-neon)
- `max_replication_slots` and `max_wal_senders` are fixed at 10. [same page](https://neon.com/docs/guides/logical-replication-neon)

**Caveat 1: the subscriber keeps compute awake.**
- *"A connected logical replication subscriber keeps the database in use, so the compute never becomes idle. Neon therefore does not suspend the compute; it remains active at all times while subscribers are connected."* Neon warns this *"can significantly affect your bill."* [Neon: Logical replication and scale to zero](https://neon.com/docs/guides/logical-replication-neon)
- The scale-to-zero page says the same: *"Logical replication from Neon keeps compute active while subscribers are connected, so the database does not scale to zero."* [Neon: Scale to zero](https://neon.com/docs/introduction/scale-to-zero)
- The arithmetic: compute hours = compute size × active hours, and *"a compute with .25 CU… would require 4 active hours to use 1 compute hour."* [Neon glossary](https://neon.com/docs/reference/glossary). Running 24/7 for 30 days is 720 h × 0.25 = **180 CU-hours**. The Free plan gives *"100 CU-hours/project/month (enough to run a 0.25 CU compute… for 400 hours/month)."* [Neon plans](https://neon.com/docs/introduction/plans)
- When the allowance runs out: *"On the Free plan, when you run out of CU-hours or public network transfer, your compute is suspended until the next billing period or until you upgrade… None of these limits delete your data."* [Neon plans](https://neon.com/docs/introduction/plans). With PowerSync always connected, that happens after about **16.7 days** each month. After that, PowerSync can't replicate and uploads through the Data API fail. The apps keep working offline, but nothing syncs.

**Caveat 2: slots are removed if nothing is connected.**
- If PowerSync is disconnected, for example because its free instance was deactivated: *"Neon automatically removes inactive replication slots after approximately 40 hours"*, meaning slots that don't acknowledge `flush_lsn` progress. [Neon: Unused replication slots](https://neon.com/docs/guides/logical-replication-neon)
- PowerSync copes with this: *"If an active slot is somehow dropped while a PowerSync instance is disconnected, PowerSync will automatically recreate the slot when it reconnects and restart replication."* A slot invalidated during the *initial snapshot* needs manual cleanup. [PowerSync: Postgres maintenance](https://docs.powersync.com/configuration/source-db/postgres-maintenance)
- Upside: Neon's automatic slot removal protects you from a problem PowerSync's docs warn about. An orphaned slot left by a deprovisioned instance keeps old WAL around and can cause *"excessive disk usage"*. [same page](https://docs.powersync.com/configuration/source-db/postgres-maintenance)

So the replication slot does not *break* when compute suspends. The real problem is the opposite one: the slot's live connection stops compute from ever suspending.

## 2. Neon Free plan limits and inactivity (vs. Supabase)

| | Neon Free | Supabase Free |
|---|---|---|
| Storage | 0.5 GB per project. Writes fail when you exceed it | 500 MB DB |
| Compute | 100 CU-hours per project per month, 0.25–2 CU autoscaling | Shared CPU, 500 MB RAM, not metered by hours |
| Idle behaviour | Compute scales to zero after **5 min** (always on, can't be disabled). Wakes *"within a few hundred milliseconds"* | Whole project **paused after 1 week of low activity** |
| Project paused or deleted for inactivity? | **No project-level pause or deletion policy found.** Non-root branches older than 14 days and idle for 24 h are *archived* and unarchive automatically on access | Paused after 7 days. Restorable from Studio within a 1-year window |
| Projects | 100 | 2 active |
| Egress | 5 GB per project per month (includes logical replication) | – |
| Auth MAU | 60k (Neon Auth) | 50k (Supabase Auth) |
| Cheapest paid | Launch: pay-as-you-go, $0.106/CU-hour, $0.35/GB-month, no minimum | Pro $25/mo |

Sources: [Neon pricing](https://neon.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans), [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero), [Neon branch archiving](https://neon.com/docs/guides/branch-archiving), [Supabase pricing](https://supabase.com/pricing), [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).

- Neon's free tier doesn't "pause" in Supabase's sense. An idle Neon database costs nothing and wakes on the first query. The limit you hit is the **monthly compute budget**. For a database that is queried now and then, that's generous. For one with a permanent replication subscriber, it isn't.
- Supabase says pausing targets projects with *"too few user queries"*, and that *"a few user requests to the database each day over the previous week is enough to keep the project from being paused."* [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing). **Unverified:** whether PowerSync's replication connection counts as activity for Supabase. Supabase's docs don't say.
- Estimated cost of an always-on 0.25 CU on Neon Launch: 180 CU-h × $0.106 ≈ **$19/mo**, plus storage. That's cheaper than Supabase Pro ($25), but it isn't $0.

## 3. Auth options with Neon

PowerSync accepts any JWT with `sub`, `aud`, `iat`, `exp` (at most 24 h apart), and a `kid` that matches a JWKS key. Supported algorithms are RS256/384/512, **EdDSA**, and ES256/384/512. HS256 is for development only. [PowerSync: Custom auth](https://docs.powersync.com/configuration/auth/custom)

| Option | Free tier | Works with PowerSync | Web SPA | React Native / Expo |
|---|---|---|---|---|
| **Neon Auth** (Managed Better Auth) | Up to 60k MAU on Neon Free | **Yes.** PowerSync's Neon guide points PowerSync at Neon Auth's JWKS URL and audience | Supported: Vite + React, React Router, TanStack Router, Next.js | **Not supported yet.** Not on the framework list, and "standalone frontend + backend" is "coming soon" |
| **Better Auth** (self-hosted library) | Free (OSS), but you host a server | Yes, through its JWT plugin: JWKS at `/jwks`, EdDSA by default | Yes | **Yes, official** `@better-auth/expo` |
| **Clerk** | Hobby: 50,000 MRU per app | Yes. Listed among PowerSync-compatible providers (see prior research) | Yes | **Yes, official** `@clerk/expo` |
| Stack Auth | – | – | – | Neon's legacy auth. Neon now documents migrating *off* it |

Details:
- **Neon Auth is now "Managed Better Auth"**, *"powered by Better Auth"* (v1.4.18), is GA, and runs on AWS regions only. Users live in a `neon_auth` schema that you can query with SQL and that works with RLS. [Neon Auth overview](https://neon.com/docs/auth/overview)
- Its JWT plugin: tokens come from `authClient.token()`, are *"signed with EdDSA (Ed25519) and expire in 15 minutes"*, and are verified via `<NEON_AUTH_URL>/.well-known/jwks.json`. Custom claims aren't supported. A SPA served from a different origin than the `*.neon.tech` auth URL needs `credentials: 'include'`, and *"Safari ITP blocking third-party cookies"* is a known cross-domain limitation. [Neon Auth JWT plugin](https://neon.com/docs/auth/guides/plugins/jwt). Fourfold's web client would run into this unless it uses a reverse proxy or a shared parent domain.
- Framework support and the roadmap: supported are Next.js, Vite + React, React + React Router, and React + TanStack Router. *"Architectures where frontend and backend are separate deployments… are not yet supported. Managed Better Auth uses HTTP-only cookies."* MFA is "coming soon". [Managed Better Auth roadmap](https://neon.com/docs/auth/roadmap)
- React Native: Neon's only Expo sample, [`neondatabase/neon-auth-react-native-demo`](https://github.com/neondatabase/neon-auth-react-native-demo), uses **Stack Auth** (the legacy implementation). Its last push was 2026-03-11 (GitHub API). Neon's docs have a guide to [migrate from the legacy Stack Auth implementation](https://neon.com/docs/auth/migrate/from-legacy-auth).
- Better Auth: *"Better Auth supports both Expo native and web apps"* via `@better-auth/expo`. [Better Auth Expo](https://www.better-auth.com/docs/integrations/expo). Its JWT plugin *"provides… a JWKS endpoint to verify the token"* and is *"meant to be used for services that require JWT tokens"*. [Better Auth JWT plugin](https://www.better-auth.com/docs/plugins/jwt). Catch for $0: it's a library, so you have to run and host an auth server yourself.
- Clerk: Hobby plan has a *"50,000 MRU limit per app"*. [Clerk pricing](https://clerk.com/pricing). Official Expo SDK: `@clerk/expo`. [Clerk Expo quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- Offline note, for any provider: local reads and writes in PowerSync don't need a valid token. The JWT is only needed when the client reconnects to sync, so short-lived tokens like Neon Auth's 15 minutes are fine.

## 4. Other sync engines that pair with Neon

- **ElectricSQL** works with any Postgres that has logical replication. Its Neon guide says to enable logical replication and use the **direct, not pooled** connection string. [Electric: Neon integration](https://electric.ax/docs/sync/integrations/neon). Electric keeps a replication connection open too, so the same compute-hours problem applies.
- **New since the sync-backend research:** on 2026-08-11, *"Electric is joining the Neon team within Databricks."* [Neon blog](https://neon.com/blog/electric-joins-neon). Electric's own post says *"Electric Cloud is winding down. Cloud users will need to self-host or move to another provider,"* and *"Everything Electric has previously open sourced stays open source: Postgres Sync, PGlite, TanStack DB, Durable Streams."* [Electric blog](https://electric.ax/blog/2026/08/11/electric-joining-databricks). The prior research cited Electric Cloud's pricing. **That hosted option is going away**, so Electric now means self-hosting, or waiting to see what Neon ships.
- Neon itself was acquired by Databricks, announced 2025-05-14. [Databricks press release](https://www.databricks.com/company/newsroom/press-releases/databricks-agrees-acquire-neon-help-developers-deliver-ai-systems)

## 5. PowerSync Free-tier deactivation (applies regardless of database)

- Pricing page, Free plan: *"Free projects are deactivated after 1 week of inactivity."* Paid plans: *"No project deactivation."* [PowerSync pricing](https://www.powersync.com/pricing)
- What counts as activity, from the tooltip on the same page: *"Instances that have been inactive for longer than 2 weeks (no activity on the PowerSync dashboard or any API requests) will be deactivated. They can be manually reactiviated."* [PowerSync pricing](https://www.powersync.com/pricing). **Note the inconsistency:** the headline says 1 week and the tooltip says 2 weeks. Plan around 1 week.
- The policy belongs to PowerSync Cloud, so it applies whatever the source database is. Neon doesn't help here.
- **Secondary source, not official:** one developer's PR reports that PowerSync *"deprovisions Free-plan instances after 7 days with no deploys or client connections."* They work around it with a scheduled job that connects a real SDK client twice a week, instead of redeploying, which would trigger reprocessing. [adamnc02/personal-f#1](https://github.com/adamnc02/personal-f/pull/1)
- The self-hosted PowerSync Open Edition has no deactivation, but then you need somewhere free to host it. [PowerSync pricing](https://www.powersync.com/pricing)
- Side effect with Neon: while a deactivated PowerSync instance is disconnected, Neon's compute can scale to zero again. That saves CU-hours, but the slot gets removed after about 40 h, and PowerSync recreates it on reconnect (see §1).

## 6. Bottom line: Neon + PowerSync vs. Supabase + PowerSync for a $0 v1

| | Supabase + PowerSync Cloud | Neon + PowerSync Cloud (+ auth) |
|---|---|---|
| Official PowerSync guide | Yes | Yes |
| No-server write path | supabase-js + RLS | Neon Data API + RLS |
| Free-tier failure mode | Project **paused after ~1 week of low activity**. Needs a manual restore, or a keep-alive | Compute **suspended around day 17 every month**, because PowerSync keeps it awake and 180 CU-h is more than the 100 CU-h allowance. Resumes next billing period |
| Can a keep-alive fix it? | Yes: a few DB requests a day (per Supabase docs) | **No.** More activity burns CU-hours faster |
| PowerSync 1-week deactivation | Applies | Applies |
| Auth for web + future RN | Supabase Auth (web + RN) | Neon Auth: web only, no RN yet, cross-origin cookie caveats. Otherwise Clerk or self-hosted Better Auth (another vendor or server) |
| Cheapest upgrade | Supabase Pro $25/mo | Neon Launch ≈ $19/mo of compute for an always-on 0.25 CU |

**Verdict: Neon isn't worth adding to the $0 shortlist as a Supabase replacement under PowerSync Cloud.** Neon's "never paused for inactivity" advantage doesn't survive contact with logical replication. The always-connected subscriber that any Postgres sync engine needs (PowerSync or Electric) turns Neon's generous idle-friendly free tier into a hard mid-month outage that you can't work around. On top of that, Neon Auth doesn't yet cover React Native or a standalone SPA cleanly, so the Neon stack needs a third vendor (Clerk) or a self-hosted auth server, where Supabase bundles auth.

Supabase's inactivity pause can at least be prevented with light scheduled traffic. It's also unlikely to trigger for an app someone uses daily.

**When Neon becomes worth reconsidering:**
- If Fourfold is willing to pay about $19/mo (Neon Launch). That's cheaper than Supabase Pro for the database alone, but you still need PowerSync Pro ($49) or a self-hosted PowerSync to avoid deactivation.
- If Neon Auth adds React Native and standalone-SPA support, per its [roadmap](https://neon.com/docs/auth/roadmap).
- If Neon ships a Neon-native sync product built from the Electric team. Watch this space, but it doesn't exist today.

## Open questions

- Does PowerSync's replication connection count as "activity" for Supabase's pause detection? Not documented. It would decide whether Supabase + PowerSync pauses on its own.
- Can PowerSync be told to disconnect replication when idle? Nothing found in the docs. It would stop replicating while disconnected, which defeats the point.
