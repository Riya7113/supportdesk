"""Organization member management for administrators."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models import User
from app.schemas import UserCreate, UserRead
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["team"])


@router.get("", response_model=list[UserRead])
def list_users(
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> list[User]:
    return list(
        db.scalars(
            select(User)
            .where(User.organization_id == admin.organization_id)
            .order_by(User.full_name.asc())
        )
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    email = str(data.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = User(
        organization_id=admin.organization_id,
        full_name=data.full_name.strip(),
        email=email,
        password_hash=hash_password(data.password),
        role="agent",
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists") from error
    db.refresh(user)
    return user
