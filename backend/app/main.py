import asyncio
import json
from typing import Literal
from fastapi import FastAPI, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DB
from .storage import blob_container
from .config import settings
from .models import User, Session, Credential, Course, Attempt, Audit, db_session, now
from .security import (passwords, cipher, redis, digest, issue, public_user, current_user, admin, audit, rate_limit, require_origin, DUMMY_HASH)
from .learning import build_graph, grade, demo_curriculum

app = FastAPI(title='EduQuiz API', version='0.1.0', docs_url='/api/docs', openapi_url='/api/openapi.json')
class Input(BaseModel):
    model_config = ConfigDict(extra='forbid')
class Login(Input):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
class Signup(Login):
    name: str = Field(min_length=1, max_length=100)
class KeyInput(Input):
    provider: Literal['openai', 'anthropic']
    model: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9._:/-]+$')
    api_key: str = Field(min_length=10, max_length=512)
class TopicInput(Input):
    topic: str = Field(min_length=2, max_length=300)
    practice: bool = False
class Submission(Input):
    mission_index: int = Field(ge=0)
    answers: list[int] = Field(min_length=3, max_length=8)
    skip: bool = False
    tasks_completed: bool = False
class Decision(Input):
    attempt_id: str
    remediate: bool
class Suspension(Input):
    suspended: bool

@app.middleware('http')
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control'] = 'no-store'
    return response
@app.exception_handler(RequestValidationError)
async def invalid_request(request, exc):
    # Pydantic's default error includes raw input, which may contain credentials.
    return JSONResponse(status_code=422, content={'detail':'Invalid request. Check required fields and allowed values.'})
@app.exception_handler(Exception)
async def unexpected(request, exc):
    # Do not serialize provider errors, request bodies, keys, or tokens.
    return JSONResponse(status_code=500, content={'detail':'Unexpected server error. Please try again.'})
@app.get('/api/health')
def health(db: DB = Depends(db_session)):
    db.execute(text('SELECT 1')); redis.ping()
    return {'status':'ok', 'demo_mode':settings.demo_mode}

def auth_rate(request):
    rate_limit(f'auth:{request.client.host}', 20, 300)
@app.post('/api/auth/signup', dependencies=[Depends(require_origin)])
def signup(data: Signup, request: Request, response: Response, db: DB = Depends(db_session)):
    auth_rate(request)
    user = User(email=str(data.email).lower(), name=data.name.strip() or 'Learner', password_hash=passwords.hash(data.password))
    db.add(user)
    try: db.flush()
    except IntegrityError:
        db.rollback(); raise HTTPException(409, 'Unable to create account with these details')
    result = issue(db, user, response); audit(db,user.id,'signup'); db.commit()
    return result
@app.post('/api/auth/login', dependencies=[Depends(require_origin)])
def login(data: Login, request: Request, response: Response, db: DB = Depends(db_session)):
    auth_rate(request)
    rate_limit('login:'+digest(str(data.email).lower()), 10, 300)
    user = db.scalar(select(User).where(User.email==str(data.email).lower()))
    valid = passwords.verify(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid or user.suspended: raise HTTPException(401, 'Invalid credentials or unavailable account')
    result=issue(db,user,response); audit(db,user.id,'login'); db.commit(); return result
@app.post('/api/auth/refresh', dependencies=[Depends(require_origin)])
def refresh(request: Request, response: Response, db: DB = Depends(db_session)):
    auth_rate(request)
    raw=request.cookies.get('refresh_token','')
    parts=raw.split('.',1)
    if len(parts)!=2: raise HTTPException(401,'Sign in required')
    sid, secret=parts
    session=db.scalar(select(Session).where(Session.id==sid).with_for_update())
    hashed=digest(secret)
    if session and hashed in session.used_hashes:
        session.revoked=True; audit(db,session.user_id,'refresh_reuse',sid); db.commit()
        raise HTTPException(401,'Session revoked; sign in again')
    if not session or session.revoked or session.expires_at<=now() or not __import__('secrets').compare_digest(session.refresh_hash,hashed):
        raise HTTPException(401,'Sign in required')
    user=db.get(User,session.user_id)
    if not user or user.suspended: raise HTTPException(401,'Account unavailable')
    result=issue(db,user,response,session); db.commit(); return result
