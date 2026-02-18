from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EventSummary(BaseModel):
    id: str
    title: str
    venue_name: str
    start_time: datetime
    category: str
    zip_code: str = Field(pattern=r"^\d{5}$")

class EventDetail(BaseModel):
    id: str
    title: str
    description: str
    venue_name: str
    category: str
    start_time: datetime
    end_time: datetime
    zip_code: str = Field(pattern=r'^\d{5}$')
    ticket_url: Optional[str] = None

class EventCreate(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=3000)
    category: str = Field(min_length=2, max_length=80)
    start_time: datetime
    end_time: datetime
    zip_code: str = Field(pattern=r"^\d{5}$")
    ticket_url: Optional[str] = None

class EventCreated(BaseModel):
    id: str
    status: str


class FavoriteCreate(BaseModel):
    event_id: str
