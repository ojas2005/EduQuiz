"""Generate fresh local-only secrets without printing them. No third-party dependencies."""
import base64
import os
from pathlib import Path
import secrets
root=Path(__file__).resolve().parent.parent
path=root/'.env'
password=secrets.token_urlsafe(24)
values={
 'POSTGRES_PASSWORD':password,
 'DATABASE_URL':f'postgresql+psycopg://eduquiz:{password}@postgres:5432/eduquiz',
 'REDIS_URL':'redis://redis:6379/0',
 'JWT_SECRET':secrets.token_urlsafe(48),
 'ENCRYPTION_KEY':base64.urlsafe_b64encode(os.urandom(32)).decode(),
 'ORIGIN':'http://localhost:8080',
 'SECURE_COOKIES':'false',
 'DEMO_MODE':'true',
 'BLOB_ENDPOINT':'http://blob:10000/eduquiz',
 'BLOB_ACCESS_KEY':'eduquiz',
 'BLOB_SECRET_KEY':base64.b64encode(os.urandom(32)).decode(),
 'BLOB_BUCKET':'eduquiz',
}
try:
    fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
except FileExistsError:
    raise SystemExit('.env already exists; leaving it unchanged.')
with os.fdopen(fd,'w') as f:
    f.write('\n'.join(f'{k}={v}' for k,v in values.items())+'\n')
print('Created .env with fresh local secrets. Never commit this file.')
