#!/bin/bash
set -e

echo "Starting AuraPhoto Service Entrypoint..."

# If DATABASE_URL is set, wait for PostgreSQL to become available
if [ -n "$DATABASE_URL" ]; then
  # Parse host and port from DATABASE_URL
  # Format: postgresql://user:pass@host:port/db
  DB_HOST=$(echo $DATABASE_URL | sed -e 's|.*@||' -e 's|/.*||' -e 's|:.*||')
  DB_PORT=$(echo $DATABASE_URL | sed -e 's|.*@||' -e 's|/.*||' -e 's|.*:||')
  
  if [ -z "$DB_PORT" ] || [ "$DB_PORT" = "$DB_HOST" ]; then
    DB_PORT=5432
  fi

  echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
  until python3 -c "import socket; s = socket.socket(); s.settimeout(1); s.connect(('$DB_HOST', int('$DB_PORT')))" 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
  done
  echo "PostgreSQL is up and running!"
fi

# Execute the passed command (like uvicorn or celery) or fallback to starting FastAPI
if [ $# -eq 0 ]; then
  echo "No command specified. Defaulting to running FastAPI server..."
  exec uvicorn backend.main:app --host 0.0.0.0 --port 8000
else
  echo "Executing custom command: $@"
  exec "$@"
fi
