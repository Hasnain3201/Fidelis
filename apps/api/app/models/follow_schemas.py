from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Follows
# ---------------------------------------------------------------------------

class FollowCreate(BaseModel):
    artist_id: str


class FollowRead(BaseModel):
    artist_id: str
    created_at: datetime
    stage_name: str
