import { api } from './api.js';
import { current,data,scopeKey } from './auth.js';
import { cache } from './queue.js';
import { $,h,options,table,date,badge,debounce,report,toast } from './ui.js';
import { refreshMap } from './map.js';
import { editCustomer } from './admin.js';
import { exportDialog } from './export.js';
let filters={},generation=0;
export function initFilters() {const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());filters={from:day,to:day};}
export function activeFilters(){return Object.assign({},filters);}
function filterForm() {
  const b=data(),users=b.users||[];
  return '<form class="filters" id="filter-form"><label>Dari<input name="from" type="date" value="'+h(filters.from)+'"></label><label>Sampai<input name="to" type="date" value="'+h(filters.to)+'"></label><label>SPG<select name="spg_id">'+options(users.filter(u=>u.role==='SPG'),filters.spg_id)+'</select></label><label>Store<select name="store_id">'+options(b.stores,filters.store_id)+'</select></label><label>TL<select name="tl_id">'+options(users.filter(u=>u.role==='TL'),filters.tl_id)+'</select></label><label>SOB<select name="sob_id">'+options(b.sob.concat({id:'OTHER',name:'Lainnya'}),filters.sob_id)+'</select></label><label>Cari<input name="q" type="search" value="'+h(filters.q||'')+'" maxlength="160"></label><div class="filter-actions"><button type="submit" class="primary">Terapkan</button><button type="button" id="filter-reset">Hari ini</button>'+(current().profile.role==='ADMIN'?'<button type="button" id="open-export">Export</button>':'')+'</div></form>';
}
function bindFilters(root,reload) {
  const form=$('#filter-form',root);if(!form)return;
  const change=()=>{filters=Object.fromEntries(new FormData(form));reload().catch(report);};form.onsubmit=e=>{e.preventDefault();change();};$('[name=q]',form).oninput=debounce(change);
  $('#filter-reset',form).onclick=()=>{initFilters();reload().catch(report);};$('#open-export',form)?.addEventListener('click',()=>exportDialog(activeFilters()));
}
export async function renderDashboard() {
  const root=$('#dash-view');root.innerHTML='<button type="button" class="sheet-handle" aria-label="Buka atau lipat panel dashboard" aria-expanded="true"></button><div class="view-head"><h2>Dashboard</h2><button type="button" id="panel-toggle">Lipat panel</button></div><div class="panel-body">'+filterForm()+'<div id="dashboard-result"><p>Memuat ringkasan</p></div><h3>SPG aktif</h3><p id="live-note" class="muted">Mengambil lokasi</p><div id="live-list"></div></div>';
  const body=$('.panel-body',root),handle=$('.sheet-handle',root),toggle=()=>{body.classList.toggle('collapsed');const open=!body.classList.contains('collapsed');handle.setAttribute('aria-expanded',String(open));$('#panel-toggle').textContent=open?'Lipat panel':'Buka panel';};$('#panel-toggle').onclick=toggle;handle.onclick=toggle;
  let y=0,dragged=false;handle.onclick=()=>{if(dragged){dragged=false;return;}toggle();};handle.onpointerdown=e=>{dragged=false;y=e.clientY;handle.setPointerCapture(e.pointerId);};handle.onpointerup=e=>{if(Math.abs(e.clientY-y)>30){dragged=true;const collapse=e.clientY>y;body.classList.toggle('collapsed',collapse);handle.setAttribute('aria-expanded',String(!collapse));$('#panel-toggle').textContent=collapse?'Buka panel':'Lipat panel';}};
  bindFilters(root,renderDashboard);const mine=++generation,key='dash:'+scopeKey()+':'+JSON.stringify(filters),cached=await cache.get(key);
  function draw(r,stale){const entries=[['Konsumen hari ini',r.kpi.today],['Konsumen bulan ini',r.kpi.month],['SPG check-in',r.kpi.active],['Store sesuai filter',r.kpi.stores],['Peringatan filter',r.kpi.alerts],['Konsumen filter',r.kpi.filtered]];$('#dashboard-result').innerHTML=(stale?'<p class="muted">Salinan ringkasan '+h(date(r.generated_at))+'; sedang diperbarui.</p>':'')+'<div class="kpis">'+entries.map(([label,v])=>'<div class="kpi"><strong>'+v+'</strong><span>'+h(label)+'</span></div>').join('')+'</div>'+chart(r.chart);}
  if(cached&&mine===generation)draw(cached,true);
  try{const r=await api('dashboard',{filters});if(mine!==generation)return;await cache.put(key,r);draw(r,false);await refreshMap();}catch(e){if(mine===generation){if(!cached)$('#dashboard-result').textContent=e.message;else toast(e.message,true);}}
}
function chart(rows) {
  if(!rows.length)return '<p class="empty">Belum ada konsumen untuk grafik ini.</p>';
  const max=Math.max(...rows.map(r=>r.count)),width=560,bar=width/rows.length;
  return '<svg class="chart" viewBox="0 0 600 130" role="img" aria-label="Jumlah konsumen per tanggal"><title>'+h(rows.map(r=>r.day+': '+r.count).join('; '))+'</title>'+rows.map((r,i)=>{const x=20+i*bar,height=r.count/max*85;return '<rect x="'+x+'" y="'+(100-height)+'" width="'+Math.max(1,bar-5)+'" height="'+height+'"><title>'+h(r.day+': '+r.count)+'</title></rect>'+(rows.length<=15||i%Math.ceil(rows.length/10)===0?'<text x="'+x+'" y="120">'+h(r.day.slice(5))+'</text>':'');}).join('')+'</svg>';
}
const headings={customers:'Konsumen',visits:'Kunjungan',alerts:'Peringatan',audit:'Audit log'};
const actions={customers:'listCustomers',visits:'listVisits',alerts:'listAlerts',audit:'listAudit'};
export async function renderTable(kind,page=1) {
  const root=$('#'+kind+'-view'),mine=++generation;
  root.innerHTML='<div class="view-head"><h2>'+headings[kind]+'</h2><button id="table-refresh">Muat ulang</button></div>'+(kind!=='audit'?filterForm():'')+'<div id="table-result"><p>Memuat data</p></div><div id="table-pager" class="pager"></div>';
  bindFilters(root,()=>renderTable(kind,1));$('#table-refresh').onclick=()=>renderTable(kind,page).catch(report);
  const key='table:'+scopeKey()+':'+kind+':'+page+':'+JSON.stringify(filters),cached=await cache.get(key);
  function draw(r,stale) {
    const admin=current().profile.role==='ADMIN';let html='';
    if(kind==='customers')html=table(['Waktu','SPG','TL','Store','Nama','Nomor HP','SOB','Pekerjaan'].concat(admin?['Tindakan']:[]),r.items,c=>[h(date(c.created_at)),h(c.user_name),h(c.tl_name),h(c.store_name),h(c.name),h(c.phone),h(c.sob),h(c.job)].concat(admin?['<button data-edit="'+h(c.id)+'">Edit</button>']:[]));
    if(kind==='visits')html=table(['SPG','Store','Check-in','Check-out','Jarak masuk/keluar','GPS masuk/keluar','Geofence masuk/keluar','Peringatan','Foto masuk','Foto keluar'],r.items,v=>[h(v.user_name),h(v.store_name),h(date(v.checkin_at)),h(date(v.checkout_at)),h(v.in_distance+' / '+(v.out_distance||'—')+' m'),h(v.in_accuracy+' / '+(v.out_accuracy||'—')+' m'),badge(v.in_geofence)+' '+(v.checkout_at?badge(v.out_geofence):''),h(v.flags||'—'),photoButton(v,'checkin'),v.out_photo_id?photoButton(v,'checkout'):'—']);
    if(kind==='alerts')html=table(['Waktu','Kode','SPG / Store','Kunjungan'],r.items,a=>[h(date(a.at)),badge(a.code),h(a.detail),h(a.visit_id)]);
    if(kind==='audit')html=table(['Waktu','Pelaku','Tindakan','Data','Perubahan'],r.items,a=>[h(date(a.at)),h(data().users.find(u=>u.id===a.actor_id)?.name||a.actor_id),h(a.action),h(a.entity_id),'<button data-audit="'+h(a.id)+'">Lihat</button>']);
    $('#table-result',root).innerHTML=(stale?'<p class="muted">Salinan tersimpan; sedang diperbarui.</p>':'')+html;
    $('#table-pager',root).innerHTML='<span>'+r.total+' data · halaman '+page+'</span>'+(page>1?'<button id="prev-page">Sebelumnya</button>':'')+(r.has_more?'<button id="next-page">Berikutnya</button>':'');$('#prev-page',root)?.addEventListener('click',()=>renderTable(kind,page-1).catch(report));$('#next-page',root)?.addEventListener('click',()=>renderTable(kind,page+1).catch(report));
    root.onclick=e=>{const edit=e.target.closest('[data-edit]'),photo=e.target.closest('[data-photo]'),audit=e.target.closest('[data-audit]');if(edit)editCustomer(r.items.find(c=>c.id===edit.dataset.edit),()=>renderTable(kind,page)).catch(report);if(photo)showPhoto(photo.dataset.photo,photo.dataset.kind).catch(report);if(audit){const a=r.items.find(x=>x.id===audit.dataset.audit);import('./ui.js').then(m=>m.dialog('Perubahan data','<p>Nilai lama</p><pre>'+h(JSON.stringify(JSON.parse(a.old_json),null,2))+'</pre><p>Nilai baru</p><pre>'+h(JSON.stringify(JSON.parse(a.new_json),null,2))+'</pre>'));}};
    if(kind==='visits')lazyPhotos(root);
  }
  if(cached&&mine===generation)draw(cached,true);
  try{const r=await api(actions[kind],{filters,page});if(mine!==generation)return;await cache.put(key,r);draw(r,false);}catch(e){if(mine===generation){if(!cached)$('#table-result',root).textContent=e.message;else toast(e.message,true);}}
}
function photoButton(v,kind){return '<button class="photo-button" data-photo="'+h(v.id)+'" data-kind="'+kind+'" aria-label="Foto '+kind+' '+h(v.user_name)+'"><img class="thumb" alt="Foto '+kind+'" data-lazy-photo="'+h(v.id)+'" data-kind="'+kind+'"></button>';}
function lazyPhotos(root) {
  const pending=[];let running=0;
  function pump(){while(running<2&&pending.length){const img=pending.shift();running++;api('getPhoto',{visit_id:img.dataset.lazyPhoto,kind:img.dataset.kind}).then(r=>{if(img.isConnected)img.src='data:'+r.mime+';base64,'+r.base64;}).catch(()=>{if(img.isConnected)img.alt='Foto gagal; ketuk untuk ulang';}).finally(()=>{running--;pump();});}}
  const observer=new IntersectionObserver(entries=>{entries.filter(e=>e.isIntersecting).forEach(e=>{observer.unobserve(e.target);pending.push(e.target);});pump();},{rootMargin:'100px'});root.querySelectorAll('[data-lazy-photo]').forEach(img=>observer.observe(img));
}
async function showPhoto(id,kind){const r=await api('getPhoto',{visit_id:id,kind}),ui=await import('./ui.js');ui.dialog('Foto '+kind,'<img class="photo-full" alt="Foto stok" src="data:'+h(r.mime)+';base64,'+h(r.base64)+'">');}
