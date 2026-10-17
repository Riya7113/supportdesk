"""Tenant-scoped ticket listing, updates, and conversation routes."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session, aliased

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Ticket, TicketComment, User
from app.schemas import (
    CommentCreate,
    CommentRead,
    TicketCreate,
    TicketDetail,
    TicketPage,
    TicketRead,
    TicketUpdate,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])
AssignedUser = aliased(User)


def ticket_select() -> Select:
    return select(Ticket, User.full_name, AssignedUser.full_name).join(
        User, User.id == Ticket.created_by_id
    ).outerjoin(AssignedUser, AssignedUser.id == Ticket.assigned_to_id)


def ticket_read(ticket: Ticket, creator_name: str, assigned_name: str | None) -> TicketRead:
    return TicketRead(
        id=ticket.id,
        subject=ticket.subject,
        description=ticket.description,
        status=ticket.status,
        priority=ticket.priority,
        created_by_id=ticket.created_by_id,
        created_by_name=creator_name,
        assigned_to_id=ticket.assigned_to_id,
        assigned_to_name=assigned_name,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("", response_model=TicketPage)
def list_tickets(
    status_filter: Annotated[Literal["open", "in_progress", "resolved"] | None, Query(alias="status")] = None,
    priority: Literal["low", "normal", "high", "urgent"] | None = None,
    search: Annotated[str | None, Query(max_length=120)] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketPage:
    conditions = [Ticket.organization_id == user.organization_id]
    if status_filter:
        conditions.append(Ticket.status == status_filter)
    if priority:
        conditions.append(Ticket.priority == priority)
    if search and search.strip():
        conditions.append(Ticket.subject.ilike(f"%{search.strip()}%"))

    total = db.scalar(select(func.count(Ticket.id)).where(*conditions)) or 0
    rows = db.execute(
        ticket_select()
        .where(*conditions)
        .order_by(Ticket.updated_at.desc(), Ticket.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return TicketPage(
        items=[ticket_read(ticket, creator, assigned) for ticket, creator, assigned in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post("", response_model=TicketRead, status_code=status.HTTP_201_CREATED)
def create_ticket(
    data: TicketCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketRead:
    ticket = Ticket(
        organization_id=user.organization_id,
        created_by_id=user.id,
        subject=data.subject.strip(),
        description=data.description.strip(),
        priority=data.priority,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket_read(ticket, user.full_name, None)


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(
    ticket_id: UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketDetail:
    row = db.execute(
        ticket_select().where(
            Ticket.id == ticket_id, Ticket.organization_id == user.organization_id
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Ticket not found")
    ticket, creator_name, assigned_name = row
    comments = db.execute(
        select(TicketComment, User.full_name)
        .join(User, User.id == TicketComment.author_id)
        .where(
            TicketComment.ticket_id == ticket.id,
            TicketComment.organization_id == user.organization_id,
        )
        .order_by(TicketComment.created_at.asc())
    ).all()
    comment_reads = [
        CommentRead(
            id=comment.id,
            ticket_id=comment.ticket_id,
            author_id=comment.author_id,
            author_name=author_name,
            body=comment.body,
            created_at=comment.created_at,
        )
        for comment, author_name in comments
    ]
    return TicketDetail(
        **ticket_read(ticket, creator_name, assigned_name).model_dump(), comments=comment_reads
    )


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: UUID,
    data: TicketUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TicketRead:
    ticket = db.scalar(
        select(Ticket).where(
            Ticket.id == ticket_id, Ticket.organization_id == user.organization_id
        )
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    changes = data.model_dump(exclude_unset=True)
    if "status" in changes and changes["status"] is not None:
        ticket.status = changes["status"]
    if "priority" in changes and changes["priority"] is not None:
        ticket.priority = changes["priority"]
    if "assigned_to_id" in changes:
        if user.role != "admin":
            raise HTTPException(status_code=403, detail="Only workspace admins can assign tickets")
        assignee_id = changes["assigned_to_id"]
        if assignee_id is not None:
            assignee = db.scalar(
                select(User).where(
                    User.id == assignee_id,
                    User.organization_id == user.organization_id,
                    User.is_active.is_(True),
                )
            )
            if assignee is None:
                raise HTTPException(status_code=422, detail="Assignee must be an active team member")
        ticket.assigned_to_id = assignee_id

    db.commit()
    db.refresh(ticket)
    creator = db.get(User, ticket.created_by_id)
    assigned = db.get(User, ticket.assigned_to_id) if ticket.assigned_to_id else None
    return ticket_read(ticket, creator.full_name if creator else "Unknown", assigned.full_name if assigned else None)


@router.post("/{ticket_id}/comments", response_model=CommentRead, status_code=201)
def add_comment(
    ticket_id: UUID,
    data: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommentRead:
    ticket = db.scalar(
        select(Ticket).where(
            Ticket.id == ticket_id, Ticket.organization_id == user.organization_id
        )
    )
    if ticket is None:
        raise HTTPException(status_code=404, detail="Ticket not found")

    comment = TicketComment(
        organization_id=user.organization_id,
        ticket_id=ticket.id,
        author_id=user.id,
        body=data.body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentRead(
        id=comment.id,
        ticket_id=comment.ticket_id,
        author_id=user.id,
        author_name=user.full_name,
        body=comment.body,
        created_at=comment.created_at,
    )
