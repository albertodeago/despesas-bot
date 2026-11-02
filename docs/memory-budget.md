# Running within the Legacy Hobby compute allowance

## Changes

- Replace the complete `googleapis` SDK with `@googleapis/sheets` and an explicit
  `google-auth-library` dependency. Keep service-account authentication and the
  existing Sheets read/append/update operations.
- Remove chart rendering and its native canvas dependency. Monthly reports still
  send their category/subcategory text summaries; sends are awaited sequentially.
- Remove unused local Google authentication and patch TTLCache to 2.1.5.
- Prune development dependencies from the production image; native build tools
  are no longer needed.
- Set the Machine to 256 MB in `fly.toml` and align PR checks with Node 24.10.0.

The Telegram 2.x update was investigated but deferred: it changes the client,
handlers and webhook API. Updating it is a separate migration, not a safe patch
for this memory reduction. Existing audit findings in its legacy dependencies
are not fixed by this change.

## Reproduce the memory check

With Node/npm and a running Docker daemon:

```sh
npm ci
npm run build
npm test
npm run ts:check

docker build -t despesas-bot:memory-check .
docker run --rm --network none --memory 256m --memory-swap 256m \
  -e NODE_PATH=/smoke/node_modules \
  -v "$PWD/scripts:/app/scripts:ro" \
  -v "$PWD/node_modules:/smoke/node_modules:ro" \
  despesas-bot:memory-check node scripts/memory-smoke.cjs
```

This runs the production image/bundle, mounting only the harness and its development
libraries. It does not run `npm` inside the memory-limited container, load `.env`,
use real credentials, or contact Telegram/Google. HTTP interception is installed
before startup, unexpected requests fail, and Docker blocks external networking.
The actual clients, OAuth signing, webhook server, expense command, Sheets
append/update, listing, and monthly text reporting are exercised with fake data.

The harness performs 60 report/listing cycles over 10,000 synthetic history rows,
including slow Telegram replies and duplicate-report checks. Acceptance requires:

- Node 24 on Linux, a real 256 MiB memory cgroup, and disabled swap;
- process peak RSS at most 160 MiB and cgroup peak at most 192 MiB;
- no new cgroup limit/OOM events, no application errors, and correct output.

`npm run test:memory` is also available inside an appropriately isolated Linux
container. `SMOKE_ALLOW_UNLIMITED=1` skips environment checks for debugging only;
it is not an acceptance result.

Nock is deliberately pinned to 14.0.17. A trial with 15.0.5 retained Google response
histories through mocked TLS socket handles and OOMed during the longer run.
The same workload with 14.0.17 stayed within budget without forced GC or weaker
limits. Re-run the memory check when changing the HTTP mocking dependency.

## Local results (2 November 2026)

- Bundle: about 33.1 MiB before, about 3.0 MiB after.
- Existing unit tests: 136 passed; TypeScript and production Docker build passed.
- Native ARM64 Linux container: peak process RSS about 115 MiB, 60 cycles passed.
- x86-64 Linux guest/container: peak process RSS about 119 MiB, 60 cycles passed.
- Both used Node 24.10.0, a 256 MiB cap, no swap, and recorded no OOM events.

The x86-64 guest was system-emulated on an ARM Mac; CPU emulation was outside the
container's memory cgroup. Running an x86-64 container directly through user-mode
QEMU on ARM includes emulator overhead in the container and is not an equivalent
memory measurement. Prefer a host/guest whose CPU architecture matches the image.

This is a finite synthetic check, not proof of every workload or a long-running
production soak. It includes the mock library/fixtures but excludes the Fly guest
OS and agent. The conservative ceilings leave room for those services; validate
actual usage after deployment, especially under concurrent commands and larger
spreadsheets. The old live process's approximately 226 MiB RSS is not a controlled
before/after comparison with the isolated smoke workload.

## Rollout (manual; not performed by this branch)

1. Deploy the optimized image with the updated `fly.toml`. Expect a brief restart.
   Do not shrink the old image before deploying the optimization.
2. Check `fly machine list -a despesas-bot --json` and confirm the live Machine's
   `config.guest.memory_mb` is 256 and there is only one started Machine. If the
   existing size was retained, only after the optimized image is running use
   `fly scale memory 256 -a despesas-bot`.
3. Exercise expense entry/listing, watch `fly logs -a despesas-bot`, and check Fly
   memory metrics for OOM/restart events. Continue monitoring across report runs.
4. Confirm the organization still has its Legacy Hobby allowance and the next
   usage breakdown has no additional-RAM charge. Already accrued RAM usage is
   still payable; this is not a refund or a hard spending cap.
5. If the app OOMs, temporarily restore RAM with
   `fly scale memory 1024 -a despesas-bot` and investigate before retrying 256 MB.
   Restoring RAM resumes billable additional-RAM usage. Restore capacity before
   rolling back to the heavier old image, and update `fly.toml` if retaining it.

The $0 expectation applies only while all resources stay within this particular
organization's legacy allowances. Dedicated IPs, storage, excess bandwidth, new
organizations, or future pricing/allowance changes can introduce charges.
