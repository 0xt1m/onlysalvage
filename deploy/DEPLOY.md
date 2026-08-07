# Deploying OnlySalvage to an EC2 instance (Ubuntu)

Traditional deploy: Python/Node installed directly on the instance, gunicorn
+ Celery + Next.js running as systemd services, nginx reverse-proxying and
terminating TLS. RDS (Postgres/PostGIS) and S3 (media/static) are external,
already-managed AWS services -- nothing here provisions those.

Targets Ubuntu specifically (this is what's actually running in production --
22.04/24.04 LTS or newer). nginx's worker processes run as `www-data` on
Ubuntu, which matters for the socket-permission step below; a different
distro (Amazon Linux/RHEL use `nginx` as the user instead, and different
package names throughout) would need those adjusted.

This covers getting the *code* running correctly. It does not cover
provisioning the EC2 instance itself, security groups, IAM roles, or DNS --
those are AWS console/Terraform-level decisions outside this repo.

## One-time server setup

```bash
# Python 3.14 isn't in Ubuntu's default apt repos yet on most LTS releases --
# the deadsnakes PPA is the standard way to get a current version without
# building from source. Skip this `add-apt-repository` step if your Ubuntu
# release already ships python3.14 natively (check `apt-cache policy python3.14`).
sudo add-apt-repository -y ppa:deadsnakes/ppa
sudo apt-get update
sudo apt-get install -y python3.14 python3.14-venv python3-pip \
    gdal-bin libgdal-dev libgeos-dev libpq-dev \
    nginx certbot python3-certbot-nginx redis-server git

# Ubuntu's own `apt install nodejs` repo is usually far behind what Next.js
# 16 / React 19 need -- use NodeSource's setup script for a current LTS
# instead (this adds NodeSource's apt repo, then installs from it).
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

sudo useradd --system --create-home --shell /bin/false onlysalvage
sudo mkdir -p /opt/onlysalvage
sudo chown onlysalvage:onlysalvage /opt/onlysalvage
```

Clone this repo to `/opt/onlysalvage/` (so you end up with
`/opt/onlysalvage/onlysalvage_api` and `/opt/onlysalvage/onlysalvage_frontend`
side by side -- matches the paths in the systemd units below):

```bash
git clone <your-repo-url> /opt/onlysalvage
```

## Backend

```bash
cd /opt/onlysalvage/onlysalvage_api
python3.14 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in .env for real: DJANGO_SECRET_KEY (generate a NEW one, don't reuse
# the dev value), DJANGO_DEBUG=False,
# DJANGO_ALLOWED_HOSTS=onlysalvage.com,www.onlysalvage.com,127.0.0.1  <-
#   the 127.0.0.1 matters: the frontend's server-side calls hit gunicorn's
#   loopback port directly (INTERNAL_API_URL below), and Django rejects
#   anything not in this list with a 400 DisallowedHost otherwise.
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

# nginx's worker processes run as www-data on Ubuntu -- without this, nginx
# can't read/write the gunicorn socket (RuntimeDirectoryMode=0750 in
# onlysalvage-api.service restricts it to the onlysalvage user/group), and
# every request through nginx 502s.
sudo usermod -a -G onlysalvage www-data
sudo systemctl restart onlysalvage-api
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
# INTERNAL_API_URL=http://127.0.0.1:8001/api   <- see note below, NOT the unix socket

npm run build

sudo cp ../deploy/onlysalvage-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now onlysalvage-frontend
```

`INTERNAL_API_URL` note: Next.js's own `fetch` can't talk to a Unix socket at
all -- `http://unix:/run/onlysalvage/api.sock:/api` is NOT a valid value and
fails with `getaddrinfo EAI_AGAIN unix` (Node tries to DNS-resolve the
literal hostname "unix"). Use the loopback TCP port gunicorn also binds
instead (`onlysalvage-api.service` already passes `--bind 127.0.0.1:8001`
alongside the socket bind for exactly this reason):
`INTERNAL_API_URL=http://127.0.0.1:8001/api`. Server-to-server traffic still
never touches the public nginx path either way.

## nginx + TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/onlysalvage.conf
# Edit server_name in that file to match your real domain first.
sudo ln -s /etc/nginx/sites-available/onlysalvage.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Once DNS for your domain points at this instance's IP:
sudo certbot --nginx -d onlysalvage.com -d www.onlysalvage.com
```

certbot rewrites `/etc/nginx/sites-available/onlysalvage.conf` in place to
add the 443/SSL server block and the http->https redirect -- `deploy/nginx.conf`
in the repo is the pre-certbot version and will look out of date after this
runs. That's expected; copy the real post-certbot file
(`cat /etc/nginx/sites-available/onlysalvage.conf`) back into the repo if you
want it to match reality for future fresh deploys.

## Redeploying after a code change

Requires an SSH deploy key set up for this repo on the server (GitHub repo
-> Settings -> Deploy keys, read-only is enough) -- see whichever chat/notes
you set that up from if it's not already configured.

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
