"""Authentication API routes (login, refresh, logout)."""

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.core.auth import (
    TokenPair,
    create_token_pair,
    decode_access_token,
    decode_refresh_token,
    verify_password,
)
from app.core.token_store import LoginRateLimiter, RefreshTokenStore

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Module-level singletons (reset-safe for single-user MVP)
_token_store = RefreshTokenStore()
_rate_limiter = LoginRateLimiter()


# --- Request/Response Models ---


class LoginRequest(BaseModel):
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


# --- Auth dependency ---


def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    """FastAPI dependency: validate access token from Authorization header.

    Usage: @router.get("/protected", dependencies=[Depends(get_current_user)])
    Or:    def endpoint(user: dict = Depends(get_current_user))
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


# --- Routes ---


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest) -> TokenPair:
    """Authenticate with password and receive token pair."""
    if _rate_limiter.is_locked():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Login locked temporarily.",
        )

    if not verify_password(body.password):
        _rate_limiter.record_failure()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    # Successful login resets rate limiter
    _rate_limiter.reset()

    pair = create_token_pair()

    # Register the refresh token JTI in the store
    refresh_payload = decode_refresh_token(pair.refresh_token)
    _token_store.add(refresh_payload["jti"])

    return pair


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest) -> TokenPair:
    """Exchange a valid refresh token for a new token pair (rotation)."""
    try:
        old_payload = decode_refresh_token(body.refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    old_jti = old_payload["jti"]

    if not _token_store.is_valid(old_jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or already used",
        )

    new_pair = create_token_pair()
    new_refresh_payload = decode_refresh_token(new_pair.refresh_token)
    new_jti = new_refresh_payload["jti"]

    _token_store.rotate(old_jti, new_jti)

    return new_pair


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    user: dict = Depends(get_current_user),
) -> dict[str, str]:
    """Revoke the refresh token (requires valid access token)."""
    try:
        payload = decode_refresh_token(body.refresh_token)
        _token_store.revoke(payload["jti"])
    except Exception:
        pass  # If token is invalid, nothing to revoke -- still return 200
    return {"status": "ok"}
