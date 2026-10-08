
async function openAdminConsole(tab='users') {
  const box=document.getElementById('admin-console');
  const panel=document.getElementById('admin-panel');
  if(!box||!panel)return;
  box.classList.remove('hidden');
  document.querySelectorAll('[data-admin-tab]').forEach(b=>{
    b.onclick=()=>openAdminConsole(b.dataset.adminTab);
  });
  panel.innerHTML='<p>Memuat...</p>';
  try{
    if(tab==='users'){
      const d=await apiAction('adminListUsers');
      panel.innerHTML='<div class="admin-table"><table><thead><tr><th>Username</th><th>Nama</th><th>Role</th><th>Status</th></tr></thead><tbody>'+
        d.rows.map(x=>`<tr><td>${esc(x.username)}</td><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${x.active?'ACTIVE':'BLOCKED'}</td></tr>`).join('')+
        '</tbody></table></div>';
    } else if(tab==='stores'){
      const d=await apiAction('adminListStores');
      panel.innerHTML='<div class="admin-table"><table><thead><tr><th>Store</th><th>Lat</th><th>Lng</th><th>Radius</th><th>Status</th></tr></thead><tbody>'+
        d.rows.map(x=>`<tr><td>${esc(x.storeName)}</td><td>${esc(x.lat)}</td><td>${esc(x.lng)}</td><td>${esc(x.radiusMeters||100)} m</td><td>${String(x.active)!=='false'?'ACTIVE':'OFF'}</td></tr>`).join('')+
        '</tbody></table></div>';
    } else if(tab==='assignments'){
      const d=await apiAction('adminListAssignments');
      panel.innerHTML='<div class="admin-table"><table><thead><tr><th>SPG</th><th>TL</th><th>ARCO</th><th>Status</th></tr></thead><tbody>'+
        d.rows.map(x=>`<tr><td>${esc(x.spgId)}</td><td>${esc(x.tlId)}</td><td>${esc(x.arcoId||'')}</td><td>${esc(x.active||'')}</td></tr>`).join('')+
        '</tbody></table></div>';
    } else if(tab==='alerts'){
      const d=await apiAction('adminAlerts');
      panel.innerHTML='<div class="admin-table"><table><thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>User</th></tr></thead><tbody>'+
        d.rows.map(x=>`<tr><td>${esc(x.timestamp)}</td><td>${esc(x.type)}</td><td>${esc(x.severity)}</td><td>${esc(x.userId)}</td></tr>`).join('')+
        '</tbody></table></div>';
    } else if(tab==='live'){
      const d=await apiAction('adminLiveLocations');
      panel.innerHTML='<div class="admin-table"><table><thead><tr><th>SPG</th><th>Time</th><th>Lat</th><th>Lng</th><th>Accuracy</th></tr></thead><tbody>'+
        d.rows.map(x=>`<tr><td>${esc(x.spgId)}</td><td>${esc(x.timestamp)}</td><td>${esc(x.lat)}</td><td>${esc(x.lng)}</td><td>${esc(x.accuracy)} m</td></tr>`).join('')+
        '</tbody></table></div>';
    } else if(tab==='exports'){
      panel.innerHTML='<button id="export-pdf">Export Attendance PDF</button>';
      document.getElementById('export-pdf').onclick=async()=>{
        const d=await apiAction('exportPdf',{title:'rivalitaz.121 Attendance Report'});
        alert('PDF dibuat: '+d.name);
      };
    }
  }catch(e){panel.innerHTML='<p class="error">'+esc(e.message)+'</p>';}
}
function esc(v){
  return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
