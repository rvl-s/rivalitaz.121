import { CONFIG } from './config.js';
import { api } from './api.js';
import { loadScript,h,date } from './ui.js';
let map,timer,layer,first=true,busy=false,generation=0;
export async function startMap() {
  const mine=++generation;document.querySelector('#map').hidden=false;
  if(!document.querySelector('link[data-leaflet]')){const css=document.createElement('link');css.rel='stylesheet';css.href=CONFIG.cdn.leafletCss;css.dataset.leaflet='yes';document.head.append(css);}
  await loadScript(CONFIG.cdn.leaflet);if(mine!==generation)return;
  if(!map){map=L.map('map',{zoomControl:false}).setView([-2.5,118],5);L.control.zoom({position:'topright'}).addTo(map);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);layer=L.layerGroup().addTo(map);}
  first=true;clearInterval(timer);await refreshMap();timer=setInterval(()=>{if(!document.hidden)refreshMap().catch(showError);},CONFIG.mapRefreshMs);setTimeout(()=>map.invalidateSize(),100);
}
function showError(e){const el=document.querySelector('#live-note');if(el)el.textContent=e.message;}
export async function refreshMap() {
  if(busy||!map)return;busy=true;const mine=generation;
  try{
    const r=await api('liveLocation');if(mine!==generation)return;layer.clearLayers();const points=[];
    for(const p of r.items){const lost=p.status==='LOKASI_HILANG',warn=p.geofence!=='VALID',marker=L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="map-marker '+(lost?'lost':warn?'warn':'')+'"></div>',iconSize:[20,20],iconAnchor:[10,10]})});marker.bindPopup('<strong>'+h(p.name)+'</strong><p>'+h(p.store_name)+'</p><p>'+h(p.status)+' · '+h(p.geofence)+'</p><p>Update '+h(date(p.at))+' · '+Math.round(p.accuracy)+' m</p>');marker.addTo(layer);points.push([p.lat,p.lng]);}
    if(first&&points.length){map.fitBounds(points,{paddingTopLeft:[40,40],paddingBottomRight:[40,40],maxZoom:15});first=false;}
    const list=document.querySelector('#live-list');if(list)list.innerHTML=r.items.map(p=>'<div class="inline-note"><strong>'+h(p.name)+'</strong> · '+h(p.store_name)+'<br>'+h(p.status)+' · '+h(date(p.at,true))+'</div>').join('')||( '<p class="empty">Belum ada SPG check-in.</p>');
    const note=document.querySelector('#live-note');if(note)note.textContent='Peta diperbarui '+new Date(r.time).toLocaleTimeString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB · refresh 45 detik';
  }finally{busy=false;}
}
export function resizeMap(){setTimeout(()=>map?.invalidateSize(),100);}
export function stopMap(){generation++;clearInterval(timer);timer=null;layer?.clearLayers();document.querySelector('#map').hidden=true;}
window.addEventListener('signedout',stopMap);
