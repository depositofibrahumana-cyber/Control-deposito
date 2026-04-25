/* ============================================================
   APP.JS — Control de Depósito Fibra Fitness
   Backend: Supabase (veexubtrpaplivoyuuli)
   ============================================================ */

// Estado en memoria
let appData = {
  envios:      { tiendanube: 0, full: 0, manuales: 0, colecta: 0, flex: 0, turbo: 0, andreani: 0 },
  errores:     { informados: 0 },
  movimientos: { interdeposito: 0, retiros: 0, itemsDiferentes: 0, detalles: [] }
};

let currentUser = null;
let currentProfile = null;

// Historial para gráficos (6 puntos horarios)
let historialEnvios  = [0, 0, 0, 0, 0, 0];
let historialErrores = [0, 0, 0, 0, 0, 0];

// Referencia a la jornada activa de Supabase
let jornadaActual = null;

// ─────────────────────────────────────────────
// Sincronizar datos desde Supabase → appData
// ─────────────────────────────────────────────
async function syncFromSupabase(targetDate = null) {
  try {
    const { jornada, detalles, histEnvios, histErrores } = await getDashboardData(targetDate);
    jornadaActual = jornada;

    appData.envios.tiendanube   = jornada.tiendanube || 0;
    appData.envios.full         = jornada.full_envios || 0;
    appData.envios.manuales     = jornada.manuales || 0;
    appData.envios.colecta      = jornada.colecta || 0;
    appData.envios.flex         = jornada.flex || 0;
    appData.envios.turbo        = jornada.turbo || 0;
    appData.envios.andreani     = jornada.andreani || 0;
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
    showToast('⚠️ Error de DB: ' + (err.message || 'Desconocido'), 'error');
    return false;
  }
}

/* ==================================
  CLIENTE API (Supabase Integration)
===================================== */
class ApiClient {
  static async getDashboard(targetDate = null) {
    await syncFromSupabase(targetDate);
    return { success: true, data: JSON.parse(JSON.stringify(appData)) };
  }

  static async submitMovimiento(movimiento) {
    if (!currentProfile?.permiso_carga_manual) return { success: false, message: 'No tienes permiso para esta acción.' };
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
      return { success: true, message: `✅ Sincronizado: +${cant} ${movimiento.tipo}.` };
    } catch (err) {
      return { success: false, message: `Error: ${err.message}` };
    }
  }

  static async resetData() {
    if (!currentProfile?.is_admin && !currentProfile?.permiso_reinicio_metricas) return { success: false, message: 'Acceso denegado.' };
    if (!jornadaActual) await syncFromSupabase();
    try {
      await resetJornada(jornadaActual.id);
      await syncFromSupabase();
      return { success: true, message: '🔄 Contadores reiniciados.' };
    } catch (err) {
      return { success: false, message: `Error: ${err.message}` };
    }
  }

  static async uploadData(file, parsedData = null) {
    if (!currentProfile?.permiso_carga_trabajo) return { success: false, message: 'Sin permiso para cargar jornada.' };
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
        await insertMovimientosDetalle(jornadaActual.id, parsedData.movimientos.detalles);
      }

      const totalEnvios = (parsedData.colecta || 0) + (parsedData.flex || 0) + (parsedData.turbo || 0) + (parsedData.andreani || 0);
      const horaLabel = new Date().getHours() + 'h';
      await appendHistorial('historial_envios',  jornadaActual.id, horaLabel, totalEnvios);
      await appendHistorial('historial_errores', jornadaActual.id, horaLabel, parsedData.errores || 0);

      jornadaActual = await updateJornada(jornadaActual.id, patch);
      await syncFromSupabase();
      return { success: true, message: '📦 Datos guardados en Supabase.' };
    } catch (err) {
      return { success: false, message: `Error: ${err.message}` };
    }
  }
}

async function syncDrive(isAuto = false) {
  if (!currentProfile?.is_admin && !currentProfile?.permiso_carga_trabajo) {
    if (isAuto !== true) showToast('Sin permisos para sincronizar Drive.', 'error');
    return;
  }
  
  const syncBtn = document.querySelector('button[onclick="syncDrive()"]');
  if (!isAuto) {
    showToast('Sincronizando con Google Drive...', 'info');
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.classList.add('syncing');
      syncBtn.innerHTML = '⚡ Sincronizando...';
    }
  }

  const token = currentSession ? currentSession.access_token : SUPABASE_ANON;
  const activeDate = document.getElementById('dashboard-date')?.value;
  const bodyData = JSON.stringify(activeDate ? { date: activeDate } : {});
  
  const startTime = Date.now();

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/procesar-etiquetas-drive`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: bodyData
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en Edge Function');
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Sync completed in ${duration}s`);

    if (!isAuto || data.nuevasHojas > 0) {
      showToast(`${data.message} (${duration}s)`, 'success');
    }
    
    if (data.nuevasHojas > 0) {
      await ApiClient.getDashboard(activeDate);
    }
  } catch (err) {
    console.error('Error Drive Sync:', err);
    if (!isAuto) showToast('⚠️ Error: ' + err.message, 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.classList.remove('syncing');
      syncBtn.innerHTML = '☁️ Sincronizar Drive';
    }
  }
}

/* ==================================
  AUTH & SESSION MANAGEMENT
==================================== */
async function checkAuth() {
  try {
    const session = await getSession();
    const overlay = document.getElementById('view-login');
    
    if (session) {
      console.log('Sesión activa:', session.user.email);
      currentUser = session.user;
      
      try {
        currentProfile = await getMyProfile();
        console.log('Perfil cargado:', currentProfile);
      } catch (pErr) {
        console.error('Error cargando perfil:', pErr);
        alert('Error fatal cargando permisos del perfil: ' + pErr.message + '\nContacta al soporte.');
      }
      
      if (overlay) overlay.classList.add('hidden');
      applyPermissions();
      initDashboard();
    } else {
      console.log('Sin sesión activa');
      if (overlay) overlay.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Error en checkAuth:', err);
  }
}

function applyPermissions() {
  const adminTools = document.getElementById('admin-tools');
  if (adminTools) {
    if (currentProfile?.is_admin) adminTools.classList.remove('hidden');
    else adminTools.classList.add('hidden');
  }

  document.querySelectorAll('.auth-required').forEach(btn => {
    if (!currentProfile) {
      // Si no hay perfil, ocultamos todo EXCEPTO cerrar sesión
      if (!btn.innerText.includes('Cerrar Sesión') && !btn.innerText.includes('Dashboard')) {
         btn.classList.add('hidden');
      }
      return;
    }
    const perm = btn.getAttribute('data-perm');
    if (!perm || perm === 'any') return;
    
    let hasPerm = true;
    if (perm === 'stock' && !currentProfile.permiso_stock) hasPerm = false;
    else if (perm === 'carga_trabajo' && !currentProfile.permiso_carga_trabajo) hasPerm = false;
    else if (perm === 'carga_manual' && !currentProfile.permiso_carga_manual) hasPerm = false;
    
    if (!hasPerm) btn.classList.add('hidden');
    else btn.classList.remove('hidden');
  });
}

async function handleLogout() {
  await signOut();
  window.location.reload();
}

/* ==================================
  UI CORE & CHARTJS
===================================== */
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

let myChartEnvios, myChartErrores, myChartMovimientos;

function initCharts() {
  let ctxEnvios = document.getElementById('enviosChart').getContext('2d');
  myChartEnvios = new Chart(ctxEnvios, {
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  let ctxErrores = document.getElementById('errorChart').getContext('2d');
  myChartErrores = new Chart(ctxErrores, {
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
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  let ctxMovimientos = document.getElementById('movimientosChart').getContext('2d');
  myChartMovimientos = new Chart(ctxMovimientos, {
      type: 'doughnut',
      data: {
          labels: ['Interdepósito', 'Retiros'],
          datasets: [{
              data: [0, 0],
              backgroundColor: ['#06b6d4', '#d946ef'],
              borderWidth: 0
          }]
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%' }
  });
}

function updateDashboardUI(data) {
  const anim = (elId, value) => {
    const el = document.getElementById(elId);
    if(el && el.innerText !== value.toString()) {
      el.innerText = value;
      el.style.opacity = '0.5';
      setTimeout(() => el.style.opacity = '1', 200);
    }
  };

  anim('kpi-tiendanube', data.envios.tiendanube);
  anim('kpi-full',       data.envios.full);
  anim('kpi-manuales',   data.envios.manuales);
  anim('kpi-colecta',    data.envios.colecta);
  anim('kpi-flex',       data.envios.flex);
  anim('kpi-turbo',      data.envios.turbo);
  anim('kpi-andreani',   data.envios.andreani);
  anim('kpi-errores',    data.errores.informados);

  let totalEnvios = data.envios.tiendanube + data.envios.full + data.envios.manuales + data.envios.colecta + data.envios.flex + data.envios.turbo + data.envios.andreani;

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
    html += `<tr><td style="font-weight: 600;">${d.item}</td><td><span class="badge ${badgeClass}">${d.tipo}</span></td><td>${d.cantidad}</td><td>${d.deposito}</td></tr>`;
  });
  tbody.innerHTML = html || '<tr><td colspan="4" style="text-align: center;">No hay resultados</td></tr>';
}

/* ==================================
  STOCK MANAGEMENT LOGIC
===================================== */
async function searchStock() {
  const sku = document.getElementById('stock-search-input').value.trim();
  if (!sku) return;

  const emptyState = document.getElementById('stock-empty-state');
  const resultContainer = document.getElementById('stock-result-container');
  
  try {
    const summary = await getStockSummaryBySku(sku);
    const moves = await getMovimientosBySku(sku);
    
    document.getElementById('stock-gaona').innerText = summary['Gaona 3735'];
    document.getElementById('stock-concordia').innerText = summary['Concordia 926'];
    
    let html = '';
    moves.forEach(m => {
      const date = new Date(m.fecha).toLocaleString('es-ES');
      html += `<tr>
        <td>${date}</td>
        <td>${m.tipo}</td>
        <td>${m.cantidad}</td>
        <td>${m.deposito_origen || '-'}</td>
        <td>${m.deposito_destino || '-'}</td>
      </tr>`;
    });
    
    document.getElementById('stock-movements-table').innerHTML = html || '<tr><td colspan="5" style="text-align:center;">Sin movimientos</td></tr>';
    
    emptyState.classList.add('hidden');
    resultContainer.classList.remove('hidden');
  } catch (err) {
    showToast('Error buscando stock: ' + err.message, 'error');
  }
}

function toggleStockFormFields() {
  const tipo = document.getElementById('sm-tipo').value;
  const groupOrigen = document.getElementById('group-origen');
  const groupDestino = document.getElementById('group-destino');
  
  if (tipo === 'Ingreso') {
    groupOrigen.classList.add('hidden');
    groupDestino.classList.remove('hidden');
  } else if (tipo === 'Retiro') {
    groupOrigen.classList.remove('hidden');
    groupDestino.classList.add('hidden');
  } else {
    groupOrigen.classList.remove('hidden');
    groupDestino.classList.remove('hidden');
  }
}

document.getElementById('stock-move-form').onsubmit = async (e) => {
  e.preventDefault();
  const mov = {
    sku: document.getElementById('sm-sku').value,
    tipo: document.getElementById('sm-tipo').value,
    cantidad: document.getElementById('sm-cantidad').value,
    deposito_origen: document.getElementById('sm-origen').value,
    deposito_destino: document.getElementById('sm-destino').value
  };
  
  try {
    await insertStockMovimiento(mov);
    showToast('Movimiento registrado correctamente');
    e.target.reset();
    toggleStockFormFields();
    searchStock(); // Refrescar si estábamos viendo ese SKU
  } catch (err) {
    showToast(err.message, 'error');
  }
};

/* ==================================
  ADMIN PANEL LOGIC
===================================== */
async function loadAdminUsers() {
  if (!currentProfile?.is_admin) return;
  const users = await getAllProfiles();
  const tbody = document.getElementById('users-table-body');
  
  let html = '';
  users.forEach(u => {
    html += `
      <tr>
        <td>${u.email}</td>
        <td><label class="switch"><input type="checkbox" ${u.is_admin ? 'checked' : ''} onchange="togglePerm('${u.id}', 'is_admin', this.checked)"><span class="slider"></span></label></td>
        <td><label class="switch"><input type="checkbox" ${u.permiso_carga_trabajo ? 'checked' : ''} onchange="togglePerm('${u.id}', 'permiso_carga_trabajo', this.checked)"><span class="slider"></span></label></td>
        <td><label class="switch"><input type="checkbox" ${u.permiso_carga_manual ? 'checked' : ''} onchange="togglePerm('${u.id}', 'permiso_carga_manual', this.checked)"><span class="slider"></span></label></td>
        <td><label class="switch"><input type="checkbox" ${u.permiso_reinicio_metricas ? 'checked' : ''} onchange="togglePerm('${u.id}', 'permiso_reinicio_metricas', this.checked)"><span class="slider"></span></label></td>
        <td><label class="switch"><input type="checkbox" ${u.permiso_stock ? 'checked' : ''} onchange="togglePerm('${u.id}', 'permiso_stock', this.checked)"><span class="slider"></span></label></td>
        <td><button class="btn-small danger" onclick="showToast('Función de borrado no implementada por seguridad')">Eliminar</button></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

async function togglePerm(userId, field, value) {
  try {
    await updateProfilePermissions(userId, { [field]: value });
    showToast('Permiso actualizado');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ==================================
  UTILIDADES GLOBALES
===================================== */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function switchView(viewId, btnElement, titleText) {
  if (viewId === 'view-admin') loadAdminUsers();
  
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
  if(title && titleText) title.innerText = titleText;
}

async function resetCounters() {
  if (!currentProfile?.is_admin && !currentProfile?.permiso_reinicio_metricas) return showToast('No tienes permiso', 'error');
  if (confirm('¿Estás seguro de que deseas reiniciar TODOS los contadores?')) {
    const res = await ApiClient.resetData();
    if(res.success) {
      showToast(res.message);
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
    showToast("Reporte descargado correctamente.");
  } catch (err) {
    showToast("Error al generar reporte", "error");
  }
}

// Lógica de carga de archivos (Drag & Drop)
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('fileInput');

if (dropZone) {
  dropZone.onclick = () => fileInput.click();
  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
  dropZone.ondragleave = () => { dropZone.classList.remove('dragover'); };
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  };
}

if (fileInput) {
  fileInput.onchange = (e) => { if(e.target.files.length) handleFile(e.target.files[0]); };
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const status = document.getElementById('uploadStatus');
  const text = document.getElementById('uploadStatusText');
  
  if (dropZone) dropZone.classList.add('hidden');
  if (status) status.classList.remove('hidden');

  try {
    if (ext === 'xlsx' || ext === 'xls') {
      if (text) text.innerText = "Procesando Excel...";
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        let parsed = {
          colecta: null, turbo: null, flex: null, andreani: null, errores: null,
          movimientos: { interdeposito: 0, retiros: 0, items: new Set(), detalles: [] },
          hasMovimientos: false
        };
        
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
            if(i > 0 && (row[0] || row[1] || row[2])) parsed.errores++;
          });
        }

        if(workbook.Sheets['Movimientos']) {
          parsed.hasMovimientos = true;
          XLSX.utils.sheet_to_json(workbook.Sheets['Movimientos'], {header: 1}).forEach((row, i) => {
            if(i > 0 && row[0] && row[2] && !isNaN(row[2])) {
              const tipo = row[0].toString().trim().toLowerCase();
              const cant = parseInt(row[2]);
              const item = row[1] ? row[1].toString().trim() : '';
              let dep = 'No especificado';
              if(tipo.includes('interdeposito')) { parsed.movimientos.interdeposito += cant; dep = 'Gaona 3735'; }
              else if(tipo.includes('retiro')) { parsed.movimientos.retiros += cant; dep = 'Concordia 926'; }
              if(item) {
                parsed.movimientos.items.add(item);
                parsed.movimientos.detalles.push({ item, tipo: row[0], cantidad: cant, deposito: dep });
              }
            }
          });
        }
        
        const res = await ApiClient.uploadData(file, parsed);
        if(res.success) showToast(res.message); else showToast(res.message, 'error');
        closeModal('uploadModal');
        initDashboard();
        if (status) status.classList.add('hidden');
        if (dropZone) dropZone.classList.remove('hidden');
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Formato no soportado', 'error');
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Cierre de sesión y modals
window.onclick = (e) => { if (e.target.classList.contains('modal')) e.target.classList.remove('active'); };

// ─────────────────────────────────────────────
// INITIALIZATION & EVENT LISTENERS
// ─────────────────────────────────────────────

function initEventListeners() {
  // Verificar localStorage
  try {
    localStorage.setItem('test', '1');
    localStorage.removeItem('test');
  } catch (e) {
    alert('⚠️ ERROR: Tu navegador tiene bloqueado el almacenamiento local (LocalStorage). Esto impedirá que inicies sesión. Revisa la configuración de privacidad.');
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const pass = document.getElementById('login-password').value;
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      
      try {
        if (submitBtn) {
           submitBtn.disabled = true;
           submitBtn.innerText = 'Verificando...';
        }
        
        console.log('Iniciando signIn para:', email);
        const data = await signIn(email, pass);
        console.log('SignIn exitoso:', data);
        
        if (!data.access_token) {
          throw new Error('No se recibió un token de acceso válido.');
        }

        showToast('Sesión iniciada correctamente');
        
        const overlay = document.getElementById('view-login');
        if (overlay) overlay.classList.add('hidden');
        
        await checkAuth();
      } catch (err) {
        console.error('Error fatal en login:', err);
        alert('❌ Error al iniciar sesión: ' + err.message);
        if (submitBtn) {
           submitBtn.disabled = false;
           submitBtn.innerText = 'Iniciar Sesión';
        }
      }
    };
  }

  const movForm = document.getElementById('movForm');
  if (movForm) {
    movForm.onsubmit = async (e) => {
      e.preventDefault();
      const res = await ApiClient.submitMovimiento({
        tipo: document.getElementById('movTipo').value,
        cantidad: document.getElementById('movCant').value
      });
      if(res.success) {
        showToast(res.message);
        closeModal('movModal');
        initDashboard();
      } else showToast(res.message, 'error');
    };
  }

  const stockMoveForm = document.getElementById('stock-move-form');
  if (stockMoveForm) {
    stockMoveForm.onsubmit = async (e) => {
      e.preventDefault();
      const mov = {
        sku: document.getElementById('sm-sku').value,
        tipo: document.getElementById('sm-tipo').value,
        cantidad: document.getElementById('sm-cantidad').value,
        deposito_origen: document.getElementById('sm-origen').value,
        deposito_destino: document.getElementById('sm-destino').value
      };
      try {
        await insertStockMovimiento(mov);
        showToast('Movimiento registrado correctamente');
        e.target.reset();
        toggleStockFormFields();
        searchStock();
      } catch (err) {
        showToast(err.message, 'error');
      }
    };
  }
}

// Reloj
setInterval(() => {
  const el = document.getElementById('reloj');
  if (el) el.innerText = new Date().toLocaleTimeString('es-ES');
}, 1000);

async function initDashboard() {
  initCharts();
  
  const dateInput = document.getElementById('dashboard-date');
  if (dateInput) {
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }
    
    dateInput.addEventListener('change', async (e) => {
      console.log('Fecha seleccionada:', e.target.value);
      const res = await ApiClient.getDashboard(e.target.value);
      console.log('Respuesta Dashboard:', res);
      if (res.success) updateDashboardUI(res.data);
    });
    
    // Carga inicial
    const res = await ApiClient.getDashboard(dateInput.value);
    console.log('Carga inicial Dashboard:', res);
    if (res.success) updateDashboardUI(res.data);
  }
  
  // Polling del dashboard: cada 15 segundos si la ventana está activa, 60 si está en segundo plano
  let pollingInterval = setInterval(refreshDashboard, 15000);
  
  async function refreshDashboard() {
    if (document.visibilityState === 'visible') {
      const activeDate = document.getElementById('dashboard-date')?.value;
      const r = await ApiClient.getDashboard(activeDate);
      if(r.success) updateDashboardUI(r.data);
    }
  }

  window.addEventListener('visibilitychange', () => {
    clearInterval(pollingInterval);
    if (document.visibilityState === 'visible') {
      refreshDashboard();
      pollingInterval = setInterval(refreshDashboard, 15000);
    } else {
      pollingInterval = setInterval(refreshDashboard, 60000);
    }
  });

  // Auto-Sincronización con Google Drive
  setInterval(async () => {
    if (currentProfile?.permiso_carga_trabajo && document.visibilityState === 'visible') {
      await syncDrive(true);
    }
  }, 45000); // Cada 45 segundos si está activo
}

// INICIAR TODO
(function() {
  window.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    checkAuth();
  });
})();

