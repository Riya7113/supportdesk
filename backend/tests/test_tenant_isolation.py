
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base
from app.models import Organization, Ticket, User
from app.routes.dashboard import dashboard_stats
from app.routes.tickets import add_comment, create_ticket, get_ticket, list_tickets, update_ticket
from app.routes.users import create_user
from app.schemas import CommentCreate, TicketCreate, TicketUpdate, UserCreate


@pytest.fixture
def tenant_data():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        first_org = Organization(name="First workspace")
        second_org = Organization(name="Second workspace")
        db.add_all([first_org, second_org])
        db.flush()
        first_user = User(
            organization_id=first_org.id,
            full_name="First Admin",
            email="first@example.test",
            password_hash="unused",
            role="admin",
        )
        second_user = User(
            organization_id=second_org.id,
            full_name="Second Admin",
            email="second@example.test",
            password_hash="unused",
            role="admin",
        )
        db.add_all([first_user, second_user])
        db.flush()
        ticket = Ticket(
            organization_id=first_org.id,
            created_by_id=first_user.id,
            subject="First workspace ticket",
            description="A question from the first workspace.",
        )
        db.add(ticket)
        db.commit()
        yield db, first_user, second_user, ticket.id
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_ticket_list_only_returns_the_signed_in_users_workspace(tenant_data) -> None:
    db, first_user, second_user, _ = tenant_data

    first_page = list_tickets(user=first_user, db=db)
    second_page = list_tickets(user=second_user, db=db)

    assert first_page.total == 1
    assert len(first_page.items) == 1
    assert second_page.total == 0
    assert second_page.items == []


def test_ticket_from_another_workspace_looks_not_found(tenant_data) -> None:
    db, _, second_user, ticket_id = tenant_data

    with pytest.raises(HTTPException) as error:
        get_ticket(ticket_id=ticket_id, user=second_user, db=db)

    assert error.value.status_code == 404


def test_ticket_can_be_replied_to_and_resolved(tenant_data) -> None:
    db, first_user, _, _ = tenant_data
    created = create_ticket(
        data=TicketCreate(
            subject="Replacement delivery",
            description="The package arrived with a damaged part.",
            priority="high",
        ),
        user=first_user,
        db=db,
    )
    reply = add_comment(
        ticket_id=created.id,
        data=CommentCreate(body="We are arranging a replacement for you."),
        user=first_user,
        db=db,
    )
    update_ticket(
        ticket_id=created.id,
        data=TicketUpdate(status="resolved"),
        user=first_user,
        db=db,
    )

    detail = get_ticket(ticket_id=created.id, user=first_user, db=db)
    summary = dashboard_stats(user=first_user, db=db)

    assert reply.author_name == first_user.full_name
    assert len(detail.comments) == 1
    assert detail.status == "resolved"
    assert summary.resolved == 1
    assert summary.total == 2


def test_admin_can_assign_to_a_workspace_agent(tenant_data) -> None:
    db, first_user, _, ticket_id = tenant_data
    agent = create_user(
        data=UserCreate(
            full_name="Support Agent",
            email="agent@example.com",
            password="another-strong-password",
        ),
        admin=first_user,
        db=db,
    )

    updated = update_ticket(
        ticket_id=ticket_id,
        data=TicketUpdate(assigned_to_id=agent.id),
        user=first_user,
        db=db,
    )

    assert updated.assigned_to_id == agent.id
    assert updated.assigned_to_name == "Support Agent"


def test_agent_cannot_assign_tickets(tenant_data) -> None:
    db, first_user, _, ticket_id = tenant_data
    agent = create_user(
        data=UserCreate(
            full_name="Support Agent",
            email="agent2@example.com",
            password="another-strong-password",
        ),
        admin=first_user,
        db=db,
    )

    with pytest.raises(HTTPException) as error:
        update_ticket(
            ticket_id=ticket_id,
            data=TicketUpdate(assigned_to_id=first_user.id),
            user=agent,
            db=db,
        )

    assert error.value.status_code == 403
