let token = '';
let refreshInFlight: Promise<any> | null = null;
export function setToken(value:string) { token=value; }
export async function refreshSession() {
  if (!refreshInFlight) refreshInFlight=fetch('/api/auth/refresh',{method:'POST',credentials:'include'}).then(async r=>{if(!r.ok) throw new Error('Please sign in'); const data=await r.json(); token=data.access_token; return data;}).finally(()=>{refreshInFlight=null;});
  return refreshInFlight;
}
export async function api(path:string, method='GET', body?:unknown, retry=true):Promise<any> {
  const r=await fetch('/api'+path,{method,credentials:'include',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(r.status===401 && retry && !path.startsWith('/auth/')) { await refreshSession(); return api(path,method,body,false); }
  if(!r.ok) {const data=await r.json().catch(()=>({})); throw new Error(typeof data.detail==='string'?data.detail:'Check your input and try again.');}
  return r.json();
}
