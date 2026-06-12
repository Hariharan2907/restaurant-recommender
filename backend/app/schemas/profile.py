from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

_DIETARY = {"vegetarian", "vegan", "gluten_free"}


class UserProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None = None
    dietary_preferences: list[str] = Field(default_factory=list)
    default_radius_m: int = 3000
    cuisine_likes: list[str] = Field(default_factory=list)
    cuisine_dislikes: list[str] = Field(default_factory=list)
    created_at: datetime


class UserProfileResponse(UserProfile):
    visits_count: int = 0
    taste_profile_trained: bool = False


class UserProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)
    dietary_preferences: list[str] | None = None
    default_radius_m: int | None = Field(default=None, ge=100, le=20000)
    cuisine_likes: list[str] | None = Field(default=None, max_length=20)
    cuisine_dislikes: list[str] | None = Field(default=None, max_length=20)

    def validated_dietary(self) -> list[str] | None:
        if self.dietary_preferences is None:
            return None
        return [d for d in self.dietary_preferences if d in _DIETARY]
