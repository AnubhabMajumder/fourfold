# Self-hosted personal Hub instead of a cloud backend

Fourfold syncs through a **Hub**: self-hosted PowerSync + Postgres in Docker on a machine the user owns, holding exactly one person's Matrix. Devices connect by **Pairing** (Hub address + secret, long-lived token) instead of signing in, and there are no user accounts; the Hub is reachable only over a private network. Fourfold v1 is personal-use at a $0 budget, and every free cloud option failed it: Supabase and PowerSync Cloud free tiers pause after ~1 week of inactivity, Neon's free compute hours run out mid-month because the replication connection keeps it awake, Firebase meant NoSQL and lock-in, and Electric Cloud is winding down. Because the Hub runs the same stack as PowerSync Cloud + hosted Postgres, moving to a hosted backend later is a deployment change, not a rewrite; adding shared multi-user Hubs would additionally need accounts.

## Consequences

- Sync only happens while the Hub is on and reachable; devices keep working offline in the meantime and reconcile by last-write-wins, with deletes winning.
- The Hub's database is the only server-side copy, so backups are the owner's job.
- **Local-only** use (no Hub) is a supported mode, accepting that browser storage may be evicted.
