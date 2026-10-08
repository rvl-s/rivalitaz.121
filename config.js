export const CONFIG = Object.freeze({
  apiUrl: '',
  version: '1.0.0',
  appName: 'Field Operations',
  timezone: 'Asia/Jakarta',
  heartbeatMs: 60000,
  mapRefreshMs: 45000,
  requestTimeoutMs: 90000,
  maxPhotoBytes: 1572864,
  cdn: {
    leafletCss: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css',
    leaflet: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js',
    zip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
    table: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js'
  }
});
