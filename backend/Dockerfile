FROM python:3.11-slim

# Install system dependencies (tmux needed for session management, curl for downloads)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tmux \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install cloudflared (detect architecture for multi-arch support)
ARG TARGETARCH
RUN ARCH=$(echo ${TARGETARCH:-amd64} | sed 's/amd64/amd64/' | sed 's/arm64/arm64/') && \
    curl -L "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
    -o /usr/local/bin/cloudflared && \
    chmod +x /usr/local/bin/cloudflared

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
