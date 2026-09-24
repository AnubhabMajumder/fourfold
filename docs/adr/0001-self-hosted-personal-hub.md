# Self-hosted personal Hub instead of a cloud backend

Fourfold syncs through a **Hub**: self-hosted PowerSync + Postgres in Docker on a machine the user owns, holding exactly one person's Matrix. Devices connect by **Pairing** (Hub address + secret, which gives the device a long-lived device secret that the Hub exchanges for short-lived sync tokens) instead of signing in, and there are no user accounts; the Hub is reachable only over a private network. Fourfold v1 is personal-use at a $0 budget, and every free cloud option failed it: Supabase and PowerSync Cloud free tiers pause after ~1 week of inactivity, Neon's free compute hours run out mid-month because the replication connection keeps it awake, Firebase meant NoSQL and lock-in, and Electric Cloud is winding down. Because the Hub runs the same stack as PowerSync Cloud + hosted Postgres, moving to a hosted backend later is a deployment change, not a rewrite; adding shared multi-user Hubs would additionally need accounts.

## Consequences

- Sync only happens while the Hub is on and reachable; devices keep working offline in the meantime and reconcile by last-write-wins, with deletes winning.
- The Hub's database is the only server-side copy, so backups are the owner's job.
- **Local-only** use (no Hub) is a supported mode, accepting that browser storage may be evicted.
- PowerSync rejects tokens that live longer than 24 hours, so the Hub runs a small API of our own (pairing, token exchange, uploads) alongside PowerSync, and serves HTTPS (e.g. `tailscale serve`) because browsers won't call a plain-HTTP Hub from the web app.

## Update (2026-09-25): deferred past v1

v1 runs on one laptop: the web app in that laptop's browser, the Tasks in a database on the same machine. There's no second device, so the Hub, Pairing, and multi-device sync are a later effort, as is moving to an online database. The Pairing design agreed so far is recorded on the "Connecting a device to a Hub" ticket (issue #7). This decision still stands for when multi-device sync returns.
