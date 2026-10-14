# maptogether-relay

Cloudflare Worker for multiplayer maps. Deployed at
`https://maptogether-relay.innerlattice.workers.dev`.

Edits and cursors travel peer to peer: Yjs over WebRTC data channels
(`src/sync/` in the app). The relay does the two things peers can't:

- **Signaling.** `GET /sync/:room` opens a WebSocket into that map's Durable
  Object (`Room`). JSON text frames are signaling: the room gives each
  socket a peer id, tells newcomers who is there (newcomers send the offers),
  and forwards SDP and ICE candidates (`src/signaling.ts`).
- **Saving and loading.** Binary frames on the same socket are the Yjs sync
  protocol against the room's saved copy (`src/store.ts`). Clients load the map
  on connect and upload their own edits; the room saves to SQLite storage 2 s
  after edits and when the last editor leaves. It never forwards edits.
- **ICE.** `GET /ice` returns Cloudflare STUN plus short-lived Cloudflare TURN
  credentials (`src/ice.ts`) for peers behind strict NATs.

Room ids are a hash of the map id, computed in the browser. Keepalive
`ping`/`pong` is answered by the runtime, so idle rooms hibernate. Origins are
checked against `ALLOWED_ORIGINS` (`*` = one DNS label, for Netlify previews).

## Develop and deploy

From the repo root (the relay shares its dependencies):

```sh
yarn relay:dev      # local relay on :8787
yarn dev:local      # local relay on :8790 and the app against it
yarn relay:deploy   # needs CLOUDFLARE_API_TOKEN
yarn test:live      # WebRTC + saving against the deployed relay
```

Secrets (`wrangler secret put`): `TURN_KEY_ID`, `TURN_KEY_API_TOKEN`, from a
Cloudflare Realtime TURN key. Without them `/ice` returns STUN only.

### Automatic deployment

[Deploy Cloudflare relay](../.github/workflows/deploy-relay.yml) validates
branch pushes against a Worker Preview and deploys pushes to `main` when relay
code, the client sync protocol, shared dependencies, Node/Yarn configuration,
test configuration, or the workflow changes. UI-only changes do not redeploy the relay. It can also be run manually
from GitHub Actions on `main`.

`wrangler.jsonc` is the infrastructure definition: Worker name, account, Durable
Object binding and migrations, allowed origins, and observability are versioned
there. CI uses the locked Wrangler dependency and runs type checks, relay/sync
tests, and a dry-run bundle, then deploys and live-tests a Preview (see below)
before production. Deployments are serialized; queued runs and manual reruns
check out current `main`. A live test then verifies peer sync, save
acknowledgements, and reloading saved data in an isolated test map. A failed live
test marks the run failed; it does not automatically roll back database migrations.

One-time authentication setup:

1. Create a Cloudflare Workers deployment API token, restricted to the account
   in `wrangler.jsonc`, following the
   [Cloudflare GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).
2. Add it as the repository Actions secret `CLOUDFLARE_API_TOKEN` in
   [GitHub settings](https://github.com/ayahohner/maptogether/settings/secrets/actions).
   Local `wrangler login` credentials are not available to GitHub runners.
3. Run **Deploy Cloudflare relay** on `main` and confirm the deployment and live
   verification steps pass.

The token is supplied only to the Preview and production deployment steps and
the Preview cleanup workflow. Existing TURN secrets stay in
Cloudflare and do not need to be copied into GitHub.

### Worker Previews

Every relay deploy first goes to an isolated
[Worker Preview](https://developers.cloudflare.com/workers/previews/) with its own
`Room` Durable Object namespace, so preview maps never read or write
production maps. CI runs the live sync test against it before going further:

- **`main`** deploys the `main` Preview, tests it, then deploys production. A
  bad migration or protocol change fails in the Preview first.
- **Other branches** that touch the relay deploy a Preview named after the
  branch (`claude/foo` becomes `claude-foo`) at
  `https://<name>-maptogether-relay.innerlattice.workers.dev`, linked in the run
  summary. No pull request needed.

Previews don't expire on their own.
[Clean up relay Worker Previews](../.github/workflows/relay-previews-cleanup.yml)
deletes a branch's Preview when the branch is deleted, and daily deletes any
Preview not deployed for 7 days (except `main`). To try one from the app, run
it with `VITE_SYNC_RELAY_URL` set to the Preview's URL.

By hand, from any branch:

```sh
yarn wrangler preview -c relay/wrangler.jsonc --name my-branch
yarn wrangler preview delete -c relay/wrangler.jsonc --name my-branch -y
```

Previews don't inherit top-level `vars` or `env` bindings, so `wrangler.jsonc`
restates them under `previews`. They use STUN only unless TURN secrets are added
with `wrangler preview base-config secret put TURN_KEY_ID` (and
`TURN_KEY_API_TOKEN`). The free plan keeps up to 100 Previews per Worker and
deletes the least recently deployed beyond that.

### Logs and traces

Workers Logs record every invocation. Traces sample 10% of production
invocations (`observability.traces.head_sampling_rate`) and 100% of Previews.
From 2026-12-01 the free plan includes 0.5 GB/day of trace ingestion; 10% keeps
roughly an order of magnitude of headroom over current traffic. Check
ingestion under Observability in the dashboard and adjust the rate there if
traffic grows.

## Limits and costs

64 editors per map, 64 KB signaling messages, 1 MB sync messages, ~2 MB saved
map. The Workers free plan covers 100k Durable Object requests a day; past
that, Workers Paid is $5/month. TURN is billed per GB relayed, only for peers
that can't connect directly.

### Save receipts and presence

Canvas mouse positions and anonymous user identities are ephemeral Yjs awareness
messages sent over WebRTC, never saved in the map. The menu count includes the
local session; each tab has its own Yjs client ID.

After loading or editing, clients send a JSON `{ "type": "save", "id": N }`
checkpoint after their binary uploads. The relay replies with `saved` and the same
ID only after durable storage commits, or `save-error` on failure. Writes are
serialized. Clients keep newer edits pending, retry failures, and show a red
status on disconnect or a 15-second receipt timeout. Peer edits are also uploaded
(idempotently) so a receipt covers the client's complete visible document.

Deploy the updated relay before releasing the updated client. Older clients
continue using the existing sync protocol. New clients connected to an older
relay will show a save-confirmation error rather than incorrectly report saved.
