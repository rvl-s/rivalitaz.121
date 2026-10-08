window.Camera = {
  async capture(){
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API tidak tersedia. Gunakan HTTPS dan browser modern.');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}},audio:false});
    return new Promise((resolve,reject)=>{
      const overlay=document.createElement('div'); overlay.className='camera-overlay';
      overlay.innerHTML='<video autoplay playsinline></video><div class="camera-actions"><button id="cancel">Batal</button><button id="snap">Ambil Foto</button></div>';
      document.body.appendChild(overlay);
      const video=overlay.querySelector('video'); video.srcObject=stream;
      overlay.querySelector('#cancel').onclick=()=>{stream.getTracks().forEach(t=>t.stop());overlay.remove();reject(new Error('Foto dibatalkan.'))};
      overlay.querySelector('#snap').onclick=()=>{
        const canvas=document.createElement('canvas'); const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.round(video.videoWidth*scale); canvas.height=Math.round(video.videoHeight*scale);
        canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
        stream.getTracks().forEach(t=>t.stop()); overlay.remove();
        canvas.toBlob(blob=>resolve(blob),'image/jpeg',0.80);
      };
    });
  }
};