import hashlib
import secrets
from datetime import timedelta
import jwt
from cryptography.fernet import Fernet
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.orm import Session as DB
from redis import Redis
from .config import settings
from .models import User, Session, now, db_session

passwords = PasswordHash.recommended()
cipher = Fernet(settings.encryption_key.encode())
redis = Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=2, socket_timeout=2)
bearer = HTTPBearer(auto_error=False)
DUMMY_HASH = passwords.hash('not-a-real-user-password')
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def audit(db, actor, action, target=None):
    from .models import Audit
    db.add(Audit(actor_id=actor, action=action, target_id=target))
