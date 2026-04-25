/* ============================================================
   SUPABASE CLIENT - Deposito Fibra Fitness
   Proyecto: veexubtrpaplivoyuuli
   ============================================================ */

const SUPABASE_URL  = 'https://veexubtrpaplivoyuuli.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZXh1YnRycGFwbGl2b3l1dWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA4NzIsImV4cCI6MjA5MjAwNjg3Mn0.LYld-iKM_Mtn0YfO1omEfnsyRFG1btXQyAt5ctheP78';

// Estado de la sesión local
let currentSession = null;

// ─────────────────────────────────────────────
// Helper: llamada genérica a la REST API o AUTH de Supabase
// ─────────────────────────────────────────────
async function sbFetch(endpoint, options = {}) {
  const isAuth = endpoint.startsWith('auth/');
  const url = isAuth 
    ? `${SUPABASE_URL}/${endpoint}` 
    : `${SUPABASE_URL}/rest/v1/${endpoint}`;
    
  const token = currentSession ? currentSession.access_token : SUPABASE_ANON;
  
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${token}`,
    ...(isAuth ? {} : { 'Prefer': 'return=representation' }),
    ...(options.headers || {})
  };

  console.log(`[Supabase Call] ${options.method || 'GET'} ${url}`);

  try {
    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401 && !isAuth) {
      // Token expirado o inválido: limpiar sesión y forzar relogin
      console.warn('Token expirado (401). Limpiando sesión...');
      await signOut();
      window.location.reload();
      return [];
    }

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = text;
      try { 
        const json = JSON.parse(text);
        errorMsg = json.msg || json.message || json.error_description || text;
      } catch(e) {}
      throw new Error(`Supabase error [${res.status}]: ${errorMsg}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch (err) {
    console.error('[Supabase Fetch Error]', err);
    if (err.message.includes('Failed to fetch')) {
      throw new Error('Error de conexión: No se pudo conectar con el servidor. Revisa tu conexión a internet.');
    }
    throw err;
  }
}

// ─────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────
async function signIn(email, password) {
  const data = await sbFetch('auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  currentSession = data;
  localStorage.setItem('sb_session', JSON.stringify(data));
  return data;
}

async function signOut() {
  currentSession = null;
  localStorage.removeItem('sb_session');
  // No necesitamos llamar al endpoint de logout necesariamente para limpiar localmente
}

async function getSession() {
  if (currentSession) return currentSession;
  const stored = localStorage.getItem('sb_session');
  if (stored) {
    currentSession = JSON.parse(stored);
    // TODO: Validar expiración si es necesario
    return currentSession;
  }
  return null;
}

// ─────────────────────────────────────────────
// PROFILES & PERMISSIONS
// ─────────────────────────────────────────────
async function getMyProfile() {
  const session = await getSession();
  if (!session) return null;
  const rows = await sbFetch(`profiles?id=eq.${session.user.id}`, { method: 'GET' });
  return rows[0] || null;
}

async function getAllProfiles() {
  return await sbFetch('profiles?order=email.asc', { method: 'GET' });
}

async function updateProfilePermissions(userId, patch) {
  return await sbFetch(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
}

// ─────────────────────────────────────────────
// DASHBOARD & JORNADAS
// ─────────────────────────────────────────────
async function getOrCreateJornada(targetDate = null) {
  const dateToFetch = targetDate || new Date().toISOString().slice(0, 10);
  const rows = await sbFetch(`jornadas?fecha=eq.${dateToFetch}&limit=1`, { method: 'GET' });
  if (rows.length > 0) return rows[0];

  try {
    const created = await sbFetch('jornadas', {
      method: 'POST',
      body: JSON.stringify({ fecha: dateToFetch })
    });
    return Array.isArray(created) ? created[0] : created;
  } catch (err) {
    // Si hubo una carrera y alguien más lo creó
    const rowsRetry = await sbFetch(`jornadas?fecha=eq.${dateToFetch}&limit=1`, { method: 'GET' });
    if (rowsRetry.length > 0) return rowsRetry[0];
    throw err;
  }
}

async function getDashboardData(targetDate = null) {
  const jornada = await getOrCreateJornada(targetDate);
  
  // Ejecutamos las consultas en paralelo para mejorar la velocidad
  const [detalles, histEnvios, histErrores] = await Promise.all([
    sbFetch(`movimientos_detalle?jornada_id=eq.${jornada.id}&order=creado_en.asc`, { method: 'GET' }),
    sbFetch(`historial_envios?jornada_id=eq.${jornada.id}&order=registrado_en.asc`, { method: 'GET' }),
    sbFetch(`historial_errores?jornada_id=eq.${jornada.id}&order=registrado_en.asc`, { method: 'GET' })
  ]);

  return { jornada, detalles, histEnvios, histErrores };
}

async function updateJornada(jornadaId, patch) {
  const rows = await sbFetch(`jornadas?id=eq.${jornadaId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

async function insertMovimientosDetalle(jornadaId, detalles) {
  if (!detalles || detalles.length === 0) return [];
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });
  const rows = detalles.map(d => ({
    jornada_id: jornadaId,
    item:       d.item,
    tipo:       d.tipo.toLowerCase().includes('interdeposito') ? 'Interdeposito' : 'Retiro',
    cantidad:   d.cantidad,
    deposito:   d.deposito
  }));
  return sbFetch('movimientos_detalle', { method: 'POST', body: JSON.stringify(rows) });
}

async function appendHistorial(tabla, jornadaId, horaLabel, total) {
  return sbFetch(tabla, { method: 'POST', body: JSON.stringify({ jornada_id: jornadaId, hora_label: horaLabel, total }) });
}

async function resetJornada(jornadaId) {
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });
  await sbFetch(`historial_envios?jornada_id=eq.${jornadaId}`,    { method: 'DELETE', headers: { 'Prefer': '' } });
  await sbFetch(`historial_errores?jornada_id=eq.${jornadaId}`,   { method: 'DELETE', headers: { 'Prefer': '' } });
  return updateJornada(jornadaId, {
    colecta: 0, flex: 0, turbo: 0, andreani: 0,
    errores: 0, interdeposito: 0, retiros: 0, items_diferentes: 0
  });
}

async function resetMovimientos(jornadaId) {
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });
  return updateJornada(jornadaId, { interdeposito: 0, retiros: 0, items_diferentes: 0 });
}

// ─────────────────────────────────────────────
// ADVANCED STOCK MANAGEMENT
// ─────────────────────────────────────────────
async function insertStockMovimiento(mov) {
  // mov: { sku, tipo, cantidad, deposito_origen, deposito_destino }
  return await sbFetch('stock_movimientos', {
    method: 'POST',
    body: JSON.stringify({
      sku: mov.sku,
      tipo: mov.tipo,
      cantidad: parseInt(mov.cantidad),
      deposito_origen: mov.deposito_origen,
      deposito_destino: mov.deposito_destino,
      creado_por: currentSession?.user?.id
    })
  });
}

async function getMovimientosBySku(sku) {
  return await sbFetch(`stock_movimientos?sku=eq.${sku}&order=fecha.desc`, { method: 'GET' });
}

async function getStockSummaryBySku(sku) {
  const movs = await getMovimientosBySku(sku);
  const stock = { 'Gaona 3735': 0, 'Concordia 926': 0 };
  
  movs.forEach(m => {
    if (m.tipo === 'Ingreso') {
      if (m.deposito_destino) stock[m.deposito_destino] += m.cantidad;
    } else if (m.tipo === 'Retiro') {
      if (m.deposito_origen) stock[m.deposito_origen] -= m.cantidad;
    } else if (m.tipo === 'Interdeposito') {
      if (m.deposito_origen) stock[m.deposito_origen] -= m.cantidad;
      if (m.deposito_destino) stock[m.deposito_destino] += m.cantidad;
    }
  });
  
  return stock;
}

