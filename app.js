/* Inicialización de Datos Mock (Base de Datos en Memoria con LocalStorage) */
let appData = JSON.parse(localStorage.getItem('antigravity_appData'));
if (!appData) {
  appData = {
    envios: { colecta: 0, flex: 0, turbo: 0, andreani: 0 },
    errores: { informados: 0 },
    movimientos: { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] }
  };
}
if (!appData.movimientos) {
  appData.movimientos = { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] };
}
if (!appData.movimientos.detalles) {
  appData.movimientos.detalles = [];
}

// Historial para los gráficos
let historialEnvios = JSON.parse(localStorage.getItem('antigravity_historialEnvios')) || [0, 0, 0, 0, 0, 0];
let historialErrores = JSON.parse(localStorage.getItem('antigravity_historialErrores')) || [0, 0, 0, 0, 0, 0];

function saveData() {
  localStorage.setItem('antigravity_appData', JSON.stringify(appData));
  localStorage.setItem('antigravity_historialEnvios', JSON.stringify(historialEnvios));
  localStorage.setItem('antigravity_historialErrores', JSON.stringify(historialErrores));
}

/* ==================================
  MOCK API CLASE BASE
  Simula las llamadas AJAX al servidor 
===================================== */
class ApiClient {
  static async getDashboard() {
    return new Promise(resolve => {
      // Simular delay de red
      setTimeout(() => {
        resolve({ success: true, data: JSON.parse(JSON.stringify(appData)) });
      }, 300);
    });
  }

  static async submitMovimiento(movimiento) {
    return new Promise(resolve => {
      setTimeout(() => {
        const cant = parseInt(movimiento.cantidad) || 0;
        if(movimiento.tipo === 'colecta') {
          appData.envios.colecta += cant;
        } else if (movimiento.tipo === 'flex') {
          appData.envios.flex += cant;
        } else if (movimiento.tipo === 'turbo') {
          appData.envios.turbo += cant;
        } else if (movimiento.tipo === 'andreani') {
          appData.envios.andreani += cant;
        } else if (movimiento.tipo === 'errores') {
          appData.errores.informados += cant;
        }
        saveData();
        resolve({ success: true, message: `Movimiento sincronizado: +${cant} ${movimiento.tipo}.` });
      }, 500);
    });
  }

  static async resetData() {
    return new Promise(resolve => {
      appData = {
        envios: { colecta: 0, flex: 0, turbo: 0, andreani: 0 },
        errores: { informados: 0 },
        movimientos: { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] }
      };
      historialEnvios = [0, 0, 0, 0, 0, 0];
      historialErrores = [0, 0, 0, 0, 0, 0];
      saveData();
      resolve({ success: true, message: 'Todos los contadores han sido reiniciados a 0.' });
    });
  }

  static async resetMovimientos() {
    return new Promise(resolve => {
      appData.movimientos = { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] };
      saveData();
      resolve({ success: true, message: 'Los contadores de movimientos han sido reiniciados.' });
    });
  }

  static async uploadData(file, parsedData = null) {
      return new Promise(resolve => {
          setTimeout(() => {
             let addedNum = 0;
             if(parsedData) {
               // Reemplazamos los valores en lugar de sumar para evitar duplicados al recargar, pero solo si estaban en el Excel
               if (parsedData.colecta !== null) appData.envios.colecta = parsedData.colecta;
               if (parsedData.flex !== null) appData.envios.flex = parsedData.flex;
               if (parsedData.turbo !== null) appData.envios.turbo = parsedData.turbo;
               if (parsedData.andreani !== null) appData.envios.andreani = parsedData.andreani;
               if (parsedData.errores !== null) appData.errores.informados = parsedData.errores;
               
               if(parsedData.hasMovimientos && parsedData.movimientos) {
                 appData.movimientos.interdeposito = parsedData.movimientos.interdeposito || 0;
                 appData.movimientos.retiros = parsedData.movimientos.retiros || 0;
                 appData.movimientos.itemsDiferentes = parsedData.movimientos.items.size || 0;
                 appData.movimientos.detalles = parsedData.movimientos.detalles || [];
               }

               addedNum = (parsedData.colecta || 0) + (parsedData.flex || 0) + (parsedData.turbo || 0) + (parsedData.andreani || 0);
               saveData();
               
               resolve({success: true, message: `Archivo procesado. Nuevos envíos: ${addedNum}. Errores: ${parsedData.errores || 0}.`});
             } else {
               resolve({success: true, message: `Procesamiento alternativo completado.`});
             }
          }, 800);
      });
  }
}

/* ==================================
  UI CORE & CHARTJS
===================================== */

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

let ctxEnvios = document.getElementById('enviosChart').getContext('2d');
let myChartEnvios = new Chart(ctxEnvios, {
    type: 'line',
    data: {
        labels: ['8am', '9am', '10am', '11am', '12pm', '1pm'],
        datasets: [{
            label: 'Volumen Total',
            data: historialEnvios,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
        }
    }
});

let ctxErrores = document.getElementById('errorChart').getContext('2d');
let myChartErrores = new Chart(ctxErrores, {
    type: 'bar',
    data: {
        labels: ['8am', '9am', '10am', '11am', '12pm', '1pm'],
        datasets: [{
            label: 'Errores Informados',
            data: historialErrores,
            backgroundColor: '#EF4444',
            borderRadius: 6
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { grid: { color: 'rgba(255,255,255,0.05)' } },
            x: { grid: { display: false } }
        }
    }
});

let ctxMovimientos = document.getElementById('movimientosChart').getContext('2d');
let myChartMovimientos = new Chart(ctxMovimientos, {
    type: 'doughnut',
    data: {
        labels: ['Interdepósito', 'Retiros'],
        datasets: [{
            data: [appData.movimientos.interdeposito, appData.movimientos.retiros],
            backgroundColor: ['#06b6d4', '#d946ef'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#94a3b8', font: { family: "'Inter', sans-serif" }, padding: 20 }
            }
        },
        cutout: '70%'
    }
});

// Update DOM logic
function updateDashboardUI(data) {
  // Animacion simple si los limites cambian (por clase)
  const anim = (elId, value) => {
    const el = document.getElementById(elId);
    if(el && el.innerText !== value.toString()) {
      el.innerText = value;
      el.style.opacity = '0.5';
      setTimeout(() => el.style.opacity = '1', 200);
    }
  };

  anim('kpi-colecta', data.envios.colecta);
  anim('kpi-flex', data.envios.flex);
  anim('kpi-turbo', data.envios.turbo);
  anim('kpi-andreani', data.envios.andreani);
  anim('kpi-errores', data.errores.informados);

  let totalEnvios = data.envios.colecta + data.envios.flex + data.envios.turbo + data.envios.andreani;

  // Actualizar ultimo punto de la grafica
  myChartEnvios.data.datasets[0].data[5] = totalEnvios;
  myChartEnvios.update();
  
  myChartErrores.data.datasets[0].data[5] = data.errores.informados;
  myChartErrores.update();

  if(data.movimientos) {
    anim('kpi-interdeposito', data.movimientos.interdeposito);
    anim('kpi-retiros', data.movimientos.retiros);
    anim('kpi-total-mov', data.movimientos.interdeposito + data.movimientos.retiros);
    anim('kpi-items-diff', data.movimientos.itemsDiferentes);
    
    
    myChartMovimientos.data.datasets[0].data = [data.movimientos.interdeposito, data.movimientos.retiros];
    myChartMovimientos.update();
    renderMovimientosTable();
  }
}

function renderMovimientosTable() {
  const query = (document.getElementById('search-movimientos')?.value || '').toLowerCase();
  const tbody = document.querySelector('#tabla-movimientos tbody');
  if (!tbody || !appData.movimientos) return;
  
  const detalles = appData.movimientos.detalles || [];
  
  let html = '';
  detalles.forEach(d => {
    const searchStr = `${d.item} ${d.tipo} ${d.deposito}`.toLowerCase();
    if (query && !searchStr.includes(query)) return;
    
    const badgeClass = d.tipo.toLowerCase().includes('interdeposito') ? 'interdeposito' : 'retiro';
    
    html += `
      <tr>
        <td style="font-weight: 600;">${d.item}</td>
        <td><span class="badge ${badgeClass}">${d.tipo}</span></td>
        <td>${d.cantidad}</td>
        <td>${d.deposito}</td>
      </tr>
    `;
  });
  
  if (html === '') {
    html = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No hay resultados para mostrar</td></tr>`;
  }
  
  tbody.innerHTML = html;
}

// POLLING (AJAX SIMULADO)
function startPolling() {
  setInterval(async () => {
    try {
      const response = await ApiClient.getDashboard();
      if(response.success) {
        updateDashboardUI(response.data);
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  }, 2000);
}

/* ==================================
  UTILIDADES GLOBALES
===================================== */

// Reloj
setInterval(() => {
  const now = new Date();
  document.getElementById('reloj').innerText = now.toLocaleTimeString('es-ES');
}, 1000);

// Toast
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Modals
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
}

function switchView(viewId, btnElement, titleText) {
  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });
  
  // Mostrar la vista objetivo
  const targetView = document.getElementById(viewId);
  if(targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  }
  
  // Actualizar botones estilo activo
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');
  
  // Actualizar Título Principal
  const title = document.getElementById('view-title');
  if(title && titleText) {
    title.innerText = titleText;
  }
}

async function resetCounters() {
  if (confirm('¿Estás seguro de que deseas reiniciar TODOS los contadores a 0?')) {
    const res = await ApiClient.resetData();
    if(res.success) {
      showToast(res.message, 'success');
      const stateRes = await ApiClient.getDashboard();
      updateDashboardUI(stateRes.data);
    }
  }
}

async function resetMovimientosCounters() {
  if (confirm('¿Estás seguro de que deseas reiniciar SOLO los contadores de Movimientos?')) {
    const res = await ApiClient.resetMovimientos();
    if(res.success) {
      showToast(res.message, 'success');
      // Forzamos que se resetee la tabla local también
      document.getElementById('search-movimientos').value = '';
      const stateRes = await ApiClient.getDashboard();
      updateDashboardUI(stateRes.data);
    }
  }
}

async function downloadReport() {
  try {
    const wb = XLSX.utils.book_new();

    // Crear hoja de Excel
    const reportData = [
      ["Reporte de Control de Depósito - Antigravity"],
      ["Fecha", new Date().toLocaleDateString('es-ES')],
      ["Hora", new Date().toLocaleTimeString('es-ES')],
      [],
      ["Tipo de Envío", "Cantidad Procesada"],
      ["Colecta", appData.envios.colecta],
      ["Flex", appData.envios.flex],
      ["Turbo", appData.envios.turbo],
      ["Andreani", appData.envios.andreani],
      ["Total Envíos", appData.envios.colecta + appData.envios.flex + appData.envios.turbo + appData.envios.andreani],
      [],
      ["Control de Calidad", "Cantidad"],
      ["Errores Informados", appData.errores.informados],
      [],
      ["Movimientos Internos", "Cantidad"],
      ["Total Interdepósito", appData.movimientos.interdeposito],
      ["Total Retiros", appData.movimientos.retiros],
      ["Total General", appData.movimientos.interdeposito + appData.movimientos.retiros],
      ["Items Únicos", appData.movimientos.itemsDiferentes]
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    
    // Auto-ajustar ancho de columnas
    const wscols = [
      {wch: 25},
      {wch: 20}
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Diario");
    XLSX.writeFile(wb, `Reporte_Antigravity_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Reporte descargado correctamente.", "success");
  } catch (err) {
    console.error("Error al generar reporte", err);
    showToast("Hubo un error al generar el reporte.", "error");
  }
}

/* ==================================
  EVENTOS Y LOGICA DE CARGA
===================================== */

// Formularios manuales
document.getElementById('movForm').onsubmit = async (e) => {
  e.preventDefault();
  const tipo = document.getElementById('movTipo').value;
  const cantidad = document.getElementById('movCant').value;
  
  const res = await ApiClient.submitMovimiento({tipo, cantidad});
  if(res.success) {
    showToast(res.message);
    closeModal('movModal');
    // Forzamos actualización UI
    const stateRes = await ApiClient.getDashboard();
    updateDashboardUI(stateRes.data);
  }
};

// Drag & Drop y Archivos
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
const processText = document.getElementById('uploadStatusText');

dropZone.onclick = () => fileInput.click();

dropZone.ondragover = (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
};

dropZone.ondragleave = () => {
  dropZone.classList.remove('dragover');
};

dropZone.ondrop = (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if(e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
};

fileInput.onchange = (e) => {
  if(e.target.files.length) handleFile(e.target.files[0]);
};

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  
  dropZone.classList.add('hidden');
  uploadStatus.classList.remove('hidden');
  
  try {
    if (ext === 'xlsx' || ext === 'xls') {
      processText.innerText = "Parceando hoja de cálculo (XLSX)...";
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        
        let parsed = { colecta: null, turbo: null, flex: null, andreani: null, errores: null, movimientos: { interdeposito: 0, retiros: 0, items: new Set(), detalles: [] }, hasMovimientos: false };
        try {
            const sumSheet = (sheetName) => {
                let total = 0;
                if(workbook.Sheets[sheetName]) {
                    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header: 1}).forEach((row, i) => {
                        if(i > 0 && row[1] && !isNaN(row[1]) && row[0] !== 'Total') total += parseInt(row[1]);
                    });
                    return total;
                }
                return null;
            };
            parsed.colecta = sumSheet('Colecta');
            parsed.turbo = sumSheet('Turbo');
            parsed.flex = sumSheet('Flex');
            parsed.andreani = sumSheet('Andreani');
            if(workbook.Sheets['Errores informados']) {
                parsed.errores = 0;
                XLSX.utils.sheet_to_json(workbook.Sheets['Errores informados'], {header: 1}).forEach((row, i) => {
                    if(i > 0 && (row[0] || row[1] || row[2]) && row[0] !== 'INFORMA') parsed.errores++;
                });
            }
            if(workbook.Sheets['Movimientos']) {
                parsed.hasMovimientos = true;
                XLSX.utils.sheet_to_json(workbook.Sheets['Movimientos'], {header: 1}).forEach((row, i) => {
                    if(i > 0 && row[0] && row[2] && !isNaN(row[2])) {
                        const tipoMov = row[0].toString().trim().toLowerCase();
                        const cantidad = parseInt(row[2]);
                        const itemStr = row[1] ? row[1].toString().trim() : '';
                        
                        let depositoStr = 'No especificado';

                        // Validar tipo de movimiento o asimilar
                        if(tipoMov === 'interdeposito' || tipoMov === 'interdepósito') {
                            parsed.movimientos.interdeposito += cantidad;
                            depositoStr = 'Gaona 3735';
                        } else if(tipoMov === 'retiro') {
                            parsed.movimientos.retiros += cantidad;
                            depositoStr = 'Concordia 926';
                        }
                        
                        // Guardar elemento para conteo unico
                        if(itemStr) {
                            parsed.movimientos.items.add(itemStr);
                            parsed.movimientos.detalles.push({
                                item: itemStr,
                                tipo: row[0].toString().trim(),
                                cantidad: cantidad,
                                deposito: depositoStr
                            });
                        }
                    }
                });
            }
        } catch(err) {
            console.error("Error procesando hojas", err);
        }

        // Simulamos envío al endpoint
        const res = await ApiClient.uploadData(file, parsed);
        finishUpload(res);
      };
      reader.readAsArrayBuffer(file);
    } 
    else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      processText.innerText = "Ejecutando OCR (Tesseract.js) en imagen (Toma unos segundos)...";
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imgBlobUrl = e.target.result;
        
        const { data: { text } } = await Tesseract.recognize(imgBlobUrl, 'spa', {
          logger: m => {
             if(m.status === 'recognizing text'){
               processText.innerText = `Reconociendo caracteres: ${Math.round(m.progress * 100)}%`;
             }
          }
        });
        
        console.log("Texto OCR:", text);
        // Fallback or send text to server to parse
        const res = await ApiClient.uploadData(file, null);
        finishUpload(res);
      };
      reader.readAsDataURL(file);
    }
    else {
      throw new Error("Formato no soportado. Sube XLSX o imágenes.");
    }
  } catch (error) {
    finishUpload({success: false, message: error.message});
  }
}

function finishUpload(res) {
  if(res.success) {
    showToast(res.message);
    closeModal('uploadModal');
    // Force poll
    ApiClient.getDashboard().then(r => updateDashboardUI(r.data));
  } else {
    showToast(res.message, 'error');
  }
  
  // Reset interface
  setTimeout(() => {
    dropZone.classList.remove('hidden');
    uploadStatus.classList.add('hidden');
    fileInput.value = "";
  }, 1000);
}

// INICIAR TODO
(async function initApp() {
  const res = await ApiClient.getDashboard();
  updateDashboardUI(res.data);
  startPolling();
})();
