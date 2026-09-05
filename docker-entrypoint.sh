#!/bin/sh
set -e

echo "[entrypoint] Running prisma migrate deploy..."
./node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Running prisma db seed..."
./node_modules/.bin/prisma db seed

echo "[entrypoint] Starting application..."
exec "$@"
