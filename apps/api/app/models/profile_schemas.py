from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileSummary(BaseModel):
    id: UUID
    role: str

    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None

    home_zip: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    email_opt_in: bool = False
    sms_opt_in: bool = False

    preferred_genres: list[str] = Field(default_factory=list)
    preferred_event_types: list[str] = Field(default_factory=list)
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    max_distance_miles: Optional[int] = None
    onboarding_completed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class UpdateProfileResponse(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None

    home_zip: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    email_opt_in: Optional[bool] = None
    sms_opt_in: Optional[bool] = None


class UpdateProfilePreferencesRequest(BaseModel):
    preferred_genres: Optional[list[str]] = None
    preferred_event_types: Optional[list[str]] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    max_distance_miles: Optional[int] = None
    mark_onboarding_complete: bool = False