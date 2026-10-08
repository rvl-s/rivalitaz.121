import { CONFIG } from './config.js';
import { $,h,icon } from './ui.js';
import { current } from './auth.js';
let offset=Number(localStorage.getItem('fieldops-time-offset')||0);
window.addEventListener('servertime',e=>{offset=new Date(e.detail).getTime()-Date.now();localStorage.setItem('fieldops-time-offset',String(offset));});
export function officialEstimate() {return new Date(Date.now()+offset).toISOString();}
export function position() {
  if(!navigator.geolocation)return Promise.reject(new Error('GPS tidak didukung. Gunakan Chrome atau Safari terbaru melalui HTTPS.'));
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,source_at:new Date(p.timestamp).toISOString()}),e=>reject(new Error(e.code===1?'Izin lokasi ditolak. Aktifkan Lokasi pada pengaturan situs, lalu coba lagi.':e.code===2?'Posisi belum tersedia. Aktifkan GPS dan pindah ke area terbuka.':'GPS belum mendapat posisi. Tunggu di area terbuka lalu coba lagi.')),{enableHighAccuracy:true,maximumAge:0,timeout:25000}));
}
async function hash(bytes) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function compress(file,store) {
  if(!file||!file.type.startsWith('image/'))throw new Error('Pilih foto dari kamera.');
  if(file.size>30000000)throw new Error('Foto sumber terlalu besar. Gunakan resolusi kamera lebih rendah.');
  const sourceHash=await hash(await file.arrayBuffer()),url=URL.createObjectURL(file),img=new Image();
  try {img.src=url;await img.decode();}catch(e){URL.revokeObjectURL(url);throw new Error('Foto tidak dapat dibaca. Gunakan format JPEG dari kamera.');}
  const ratio=Math.min(1,1280/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
  canvas.width=Math.round(img.naturalWidth*ratio);canvas.height=Math.round(img.naturalHeight*ratio);
  const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);
  const captured_at=officialEstimate(),font=Math.max(12,Math.round(canvas.width/45)),lines=[new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'medium'}).format(new Date(captured_at))+' WIB',current().profile.name,store.name];
  const height=font*4.8;ctx.fillStyle='rgba(0,0,0,0.78)';ctx.fillRect(0,canvas.height-height,canvas.width,height);ctx.fillStyle='#ffffff';ctx.font='600 '+font+'px system-ui';
  lines.forEach((line,i)=>ctx.fillText(line,Math.round(font*.7),canvas.height-height+font*(1.3+i*1.25),canvas.width-font*1.4));
  const uri=canvas.toDataURL('image/jpeg',0.7),base64=uri.split(',')[1];
  if(base64.length*3/4>CONFIG.maxPhotoBytes)throw new Error('Hasil kompresi melebihi 1,5 MB. Ambil foto yang lebih sederhana.');
  return {photo:{base64,source_hash:sourceHash},captured_at,preview:uri};
}
export function camera(root,store) {
  root.innerHTML='<label class="camera-pick">'+icon('camera')+'Ambil foto stok<input type="file" accept="image/*" capture="environment" aria-label="Foto stok" required></label><img class="photo-preview" alt="Pratinjau foto stok" hidden><p class="camera-status" role="status"></p><button type="button" class="retake" hidden>Ambil ulang</button>';
  const input=$('input',root),preview=$('img',root),status=$('p',root),retake=$('button',root);let result=null;
  input.onchange=async()=>{result=null;if(!input.files[0])return;status.textContent='Menyiapkan foto';try{result=await compress(input.files[0],store());preview.src=result.preview;preview.hidden=false;retake.hidden=false;status.textContent='Periksa foto sebelum dikirim.';}catch(e){status.textContent=e.message;input.value='';preview.hidden=true;}};
  retake.onclick=()=>{input.value='';result=null;preview.hidden=true;input.click();};
  return {value:()=>result,reset:()=>{result=null;input.value='';preview.hidden=true;retake.hidden=true;status.textContent='';}};
}
