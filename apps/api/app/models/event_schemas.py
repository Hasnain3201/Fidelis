from datetime import datetime
from typing import Optional, Literal

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
    is_promoted: bool = False

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

class TrendingContentItem(BaseModel):
    item_type: Literal["event", "artist"]
    item_id: str
    label: str
    start_time: Optional[datetime] = None
    category: Optional[str] = None
    zip_code: Optional[str] = None
    venue_name: Optional[str] = None
    popularity_count: int
