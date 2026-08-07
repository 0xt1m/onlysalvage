# Deploying OnlySalvage to an EC2 instance

Traditional deploy: Python/Node installed directly on the instance, gunicorn
+ Celery + Next.js running as systemd services, nginx reverse-proxying and
terminating TLS. RDS (Postgres/PostGIS) and S3 (media/static) are external,
already-managed AWS services -- nothing here provisions those.

This covers getting the *code* running correctly. It does not cover
provisioning the EC2 instance itself, security groups, IAM roles, or DNS --
those are AWS console/Terraform-level decisions outside this repo.

## One-time server setup

```bash
# System packages (Ubuntu/Debian; adjust for Amazon Linux/RHEL)
sudo apt-get update
sudo apt-get install -y python3.13 python3.13-venv python3-pip \
    gdal-bin libgdal-dev libgeos-dev libpq-dev \
    nodejs npm nginx certbot python3-certbot-nginx redis-server

sudo useradd --system --create-home --shell /bin/false onlysalvage
sudo mkdir -p /opt/onlysalvage
sudo chown onlysalvage:onlysalvage /opt/onlysalvage
```

Clone/copy this repo to `/opt/onlysalvage/` (so you end up with
`/opt/onlysalvage/onlysalvage_api` and `/opt/onlysalvage/onlysalvage_frontend`
side by side -- matches the paths in the systemd units below).

## Backend

```bash
cd /opt/onlysalvage/onlysalvage_api
python3.13 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in .env for real: DJANGO_SECRET_KEY (generate a NEW one, don't reuse
# the dev value), DJANGO_DEBUG=False, DJANGO_ALLOWED_HOSTS,
# CORS_ALLOWED_ORIGINS, CSRF_TRUSTED_ORIGINS, FRONTEND_URL, the real RDS
# host/credentials, REDIS_CACHE_URL, GOOGLE_PLACES_API_KEY (see note below),
# Twilio/Telegram creds.

python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser   # if you need an initial admin account

sudo cp ../deploy/onlysalvage-api.service /etc/systemd/system/
sudo cp ../deploy/onlysalvage-celery.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now onlysalvage-api onlysalvage-celery
```

**Before going live, rotate the Google Places API key.** It was sitting
hardcoded in `settings.py` (now fixed to read from env), but the exposed
value itself should be treated as burned -- revoke it in Google Cloud
Console and issue a new one restricted to the production domain/IP.

## Frontend

```bash
cd /opt/onlysalvage/onlysalvage_frontend
npm install

cp .env.example .env.production.local
# NEXT_PUBLIC_SITE_URL=https://onlysalvage.com
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same OAuth client ID as the backend>
# NEXT_PUBLIC_API_PATH=/api          <- important, see lib/apiUrl.ts
# INTERNAL_API_URL=http://unix:/run/onlysalvage/api.sock:/api  (or wherever
#   gunicorn is actually reachable from this box -- see note below)

npm run build

sudo cp ../deploy/onlysalvage-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now onlysalvage-frontend
```

`INTERNAL_API_URL` note: Next.js's own `fetch` can't talk to a Unix socket
directly. Simplest fix is to have gunicorn also bind a loopback TCP port
(add `--bind 127.0.0.1:8001` alongside the socket bind in
`onlysalvage-api.service`) and set `INTERNAL_API_URL=http://127.0.0.1:8001/api`
-- keeps server-to-server traffic off the public nginx path entirely.

## nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/onlysalvage.conf
# Edit server_name in that file to match your real domain first.
sudo ln -s /etc/nginx/sites-available/onlysalvage.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Once DNS for your domain points at this instance's IP:
sudo certbot --nginx -d onlysalvage.com -d www.onlysalvage.com
```

## Redeploying after a code change

```bash
# Backend
cd /opt/onlysalvage/onlysalvage_api
git pull
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
sudo systemctl restart onlysalvage-api onlysalvage-celery

# Frontend
cd /opt/onlysalvage/onlysalvage_frontend
git pull
npm install
npm run build
sudo systemctl restart onlysalvage-frontend
```

## Logs

```bash
journalctl -u onlysalvage-api -f
journalctl -u onlysalvage-celery -f
journalctl -u onlysalvage-frontend -f
```

## Still outside the scope of this code-level pass

- Actually provisioning the EC2 instance, security groups, IAM role (S3 +
  SES if used), Route53/DNS, and the RDS/S3 resources themselves.
- Real outbound email (EMAIL_BACKEND is still the console backend --
  password-reset emails won't actually send until this has real SMTP/SES
  credentials).
- Error tracking (Sentry or equivalent) -- errors currently only go to
  journald, with nothing aggregating or alerting on them.
- Automated tests / CI -- there's no test coverage or pipeline yet.
- Upgrading the Twilio account off its trial plan (see earlier chat history --
  trial accounts can only text pre-verified numbers).
