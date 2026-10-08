(() => {
  const $=s=>document.querySelector(s), app=$('#app');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let state={session:API.getSession(),stores:[],busy:false};
  window.currentUser=state.session?.user||null;

  function shell(content,nav=''){
    app.innerHTML=`<header><div><b>rivalitaz.121</b><small class="role-badge">${esc(state.session?.user?.role||'')}</small></div><button id="logout" class="ghost">Logout</button></header>
      ${nav}<main>${content}</main>`;
    $('#logout')?.addEventListener('click',async()=>{
      try{await API.call('logout')}catch(e){}
      stopForegroundLocation(); API.clearSession(); state.session=null; window.currentUser=null; render();
    });
  }

  function render(){
    if(!state.session) return login();
    window.currentUser=state.session.user;
    const role=state.session.user.role;
    if(role==='SPG') return spg();
    return dashboard();
  }

  function login(){
    app.innerHTML=`<div class="login"><div class="card"><h1>rivalitaz.121</h1><p>Field Management</p>
      <input id="u" autocomplete="username" placeholder="Username">
      <input id="p" type="password" autocomplete="current-password" placeholder="Password">
      <button id="go">Login</button><div id="msg" class="error"></div></div></div>`;
    $('#go').onclick=async()=>{
      try{
        $('#go').disabled=true;
        const d=await API.call('login',{username:$('#u').value.trim(),password:$('#p').value});
        API.saveSession(d); state.session=d; window.currentUser=d.user; render();
        if(d.user.role==='SPG') startForegroundLocation();
      }catch(e){$('#msg').textContent=e.message}
      finally{$('#go').disabled=false}
    };
  }

  async function dashboard(){
    const role=state.session.user.role;
    const admin=role==='ADMIN';
    const nav=admin?`<nav class="app-nav">
      <button data-view="dashboard">Dashboard</button>
      <button data-view="users">Users</button>
      <button data-view="stores">Stores</button>
      <button data-view="assignments">Assignments</button>
      <button data-view="alerts">Alerts</button>
      <button data-view="live">Live Location</button>
      <button data-view="exports">Export</button>
    </nav>`:'';

    shell(`<section id="dashboard-view">
      <div class="page-title"><div><h1>Dashboard</h1><p>${esc(state.session.user.name)} · ${esc(role)}</p></div></div>
      <div id="stats" class="grid"></div>
      <div class="card"><h2>Recent Activity</h2><div id="rows">Loading...</div></div>
      ${admin?`<div class="card"><h2>Admin Console</h2><p class="muted">Kelola user, store, assignment, alert, live location, dan export dari menu di atas.</p><div class="quick-grid">
        <button data-quick="users">Users</button><button data-quick="stores">Stores</button><button data-quick="assignments">Assignments</button><button data-quick="alerts">Alerts</button><button data-quick="live">Live Location</button><button data-quick="exports">Export PDF</button>
      </div></div>`:''}
    </section>
    <section id="admin-console" class="hidden">
      <div class="page-title"><div><h1 id="console-title">Admin Console</h1><p>Operasional & monitoring</p></div><button id="back-dashboard" class="ghost">← Dashboard</button></div>
      <div class="console-tabs">
        <button data-admin-tab="users">Users</button>
        <button data-admin-tab="stores">Stores</button>
        <button data-admin-tab="assignments">Assignments</button>
        <button data-admin-tab="alerts">Alerts</button>
        <button data-admin-tab="live">Live Location</button>
        <button data-admin-tab="exports">Export</button>
      </div>
      <div id="admin-panel" class="card"><p>Pilih menu.</p></div>
    </section>`,nav);

    document.querySelectorAll('.app-nav [data-view]').forEach(b=>b.onclick=()=>openView(b.dataset.view));
    document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>openView(b.dataset.quick));
    $('#back-dashboard')?.addEventListener('click',()=>showDashboard());

    try{
      const d=await API.call('dashboard',{page:1,pageSize:20});
      $('#stats').innerHTML=Object.entries(d.stats||{}).map(([k,v])=>`<div class="stat"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('');
      $('#rows').innerHTML=(d.rows||[]).map(r=>`<div class="row">${Object.values(r).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`).join('')||'Tidak ada data.';
    }catch(e){$('#rows').textContent=e.message}
  }

  function showDashboard(){
    $('#dashboard-view')?.classList.remove('hidden');
    $('#admin-console')?.classList.add('hidden');
  }

  async function openView(view){
    if(view==='dashboard'){showDashboard();return;}
    if(state.session.user.role!=='ADMIN')return;
    $('#dashboard-view')?.classList.add('hidden');
    $('#admin-console')?.classList.remove('hidden');
    await openAdminConsole(view);
  }

  async function spg(){
    shell(`<section><div class="page-title"><div><h1>Halo, ${esc(state.session.user.name)}</h1><p>Operasional hari ini</p></div></div>
      <div class="grid" id="stats"></div>
      <div class="card"><h2>Check-in Store</h2><select id="store"><option>Memuat...</option></select><button id="checkin">Check In + Foto Stock</button><div id="msg" class="error"></div></div>
      <div class="card"><h2>Hari Ini</h2><div id="history">Loading...</div></div></section>`);
    try{
      const d=await API.call('spgHome'); window.currentUser=state.session.user; startForegroundLocation(); state.stores=d.stores||[];
      $('#store').innerHTML=state.stores.map(s=>`<option value="${esc(s.storeId)}">${esc(s.storeName)}</option>`).join('');
      $('#stats').innerHTML=`<div class="stat"><small>Store visited</small><strong>${d.visited||0} / 5</strong></div><div class="stat"><small>Check-in</small><strong>${d.checkins||0}</strong></div><div class="stat"><small>Check-out</small><strong>${d.checkouts||0}</strong></div>`;
      $('#history').innerHTML=(d.history||[]).map(x=>`<div class="row"><span>${esc(x.storeName)}</span><span>${esc(x.checkinStatus)}</span><span>${esc(x.checkoutStatus||'Pending')}</span>${!x.checkoutStatus?`<button class="mini checkout" data-store="${esc(x.storeId||'')}">Check-out</button>`:''}</div>`).join('')||'Belum ada transaksi.';
      document.querySelectorAll('.checkout').forEach(btn=>btn.onclick=()=>doCheckout(btn.dataset.store));
    }catch(e){$('#msg').textContent=e.message}
    async function doCheckout(storeId){try{
      $('#msg').textContent='Mengambil GPS...';const geo=await Geo.get();$('#msg').textContent='Membuka kamera...';const blob=await Camera.capture();
      const base64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
      await API.call('checkout',{storeId,geo,photoBase64:base64,mimeType:'image/jpeg'});$('#msg').textContent='Check-out berhasil.';setTimeout(spg,500);
    }catch(e){$('#msg').textContent=e.message}}
    $('#checkin').onclick=async()=>{try{
      $('#checkin').disabled=true;$('#msg').textContent='Mengambil GPS...';const geo=await Geo.get();
      $('#msg').textContent='Membuka kamera...';const blob=await Camera.capture();
      $('#msg').textContent='Mengirim data...';const base64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(',')[1]);fr.onerror=rej;fr.readAsDataURL(blob)});
      await API.call('checkin',{storeId:$('#store').value,geo,photoBase64:base64,mimeType:'image/jpeg'});
      $('#msg').textContent='Check-in berhasil.';setTimeout(spg,500);
    }catch(e){$('#msg').textContent=e.message}finally{$('#checkin').disabled=false}};
  }

  if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
})();
let foregroundWatchId=null,foregroundLastSent=0;
function startForegroundLocation(){if(!navigator.geolocation||!window.currentUser||window.currentUser.role!=='SPG'||foregroundWatchId!==null)return;foregroundWatchId=navigator.geolocation.watchPosition(async p=>{if(Date.now()-foregroundLastSent<45000)return;foregroundLastSent=Date.now();try{await apiAction('saveLiveLocation',{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy});}catch(e){}},function(){},{enableHighAccuracy:true,maximumAge:15000,timeout:15000});}
function stopForegroundLocation(){if(foregroundWatchId!==null)navigator.geolocation.clearWatch(foregroundWatchId);foregroundWatchId=null;}
