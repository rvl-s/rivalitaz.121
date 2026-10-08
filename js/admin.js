import { api } from './api.js';
import { data,refresh } from './auth.js';
import { $,h,options,table,field,dialog,combobox,report,confirmAction,toast,date } from './ui.js';
let entity='Users',generation=0;
export async function renderAdmin(page=1) {
  const root=$('#manage-view'),mine=++generation;root.innerHTML='<div class="view-head"><h2>Manajemen</h2><button id="add-master" class="primary">Tambah</button></div><div class="manage-tabs">'+[['Users','User'],['Stores','Store'],['MasterSOB','SOB'],['MasterPekerjaan','Pekerjaan']].map(([v,label])=>'<button data-entity="'+v+'" class="'+(v===entity?'primary':'')+'">'+label+'</button>').join('')+'</div><label>Cari<input id="admin-search" type="search" maxlength="100"></label><div id="admin-table">Memuat master</div><div id="admin-pager" class="pager"></div>';
  root.querySelectorAll('[data-entity]').forEach(b=>b.onclick=()=>{entity=b.dataset.entity;renderAdmin().catch(report);});$('#add-master').onclick=()=>editMaster(null,()=>renderAdmin(page)).catch(report);
  let q='';const load=async()=>{const r=await api('adminList',{entity,page,q});if(mine!==generation)return;draw(r);};let timer;$('#admin-search').oninput=e=>{q=e.target.value;page=1;clearTimeout(timer);timer=setTimeout(()=>load().catch(report),350);};
  function draw(r){let html;
    if(entity==='Users')html=table(['Username','Nama','Role','TL','Status','Tindakan'],r.items,u=>[h(u.username),h(u.name),h(u.role),h(data().users.find(x=>x.id===u.tl_id)?.name||'—'),h(u.status),'<div class="actions"><button data-edit="'+h(u.id)+'">Edit</button><button data-reset="'+h(u.id)+'">Reset password</button><button data-status="'+h(u.id)+'">'+(u.status==='active'?'Blokir':'Aktifkan')+'</button><button class="danger" data-delete="'+h(u.id)+'">Hapus</button></div>']);
    else if(entity==='Stores')html=table(['Nama','Alamat','Latitude','Longitude','Radius','Status','Tindakan'],r.items,s=>[h(s.name),h(s.address),h(s.lat),h(s.lng),h(s.radius)+' m',h(s.status),'<button data-edit="'+h(s.id)+'">Edit</button> <button class="danger" data-delete="'+h(s.id)+'">Hapus</button>']);
    else html=table(['Nama','Status','Tindakan'],r.items,m=>[h(m.name),h(m.status),'<button data-edit="'+h(m.id)+'">Edit</button> <button class="danger" data-delete="'+h(m.id)+'">Hapus</button>']);
    $('#admin-table').innerHTML=html;$('#admin-pager').innerHTML='<span>'+r.total+' data · halaman '+page+'</span>'+(page>1?'<button id="admin-prev">Sebelumnya</button>':'')+(r.has_more?'<button id="admin-next">Berikutnya</button>':'');$('#admin-prev')?.addEventListener('click',()=>renderAdmin(page-1).catch(report));$('#admin-next')?.addEventListener('click',()=>renderAdmin(page+1).catch(report));
    $('#admin-table').onclick=async e=>{
      const b=e.target.closest('[data-edit],[data-delete],[data-reset],[data-status]');if(!b)return;const id=b.dataset.edit||b.dataset.delete||b.dataset.reset||b.dataset.status,u=r.items.find(x=>x.id===id);
      try{
        if(b.dataset.edit){await editMaster(u,()=>renderAdmin(page));return;}
        if(b.dataset.reset){await confirmAction('Reset password '+u.name,'Semua sesi akun ini akan dicabut.',async()=>{const result=await api('resetPassword',{id});setTimeout(()=>showPassword(u.username,result.password),50);});return;}
        if(b.dataset.status){dialog((u.status==='active'?'Blokir ':'Aktifkan ')+u.name,field('Alasan','reason','text','','required maxlength="240"'),async p=>{await api('setUserStatus',{id,status:u.status==='active'?'blocked':'active',reason:p.reason});await refresh();await renderAdmin(page);});return;}
        await confirmAction('Hapus '+u.name,'Data master akan dinonaktifkan. Riwayat tetap tersedia untuk audit.',async()=>{await api(entity==='Users'?'deleteUser':entity==='Stores'?'deleteStore':'deleteMaster',{id,entity});await refresh();await renderAdmin(page);});
      }catch(err){report(err);}
    };
  }
  await load();
}
function showPassword(username,password){dialog('Password awal','<p>Akun: <strong>'+h(username)+'</strong></p><p>Sampaikan password ini melalui saluran internal yang aman. User wajib menggantinya saat login.</p><label>Password<input readonly value="'+h(password)+'" autocomplete="off"></label>');}
async function editMaster(item,onSaved) {
  const v=item||{},selectedEntity=entity;let html=field('Nama','name','text',v.name||'','required maxlength="100"');
  if(selectedEntity==='Users'){
    html=field('Username','username','text',v.username||'','required minlength="3" maxlength="60" autocapitalize="none"')+html+'<label>Role<select name="role">'+['ADMIN','ARCO','TL','SPG'].map(r=>'<option'+(r===(v.role||'SPG')?' selected':'')+'>'+r+'</option>').join('')+'</select></label><label id="tl-field">TL<select name="tl_id">'+options(data().users.filter(u=>u.role==='TL'&&u.status==='active'),v.tl_id,'Pilih TL')+'</select></label>'+(item?'':field('Password awal (kosongkan untuk membuat otomatis)','password','password','','minlength="12" maxlength="128" autocomplete="new-password"'));
  }
  if(selectedEntity==='Stores')html+=field('Alamat','address','text',v.address||'','required maxlength="300"')+field('Latitude','lat','number',v.lat??'','required step="any" min="-90" max="90"')+field('Longitude','lng','number',v.lng??'','required step="any" min="-180" max="180"')+field('Radius meter','radius','number',v.radius||100,'required min="1" max="10000"');
  html+='<label>Status<select name="status">'+(selectedEntity==='Users'?['active','inactive','blocked']:['active','inactive']).map(s=>'<option'+(s===(v.status||'active')?' selected':'')+'>'+s+'</option>').join('')+'</select></label>';
  const dlg=dialog(item?'Edit data':'Tambah data',html,async p=>{if(item)p.id=item.id;p.entity=selectedEntity;const result=await api(selectedEntity==='Users'?'saveUser':selectedEntity==='Stores'?'saveStore':'saveMaster',p);await refresh();await onSaved();if(result.initial_password)setTimeout(()=>showPassword(p.username,result.initial_password),50);else toast('Master tersimpan.');});
  if(selectedEntity==='Users'){const role=$('[name=role]',dlg),tl=$('[name=tl_id]',dlg),update=()=>{$('#tl-field',dlg).hidden=role.value!=='SPG';tl.required=role.value==='SPG';};role.onchange=update;update();}
}
export async function editCustomer(c,onSaved) {
  const html=field('Nama konsumen','name','text',c.name,'required maxlength="100"')+field('Nomor HP','phone','tel',c.phone,'required maxlength="30"')+'<div id="edit-sob"></div><div id="edit-job"></div><p>Terakhir diperbarui: '+h(date(c.updated_at||c.created_at))+'</p><button type="button" class="danger" id="delete-customer">Hapus konsumen</button>';
  const dlg=dialog('Edit konsumen',html,async p=>{await api('updateCustomer',Object.assign(p,{id:c.id}));await onSaved();toast('Perubahan tersimpan di audit log.');});combobox($('#edit-sob',dlg),'sob_id',data().sob,c.sob_id,c.sob_id==='OTHER'?c.sob:'');combobox($('#edit-job',dlg),'job_id',data().jobs,c.job_id,c.job_id==='OTHER'?c.job:'');
  $('#delete-customer',dlg).onclick=async()=>{if(!window.confirm('Hapus konsumen '+c.name+'? Riwayat perubahan akan dicatat.'))return;try{await api('deleteCustomer',{id:c.id});dlg.close();await onSaved();toast('Konsumen dihapus.');}catch(e){report(e);}};
}
