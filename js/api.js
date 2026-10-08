const API_URL=(window.APP_CONFIG&&window.APP_CONFIG.API_URL)||'';

async function apiFetch(action,payload={}){
  if(!API_URL||API_URL.includes('PASTE_APPS_SCRIPT')){
    throw new Error('API URL belum diisi. Buka frontend/js/config.js dan isi URL Apps Script /exec.');
  }
  const token=sessionStorage.getItem('rivalitaz_token')||localStorage.getItem('rivalitaz_token')||'';
  let res;
  try{
    res=await fetch(API_URL,{
      method:'POST',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify({action,payload,token}),
      redirect:'follow'
    });
  }catch(e){
    throw new Error('Gagal terhubung ke Apps Script. Pastikan URL /exec benar, Web App sudah di-deploy, dan aksesnya mengizinkan pengguna aplikasi.');
  }
  let out;
  try{
    out=await res.json();
  }catch(e){
    throw new Error('Apps Script tidak mengembalikan JSON. Buka URL /exec langsung di browser untuk memastikan Web App aktif.');
  }
  if(!res.ok||!out.ok) throw new Error(out.error||('Request gagal (HTTP '+res.status+').'));
  return out.data;
}

const API={
  call:apiFetch,
  saveSession(data){
    if(!data||!data.token||!data.user) throw new Error('Respons login tidak lengkap.');
    sessionStorage.setItem('rivalitaz_token',data.token);
    localStorage.setItem('rivalitaz_token',data.token);
    sessionStorage.setItem('rivalitaz_user',JSON.stringify(data.user));
  },
  getSession(){
    const token=sessionStorage.getItem('rivalitaz_token')||localStorage.getItem('rivalitaz_token');
    const raw=sessionStorage.getItem('rivalitaz_user');
    try{return token&&raw?{token,user:JSON.parse(raw)}:null}catch(e){this.clearSession();return null;}
  },
  clearSession(){
    sessionStorage.removeItem('rivalitaz_token');
    sessionStorage.removeItem('rivalitaz_user');
    localStorage.removeItem('rivalitaz_token');
  }
};

async function apiAction(action,payload={}){return apiFetch(action,payload);}
