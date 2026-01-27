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
