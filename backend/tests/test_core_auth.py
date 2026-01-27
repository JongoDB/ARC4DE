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
