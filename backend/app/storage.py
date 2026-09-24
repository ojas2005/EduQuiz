from azure.storage.blob import BlobServiceClient
from .config import settings

def blob_container():
    service=BlobServiceClient(account_url=settings.blob_endpoint,credential={'account_name':settings.blob_access_key,'account_key':settings.blob_secret_key},connection_timeout=5,read_timeout=10,retry_total=1)
    return service.get_container_client(settings.blob_bucket)
