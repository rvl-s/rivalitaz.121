import { api } from './api.js';
let database, running=false, timer, currentUser='', ready=false;
function open() {
  if(database)return Promise.resolve(database);
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open('fieldops-v1',1);
    r.onupgradeneeded=()=>{const db=r.result;const q=db.createObjectStore('queue',{keyPath:'id'});q.createIndex('user','user_id');db.createObjectStore('cache',{keyPath:'key'});};
    r.onerror=()=>reject(new Error('Penyimpanan HP tidak tersedia. Buka browser biasa dan sediakan ruang kosong.'));
    r.onsuccess=()=>{database=r.result;database.onversionchange=()=>database.close();resolve(database);};
  });
}
async function request(store,mode,fn) {
  const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode),r=fn(tx.objectStore(store));let result;
    r.onsuccess=()=>result=r.result;r.onerror=()=>reject(r.error);
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||new Error('Penyimpanan gagal.'));tx.onabort=()=>reject(tx.error||new Error('Ruang penyimpanan HP tidak cukup. Jangan tutup formulir.'));
  });
}
export const cache = {
  async get(key) {return (await request('cache','readonly',s=>s.get(key)))?.value||null;},
  async put(key,value) {return request('cache','readwrite',s=>s.put({key,value,at:Date.now()}));},
  async delete(key) {return request('cache','readwrite',s=>s.delete(key));}
};
export function uuid() {
  if(crypto.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
}
export async function items(user=currentUser) {return (await request('queue','readonly',s=>s.index('user').getAll(user))).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));}
export async function enqueue(action,payload,user=currentUser) {
  if(!user)throw new Error('Login diperlukan sebelum menyimpan antrean.');
  const previous=await items(user),order=previous.reduce((n,x)=>Math.max(n,x.order+1),Date.now());
  const entry={id:payload.id,user_id:user,action,payload,order,state:'pending',attempts:0,error:'',next_at:0};
  const old=await request('queue','readonly',s=>s.get(entry.id));if(!old)await request('queue','readwrite',s=>s.add(entry));
  await changed();kick();return entry;
}
async function changed() {window.dispatchEvent(new CustomEvent('queuechange',{detail:{items:await items()}}));}
export function configureQueue(user,canSync=true) {currentUser=user||'';ready=canSync;clearTimeout(timer);changed().catch(()=>{});if(ready)kick();}
export function pauseQueue() {ready=false;clearTimeout(timer);}
function kick(delay=50) {clearTimeout(timer);if(!ready||!currentUser)return;timer=setTimeout(()=>flush().catch(e=>window.dispatchEvent(new CustomEvent('queueerror',{detail:e.message}))),delay);}
export async function flush() {
  if(navigator.locks)return navigator.locks.request('fieldops-sync',{ifAvailable:true},lock=>lock?drain():undefined);
  return drain();
}
async function drain() {
  if(running||!ready||!currentUser||!navigator.onLine)return;
  const owner=currentUser;running=true;
  try {
    for(const entry of await items(owner)) {
      if(!ready||currentUser!==owner||!navigator.onLine)break;
      if(entry.state==='failed')break;
      if(entry.next_at>Date.now()){kick(entry.next_at-Date.now());break;}
      try {
        const data=await api(entry.action,entry.payload);
        await request('queue','readwrite',s=>s.delete(entry.id));
        window.dispatchEvent(new CustomEvent('queuesent',{detail:{entry,data}}));
      }catch(e){
        if(['AUTH','ACCOUNT_DISABLED','PASSWORD_REQUIRED'].includes(e.code)){ready=false;break;}
        entry.attempts++;entry.error=e.message;entry.state=e.retryable?'pending':'failed';entry.next_at=Date.now()+Math.min(300000,5000*2**Math.min(entry.attempts,6))+Math.random()*3000;
        await request('queue','readwrite',s=>s.put(entry));if(entry.state==='pending')kick(entry.next_at-Date.now());break;
      }
    }
  }finally{running=false;await changed();}
}
export async function retry(id) {const e=await request('queue','readonly',s=>s.get(id));if(!e||e.user_id!==currentUser)return;e.state='pending';e.error='';e.next_at=0;await request('queue','readwrite',s=>s.put(e));await changed();kick();}
export async function discard(id) {const list=await items(),e=list.find(x=>x.id===id);if(!e)return;if(list.some(x=>x.id!==id&&x.payload.visit_id===id))throw new Error('Kunjungan memiliki data terkait. Hapus data dan check-out terkait lebih dahulu.');await request('queue','readwrite',s=>s.delete(id));window.dispatchEvent(new CustomEvent('queuediscard',{detail:e}));await changed();kick();}
window.addEventListener('online',()=>kick());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick();});
