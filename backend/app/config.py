from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_access_expiry_minutes: int = 15
    jwt_refresh_expiry_days: int = 7
    auth_password: str = "changeme"

    # CORS
    allowed_origins: str = "http://localhost:5175,http://localhost:3000"

    # Server
    backend_port: int = 8000

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
