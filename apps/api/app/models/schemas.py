from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

class EventSummary(BaseModel):
    id: str
    title: str
    venue_name: str
    start_time: datetime
    category: str
    zip_code: str = Field(pattern=r"^\d{5}$")


class EventSearchResponse(BaseModel):
    items: list[EventSummary]
    page: int
    limit: int
    total: int


class EventDetail(BaseModel):
    id: str
    title: str
    description: str
    venue_name: str
    category: str
    start_time: datetime
    end_time: datetime
    zip_code: str = Field(pattern=r"^\d{5}$")
    ticket_url: Optional[str] = None


class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=3000)
    category: str = Field(min_length=2, max_length=80)
    start_time: datetime
    end_time: datetime
    zip_code: str = Field(pattern=r"^\d{5}$")
    ticket_url: Optional[str] = None

    @model_validator(mode="after")
    def check_times(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class EventCreated(BaseModel):
    id: str
    status: str


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------

class FavoriteCreate(BaseModel):
    event_id: str


class FavoriteRead(BaseModel):
    event_id: str
    created_at: datetime

    title: str
    start_time: datetime


# ---------------------------------------------------------------------------
# Follows
# ---------------------------------------------------------------------------

class FollowCreate(BaseModel):
    artist_id: str


class FollowRead(BaseModel):
    artist_id: str
    created_at: datetime
    stage_name: str

# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

class UserProfileRead(BaseModel):
    id: str
    role: str
    display_name: Optional[str] = None
    home_zip: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=120)
    home_zip: Optional[str] = Field(default=None, pattern=r"^\d{5}$")


# ---------------------------------------------------------------------------
# Venue profile
# ---------------------------------------------------------------------------

class VenueProfileCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=3000)
    address_line: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=2)
    zip_code: str = Field(pattern=r"^\d{5}$")


class VenueProfileRead(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: str
    verified: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class VenueProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=3000)
    address_line: Optional[str] = Field(default=None, max_length=300)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=2)
    zip_code: Optional[str] = Field(default=None, pattern=r"^\d{5}$")


# ---------------------------------------------------------------------------
# Artist profile
# ---------------------------------------------------------------------------

class ArtistProfileCreate(BaseModel):
    stage_name: str = Field(min_length=1, max_length=200)
    genre: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=3000)
    media_url: Optional[str] = None


class ArtistProfileRead(BaseModel):
    id: str
    stage_name: str
    genre: Optional[str] = None
    bio: Optional[str] = None
    media_url: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ArtistProfileUpdate(BaseModel):
    stage_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    genre: Optional[str] = Field(default=None, max_length=100)
    bio: Optional[str] = Field(default=None, max_length=3000)
    media_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Claims
# ---------------------------------------------------------------------------

class VenueClaimCreate(BaseModel):
    venue_id: str


class ArtistClaimCreate(BaseModel):
    artist_id: str


class VenueClaimRead(BaseModel):
    id: str
    venue_id: str
    user_id: str
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ArtistClaimRead(BaseModel):
    id: str
    artist_id: str
    user_id: str
    status: str
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ClaimReview(BaseModel):
    status: str = Field(pattern=r"^(approved|rejected)$")


class MyClaimsResponse(BaseModel):
    venue_claims: list[VenueClaimRead] = []
    artist_claims: list[ArtistClaimRead] = []
