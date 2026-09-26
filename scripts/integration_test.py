"""Standard-library black-box smoke tests. Requires local Compose demo stack."""
import json
import uuid
import secrets
import urllib.request
import urllib.error
import http.cookiejar
import subprocess
BASE='http://localhost:8080'
class Client:
    def __init__(self):
        self.jar=http.cookiejar.CookieJar()
        self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.token=''
    def call(self,path,method='GET',data=None,expected=200):
        headers={'Origin':BASE,'Content-Type':'application/json'}
        if self.token: headers['Authorization']='Bearer '+self.token
        req=urllib.request.Request(BASE+'/api'+path,data=json.dumps(data).encode() if data is not None else (b'' if method=='POST' else None),headers=headers,method=method)
        try:
            with self.http.open(req,timeout=120) as r: status=r.status; body=json.load(r)
        except urllib.error.HTTPError as e:
            status=e.code; body=json.load(e)
        assert status==expected,(path,status,body)
        return body

def main():
    a,b=Client(),Client()
    suffix=uuid.uuid4().hex[:10]
    password=secrets.token_urlsafe(24)
    for client,name in [(a,'learner'),(b,'operator')]:
        data=client.call('/auth/signup','POST',{'name':name,'email':f'{name}-{suffix}@example.com','password':password})
        client.token=data['access_token']
    invalid=a.call('/auth/signup','POST',{'name':'Test','email':'bad','password':'short-secret'},422)
    assert 'short-secret' not in json.dumps(invalid)
    a.call('/admin/users',expected=403)
    a.call('/credential','PUT',{'provider':'openai','model':'test-model','api_key':'fake-test-key-not-a-real-secret'})
    metadata=a.call('/credential')
    assert metadata['configured'] and 'api_key' not in metadata and 'ciphertext' not in metadata
    assert b.call('/credential')['configured'] is False
    a.call('/credential','DELETE')
    assert a.call('/credential')['configured'] is False
    origin_req=urllib.request.Request(BASE+'/api/auth/refresh',data=b'',headers={'Origin':'https://untrusted.example'},method='POST')
    try: urllib.request.urlopen(origin_req); raise AssertionError('Untrusted origin accepted')
    except urllib.error.HTTPError as e: assert e.code==403

    c=a.call('/courses','POST',{'topic':'sentences','practice':False})
    assert len(c['missions'])==3
    assert all('correct' not in q and 'explanation' not in q for q in c['missions'][0]['questions'])
    b.call('/courses/'+c['id'],expected=404)
    bad={'mission_index':0,'answers':[1,0,0],'skip':True,'tasks_completed':False}
    r=a.call('/courses/'+c['id']+'/submit','POST',bad)
    assert r['score']==0 and r['course']['current']==0 and not r['can_continue']
    normal={**bad,'skip':False,'tasks_completed':True}
    r=a.call('/courses/'+c['id']+'/submit','POST',normal)
    assert r['course']['pending_attempt']
    c=a.call('/courses/'+c['id']+'/decision','POST',{'attempt_id':r['attempt_id'],'remediate':True})
    assert c['current']==1 and len(c['missions'])==4
    a.call('/courses/'+c['id']+'/decision','POST',{'attempt_id':r['attempt_id'],'remediate':True},409)
    # Decline a weak remediation and proceed to original mission two.
    questions=c['missions'][1]['questions']
    r=a.call('/courses/'+c['id']+'/submit','POST',{'mission_index':1,'answers':[0]*len(questions),'skip':False,'tasks_completed':True})
    assert r['weaknesses']
    c=a.call('/courses/'+c['id']+'/decision','POST',{'attempt_id':r['attempt_id'],'remediate':False})
    assert c['current']==2 and c['missions'][2]['title']=='Complete thoughts'
    passed=a.call('/courses/'+c['id']+'/submit','POST',{'mission_index':2,'answers':[2,1,2],'skip':True,'tasks_completed':False})
    assert passed['score']==100 and passed['course']['current']==3
    a.call('/courses/'+c['id']+'/submit','POST',{'mission_index':2,'answers':[2,1,2],'skip':True},409)
    practice=a.call('/courses','POST',{'topic':'sentences','practice':True})
    result=a.call('/courses/'+practice['id']+'/submit','POST',{'mission_index':0,'answers':[0,1,2],'skip':False})
    assert result['course']['complete'] and not result['course']['pending_attempt']
    report=a.call('/report'); assert len(report['attempts'])==5
    export=a.call('/report/export','POST'); assert export['skills']==report['skills']
    # The first three generation calls were curriculum, remediation and practice.
    for _ in range(2): a.call('/courses','POST',{'topic':'unsupported-demo-topic','practice':False},400)
    a.call('/courses','POST',{'topic':'unsupported-demo-topic','practice':False},429)
    # Rotate, then replay the old opaque refresh cookie.
    old=next(c.value for c in a.jar if c.name=='refresh_token')
    a.token=a.call('/auth/refresh','POST')['access_token']
    replay=urllib.request.Request(BASE+'/api/auth/refresh',data=b'',headers={'Origin':BASE,'Cookie':'refresh_token='+old},method='POST')
    try: urllib.request.urlopen(replay); raise AssertionError('Replay accepted')
    except urllib.error.HTTPError as e: assert e.code==401
    a.call('/me',expected=401)
    a.token=a.call('/auth/login','POST',{'email':f'learner-{suffix}@example.com','password':password})['access_token']
    uid=a.call('/me')['id']
    subprocess.run(['docker','compose','exec','-T','api1','python','-m','app.manage','make-admin','--email',f'operator-{suffix}@example.com'],check=True)
    b.call('/admin/users/'+uid,'PATCH',{'suspended':True})
    a.call('/me',expected=401)
    b.call('/admin/users/'+uid,'PATCH',{'suspended':False})
    logs=b.call('/admin/logs'); assert any(l['action']=='user_suspended' for l in logs)
    b.call('/auth/logout','POST'); b.call('/me',expected=401)
    print('PASS: grading, skip gates, remediation yes/no, stale transitions, ownership, RBAC, credential isolation, origin rejection, rate limits, export, refresh replay, suspension and logout')
if __name__=='__main__': main()
