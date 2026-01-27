# Phase 3: Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement JWT-based single-user authentication with login, refresh token rotation, logout, rate limiting, and a FastAPI dependency for protecting routes.

**Architecture:** Single-user auth — the server owner sets a password in `.env` (`AUTH_PASSWORD`). Login compares the submitted password (timing-safe) and returns a JWT access token (15 min) + refresh token (7 days). Refresh tokens use JTI-based rotation tracked in memory. A FastAPI dependency (`get_current_user`) validates the `Authorization: Bearer <token>` header on protected routes. Rate limiting blocks login after 5 failed attempts in 60 seconds with a 15-minute lockout.

**Tech Stack:** FastAPI, python-jose[cryptography] (JWT), pydantic (models), secrets (timing-safe compare), pytest + httpx (testing)

---

## Acceptance Criteria

1. `POST /api/auth/login` with correct password returns `{ access_token, refresh_token, token_type }` (200)
2. `POST /api/auth/login` with wrong password returns 401
3. `POST /api/auth/refresh` with valid refresh token returns new token pair and invalidates old refresh token
4. `POST /api/auth/refresh` with reused (rotated-out) refresh token returns 401
5. `POST /api/auth/logout` invalidates the refresh token
6. Protected route with valid access token returns 200
7. Protected route without token or with expired/invalid token returns 401
8. After 5 failed login attempts within 60 seconds, further attempts return 429 for 15 minutes
9. `GET /api/health` remains unprotected
10. All tests pass inside Docker container

---

## Task 1: Test Infrastructure + JWT Core Logic

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_core_auth.py`
- Modify: `backend/app/core/auth.py`
- Modify: `backend/requirements.txt` (add pytest + httpx)

**Context:** This task builds the JWT create/verify functions in `backend/app/core/auth.py`. These are pure functions with no FastAPI dependency — they take data in and return tokens or raise errors.

**Step 1: Add test dependencies to requirements.txt**

Add to the end of `backend/requirements.txt`:

```
pytest>=8.0.0,<9.0.0
httpx>=0.27.0,<1.0.0
```

**Step 2: Create test infrastructure**

Create `backend/tests/__init__.py` (empty file).

Create `backend/tests/conftest.py`:

```python
"""Shared test fixtures."""

import os

# Override settings before any app imports
os.environ["JWT_SECRET"] = "test-secret-do-not-use-in-prod"
os.environ["AUTH_PASSWORD"] = "test-password"
os.environ["JWT_ACCESS_EXPIRY_MINUTES"] = "15"
os.environ["JWT_REFRESH_EXPIRY_DAYS"] = "7"
```

**Step 3: Write failing tests for JWT core**

Create `backend/tests/test_core_auth.py`:

```python
"""Tests for JWT core auth logic."""

from datetime import timedelta

import pytest

from app.core.auth import (
    TokenPair,
    create_token_pair,
    decode_access_token,
    verify_password,
)


class TestVerifyPassword:
    def test_correct_password(self):
        assert verify_password("test-password") is True

    def test_wrong_password(self):
        assert verify_password("wrong") is False

    def test_empty_password(self):
        assert verify_password("") is False


class TestCreateTokenPair:
    def test_returns_token_pair(self):
        pair = create_token_pair()
        assert isinstance(pair, TokenPair)
        assert isinstance(pair.access_token, str)
        assert isinstance(pair.refresh_token, str)
        assert pair.token_type == "bearer"
        assert len(pair.access_token) > 0
        assert len(pair.refresh_token) > 0

    def test_access_and_refresh_are_different(self):
        pair = create_token_pair()
        assert pair.access_token != pair.refresh_token

    def test_refresh_token_has_jti(self):
        pair = create_token_pair()
        # The refresh token should decode and contain a jti claim
        from jose import jwt
        from app.config import settings

        payload = jwt.decode(pair.refresh_token, settings.jwt_secret, algorithms=["HS256"])
        assert "jti" in payload
        assert isinstance(payload["jti"], str)


class TestDecodeAccessToken:
    def test_valid_token(self):
        pair = create_token_pair()
        payload = decode_access_token(pair.access_token)
        assert payload["sub"] == "owner"
        assert payload["type"] == "access"

    def test_expired_token(self):
        pair = create_token_pair(access_expiry_override=timedelta(seconds=-1))
        with pytest.raises(Exception):
            decode_access_token(pair.access_token)

    def test_invalid_token(self):
        with pytest.raises(Exception):
            decode_access_token("not.a.valid.token")

    def test_refresh_token_rejected_as_access(self):
        pair = create_token_pair()
        with pytest.raises(Exception):
            decode_access_token(pair.refresh_token)
```

**Step 4: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_core_auth.py -v`
Expected: FAIL — `ImportError: cannot import name 'TokenPair' from 'app.core.auth'`

**Step 5: Implement JWT core logic**

Replace `backend/app/core/auth.py` with:

```python
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

    Args:
        token: The JWT access token string.

    Returns:
        The decoded payload dict.

    Raises:
        JWTError: If token is invalid, expired, or not an access token.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Token is not an access token")
    return payload


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decode and validate a refresh token.

    Args:
        token: The JWT refresh token string.

    Returns:
        The decoded payload dict (includes 'jti').

    Raises:
        JWTError: If token is invalid, expired, or not a refresh token.
    """
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != "refresh":
        raise JWTError("Token is not a refresh token")
    if "jti" not in payload:
        raise JWTError("Refresh token missing jti")
    return payload
```

**Step 6: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_core_auth.py -v`
Expected: All 9 tests PASS

**Step 7: Commit**

```bash
git add backend/requirements.txt backend/tests/ backend/app/core/auth.py
git commit -m "feat(auth): add JWT core logic with create/verify token pairs"
```

---

## Task 2: Refresh Token Store + Rate Limiter

**Files:**
- Create: `backend/app/core/token_store.py`
- Create: `backend/tests/test_token_store.py`

**Context:** In-memory stores for refresh token JTIs (for rotation tracking) and login rate limiting. Both are simple classes with no FastAPI dependency. These reset on backend restart, which is acceptable for single-user MVP.

**Step 1: Write failing tests**

Create `backend/tests/test_token_store.py`:

```python
"""Tests for token store and rate limiter."""

import time

from app.core.token_store import RefreshTokenStore, LoginRateLimiter


class TestRefreshTokenStore:
    def setup_method(self):
        self.store = RefreshTokenStore()

    def test_add_and_check(self):
        self.store.add("jti-1")
        assert self.store.is_valid("jti-1") is True

    def test_unknown_jti_invalid(self):
        assert self.store.is_valid("unknown") is False

    def test_revoke(self):
        self.store.add("jti-1")
        self.store.revoke("jti-1")
        assert self.store.is_valid("jti-1") is False

    def test_revoke_unknown_no_error(self):
        self.store.revoke("unknown")  # Should not raise

    def test_rotate(self):
        self.store.add("old-jti")
        self.store.rotate("old-jti", "new-jti")
        assert self.store.is_valid("old-jti") is False
        assert self.store.is_valid("new-jti") is True

    def test_rotate_invalid_old_jti_raises(self):
        import pytest

        with pytest.raises(ValueError, match="not active"):
            self.store.rotate("invalid", "new-jti")


class TestLoginRateLimiter:
    def setup_method(self):
        self.limiter = LoginRateLimiter(max_attempts=3, window_seconds=2, lockout_seconds=3)

    def test_allows_under_limit(self):
        assert self.limiter.is_locked() is False
        self.limiter.record_failure()
        self.limiter.record_failure()
        assert self.limiter.is_locked() is False

    def test_locks_at_limit(self):
        for _ in range(3):
            self.limiter.record_failure()
        assert self.limiter.is_locked() is True

    def test_lockout_expires(self):
        for _ in range(3):
            self.limiter.record_failure()
        assert self.limiter.is_locked() is True
        time.sleep(3.1)
        assert self.limiter.is_locked() is False

    def test_reset_clears_state(self):
        for _ in range(3):
            self.limiter.record_failure()
        self.limiter.reset()
        assert self.limiter.is_locked() is False

    def test_old_failures_expire_from_window(self):
        self.limiter.record_failure()
        self.limiter.record_failure()
        time.sleep(2.1)  # Window expires
        self.limiter.record_failure()
        # Only 1 failure in current window, not 3
        assert self.limiter.is_locked() is False
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_token_store.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.token_store'`

**Step 3: Implement token store and rate limiter**

Create `backend/app/core/token_store.py`:

```python
"""In-memory refresh token store and login rate limiter.

Both reset on backend restart. Acceptable for single-user MVP.
"""

import time


class RefreshTokenStore:
    """Tracks active refresh token JTIs for rotation and revocation."""

    def __init__(self) -> None:
        self._active_jtis: set[str] = set()

    def add(self, jti: str) -> None:
        """Register a new refresh token JTI as active."""
        self._active_jtis.add(jti)

    def is_valid(self, jti: str) -> bool:
        """Check if a refresh token JTI is currently active."""
        return jti in self._active_jtis

    def revoke(self, jti: str) -> None:
        """Revoke a refresh token JTI (e.g., on logout)."""
        self._active_jtis.discard(jti)

    def rotate(self, old_jti: str, new_jti: str) -> None:
        """Rotate: invalidate old JTI and activate new one.

        Raises:
            ValueError: If old_jti is not currently active.
        """
        if old_jti not in self._active_jtis:
            raise ValueError(f"Refresh token {old_jti} is not active")
        self._active_jtis.discard(old_jti)
        self._active_jtis.add(new_jti)


class LoginRateLimiter:
    """Simple sliding-window rate limiter for login attempts.

    Locks out after max_attempts failures within window_seconds.
    Lockout lasts lockout_seconds.
    """

    def __init__(
        self,
        max_attempts: int = 5,
        window_seconds: int = 60,
        lockout_seconds: int = 900,
    ) -> None:
        self._max_attempts = max_attempts
        self._window_seconds = window_seconds
        self._lockout_seconds = lockout_seconds
        self._failures: list[float] = []
        self._locked_until: float | None = None

    def is_locked(self) -> bool:
        """Check if login is currently locked out."""
        if self._locked_until is not None:
            if time.monotonic() < self._locked_until:
                return True
            # Lockout expired, reset
            self._locked_until = None
            self._failures.clear()
        return False

    def record_failure(self) -> None:
        """Record a failed login attempt. May trigger lockout."""
        now = time.monotonic()
        self._failures.append(now)
        # Prune old failures outside the window
        cutoff = now - self._window_seconds
        self._failures = [t for t in self._failures if t > cutoff]
        # Check if we hit the limit
        if len(self._failures) >= self._max_attempts:
            self._locked_until = now + self._lockout_seconds

    def reset(self) -> None:
        """Reset all rate limiting state (e.g., after successful login)."""
        self._failures.clear()
        self._locked_until = None
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_token_store.py -v`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add backend/app/core/token_store.py backend/tests/test_token_store.py
git commit -m "feat(auth): add refresh token store and login rate limiter"
```

---

## Task 3: Auth API Routes

**Files:**
- Modify: `backend/app/api/auth.py`
- Modify: `backend/app/main.py` (mount auth router)
- Create: `backend/tests/test_api_auth.py`

**Context:** Three endpoints: login, refresh, logout. These use the JWT core and token store from Tasks 1-2. Tests use FastAPI's `TestClient` via `httpx`.

**Step 1: Write failing tests**

Create `backend/tests/test_api_auth.py`:

```python
"""Tests for auth API routes."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import create_token_pair, decode_refresh_token
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_state():
    """Reset token store and rate limiter between tests."""
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


class TestLogin:
    def test_success(self, client):
        resp = client.post("/api/auth/login", json={"password": "test-password"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_wrong_password(self, client):
        resp = client.post("/api/auth/login", json={"password": "wrong"})
        assert resp.status_code == 401
        assert "Invalid" in resp.json()["detail"]

    def test_missing_password(self, client):
        resp = client.post("/api/auth/login", json={})
        assert resp.status_code == 422

    def test_rate_limit(self, client):
        for _ in range(5):
            client.post("/api/auth/login", json={"password": "wrong"})
        resp = client.post("/api/auth/login", json={"password": "test-password"})
        assert resp.status_code == 429
        assert "locked" in resp.json()["detail"].lower()


class TestRefresh:
    def test_success(self, client):
        # Login first to get tokens
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        refresh_token = login_resp.json()["refresh_token"]

        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New refresh token should be different
        assert data["refresh_token"] != refresh_token

    def test_reuse_rotated_token(self, client):
        # Login
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        old_refresh = login_resp.json()["refresh_token"]

        # Refresh once (rotates)
        client.post("/api/auth/refresh", json={"refresh_token": old_refresh})

        # Try to reuse the old token
        resp = client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
        assert resp.status_code == 401

    def test_invalid_token(self, client):
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": "not.valid.token"}
        )
        assert resp.status_code == 401

    def test_access_token_rejected(self, client):
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        access_token = login_resp.json()["access_token"]
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": access_token}
        )
        assert resp.status_code == 401


class TestLogout:
    def test_success(self, client):
        # Login
        login_resp = client.post("/api/auth/login", json={"password": "test-password"})
        tokens = login_resp.json()
        access = tokens["access_token"]
        refresh = tokens["refresh_token"]

        # Logout
        resp = client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh},
            headers={"Authorization": f"Bearer {access}"},
        )
        assert resp.status_code == 200

        # Refresh should now fail
        resp = client.post(
            "/api/auth/refresh", json={"refresh_token": refresh}
        )
        assert resp.status_code == 401

    def test_unauthenticated(self, client):
        resp = client.post(
            "/api/auth/logout", json={"refresh_token": "something"}
        )
        assert resp.status_code == 401


class TestHealthUnprotected:
    def test_health_no_auth(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_api_auth.py -v`
Expected: FAIL — routes not implemented yet

**Step 3: Implement auth routes**

Replace `backend/app/api/auth.py` with:

```python
"""Authentication API routes (login, refresh, logout)."""

from fastapi import APIRouter, Depends, HTTPException, status
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


def get_current_user(authorization: str | None = None) -> dict:
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


def _get_auth_header(authorization: str | None = None) -> str | None:
    """Extract raw Authorization header. Used internally."""
    return authorization


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

    # Check the JTI is still active (not rotated out or revoked)
    if not _token_store.is_valid(old_jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has been revoked or already used",
        )

    # Create new pair
    new_pair = create_token_pair()
    new_refresh_payload = decode_refresh_token(new_pair.refresh_token)
    new_jti = new_refresh_payload["jti"]

    # Rotate: invalidate old, activate new
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
        pass  # If token is invalid, nothing to revoke — still return 200
    return {"status": "ok"}
```

**Step 4: Mount auth router in main.py**

In `backend/app/main.py`, add two lines. After the existing imports, add:

```python
from app.api.auth import router as auth_router
```

And after the CORS middleware block, add:

```python
app.include_router(auth_router)
```

The full file should be:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.config import settings

app = FastAPI(
    title="ARC4DE",
    description="Automated Remote Control for Distributed Environments",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
```

**Step 5: Fix the Authorization header dependency**

FastAPI doesn't automatically inject a raw `Authorization` header string via a parameter named `authorization`. We need to use `fastapi.Header` for that. Update the `get_current_user` function signature and the `logout` endpoint to use `Header`:

In `backend/app/api/auth.py`, add to imports:

```python
from fastapi import APIRouter, Depends, Header, HTTPException, status
```

Update `get_current_user`:

```python
def get_current_user(authorization: str | None = Header(default=None)) -> dict:
```

**Step 6: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_api_auth.py -v`
Expected: All 11 tests PASS

**Step 7: Commit**

```bash
git add backend/app/api/auth.py backend/app/main.py backend/tests/test_api_auth.py
git commit -m "feat(auth): add login/refresh/logout API routes with rate limiting"
```

---

## Task 4: Protected Route Dependency Verification

**Files:**
- Create: `backend/tests/test_protected_route.py`
- Modify: `backend/app/main.py` (add a test-only protected endpoint)

**Context:** Verify the `get_current_user` dependency works as a route guard. We add a temporary `GET /api/auth/me` endpoint that returns the decoded token payload — useful for debugging and proves the auth flow end-to-end. This endpoint stays in the app (it's useful beyond testing).

**Step 1: Write failing tests**

Create `backend/tests/test_protected_route.py`:

```python
"""Tests for protected route dependency."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth import create_token_pair
from app.api.auth import _token_store, _rate_limiter


@pytest.fixture(autouse=True)
def reset_state():
    _token_store._active_jtis.clear()
    _rate_limiter.reset()
    yield
    _token_store._active_jtis.clear()
    _rate_limiter.reset()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_tokens(client):
    resp = client.post("/api/auth/login", json={"password": "test-password"})
    return resp.json()


class TestProtectedEndpoint:
    def test_with_valid_token(self, client, auth_tokens):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['access_token']}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["sub"] == "owner"
        assert data["type"] == "access"

    def test_without_token(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_with_invalid_token(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
        )
        assert resp.status_code == 401

    def test_with_expired_token(self, client):
        pair = create_token_pair(access_expiry_override=timedelta(seconds=-1))
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {pair.access_token}"},
        )
        assert resp.status_code == 401

    def test_with_refresh_token_as_access(self, client, auth_tokens):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {auth_tokens['refresh_token']}"},
        )
        assert resp.status_code == 401

    def test_malformed_header(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "NotBearer token"},
        )
        assert resp.status_code == 401

    def test_bearer_no_token(self, client):
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer "},
        )
        assert resp.status_code == 401
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_protected_route.py -v`
Expected: FAIL — `404 Not Found` because `/api/auth/me` doesn't exist yet

**Step 3: Add /api/auth/me endpoint**

Add to `backend/app/api/auth.py`, after the `logout` endpoint:

```python
@router.get("/me")
async def me(user: dict = Depends(get_current_user)) -> dict:
    """Return current user info from the access token. Useful for verifying auth."""
    return user
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/test_protected_route.py -v`
Expected: All 7 tests PASS

**Step 5: Run all tests**

Run: `cd /Users/JonWFH/jondev/ARC4DE/backend && python -m pytest tests/ -v`
Expected: All 27 tests PASS (9 + 10 + 11 from previous tasks, minus overlap — exact count: 9 core + 10 store + 11 api + 7 protected = 37 total, but Task 3's TestHealthUnprotected is 1 test, so 9+10+11+7 = 37)

**Step 6: Commit**

```bash
git add backend/app/api/auth.py backend/tests/test_protected_route.py
git commit -m "feat(auth): add /me endpoint and protected route verification"
```

---

## Task 5: Docker Verification + CLAUDE.md Update

**Files:**
- Modify: `CLAUDE.md`

**Context:** Verify everything works inside Docker (the production runtime), then update project tracking.

**Step 1: Run tests inside Docker**

```bash
docker-compose exec backend python -m pytest tests/ -v
```

If the container is not running:

```bash
docker-compose up -d --build && sleep 10 && docker-compose exec backend python -m pytest tests/ -v
```

Expected: All tests PASS

**Step 2: Verify endpoints via curl through Vite proxy**

```bash
# Health (unprotected)
curl -s http://localhost:5175/api/health

# Login
curl -s -X POST http://localhost:5175/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"changeme"}'

# Should return { access_token, refresh_token, token_type }
```

Save the tokens from login response, then:

```bash
# Me (protected)
curl -s http://localhost:5175/api/auth/me \
  -H "Authorization: Bearer <access_token>"

# Refresh
curl -s -X POST http://localhost:5175/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'

# Logout
curl -s -X POST http://localhost:5175/api/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<refresh_token>"}'
```

**Step 3: Update CLAUDE.md**

Update the "Current State" section:

```markdown
**Phase:** Phase 4 - tmux Integration (NOT STARTED)
**Branch:** master
**Last completed:** Phase 3 - Authentication (JWT login/refresh/logout, rate limiting, protected route dependency)
```

Update the phase tracker table:

```markdown
| 3 | Authentication - JWT login/refresh | COMPLETE |
```

**Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Phase 3 authentication complete"
```

---

## Summary

| Task | What | Tests | Files |
|------|------|-------|-------|
| 1 | JWT core (create/verify tokens) | 9 | 5 |
| 2 | Token store + rate limiter | 10 | 2 |
| 3 | Auth API routes (login/refresh/logout) | 11 | 3 |
| 4 | Protected route dependency (/me) | 7 | 2 |
| 5 | Docker verification + docs | 0 | 1 |
| **Total** | | **37** | **13** |
