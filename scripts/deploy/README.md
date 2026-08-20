# Homepage production deployment

The production homepage is deployed as an immutable Git release with a blue/green runtime switch.

## Safety properties

- Deployment is refused unless the working tree is clean and `HEAD` exactly matches `origin/main`.
- A release archive is generated from Git, uploaded with a SHA-256 checksum, and extracted into a new release directory.
- Dependencies, type checks, the production build, image-quality regression checks, and database migrations run before traffic changes.
- The candidate starts on the inactive port (`3012` or `3013`) and must pass `/api/health` before traffic switches.
- Nginx continues proxying to `127.0.0.1:3002`; a stable local router atomically selects the blue or green application.
- If a post-switch health check fails, the router target is restored automatically.
- Production secrets live in `/srv/unionam/shared/homepage/.env.local` and are symlinked into each release.
- `/srv/unionam/current-homepage` and `/srv/unionam/previous-homepage` identify the current and rollback releases.

## Manual deployment

```bash
git push origin main
./scripts/deploy/production.sh
```

The first migration to the router has a very short one-time cutover while port `3002` changes ownership. Later deployments switch between ports without stopping the active application.

## Rollback

Read the previous release's assigned port from `/srv/unionam/deploy/homepage-deployments.log`, verify it is healthy, and atomically write that port to `/srv/unionam/deploy/homepage-active-port`. Do not roll back database migrations unless a migration explicitly provides a reviewed reverse operation.
