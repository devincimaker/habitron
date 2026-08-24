#!/usr/bin/env bash
# Runs ON the box, from CI (see .github/workflows/ci.yml → deploy-api) or by hand:
#   bash /opt/habitron/deploy.sh <image-tag>
# Expects the image `habitron-api:<tag>` to already be loaded into Docker
# (CI streams it over SSH with `docker save | docker load`).
set -euo pipefail

cd /opt/habitron
export API_TAG="${1:-latest}"

if ! docker image inspect "habitron-api:$API_TAG" >/dev/null 2>&1; then
  echo "Error: image habitron-api:$API_TAG is not loaded on this host" >&2
  exit 1
fi

docker compose up -d --remove-orphans

for _ in $(seq 1 30); do
  if docker compose exec -T api node -e \
    "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    echo "api healthy on habitron-api:$API_TAG"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "Error: api did not become healthy" >&2
docker compose logs --tail=50 api >&2
exit 1
