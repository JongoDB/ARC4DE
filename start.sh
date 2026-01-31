#!/bin/bash
# ARC4DE Start Script
# Starts containers in detached mode and displays tunnel info

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
CYAN='\033[1;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "    _    ____   ____ _  _   ____  _____ "
echo "   / \  |  _ \ / ___| || | |  _ \| ____|"
echo "  / _ \ | |_) | |   | || |_| | | |  _|  "
echo " / ___ \|  _ <| |___|__   _| |_| | |___ "
echo "/_/   \_\_| \_\\\\____|  |_| |____/|_____|"
echo -e "${NC}"
echo ""

# Start containers
echo -e "${YELLOW}Starting containers...${NC}"
docker compose up -d

# Wait for frontend to be ready (which means backend is also ready)
echo -e "${YELLOW}Waiting for services to be ready...${NC}"
max_attempts=60
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -sf http://localhost:5175/api/health > /dev/null 2>&1; then
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
    echo -n "."
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    echo -e "${RED}Services failed to start. Check logs with: docker compose logs${NC}"
    exit 1
fi

# Wait a moment for tunnel to establish
echo -e "${YELLOW}Waiting for tunnel...${NC}"
sleep 3

# Fetch tunnel info (through frontend proxy)
tunnel_response=$(curl -sf http://localhost:5175/api/tunnel 2>/dev/null || echo '{}')
session_url=$(echo "$tunnel_response" | grep -o '"session_url":"[^"]*"' | cut -d'"' -f4)

if [ -z "$session_url" ] || [ "$session_url" = "null" ]; then
    echo -e "${YELLOW}No tunnel active (cloudflared may not be installed)${NC}"
    echo ""
    echo -e "${GREEN}ARC4DE is running at:${NC}"
    echo -e "  ${CYAN}http://localhost:5175${NC}"
else
    echo ""
    echo "============================================================"
    echo -e "  ${GREEN}ARC4DE Remote Access${NC}"
    echo "============================================================"
    echo ""
    echo -e "  ${CYAN}${session_url}${NC}"
    echo ""

    # Generate QR code as PNG image for reliable scanning
    docker compose exec -T backend python3 -c "
try:
    import qrcode
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
    qr.add_data('$session_url')
    qr.make(fit=True)
    img = qr.make_image(fill_color='black', back_color='white')
    img.save('/app/tunnel_qr.png')
    print('  QR code saved to: tunnel_qr.png')
except Exception as e:
    print(f'  (QR image generation failed: {e})')
" 2>/dev/null || true

    # Copy QR code from container to host
    docker compose cp backend:/app/tunnel_qr.png ./tunnel_qr.png 2>/dev/null || true

    if [ -f "./tunnel_qr.png" ]; then
        echo -e "  ${GREEN}QR code saved:${NC} ./tunnel_qr.png"
        echo ""
        # Try to open the image (macOS)
        if command -v open &> /dev/null; then
            echo -e "  Opening QR code image..."
            open ./tunnel_qr.png 2>/dev/null || true
        fi
    fi

    echo ""
    echo "============================================================"
fi

echo ""
echo -e "${GREEN}Local access:${NC}  http://localhost:5175"
echo ""
echo -e "Logs:    ${YELLOW}docker compose logs -f${NC}"
echo -e "Stop:    ${YELLOW}docker compose down${NC}"
echo ""
