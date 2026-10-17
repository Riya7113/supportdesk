"""Account creation and sign-in routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Organization, User
from app.schemas import (
    AuthResponse,
    CurrentAccount,
    LoginRequest,
    OrganizationRead,
    RegisterRequest,
    UserRead,
)
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["authentication"])


def build_auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserRead.model_validate(user),
        organization=OrganizationRead(id=user.organization.id, name=user.organization.name),
    )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    organization = Organization(name=data.organization_name.strip())
    db.add(organization)
    db.flush()
    user = User(
        organization_id=organization.id,
        full_name=data.full_name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role="admin",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from error
    db.refresh(user)
    return build_auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    email = str(data.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    stored_hash = user.password_hash if user is not None else ""
    password_matches = verify_password(data.password, stored_hash)
    if user is None or not user.is_active or not password_matches:
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return build_auth_response(user)


@router.get("/me", response_model=CurrentAccount)
def current_account(user: User = Depends(get_current_user)) -> CurrentAccount:
    return CurrentAccount(
        user=UserRead.model_validate(user),
        organization=OrganizationRead(id=user.organization.id, name=user.organization.name),
    )
