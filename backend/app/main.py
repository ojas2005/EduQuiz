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
