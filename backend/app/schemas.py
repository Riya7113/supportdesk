"""Validated request and response shapes used by the API."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    organization_name: str = Field(min_length=2, max_length=160)
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("organization_name", "full_name", mode="before")
    @classmethod
    def trim_names(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)

    @field_validator("full_name", mode="before")
    @classmethod
    def trim_name(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str
    email: EmailStr
    role: Literal["admin", "agent"]
    is_active: bool
    created_at: datetime


class OrganizationRead(BaseModel):
    id: UUID
    name: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    organization: OrganizationRead


class CurrentAccount(BaseModel):
    user: UserRead
    organization: OrganizationRead


class TicketCreate(BaseModel):
    subject: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=5, max_length=20000)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"

    @field_validator("subject", "description", mode="before")
    @classmethod
    def trim_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class TicketUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"] | None = None
    priority: Literal["low", "normal", "high", "urgent"] | None = None
    assigned_to_id: UUID | None = None


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body", mode="before")
    @classmethod
    def trim_body(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class CommentRead(BaseModel):
    id: UUID
    ticket_id: UUID
    author_id: UUID
    author_name: str
    body: str
    created_at: datetime


class TicketRead(BaseModel):
    id: UUID
    subject: str
    description: str
    status: str
    priority: str
    created_by_id: UUID
    created_by_name: str
    assigned_to_id: UUID | None
    assigned_to_name: str | None
    created_at: datetime
    updated_at: datetime


class TicketDetail(TicketRead):
    comments: list[CommentRead]


class TicketPage(BaseModel):
    items: list[TicketRead]
    total: int
    skip: int
    limit: int


class DashboardStats(BaseModel):
    total: int
    open: int
    in_progress: int
    resolved: int
    urgent: int
    recent: list[TicketRead]
