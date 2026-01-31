#!/bin/bash
# ARC4DE Stop Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Stopping ARC4DE..."
docker compose down
echo "Done."
