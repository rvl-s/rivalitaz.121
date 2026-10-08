import { CONFIG } from './config.js';
import { current,data,login,restore,changePassword,consent,logout } from './auth.js';
import { items,flush } from './queue.js';
import { $,h,icon,busy,report,toast,dialog } from './ui.js';
import { renderWork,renderOwn,renderQueue,pendingCounts,projection } from './spg.js';
import { startMap,stopMap,resizeMap } from './map.js';
import { renderDashboard,renderTable,initFilters } from './dashboard.js';
import { renderAdmin } from './admin.js';
let route='',owner='',installPrompt=null;
const labels={work:['Kerja','work'],dash:['Peta','map'],customers:['Konsumen','users'],visits:['Kunjungan','list'],alerts:['Peringatan','alert'],manage:['Master','users'],audit:['Audit','list'],queue:['Antrean','queue']};
async function navigate(name) {
  if(!current()||!data())return;route=name;
  document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!==name+'-view');document.querySelectorAll('#navigation button').forEach(b=>{b.classList.toggle('active',b.dataset.route===name);b.setAttribute('aria-current',b.dataset.route===name?'page':'false');});
  document.body.classList.toggle('dashboard-mode',name==='dash');resizeMap();
  try{if(name==='work')await renderWork();else if(name==='queue')await renderQueue();else if(name==='customers'&&current().profile.role==='SPG')await renderOwn();else if(name==='dash')await renderDashboard();else if(name==='manage')await renderAdmin();else await renderTable(name);}catch(e){report(e);}
}
function passwordDialog(required=false) {
  const dlg=dialog(required?'Ganti password awal':'Ganti password','<p>Gunakan password baru minimal 12 karakter. Semua sesi lama akan dicabut.</p><label>Password saat ini<input name="current_password" type="password" required autocomplete="current-password"></label><label>Password baru<input name="new_password" type="password" minlength="12" maxlength="128" required autocomplete="new-password"></label><label>Ulangi password baru<input name="confirm" type="password" minlength="12" required autocomplete="new-password"></label>',async p=>{if(p.new_password!==p.confirm)throw new Error('Ulangan password belum sama.');await changePassword(p.current_password,p.new_password);toast('Password diperbarui.');});
  if(required){dlg.querySelectorAll('[data-close]').forEach(b=>b.hidden=true);dlg.oncancel=e=>e.preventDefault();}else dlg.oncancel=null;
}
function consentDialog() {
  const dlg=dialog('Persetujuan lokasi','<div class="privacy"><p>Aplikasi mencatat lokasi dan akurasi GPS saat check-in, check-out, serta selama kunjungan kerja aktif. Foto stok menyertakan nama, store, dan waktu pengambilan.</p><p>Admin, ARCO, dan TL sesuai tim dapat melihat data ini untuk memeriksa kunjungan. Titik tracking disimpan 60 hari. Tracking berhenti setelah check-out. Buka aplikasi selama jam kerja agar lokasi dapat dikirim.</p><label><input name="accepted" type="checkbox" required> Saya memahami dan menyetujui perekaman lokasi selama kunjungan kerja.</label></div>',async()=>{await consent();toast('Persetujuan tersimpan.');await navigate('work');});
  dlg.querySelectorAll('[data-close]').forEach(b=>b.hidden=true);dlg.oncancel=e=>e.preventDefault();
}
window.addEventListener('sessionready',async e=>{
  const u=e.detail.session.profile,isNew=owner!==u.id;$('#login-view').hidden=true;$('#app').hidden=false;$('#identity').textContent=u.name+' · '+u.role;
  if(isNew){owner=u.id;initFilters();const routes=u.role==='SPG'?['work','customers','queue']:['dash','customers','visits','alerts'].concat(u.role==='ADMIN'?['manage','audit']:[]);$('#navigation').innerHTML=routes.map(r=>'<button data-route="'+r+'">'+icon(labels[r][1])+'<span>'+h(u.role==='SPG'&&r==='customers'?'Data saya':labels[r][0])+'</span></button>').join('');$('#navigation').onclick=ev=>{const b=ev.target.closest('[data-route]');if(b)navigate(b.dataset.route);};if(u.role!=='SPG')startMap().catch(err=>toast(err.message,true));else stopMap();await navigate(routes[0]);}
  if(!isNew&&u.role==='SPG'&&route==='work'){const p=await projection();if($('#work-view').dataset.activeId!==(p.active?.id||''))await renderWork();else window.dispatchEvent(new CustomEvent('spgupdated',{detail:'createCustomer'}));}
  if(u.role==='SPG'&&!u.consent_at)setTimeout(()=>{if(current()&&!current().profile.consent_at)consentDialog();},50);if(e.detail.offline)toast('Mode offline. Antrean baru disimpan di HP; login diverifikasi lagi saat online.',true);updateQueue();
});
window.addEventListener('passwordrequired',()=>passwordDialog(true));
window.addEventListener('signedout',e=>{owner='';route='';$('#app').hidden=true;$('#login-view').hidden=false;document.body.classList.remove('dashboard-mode');$('#dialog').close();$('#startup').textContent='';$('#login-error').textContent=e.detail||'';document.querySelectorAll('.view').forEach(v=>{v.innerHTML='';v.hidden=true;});});
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=$('[type=submit]',e.target),values=Object.fromEntries(new FormData(e.target));busy(b,true,'Memeriksa akun');$('#login-error').textContent='';try{await login(values.username,values.password);e.target.reset();}catch(err){$('#login-error').textContent=err.message;}finally{busy(b,false);$('#startup').textContent='';}};
$('#password-button').onclick=()=>passwordDialog();$('#logout-button').onclick=async()=>{const q=await items();if(q.length)toast(q.length+' data masih tersimpan di HP. Login dengan akun yang sama untuk melanjutkan sinkronisasi.');try{await logout();}catch(e){report(e);}};
$('#queue-status').onclick=()=>{if(current()?.profile.role==='SPG')navigate('queue');};
async function updateQueue(){if(!current())return;const q=await items(current().profile.id);$('#queue-status').textContent='Antrean '+q.length+(q.some(e=>e.state==='failed')?' · ada yang ditolak':'');if(route==='queue')renderQueue().catch(report);}
window.addEventListener('queuechange',updateQueue);window.addEventListener('queueerror',e=>toast(e.detail,true));
window.addEventListener('spgupdated',async e=>{if(route!=='work'||!current())return;if(e.detail!=='createCustomer'){await renderWork();return;}const c=data()?.counter,pending=pendingCounts(await items());if(c)document.querySelectorAll('#work-view [data-counter]').forEach(el=>el.textContent=c[el.dataset.counter]+pending[el.dataset.counter]);});
window.addEventListener('trackingended',()=>{if(current()?.profile.role==='SPG')import('./auth.js').then(a=>a.refresh()).catch(()=>{});});
function network(){ $('#network-status').textContent=navigator.onLine?'Online':'Offline'; }
window.addEventListener('online',network);window.addEventListener('offline',network);network();$('#app-version').textContent='v'+CONFIG.version;
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
function showInstall(){document.querySelectorAll('.install').forEach(b=>b.hidden=standalone||(!installPrompt&&!ios));}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;showInstall();});window.addEventListener('appinstalled',()=>{installPrompt=null;document.querySelectorAll('.install').forEach(b=>b.hidden=true);});
document.querySelectorAll('.install').forEach(b=>b.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;showInstall();}else dialog('Pasang di iPhone','<p>Buka alamat ini di Safari. Tekan Bagikan, pilih <strong>Tambahkan ke Layar Utama</strong>, lalu tekan Tambah. Buka aplikasi dari ikon yang baru.</p>');});showInstall();
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{function update(){if(!reg.waiting)return;toast('Versi aplikasi baru tersedia. Tutup semua tab aplikasi lalu buka lagi setelah antrean tersimpan.');}reg.addEventListener('updatefound',()=>{reg.installing?.addEventListener('statechange',()=>{if(reg.installing?.state==='installed'&&navigator.serviceWorker.controller)update();});});update();}).catch(e=>toast('Cache offline belum siap: '+e.message,true));}
restore().then(ok=>{if(!ok)$('#startup').textContent='';}).catch(e=>{$('#startup').textContent='';$('#login-error').textContent=e.message;});
