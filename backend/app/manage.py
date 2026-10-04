"""Explicit operator commands; never bootstrap an administrator from public signup."""
import argparse
from sqlalchemy import select, text
from .models import Base, engine, SessionLocal, User
from .security import audit
parser=argparse.ArgumentParser()
parser.add_argument('command',choices=['init-db','make-admin'])
parser.add_argument('--email')
args=parser.parse_args()
if args.command=='init-db':
    Base.metadata.create_all(engine)
    # Additive upgrade for existing Compose databases; safe to run repeatedly.
    with engine.begin() as connection:
        connection.execute(text('ALTER TABLE courses ADD COLUMN IF NOT EXISTS title VARCHAR(80)'))
else:
    if not args.email: parser.error('--email required')
    with SessionLocal() as db:
        user=db.scalar(select(User).where(User.email==args.email.lower()))
        if not user: raise SystemExit('Register the account first')
        user.role='admin'; audit(db,user.id,'admin_provisioned'); db.commit()
