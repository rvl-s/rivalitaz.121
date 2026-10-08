window.Geo = {
  async get(){
    if(!navigator.geolocation) throw new Error('Geolocation tidak tersedia pada perangkat ini.');
    return new Promise((resolve,reject)=>{
      navigator.geolocation.getCurrentPosition(
        p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp}),
        e=>reject(new Error(e.code===1?'Izin lokasi ditolak. Aktifkan Location Permission untuk aplikasi/browser ini.':'GPS tidak tersedia. Coba lagi di area terbuka.')),
        {enableHighAccuracy:true,timeout:15000,maximumAge:0}
      );
    });
  }
};