from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.routes.auth import login, register
from app.schemas import LoginRequest, RegisterRequest
from app.security import read_access_token


def test_workspace_owner_can_register_and_sign_in() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        registered = register(
            data=RegisterRequest(
                organization_name="Northstar Support",
                full_name="Riya Singh",
                email="riya@example.com",
                password="a-strong-local-password",
            ),
            db=db,
        )
        signed_in = login(
            data=LoginRequest(email="RIYA@example.com", password="a-strong-local-password"),
            db=db,
        )

        assert registered.organization.name == "Northstar Support"
        assert registered.user.role == "admin"
        assert signed_in.user.email == "riya@example.com"
        assert read_access_token(signed_in.access_token) == signed_in.user.id
    Base.metadata.drop_all(engine)
    engine.dispose()
