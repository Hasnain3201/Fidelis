from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

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
