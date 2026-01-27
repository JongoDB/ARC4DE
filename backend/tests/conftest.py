"""Shared test fixtures."""

import os

# Override settings before any app imports
os.environ["JWT_SECRET"] = "test-secret-do-not-use-in-prod"
os.environ["AUTH_PASSWORD"] = "test-password"
os.environ["JWT_ACCESS_EXPIRY_MINUTES"] = "15"
os.environ["JWT_REFRESH_EXPIRY_DAYS"] = "7"
