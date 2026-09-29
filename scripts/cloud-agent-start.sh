#!/usr/bin/env bash
# Per-boot local services for Cloud Agents: Docker, Supabase, .env.local, seed users.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
  NODE_BIN="$(dirname "$(nvm which 22)")"
  export PATH="$NODE_BIN:$PATH"
fi

start_docker() {
  if docker info >/dev/null 2>&1; then
    return 0
  fi

  if [[ ! -S /var/run/docker.sock ]]; then
    echo '{"storage-driver":"fuse-overlayfs","iptables":true,"ip6tables":false}' | sudo tee /etc/docker/daemon.json >/dev/null
    if [[ -x /usr/sbin/iptables-legacy ]]; then
      sudo update-alternatives --set iptables /usr/sbin/iptables-legacy || true
      sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy || true
    fi
    sudo dockerd >/tmp/dockerd.log 2>&1 &
  fi

  for _ in $(seq 1 60); do
    if [[ -S /var/run/docker.sock ]]; then
      sudo chmod 666 /var/run/docker.sock || true
    fi
    if docker info >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "Docker did not become ready. See /tmp/dockerd.log" >&2
  return 1
}

prepare_supabase_workdir() {
  python3 - "$ROOT" <<'PY'
import pathlib, shutil, sys
root = pathlib.Path(sys.argv[1])
src = root / "supabase" / "migrations"
dest_root = pathlib.Path("/tmp/kt-portal-supabase")
supabase_dir = dest_root / "supabase"
mig = supabase_dir / "migrations"
if dest_root.exists():
    shutil.rmtree(dest_root)
mig.mkdir(parents=True)
shutil.copy(root / "supabase" / "config.toml", supabase_dir / "config.toml")
# config.toml references ./seed.sql. Test users are created by the seed script.
(supabase_dir / "seed.sql").write_text("-- seeded by scripts/seed-test-users.ts\n")
assigned = set()
files = sorted(p.name for p in src.iterdir() if p.suffix == ".sql")
for name in files:
    prefix, rest = name.split("_", 1)
    version = int(prefix)
    while f"{version:014d}" in assigned:
        version += 1
    key = f"{version:014d}"
    assigned.add(key)
    (mig / f"{key}_{rest}").symlink_to(src / name)
print(f"prepared {len(files)} migrations")
PY
}

write_env_local() {
  local status_file
  status_file="$(mktemp)"
  npx supabase status -o env --workdir /tmp/kt-portal-supabase >"$status_file"
  python3 - "$status_file" "$ROOT/.env.local" <<'PY'
import pathlib, sys
src, dest = sys.argv[1:]
vals = {}
for line in pathlib.Path(src).read_text().splitlines():
    if "=" not in line:
        continue
    key, value = line.split("=", 1)
    vals[key] = value.strip().strip('"')
required = ("API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL")
missing = [key for key in required if not vals.get(key)]
if missing:
    raise SystemExit(f"supabase status missing {', '.join(missing)}")
pathlib.Path(dest).write_text(
    "\n".join(
        [
            f"NEXT_PUBLIC_SUPABASE_URL={vals['API_URL']}",
            f"NEXT_PUBLIC_SUPABASE_ANON_KEY={vals['ANON_KEY']}",
            f"SUPABASE_SERVICE_ROLE_KEY={vals['SERVICE_ROLE_KEY']}",
            f"POSTGRES_URL_NON_POOLING={vals['DB_URL']}",
            "NEXT_PUBLIC_APP_URL=http://localhost:3000",
            "NODE_ENV=development",
            "",
        ]
    )
)
print("wrote .env.local")
PY
  rm -f "$status_file"
}

start_docker

if ! npx supabase status --workdir /tmp/kt-portal-supabase >/dev/null 2>&1; then
  prepare_supabase_workdir
  npx supabase start \
    -x studio,logflare,vector,imgproxy,edge-runtime,postgres-meta \
    --workdir /tmp/kt-portal-supabase
else
  # Refresh migration links without restarting a healthy stack.
  if [[ ! -d /tmp/kt-portal-supabase/supabase/migrations ]]; then
    prepare_supabase_workdir
  fi
fi

write_env_local
pnpm exec tsx scripts/seed-test-users.ts
echo "Local Supabase is ready at http://127.0.0.1:54321"
