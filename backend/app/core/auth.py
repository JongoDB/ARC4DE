"""JWT create/verify/refresh logic."""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

ALGORITHM = "HS256"


class TokenPair(BaseModel):
    """Access + refresh token pair returned on login/refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def verify_password(password: str) -> bool:
    """Timing-safe comparison of password against configured auth password."""
    return secrets.compare_digest(password, settings.auth_password)


def create_token_pair(
    access_expiry_override: timedelta | None = None,
    refresh_expiry_override: timedelta | None = None,
) -> TokenPair:
    """Create a new access + refresh token pair.

    Args:
        access_expiry_override: Override access token expiry (for testing).
        refresh_expiry_override: Override refresh token expiry (for testing).

    Returns:
        TokenPair with access_token, refresh_token, and token_type.
    """
    now = datetime.now(timezone.utc)

    access_expiry = access_expiry_override or timedelta(
        minutes=settings.jwt_access_expiry_minutes
    )
    refresh_expiry = refresh_expiry_override or timedelta(
        days=settings.jwt_refresh_expiry_days
    )

    access_payload = {
        "sub": "owner",
        "type": "access",
        "iat": now,
        "exp": now + access_expiry,
    }

    jti = uuid4().hex
    refresh_payload = {
        "sub": "owner",
        "type": "refresh",
        "jti": jti,
        "iat": now,
        "exp": now + refresh_expiry,
    }

    access_token = jwt.encode(access_payload, settings.jwt_secret, algorithm=ALGORITHM)
    refresh_token = jwt.encode(
        refresh_payload, settings.jwt_secret, algorithm=ALGORITHM
    )

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate an access token.

    Raises:
        JWTError: If token is invalid, expired, or not an access token.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Token is not an access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode and validate a refresh token.

    Raises:
        JWTError: If token is invalid, expired, or not a refresh token.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")
    if "jti" not in payload:
        raise JWTError("Refresh token missing jti")
    return payload
