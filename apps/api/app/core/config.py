from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "LIVEY API"
    environment: str = "development"
    api_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:3000"

    # Supabase
    supabase_url: str = ""
    # Prefer publishable/secret key names, but still accept legacy env vars.
    supabase_publishable_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
    )
    supabase_secret_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
    )
    supabase_jwt_secret: str = ""

    # Scraper / AI
    scraper_ai_provider: str = "gemini"
    google_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash-lite"
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # External event APIs (admin preview; keys are server-side only)
    ticketmaster_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "TICKETMASTER_API_KEY",
            "TICKETMASTER_CONSUMER_KEY",
        ),
    )
    eventbrite_api_token: str = Field(
        default="",
        validation_alias=AliasChoices(
            "EVENTBRITE_API_TOKEN",
            "EVENTBRITE_API_KEY",
            "EVENTBRITE_TOKEN",
        ),
    )
    # Optional: list events for your org (search-by-ZIP is often unavailable for third parties).
    eventbrite_organization_id: str = Field(
        default="",
        validation_alias=AliasChoices(
            "EVENTBRITE_ORGANIZATION_ID",
            "EVENTBRITE_ORG_ID",
        ),
    )

    # Foursquare Places API (venue discovery)
    # Accepts any of the common env var names for the Places v3 API key
    foursquare_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "FOURSQUARE_SERVICE_API_KEY",
            "FOURSQUARE_SERVICE_API",
            "FOURSQUARE_API_KEY",
        ),
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",  # prevents crashes if .env has extra keys
    )

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()