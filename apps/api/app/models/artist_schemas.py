from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

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
