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
