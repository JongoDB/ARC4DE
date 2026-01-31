"""Cloudflare tunnel management for remote access."""

import re

# Pattern to match trycloudflare.com URLs
TUNNEL_URL_PATTERN = re.compile(r"https://[\w-]+\.trycloudflare\.com")


def parse_tunnel_url(output: str) -> str | None:
    """Extract trycloudflare.com URL from cloudflared output.

    Args:
        output: The stderr output from cloudflared containing tunnel information.

    Returns:
        The extracted tunnel URL, or None if no URL was found.
    """
    match = TUNNEL_URL_PATTERN.search(output)
    return match.group(0) if match else None
