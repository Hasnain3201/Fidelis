from datetime import datetime
from typing import Optional

from uuid import UUID

from pydantic import BaseModel, Field, model_validator

class ProfileSummary(BaseModel):
    id: UUID
    role: str

    display_name: Optional[str] = None
    username: Optional[str] = None
    avatar_url: Optional[str] = None

    home_zip: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None

    created_at: datetime
    updated_at: datetime

class UpdateProfileResponse(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None

    home_zip: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
