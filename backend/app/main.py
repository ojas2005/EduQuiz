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
@app.post('/api/auth/logout', dependencies=[Depends(require_origin)])
def logout(request: Request, response: Response, user=Depends(current_user), db: DB=Depends(db_session)):
    # Revoke all sessions: explicit, safe logout behavior across devices.
    for session in db.scalars(select(Session).where(Session.user_id==user.id)): session.revoked=True
    audit(db,user.id,'logout_all'); db.commit()
    response.delete_cookie('refresh_token',path='/api/auth'); return {'ok':True}
@app.get('/api/me')
def me(user=Depends(current_user)): return public_user(user)
@app.put('/api/credential')
def save_key(data:KeyInput, user=Depends(current_user), db:DB=Depends(db_session)):
    rate_limit('key:'+user.id,10)
    row=db.get(Credential,user.id)
    if not row: row=Credential(user_id=user.id); db.add(row)
    row.provider=data.provider; row.model=data.model; row.ciphertext=cipher.encrypt(data.api_key.encode()).decode()
    audit(db,user.id,'credential_updated'); db.commit(); return {'provider':row.provider,'model':row.model}
@app.get('/api/credential')
def get_key(user=Depends(current_user),db:DB=Depends(db_session)):
    row=db.get(Credential,user.id)
    return {'configured':bool(row),'provider':row.provider if row else None,'model':row.model if row else None,'demo_mode':settings.demo_mode}
@app.delete('/api/credential')
def delete_key(user=Depends(current_user), db:DB=Depends(db_session)):
    row=db.get(Credential,user.id)
    if row: db.delete(row)
    audit(db,user.id,'credential_deleted'); db.commit(); return {'ok':True}

async def generate(db,user,topic,practice=False,focus=None):
    rate_limit('generation:'+user.id,5,3600)
    key=db.get(Credential,user.id)
    if key is None:
        if settings.demo_mode and topic.lower()=='sentences':
            missions=demo_curriculum()
            if focus:
                matching=[m for m in missions if m['questions'][0]['skill'] in focus]
                mission=dict(matching[0]); mission['title']='Review: '+', '.join(focus)
                mission['lesson']='\n\n'.join(m['lesson'] for m in matching)
                mission['objective']='Practice only: '+', '.join(focus)
                mission['tasks']=['Write an example for each focus skill: '+', '.join(focus), 'Explain how your examples demonstrate these focus skills.']
                mission['questions']=[q for m in missions for q in m['questions'] if q['skill'] in focus][:8]
                while len(mission['questions'])<3: mission['questions']+=mission['questions'][:1]
                return [mission]
            return missions[:1] if practice else missions
        raise HTTPException(400,'Add your provider API key in Settings. Local demo supports “sentences” only.')
    try:
        graph=build_graph(key.provider,key.model,cipher.decrypt(key.ciphertext.encode()).decode())
        result=await asyncio.wait_for(graph.ainvoke({'topic':topic,'focus':focus or [],'practice':practice}),timeout=90)
        return result['curriculum']['missions']
    except Exception:
        raise HTTPException(502,'Generation failed. Check your provider, model access, and quota, then retry.')

def owned_course(db,user,cid,lock=False):
    query=select(Course).where(Course.id==cid,Course.user_id==user.id)
    if lock: query=query.with_for_update()
    course=db.scalar(query)
    if not course: raise HTTPException(404,'Learning path not found')
    return course

def public_course(c):
    # Answer keys/explanations never leave the server before submission.
    missions=[]
    for i,m in enumerate(c.missions):
        public={'title':m['title'],'objective':m['objective']}
        if i==c.current:
            public.update({'lesson':m['lesson'],'tasks':m['tasks'],'questions':[{'prompt':q['prompt'],'options':q['options']} for q in m['questions']]})
        missions.append(public)
    return {'id':c.id,'topic':c.topic,'practice':c.practice,'current':c.current,'missions':missions,'pending_attempt':c.pending_attempt,'complete':c.current>=len(c.missions)}
@app.post('/api/courses')
async def create_course(data:TopicInput,user=Depends(current_user),db:DB=Depends(db_session)):
    missions=await generate(db,user,data.topic.strip(),data.practice)
    course=Course(user_id=user.id,topic=data.topic.strip(),practice=data.practice,missions=missions)
    db.add(course); db.flush(); audit(db,user.id,'practice_created' if data.practice else 'course_created',course.id); db.commit()
    return public_course(course)
@app.get('/api/courses')
def courses(user=Depends(current_user),db:DB=Depends(db_session)):
    return [public_course(c) for c in db.scalars(select(Course).where(Course.user_id==user.id).order_by(Course.created_at.desc()).limit(100))]
@app.get('/api/courses/{cid}')
def course(cid:str,user=Depends(current_user),db:DB=Depends(db_session)):
    return public_course(owned_course(db,user,cid))
@app.post('/api/courses/{cid}/submit')
def submit(cid:str,data:Submission,user=Depends(current_user),db:DB=Depends(db_session)):
    rate_limit('quiz:'+user.id,30)
    c=owned_course(db,user,cid,True)
    if c.pending_attempt: raise HTTPException(409,'Choose your next step before continuing')
    if c.current!=data.mission_index or c.current>=len(c.missions): raise HTTPException(409,'Mission changed; reload your path')
    if not data.skip and not data.tasks_completed and not c.practice: raise HTTPException(400,'Complete the mission tasks first')
    questions=c.missions[c.current]['questions']
    if len(data.answers)!=len(questions) or any(a not in range(4) for a in data.answers): raise HTTPException(422,'Answer every question with a valid option')
    result=grade(questions,data.answers)
    result.update({'skip':data.skip,'can_continue':not data.skip or result['passed']})
    attempt=Attempt(user_id=user.id,course_id=c.id,mission_index=c.current,result=result)
    db.add(attempt); db.flush()
    if result['can_continue']:
        if result['weaknesses'] and not c.practice: c.pending_attempt=attempt.id
        else: c.current+=1
    audit(db,user.id,'quiz_submitted',c.id); db.commit()
    return {**result,'attempt_id':attempt.id,'course':public_course(c)}
@app.post('/api/courses/{cid}/decision')
async def decision(cid:str,data:Decision,user=Depends(current_user),db:DB=Depends(db_session)):
    c=owned_course(db,user,cid)
    if c.pending_attempt!=data.attempt_id: raise HTTPException(409,'This decision is no longer pending')
    attempt=db.get(Attempt,data.attempt_id)
    remediation=await generate(db,user,c.topic,focus=attempt.result['weaknesses']) if data.remediate else []
    # Recheck under a row lock after the external call to avoid double insertion.
    db.expire(c)
    c=owned_course(db,user,cid,True)
    if c.pending_attempt!=data.attempt_id: raise HTTPException(409,'Decision already applied')
    c.current+=1
    if remediation: c.missions=c.missions[:c.current]+remediation+c.missions[c.current:]
    c.pending_attempt=None; audit(db,user.id,'remediation_accepted' if data.remediate else 'remediation_declined',cid); db.commit()
    return public_course(c)
@app.get('/api/report')
def report(user=Depends(current_user),db:DB=Depends(db_session)):
    attempts=list(db.scalars(select(Attempt).where(Attempt.user_id==user.id).order_by(Attempt.created_at)))
    totals={}
    for a in attempts:
        for skill,(correct,total) in a.result['skills'].items():
            item=totals.setdefault(skill,[0,0]); item[0]+=correct; item[1]+=total
    return {'attempts':[{'id':a.id,'course_id':a.course_id,'date':a.created_at.isoformat(),**a.result} for a in attempts], 'skills':[{'name':s,'score':round(c/t*100),'evidence':t} for s,(c,t) in totals.items()]}
