#!/usr/bin/env bash
#
# Pulls the latest code and redeploys both the backend and frontend.
#
# Run as: sudo bash deploy/deploy.sh
#
# set -e is the important part here -- if `npm run build` (or anything
# else) fails partway through, the script stops immediately instead of
# going on to restart services on top of a stale/broken build, which is
# exactly what silently happened the last time this was done by hand.
set -euo pipefail

REPO_DIR="/opt/onlysalvage"
SERVICE_USER="onlysalvage"

if [[ $EUID -ne 0 ]]; then
  echo "Run this with sudo: sudo bash deploy/deploy.sh" >&2
  exit 1
fi

run_as_service_user() {
  sudo -H -u "$SERVICE_USER" "$@"
}

echo "==> Pulling latest code"
cd "$REPO_DIR"
run_as_service_user git pull

echo "==> Backend: installing dependencies"
cd "$REPO_DIR/onlysalvage_api"
run_as_service_user venv/bin/pip install -r requirements.txt

echo "==> Backend: applying migrations"
run_as_service_user venv/bin/python manage.py migrate

echo "==> Backend: collecting static files"
run_as_service_user venv/bin/python manage.py collectstatic --noinput

echo "==> Frontend: installing dependencies"
cd "$REPO_DIR/onlysalvage_frontend"
run_as_service_user npm install

echo "==> Frontend: building"
run_as_service_user npm run build

echo "==> Restarting services"
systemctl restart onlysalvage-api onlysalvage-celery onlysalvage-frontend

# Give each service a moment to either come up cleanly or crash-loop, so a
# bad deploy is reported here instead of discovered later from a 502.
sleep 3

echo "==> Checking service status"
failed=0
for service in onlysalvage-api onlysalvage-celery onlysalvage-frontend; do
  if systemctl is-active --quiet "$service"; then
    echo "    $service: active"
  else
    echo "    $service: NOT ACTIVE -- check 'journalctl -u $service -n 50 --no-pager'"
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "==> Deploy finished with failures -- see above." >&2
  exit 1
fi

echo "==> Deploy complete."
