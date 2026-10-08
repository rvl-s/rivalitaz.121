const VERSION='fieldops-1.0.0';
const BASE=new URL('./',self.location.href).href;
const SHELL=['./','index.html','manifest.json','css/style.css','js/config.js','js/api.js','js/queue.js','js/ui.js','js/auth.js','js/camera.js','js/tracking.js','js/spg.js','js/map.js','js/dashboard.js','js/admin.js','js/export.js','js/app.js','icon-generator.html','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL.map(p=>new URL(p,BASE).href)))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fieldops-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(url.hostname==='script.google.com'||url.hostname==='script.googleusercontent.com'){
    event.respondWith(fetch(request).catch(()=>new Response(JSON.stringify({ok:false,error:{code:'NETWORK',message:'Offline. Data aman di antrean HP dan dikirim saat aplikasi online.',retryable:true}}),{headers:{'Content-Type':'application/json'}})));return;
  }
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(BASE))return;
  if(request.mode==='navigate')event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(c=>c.put(new URL('index.html',BASE).href,copy));}return response;}).catch(()=>caches.match(new URL('index.html',BASE).href)));
  else event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
