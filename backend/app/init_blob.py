import time
from azure.core.exceptions import ResourceExistsError
from .storage import blob_container
for attempt in range(30):
    try:
        try: blob_container().create_container()
        except ResourceExistsError: pass
        print('Private report container ready')
        break
    except Exception:
        if attempt==29: raise SystemExit('Blob initialization failed')
        time.sleep(2)
