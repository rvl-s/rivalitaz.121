import { api } from './api.js';
import { current,data,patch,scopeKey } from './auth.js';
import { enqueue,items,uuid,cache,flush,retry,discard } from './queue.js';
import { camera,position,officialEstimate } from './camera.js';
import { startTracking,stopTracking } from './tracking.js';
import { $,h,options,combobox,date,table,busy,report,toast,confirmAction } from './ui.js';
export async function projection() {
  const b=data(),q=await items(current().profile.id);let active=b.active,visits=b.visits_today.slice();
  for(const e of q) {
    if(e.action==='checkIn'){const store=b.stores.find(s=>s.id===e.payload.store_id);const v={id:e.id,store_id:store?.id,store_name:store?.name,checkin_at:e.payload.captured_at,day:e.payload.captured_at.slice(0,10),pending:true};if(!visits.some(x=>x.id===v.id))visits.push(v);active=v;}
    if(e.action==='checkOut'&&active?.id===e.payload.visit_id)active=null;
  }
  return {active,visits,q};
}
export function pendingCounts(q) {
  const day=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(d));
  const today=day(officialEstimate()),rows=q.filter(e=>e.action==='createCustomer'&&e.state==='pending');
  return {today:rows.filter(e=>day(e.payload.captured_at)===today).length,month:rows.filter(e=>day(e.payload.captured_at).slice(0,7)===today.slice(0,7)).length,total:rows.length};
}
export async function renderWork() {
  if(!current()||current().profile.role!=='SPG')return;
  const b=data(),root=$('#work-view'),p=await projection(),pending=p.q.filter(e=>e.action==='createCustomer'&&e.state==='pending').length,local=pendingCounts(p.q),c=b.counter||{today:0,month:0,total:0};
  root.dataset.activeId=p.active?.id||'';
  root.innerHTML='<div class="view-head"><h2>Hari kerja</h2><button type="button" id="sync-work">Sinkronkan</button></div><div class="kpis">'+[['Hari ini',c.today+local.today],['Bulan ini',c.month+local.month],['Total',c.total+local.total]].map(([label,count])=>'<div class="kpi"><strong data-counter="'+({"Hari ini":"today","Bulan ini":"month","Total":"total"}[label])+'">'+count+'</strong><span>'+label+(pending?' · termasuk antrean':'')+'</span></div>').join('')+'</div><p class="muted">'+p.visits.length+' dari 5 store hari ini. Waktu resmi dicatat ketika server menerima data.</p><div class="split"><section class="work-card"><h3>'+ (p.active?'Check-out':'Check-in')+'</h3>'+(p.active?'<div class="visit-info"><strong>'+h(p.active.store_name)+'</strong><p>'+date(p.active.checkin_at)+(p.active.pending?' · check-in menunggu sinkronisasi':'')+'</p></div>':'')+'<form id="visit-form">'+(!p.active?'<label>Store<select name="store_id" required>'+options(b.stores.filter(s=>!p.visits.some(v=>v.store_id===s.id)),'','Pilih store')+'</select></label>':'')+'<div id="stock-camera"></div><p class="inline-note">Foto dan lokasi GPS wajib. Kunjungan di luar radius tetap dicatat dengan peringatan.</p><button class="primary" type="submit">'+(p.active?'Kirim check-out':'Kirim check-in')+'</button></form></section><section class="work-card"><h3>Data konsumen</h3>'+(p.active?'<form id="customer-form"><label>Nama konsumen<input name="name" required maxlength="100" autocomplete="off"></label><label>Nomor HP<input name="phone" type="tel" inputmode="tel" autocomplete="off" required maxlength="30"></label><div id="sob-combo"></div><div id="job-combo"></div><button class="primary" type="submit">Simpan konsumen</button></form>':'<p class="empty">Check-in store untuk mulai input konsumen.</p>')+'</section></div><p class="inline-note">Jika sinyal buruk, data tersimpan di HP. Buka aplikasi saat online untuk mengirim antrean. Jangan hapus data situs atau uninstall sebelum antrean kosong.</p>';
  $('#sync-work').onclick=async()=>{try{await flush();toast('Antrean sedang diperiksa.');}catch(e){report(e);}};
  const store=()=>p.active?b.stores.find(s=>s.id===p.active.store_id):b.stores.find(s=>s.id===$('[name=store_id]',root).value);
  const cam=camera($('#stock-camera'),()=>{const s=store();if(!s)throw new Error('Pilih store sebelum mengambil foto.');return s;});
  $('[name=store_id]',root)?.addEventListener('change',()=>cam.reset());
  $('#visit-form').onsubmit=async e=>{
    e.preventDefault();const button=$('[type=submit]',e.target);busy(button,true,'Mengambil lokasi');
    try{
      const s=store();if(!s)throw new Error('Pilih store yang aktif.');const photo=cam.value();if(!photo)throw new Error('Ambil dan periksa foto stok terlebih dahulu.');
      const geo=await position(),id=uuid(),action=p.active?'checkOut':'checkIn';
      const payload={id,geo,photo:photo.photo,captured_at:photo.captured_at};if(p.active)payload.visit_id=p.active.id;else payload.store_id=s.id;
      await enqueue(action,payload);toast('Tersimpan di HP. Antrean akan dikirim berurutan.');await renderWork();
    }catch(err){report(err);busy(button,false);}
  };
  if(p.active){
    combobox($('#sob-combo'),'sob_id',b.sob);combobox($('#job-combo'),'job_id',b.jobs);
    $('#customer-form').onsubmit=async e=>{
      e.preventDefault();const button=$('[type=submit]',e.target);busy(button,true);
      try{
        const values=Object.fromEntries(new FormData(e.target)),compact=values.phone.replace(/[\s()-]/g,'');
        if(!/^(08\d+|\+628\d+|628\d+)$/.test(compact)||compact.replace(/^\+/,'').length<9||compact.replace(/^\+/,'').length>14)throw new Error('Nomor HP harus berawalan 08, +628, atau 628 dengan 9–14 digit.');
        const normalized=compact.replace(/^\+/,'').replace(/^0/,'62');
        if((await items()).some(x=>x.action==='createCustomer'&&x.payload.phone.replace(/^\+/,'').replace(/^0/,'62')===normalized))throw new Error('Nomor HP ini sudah ada dalam antrean Anda.');
        await enqueue('createCustomer',Object.assign(values,{phone:normalized,id:uuid(),visit_id:p.active.id,captured_at:officialEstimate()}));toast('Data konsumen tersimpan di HP.');await renderWork();
      }catch(err){report(err);busy(button,false);}
    };
  }
  if(b.active)startTracking(b.active);else stopTracking();
}
export async function renderOwn(page=1) {
  const root=$('#customers-view');root.innerHTML='<div class="view-head"><h2>Data saya</h2><button id="own-refresh">Muat ulang</button></div><div id="own-table"><p>Memuat data</p></div><div class="pager" id="own-pager"></div>';
  $('#own-refresh').onclick=()=>renderOwn(1).catch(report);
  const key='own:'+scopeKey()+':'+page,cached=await cache.get(key);
  function draw(r,stale){$('#own-table').innerHTML=(stale?'<p class="muted">Salinan tersimpan. Menghubungkan ke server.</p>':'')+table(['Waktu','Store','Nama','Nomor HP','SOB','Pekerjaan'],r.items,x=>[h(date(x.created_at)),h(x.store_name),h(x.name),h(x.phone),h(x.sob),h(x.job)]);$('#own-pager').innerHTML='<span>'+r.total+' data · halaman '+page+'</span>'+(page>1?'<button id="own-prev">Sebelumnya</button>':'')+(r.has_more?'<button id="own-next">Berikutnya</button>':'');$('#own-prev')?.addEventListener('click',()=>renderOwn(page-1).catch(report));$('#own-next')?.addEventListener('click',()=>renderOwn(page+1).catch(report));}
  if(cached)draw(cached,true);
  try{const r=await api('listCustomers',{page});await cache.put(key,r);draw(r,false);if(r.counter)await patch({counter:r.counter});}catch(e){if(!cached)$('#own-table').textContent=e.message;else toast(e.message,true);}
}
export async function renderQueue() {
  const root=$('#queue-view'),q=await items();root.innerHTML='<div class="view-head"><h2>Antrean HP</h2><button id="queue-sync">Kirim sekarang</button></div><p>Data dikirim berurutan. Satu data yang ditolak akan menahan data sesudahnya agar urutan kunjungan tetap benar.</p>'+q.map(e=>'<article class="queue-item"><strong>'+h({checkIn:'Check-in',checkOut:'Check-out',createCustomer:'Konsumen'}[e.action])+' · '+h(e.payload.name||e.payload.store_id||e.payload.visit_id)+'</strong><p>'+h(e.state==='failed'?'Ditolak server':'Menunggu pengiriman')+' · '+date(new Date(e.order).toISOString())+'</p><p class="form-error">'+h(e.error)+'</p><div class="actions"><button data-retry="'+h(e.id)+'">Coba lagi</button><button class="danger" data-discard="'+h(e.id)+'">Hapus antrean ini</button></div></article>').join('')+(q.length?'':'<p class="empty">Antrean kosong. Semua data telah dikirim.</p>');
  $('#queue-sync').onclick=()=>flush().catch(report);root.onclick=async e=>{const b=e.target.closest('[data-retry],[data-discard]');if(!b)return;try{if(b.dataset.retry)await retry(b.dataset.retry);else await confirmAction('Hapus data antrean','Data lokal ini akan dihapus. Jika koneksi terputus setelah server menerima data, periksa daftar server dahulu.',()=>discard(b.dataset.discard));await renderQueue();await renderWork();}catch(err){report(err);}};
}
window.addEventListener('queuesent',async e=>{
  if(!current()||current().profile.id!==e.detail.entry.user_id)return;
  const b=data(),r=e.detail.data,entry=e.detail.entry;
  if(r.visit){const v=r.visit,visits=b.visits_today.filter(x=>x.id!==v.id).concat(v);await patch({active:v.checkout_at?null:v,visits_today:visits});if(v.checkout_at)stopTracking();else startTracking(v);if(r.warnings?.length)toast('Kunjungan dicatat dengan peringatan: '+r.warnings.join(', '),true);}
  if(entry.action==='createCustomer'&&!r.duplicate){const c=b.counter;await patch({counter:{today:c.today+1,month:c.month+1,total:c.total+1}});}
  window.dispatchEvent(new CustomEvent('spgupdated',{detail:entry.action}));
});
