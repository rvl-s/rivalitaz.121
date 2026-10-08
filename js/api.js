const API_URL=(window.APP_CONFIG&&window.APP_CONFIG.API_URL)||'';
const API={
  async call(action,payload={}){
    if(!API_URL||API_URL.includes('PASTE_APPS_SCRIPT'))throw new Error('API belum dikonfigurasi. Isi frontend/js/config.js dengan URL Apps Script /exec.');
    const token=sessionStorage.getItem('rivalitaz_token')||localStorage.getItem('rivalitaz_token')||'';
    const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,token})});
    const out=await res.json(); if(!out.ok)throw new Error(out.error||'Request gagal.');
    if(out.data&&out.data.token)sessionStorage.setItem('rivalitaz_token',out.data.token);
    return out.data;
  },
  saveSession(data){sessionStorage.setItem('rivalitaz_token',data.token);localStorage.setItem('rivalitaz_token',data.token);sessionStorage.setItem('rivalitaz_user',JSON.stringify(data.user));},
  getSession(){const token=sessionStorage.getItem('rivalitaz_token')||localStorage.getItem('rivalitaz_token');const raw=sessionStorage.getItem('rivalitaz_user');return token&&raw?{token,user:JSON.parse(raw)}:null;},
  clearSession(){sessionStorage.removeItem('rivalitaz_token');sessionStorage.removeItem('rivalitaz_user');localStorage.removeItem('rivalitaz_token');}
};
