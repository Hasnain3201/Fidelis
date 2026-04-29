from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, model_validator

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