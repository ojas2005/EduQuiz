from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', extra='ignore')
    database_url: str = 'postgresql+psycopg://eduquiz:eduquiz@postgres:5432/eduquiz'
    redis_url: str = 'redis://redis:6379/0'
    jwt_secret: str = Field(min_length=32)
    encryption_key: str
    origin: str = 'http://localhost:8080'
    secure_cookies: bool = True
    demo_mode: bool = False
    blob_endpoint: str = 'http://blob:10000/eduquiz'
    blob_access_key: str
    blob_secret_key: str
    blob_bucket: str = 'eduquiz'

settings = Settings()
