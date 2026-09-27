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
def require_origin(request: Request):
    origin = request.headers.get('origin')
    host = request.headers.get('host')
    valid = {settings.origin, f'http://{host}', f'https://{host}'} if host else {settings.origin}
    if not origin or origin not in valid:
        raise HTTPException(403, 'Untrusted request origin')
def rate_limit(key, limit, seconds=60):
    try:
        count = redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, key, seconds)
    except Exception:
        raise HTTPException(503, 'Rate limiter unavailable; try again shortly')
    if count > limit:
        raise HTTPException(429, 'Too many requests', headers={'Retry-After': str(seconds)})
def issue(db, user, response, session=None):
    refresh = secrets.token_urlsafe(48)
    if session is None:
        session = Session(user_id=user.id, refresh_hash=digest(refresh), expires_at=now()+timedelta(days=7))
        db.add(session); db.flush()
    else:
        session.used_hashes = session.used_hashes + [session.refresh_hash]
        session.refresh_hash = digest(refresh)
    token = jwt.encode({'sub':user.id,'sid':session.id,'iss':'eduquiz','aud':'eduquiz-web','iat':now(),'exp':now()+timedelta(minutes=15)}, settings.jwt_secret, algorithm='HS256')
    response.set_cookie('refresh_token', f'{session.id}.{refresh}', httponly=True, secure=settings.secure_cookies, samesite='strict', path='/api/auth', max_age=max(0, int((session.expires_at-now()).total_seconds())))
    return {'access_token': token, 'user': public_user(user)}
def public_user(u): return {'id':u.id,'name':u.name,'email':u.email,'role':u.role,'suspended':u.suspended,'bio':u.profile.bio if u.profile else '', 'avatar':u.profile.avatar if u.profile else 'initials'}
def current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer), db: DB = Depends(db_session)):
    try:
        if credentials is None: raise ValueError()
        claims = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=['HS256'], audience='eduquiz-web', issuer='eduquiz', options={'require':['sub','sid','exp','iat']})
        session = db.get(Session, claims['sid'])
        user = db.get(User, claims['sub'])
        if not session or session.revoked or session.user_id != claims['sub'] or session.expires_at <= now() or not user or user.suspended: raise ValueError()
        return user
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(401, 'Session expired or revoked')
def admin(user: User = Depends(current_user)):
    if user.role != 'admin': raise HTTPException(403, 'Administrator access required')
    return user
