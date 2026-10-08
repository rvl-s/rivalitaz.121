import { CONFIG } from './config.js';
import { api } from './api.js';
import { position } from './camera.js';
let visit=null,watch=null,timer=null,initial=null,wake=null,last=null,sending=false,lastSent=0;
function indicator(text,ok) {const el=document.querySelector('#location-status');if(el){el.textContent=text;el.classList.toggle('good',!!ok);}}
async function acquire() {if(!document.hidden&&navigator.wakeLock&&!wake){try{wake=await navigator.wakeLock.request('screen');wake.addEventListener('release',()=>wake=null);}catch(e){indicator('GPS aktif; layar dapat terkunci',false);}}}
export function startTracking(v) {
  if(visit?.id===v.id)return;stopTracking();visit=v;
  if(!navigator.geolocation){indicator('Lokasi tidak didukung',false);return;}
  watch=navigator.geolocation.watchPosition(p=>{last={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,source_at:new Date(p.timestamp).toISOString()};},()=>{last=null;indicator('Lokasi terputus; periksa izin GPS',false);},{enableHighAccuracy:true,maximumAge:15000,timeout:20000});
  acquire();initial=setTimeout(()=>{send(true).catch(()=>{});timer=setInterval(()=>send().catch(()=>{}),CONFIG.heartbeatMs);},Math.random()*10000);
}
export function stopTracking() {if(watch!==null)navigator.geolocation?.clearWatch(watch);clearInterval(timer);clearTimeout(initial);watch=null;timer=null;initial=null;visit=null;last=null;lastSent=0;if(wake)wake.release().catch(()=>{});wake=null;indicator('Belum check-in',false);}
async function send(force=false) {
  if(!visit||sending||document.hidden||(!force&&Date.now()-lastSent<50000))return;
  if(!navigator.onLine){indicator('Lokasi menunggu internet',false);return;}
  const owner=visit.id;sending=true;
  try {
    if(force||!last||Date.now()-new Date(last.source_at)>120000)last=await position();
    if(!visit||visit.id!==owner)return;
    const r=await api('heartbeat',{visit_id:owner,geo:last,source_at:last.source_at});lastSent=Date.now();indicator('Lokasi terkirim '+new Date(r.at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}),true);
  }catch(e){indicator(e.message,false);if(['ACTIVE_VISIT','AUTH','ACCOUNT_DISABLED'].includes(e.code)){stopTracking();window.dispatchEvent(new Event('trackingended'));}}
  finally{sending=false;}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&visit){acquire();send(true).catch(()=>{});}});
window.addEventListener('online',()=>send(true).catch(()=>{}));
window.addEventListener('signedout',stopTracking);
