import { CONFIG } from './config.js';
import { api } from './api.js';
import { $,h,dialog,loadScript,date,report } from './ui.js';
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
export function csvCell(value){const text=String(value??''),safe=/^[\s]*[=+\-@]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';}
const header=['Waktu WIB','SPG','TL','Store','Nama','Nomor HP','SOB','Pekerjaan'];
const cells=c=>[date(c.created_at),c.user_name,c.tl_name,c.store_name,c.name,c.phone,c.sob,c.job];
export function exportDialog(filters) {
  const dlg=dialog('Export sesuai filter','<p>'+h(JSON.stringify(filters))+'</p><div class="actions"><button data-export="csv">CSV</button><button data-export="pdf">PDF</button><button data-export="zip">ZIP foto</button></div><p id="export-note" role="status">Pilih format.</p><progress id="export-progress" class="progress" value="0" max="100"></progress>');
  dlg.querySelectorAll('[data-export]').forEach(button=>button.onclick=async()=>{
    const buttons=dlg.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
    const note=$('#export-note',dlg),progress=$('#export-progress',dlg),type=button.dataset.export;
    function update(done,total,message){progress.value=total?done/total*100:100;note.textContent=message;}
    try{
      note.textContent='Menyiapkan snapshot data';const job=await api('startExport',{type,filters});
      if(type==='zip'){
        await loadScript(CONFIG.cdn.zip);const zip=new JSZip();let offset=0,done=0;
        while(offset!==null){const batch=await api('exportPhotos',{export_id:job.id,offset});for(let i=0;i<batch.items.length;i+=3){const photos=await Promise.all(batch.items.slice(i,i+3).map(async p=>({p,file:await api('getPhoto',{visit_id:p.visit_id,kind:p.kind,full:true})})));for(const {p,file}of photos){zip.file(p.name,file.base64,{base64:true});done++;update(done,batch.total,'Mengambil foto '+done+' / '+batch.total);}}offset=batch.next;}
        zip.file('filter.json',JSON.stringify({filters,printed_at:new Date().toISOString()},null,2));note.textContent='Menyusun ZIP';const blob=await zip.generateAsync({type:'blob',compression:'STORE'},m=>{progress.value=m.percent;});download(blob,'FieldOps_Foto_'+job.id+'.zip');
      }else{
        const rows=[];let offset=0;while(offset!==null){const batch=await api('exportCustomers',{export_id:job.id,offset});rows.push(...batch.items);update(rows.length,batch.total,'Mengambil '+rows.length+' / '+batch.total+' konsumen');offset=batch.next;}
        if(type==='csv'){const csv='\uFEFF'+[header,...rows.map(cells)].map(row=>row.map(csvCell).join(',')).join('\r\n');download(new Blob([csv],{type:'text/csv;charset=utf-8'}),'FieldOps_Konsumen_'+job.id+'.csv');}
        else {await loadScript(CONFIG.cdn.pdf);await loadScript(CONFIG.cdn.table);const pdf=new jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});pdf.setFontSize(15);pdf.text('Field Operations — Data Konsumen',14,15);pdf.setFontSize(9);pdf.text('Cetak: '+date(new Date().toISOString()),14,22);const lines=pdf.splitTextToSize('Filter: '+JSON.stringify(filters),265);pdf.text(lines,14,28);pdf.autoTable({head:[header],body:rows.map(cells),startY:30+lines.length*4,styles:{fontSize:8,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:[191,77,36]},didDrawPage:()=>{pdf.setFontSize(8);pdf.text('Halaman '+pdf.internal.getNumberOfPages(),265,202);}});pdf.save('FieldOps_Konsumen_'+job.id+'.pdf');}
      }
      update(1,1,'File siap. Periksa folder unduhan atau menu Bagikan di Safari.');
    }catch(e){note.textContent=e.message;report(e);}finally{buttons.forEach(b=>b.disabled=false);}
  });
}
