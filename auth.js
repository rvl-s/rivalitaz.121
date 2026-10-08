import { api,setToken } from './api.js';
import { cache,configureQueue,pauseQueue } from './queue.js';
let session=null, bootstrap=null,lastRefresh=0;
export function current() {return session;}
export function data() {return bootstrap;}
export function scopeKey() {return session.profile.id+':'+session.profile.role+':'+(bootstrap.cache_scope||'0');}
function save(s) {session=s;setToken(s.token);localStorage.setItem('fieldops-session',JSON.stringify(s));}
function emit(offline=false) {window.dispatchEvent(new CustomEvent('sessionready',{detail:{session,bootstrap,offline}}));}
export async function login(username,password) {const s=await api('login',{username,password},{token:''});save(s);if(s.profile.must_change){window.dispatchEvent(new Event('passwordrequired'));return;}await refresh();}
export async function changePassword(current_password,new_password) {const s=await api('changePassword',{current_password,new_password});save(s);await refresh();}
export async function consent() {const r=await api('consent',{accepted:true});session.profile.consent_at=r.consent_at;save(session);await refresh();}
export async function refresh() {
  if(!session)return;
  const owner=session.profile.id;
  const b=await api('bootstrap');if(!session||session.profile.id!==owner)return;
  bootstrap=b;lastRefresh=Date.now();session.profile=b.profile;save(session);await cache.put('bootstrap:'+owner,b);configureQueue(owner,b.profile.role==='SPG'&&!b.profile.must_change&&!!b.profile.consent_at);emit();return b;
}
export async function restore() {
  try{session=JSON.parse(localStorage.getItem('fieldops-session')||'null');}catch(e){session=null;}
  if(!session?.token||!session?.profile){session=null;return false;}
  setToken(session.token);
  if(session.profile.must_change){window.dispatchEvent(new Event('passwordrequired'));return true;}
  const saved=await cache.get('bootstrap:'+session.profile.id);
  if(saved&&saved.profile.role==='SPG'&&session.profile.role==='SPG'){
    bootstrap=saved;configureQueue(session.profile.id,false);emit(!navigator.onLine);
    if(navigator.onLine)refresh().catch(e=>{if(session)window.dispatchEvent(new CustomEvent('queueerror',{detail:e.message}));});
    return true;
  }
  try{await refresh();return true;}catch(e){
    if(e.retryable&&session){bootstrap=await cache.get('bootstrap:'+session.profile.id);if(bootstrap&&session.profile.role==='SPG'){configureQueue(session.profile.id,false);emit(true);return true;}}
    if(e.code==='CONFIG')throw e;
    return false;
  }
}
export async function logout() {
  if(!navigator.onLine)throw new Error('Logout server memerlukan internet. Sambungkan dahulu; antrean akan tetap disimpan.');
  pauseQueue();try{await api('logout');}catch(e){if(!['AUTH','ACCOUNT_DISABLED'].includes(e.code)){configureQueue(session?.profile.id,!!session?.profile.consent_at);throw e;}}
  forget();window.dispatchEvent(new Event('signedout'));
}
function forget() {pauseQueue();setToken('');session=null;bootstrap=null;localStorage.removeItem('fieldops-session');}
export async function patch(update) {if(!session||!bootstrap)return;Object.assign(bootstrap,update);await cache.put('bootstrap:'+session.profile.id,bootstrap);window.dispatchEvent(new CustomEvent('localdata',{detail:bootstrap}));}
window.addEventListener('authlost',e=>{forget();window.dispatchEvent(new CustomEvent('signedout',{detail:e.detail?.message}));});
window.addEventListener('online',()=>{if(session)refresh().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&session&&navigator.onLine&&Date.now()-lastRefresh>300000)refresh().catch(()=>{});});
