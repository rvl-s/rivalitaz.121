import { CONFIG } from './config.js';
let token = '';
export class ApiError extends Error {
  constructor(message, code, retryable=false, details=null) { super(message);this.name='ApiError';this.code=code;this.retryable=retryable;this.details=details; }
}
export function setToken(value) { token=value||''; }
export async function api(action,payload={},options={}) {
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(CONFIG.apiUrl))throw new ApiError('URL Web App belum diatur. Admin perlu mengisi apiUrl di js/config.js.','CONFIG');
  const requestToken=options.token??token;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),CONFIG.requestTimeoutMs);
  try {
    const response=await fetch(CONFIG.apiUrl,{method:'POST',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,token:requestToken,payload}),signal:controller.signal});
    if(!response.ok)throw new ApiError('Server HTTP '+response.status+'. Coba lagi.','NETWORK',true);
    let result;try {result=JSON.parse(await response.text());}catch(e){throw new ApiError('Respons bukan JSON. Periksa Deploy Web App: Execute as Me, akses Anyone, dan URL /exec.','NETWORK',true);}
    if(!result.ok) {const e=result.error||{};if(['AUTH','ACCOUNT_DISABLED'].includes(e.code)&&action!=='login'&&requestToken===token)window.dispatchEvent(new CustomEvent('authlost',{detail:e}));throw new ApiError(e.message||'Request ditolak.',e.code||'SERVER',!!e.retryable,e.details);}
    if(result.server_time)window.dispatchEvent(new CustomEvent('servertime',{detail:result.server_time}));return result.data;
  }catch(e){if(e instanceof ApiError)throw e;throw new ApiError(e.name==='AbortError'?'Server belum merespons. Data tetap di antrean; jangan buat input yang sama kembali.':'Koneksi gagal. Periksa sinyal dan akses Web App. Data antrean tetap tersimpan.','NETWORK',true);}
  finally{clearTimeout(timeout);}
}
