"""Small organization dashboard summary."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Ticket, User
from app.routes.tickets import ticket_read, ticket_select
from app.schemas import DashboardStats

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> DashboardStats:
    base = Ticket.organization_id == user.organization_id
    total = db.scalar(select(func.count(Ticket.id)).where(base)) or 0

    def count_for(state: str) -> int:
        return db.scalar(
            select(func.count(Ticket.id)).where(base, Ticket.status == state)
        ) or 0

    urgent = db.scalar(
        select(func.count(Ticket.id)).where(
            base, Ticket.priority == "urgent", Ticket.status != "resolved"
        )
    ) or 0
    rows = db.execute(
        ticket_select()
        .where(base)
        .order_by(Ticket.updated_at.desc(), Ticket.created_at.desc())
        .limit(6)
    ).all()
    return DashboardStats(
        total=total,
        open=count_for("open"),
        in_progress=count_for("in_progress"),
        resolved=count_for("resolved"),
        urgent=urgent,
        recent=[ticket_read(ticket, creator, assigned) for ticket, creator, assigned in rows],
    )
