#!/bin/sh
set -e

# waporta installer
# Usage: curl -fsSL https://storage.iniadil.dev/wa-porta/install.sh | sh

REPO="https://github.com/iniadil/waporta.git"
DIR="waporta"

# colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

print()  { printf "%b\n" "$1"; }
ok()     { printf "%b\n" "${GREEN}✓${RESET} $1"; }
info()   { printf "%b\n" "${CYAN}→${RESET} $1"; }
warn()   { printf "%b\n" "${YELLOW}!${RESET} $1"; }
error()  { printf "%b\n" "${RED}✗${RESET} $1"; exit 1; }
header() { printf "\n%b\n\n" "${BOLD}$1${RESET}"; }

# ── prerequisites ──────────────────────────────────────────────────────────────

header "waporta installer"

command -v git >/dev/null 2>&1 || error "git is required but not installed."

if ! command -v docker >/dev/null 2>&1; then
  error "Docker is required but not installed. Install from https://docs.docker.com/get-docker/"
fi

if ! docker compose version >/dev/null 2>&1; then
  error "Docker Compose plugin is required. Update Docker Desktop or install the plugin."
fi

ok "Prerequisites OK (git, docker, docker compose)"

# ── destination ────────────────────────────────────────────────────────────────

if [ -d "$DIR" ]; then
  warn "Directory '$DIR' already exists."
  printf "  Overwrite? [y/N] "
  read -r CONFIRM </dev/tty
  case "$CONFIRM" in
    y|Y) rm -rf "$DIR" ;;
    *)   error "Aborted." ;;
  esac
fi

# ── credentials ────────────────────────────────────────────────────────────────

header "Dashboard credentials"

printf "  Username [admin]: "
read -r USERNAME </dev/tty
USERNAME="${USERNAME:-admin}"

printf "  Password: "
# hide input if connected to a terminal
if [ -t 1 ]; then
  stty -echo 2>/dev/null || true
  read -r PASSWORD </dev/tty
  stty echo 2>/dev/null || true
  print ""
else
  read -r PASSWORD </dev/tty
fi

if [ -z "$PASSWORD" ]; then
  error "Password cannot be empty."
fi

printf "  Port [3000]: "
read -r PORT </dev/tty
PORT="${PORT:-3000}"

# ── install ────────────────────────────────────────────────────────────────────

header "Installing"

info "Cloning repository..."
git clone --quiet "$REPO" "$DIR"
cd "$DIR"

info "Writing .env..."
cat > .env <<EOF
DASHBOARD_USERNAME=${USERNAME}
DASHBOARD_PASSWORD=${PASSWORD}
PORT=${PORT}
EOF

info "Starting containers..."
PORT="$PORT" docker compose up -d

# ── done ───────────────────────────────────────────────────────────────────────

print ""
ok "waporta is running!"
print ""
print "  Dashboard  ${BOLD}http://localhost:${PORT}/dashboard${RESET}"
print "  API docs   ${BOLD}http://localhost:${PORT}/doc${RESET}"
print ""
print "${CYAN}Next steps:${RESET}"
print "  1. Open the dashboard and log in"
print "  2. Go to ${BOLD}API Keys${RESET} → generate a key"
print "  3. Go to ${BOLD}Sessions${RESET} → create a session → scan QR"
print "  4. Start sending messages via the REST API"
print ""
print "  Logs:    cd ${DIR} && docker compose logs -f"
print "  Stop:    cd ${DIR} && docker compose down"
print "  Upgrade: cd ${DIR} && git pull && docker compose up -d --build"
print ""
