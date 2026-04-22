/* ============================================================
   APP.JS — Control de Depósito Fibra Fitness
   Backend: Supabase (veexubtrpaplivoyuuli)
   ============================================================ */

// Estado en memoria (siempre se inicializa desde Supabase)
let appData = {
  envios:      { colecta: 0, flex: 0, turbo: 0, andreani: 0 },
  errores:     { informados: 0 },
  movimientos: { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] }
};

// Historial para gráficos (6 puntos horarios)
let historialEnvios  = [0, 0, 0, 0, 0, 0];
let historialErrores = [0, 0, 0, 0, 0, 0];

// Referencia a la jornada activa de Supabase
let jornadaActual = null;

// ─────────────────────────────────────────────
// Sincronizar datos desde Supabase → appData
// ─────────────────────────────────────────────
async function syncFromSupabase() {
  try {
    const { jornada, detalles, histEnvios, histErrores } = await getDashboardData();
    jornadaActual = jornada;

    appData.envios.colecta      = jornada.colecta;
    appData.envios.flex         = jornada.flex;
    appData.envios.turbo        = jornada.turbo;
    appData.envios.andreani     = jornada.andreani;
    appData.errores.informados  = jornada.errores;
    appData.movimientos.interdeposito   = jornada.interdeposito;
    appData.movimientos.retiros         = jornada.retiros;
    appData.movimientos.itemsDiferentes = jornada.items_diferentes;
    appData.movimientos.detalles = detalles.map(d => ({
      item:     d.item,
      tipo:     d.tipo,
      cantidad: d.cantidad,
      deposito: d.deposito
    }));

    // Reconstruir historial de gráficos
    if (histEnvios.length > 0) {
      historialEnvios = [0, 0, 0, 0, 0, 0];
      histEnvios.slice(-6).forEach((h, i) => { historialEnvios[i] = h.total; });
    }
    if (histErrores.length > 0) {
      historialErrores = [0, 0, 0, 0, 0, 0];
      histErrores.slice(-6).forEach((h, i) => { historialErrores[i] = h.total; });
    }

    return true;
  } catch (err) {
    console.error('Error sincronizando desde Supabase:', err);
    showToast('⚠️ Error de conexión con la base de datos', 'error');
    return false;
  }
}

/* ==================================
  CLIENTE API (Supabase)
===================================== */
class ApiClient {

  static async getDashboard() {
    await syncFromSupabase();
    return { success: true, data: JSON.parse(JSON.stringify(appData)) };
  }

  static async submitMovimiento(movimiento) {
    if (!jornadaActual) await syncFromSupabase();
    try {
      const cant = parseInt(movimiento.cantidad) || 0;
      const patch = {};
      if      (movimiento.tipo === 'colecta')  patch.colecta  = (jornadaActual.colecta  || 0) + cant;
      else if (movimiento.tipo === 'flex')     patch.flex     = (jornadaActual.flex     || 0) + cant;
      else if (movimiento.tipo === 'turbo')    patch.turbo    = (jornadaActual.turbo    || 0) + cant;
      else if (movimiento.tipo === 'andreani') patch.andreani = (jornadaActual.andreani || 0) + cant;
      else if (movimiento.tipo === 'errores')  patch.errores  = (jornadaActual.errores  || 0) + cant;

      jornadaActual = await updateJornada(jornadaActual.id, patch);
      await syncFromSupabase();
      return { success: true, message: `✅ Sincronizado con Supabase: +${cant} ${movimiento.tipo}.` };
    } catch (err) {
      return { success: false, message: `Error al guardar: ${err.message}` };
    }
  }

  static async resetData() {
    if (!jornadaActual) await syncFromSupabase();
    try {
      await resetJornada(jornadaActual.id);
      await syncFromSupabase();
      return { success: true, message: '🔄 Todos los contadores han sido reiniciados en Supabase.' };
    } catch (err) {
      return { success: false, message: `Error al reiniciar: ${err.message}` };
    }
  }

  static async resetMovimientos() {
    if (!jornadaActual) await syncFromSupabase();
    try {
      await resetMovimientos(jornadaActual.id);
      await syncFromSupabase();
      return { success: true, message: '🔄 Movimientos reiniciados en Supabase.' };
    } catch (err) {
      return { success: false, message: `Error al reiniciar movimientos: ${err.message}` };
    }
  }

  static async uploadData(file, parsedData = null) {
    if (!jornadaActual) await syncFromSupabase();
    try {
      if (!parsedData) return { success: true, message: 'Procesamiento alternativo completado.' };

      const patch = {};
      if (parsedData.colecta  !== null) patch.colecta  = parsedData.colecta;
      if (parsedData.flex     !== null) patch.flex     = parsedData.flex;
      if (parsedData.turbo    !== null) patch.turbo    = parsedData.turbo;
      if (parsedData.andreani !== null) patch.andreani = parsedData.andreani;
      if (parsedData.errores  !== null) patch.errores  = parsedData.errores;

      if (parsedData.hasMovimientos && parsedData.movimientos) {
        patch.interdeposito   = parsedData.movimientos.interdeposito || 0;
        patch.retiros         = parsedData.movimientos.retiros       || 0;
        patch.items_diferentes = parsedData.movimientos.items.size   || 0;

        // Guardar detalles de movimientos
        await insertMovimientosDetalle(jornadaActual.id, parsedData.movimientos.detalles);
      }

      // Guardar punto de historial de envíos
      const totalEnvios = (parsedData.colecta || 0) + (parsedData.flex || 0) +
                          (parsedData.turbo || 0) + (parsedData.andreani || 0);
      const horaLabel = new Date().getHours() + 'h';
      await appendHistorial('historial_envios',  jornadaActual.id, horaLabel, totalEnvios);
      await appendHistorial('historial_errores', jornadaActual.id, horaLabel, parsedData.errores || 0);

      jornadaActual = await updateJornada(jornadaActual.id, patch);
      await syncFromSupabase();

      const added = (parsedData.colecta || 0) + (parsedData.flex || 0) + (parsedData.turbo || 0) + (parsedData.andreani || 0);
      return { success: true, message: `📦 Datos guardados en Supabase. Envíos: ${added} | Errores: ${parsedData.errores || 0}` };
    } catch (err) {
      return { success: false, message: `Error al guardar en Supabase: ${err.message}` };
    }
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
            data: [0, 0],
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
  const anim = (elId, value) => {
    const el = document.getElementById(elId);
    if(el && el.innerText !== value.toString()) {
      el.innerText = value;
      el.style.opacity = '0.5';
      setTimeout(() => el.style.opacity = '1', 200);
    }
  };

  anim('kpi-colecta',  data.envios.colecta);
  anim('kpi-flex',     data.envios.flex);
  anim('kpi-turbo',    data.envios.turbo);
  anim('kpi-andreani', data.envios.andreani);
  anim('kpi-errores',  data.errores.informados);

  let totalEnvios = data.envios.colecta + data.envios.flex + data.envios.turbo + data.envios.andreani;

  myChartEnvios.data.datasets[0].data = [...historialEnvios];
  myChartEnvios.data.datasets[0].data[5] = totalEnvios;
  myChartEnvios.update();

  myChartErrores.data.datasets[0].data = [...historialErrores];
  myChartErrores.data.datasets[0].data[5] = data.errores.informados;
  myChartErrores.update();

  if(data.movimientos) {
    anim('kpi-interdeposito', data.movimientos.interdeposito);
    anim('kpi-retiros',       data.movimientos.retiros);
    anim('kpi-total-mov',     data.movimientos.interdeposito + data.movimientos.retiros);
    anim('kpi-items-diff',    data.movimientos.itemsDiferentes);

    myChartMovimientos.data.datasets[0].data = [data.movimientos.interdeposito, data.movimientos.retiros];
    myChartMovimientos.update();
    renderMovimientosTable();
  }

  // Actualizar indicador de conexión
  const dot = document.querySelector('.dot');
  if (dot) {
    dot.style.background = '#10b981';
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

// POLLING desde Supabase cada 10 segundos
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
  }, 10000);
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
  document.querySelectorAll('.view').forEach(v => {
    v.classList.remove('active');
    v.classList.add('hidden');
  });

  const targetView = document.getElementById(viewId);
  if(targetView) {
    targetView.classList.remove('hidden');
    targetView.classList.add('active');
  }

  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if(btnElement) btnElement.classList.add('active');

  const title = document.getElementById('view-title');
  if(title && titleText) {
    title.innerText = titleText;
  }
}

async function resetCounters() {
  if (confirm('¿Estás seguro de que deseas reiniciar TODOS los contadores en Supabase?')) {
    const res = await ApiClient.resetData();
    if(res.success) {
      showToast(res.message, 'success');
      const stateRes = await ApiClient.getDashboard();
      updateDashboardUI(stateRes.data);
    } else {
      showToast(res.message, 'error');
    }
  }
}

async function resetMovimientosCounters() {
  if (confirm('¿Estás seguro de que deseas reiniciar SOLO los contadores de Movimientos?')) {
    const res = await ApiClient.resetMovimientos();
    if(res.success) {
      showToast(res.message, 'success');
      document.getElementById('search-movimientos').value = '';
      const stateRes = await ApiClient.getDashboard();
      updateDashboardUI(stateRes.data);
    } else {
      showToast(res.message, 'error');
    }
  }
}

async function downloadReport() {
  try {
    const wb = XLSX.utils.book_new();
    const reportData = [
      ["Reporte de Control de Depósito - Antigravity"],
      ["Fecha", new Date().toLocaleDateString('es-ES')],
      ["Hora",  new Date().toLocaleTimeString('es-ES')],
      [],
      ["Tipo de Envío", "Cantidad Procesada"],
      ["Colecta",  appData.envios.colecta],
      ["Flex",     appData.envios.flex],
      ["Turbo",    appData.envios.turbo],
      ["Andreani", appData.envios.andreani],
      ["Total Envíos", appData.envios.colecta + appData.envios.flex + appData.envios.turbo + appData.envios.andreani],
      [],
      ["Control de Calidad", "Cantidad"],
      ["Errores Informados", appData.errores.informados],
      [],
      ["Movimientos Internos", "Cantidad"],
      ["Total Interdepósito", appData.movimientos.interdeposito],
      ["Total Retiros",       appData.movimientos.retiros],
      ["Total General",       appData.movimientos.interdeposito + appData.movimientos.retiros],
      ["Items Únicos",        appData.movimientos.itemsDiferentes]
    ];

    const ws = XLSX.utils.aoa_to_sheet(reportData);
    ws['!cols'] = [{wch: 25}, {wch: 20}];
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
  const tipo     = document.getElementById('movTipo').value;
  const cantidad = document.getElementById('movCant').value;

  const res = await ApiClient.submitMovimiento({tipo, cantidad});
  if(res.success) {
    showToast(res.message);
    closeModal('movModal');
    const stateRes = await ApiClient.getDashboard();
    updateDashboardUI(stateRes.data);
  } else {
    showToast(res.message, 'error');
  }
};

// Drag & Drop y Archivos
const dropZone    = document.getElementById('drop-zone');
const fileInput   = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
const processText  = document.getElementById('uploadStatusText');

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

        let parsed = {
          colecta: null, turbo: null, flex: null, andreani: null, errores: null,
          movimientos: { interdeposito: 0, retiros: 0, items: new Set(), detalles: [] },
          hasMovimientos: false
        };

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

          parsed.colecta  = sumSheet('Colecta');
          parsed.turbo    = sumSheet('Turbo');
          parsed.flex     = sumSheet('Flex');
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
                const tipoMov  = row[0].toString().trim().toLowerCase();
                const cantidad = parseInt(row[2]);
                const itemStr  = row[1] ? row[1].toString().trim() : '';

                let depositoStr = 'No especificado';

                if(tipoMov === 'interdeposito' || tipoMov === 'interdepósito') {
                  parsed.movimientos.interdeposito += cantidad;
                  depositoStr = 'Gaona 3735';
                } else if(tipoMov === 'retiro') {
                  parsed.movimientos.retiros += cantidad;
                  depositoStr = 'Concordia 926';
                }

                if(itemStr) {
                  parsed.movimientos.items.add(itemStr);
                  parsed.movimientos.detalles.push({
                    item:     itemStr,
                    tipo:     row[0].toString().trim(),
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

        processText.innerText = "Guardando en Supabase...";
        const res = await ApiClient.uploadData(file, parsed);
        finishUpload(res);
      };
      reader.readAsArrayBuffer(file);
    }
    else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      processText.innerText = "Ejecutando OCR (Tesseract.js) en imagen...";

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
    ApiClient.getDashboard().then(r => updateDashboardUI(r.data));
  } else {
    showToast(res.message, 'error');
  }

  setTimeout(() => {
    dropZone.classList.remove('hidden');
    uploadStatus.classList.add('hidden');
    fileInput.value = "";
  }, 1000);
}

// INICIAR TODO — Carga inicial desde Supabase
(async function initApp() {
  // Indicar carga
  document.querySelectorAll('.kpi-value').forEach(el => {
    el.innerText = '...';
    el.style.opacity = '0.5';
  });

  const res = await ApiClient.getDashboard();
  if (res.success) {
    updateDashboardUI(res.data);
    showToast('🟢 Conectado a Supabase — Deposito Fibra Fitness', 'success');
  }

  startPolling();
})();
