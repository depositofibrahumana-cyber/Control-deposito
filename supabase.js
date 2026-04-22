/* ============================================================
   SUPABASE CLIENT - Deposito Fibra Fitness
   Proyecto: veexubtrpaplivoyuuli
   ============================================================ */

const SUPABASE_URL  = 'https://veexubtrpaplivoyuuli.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZXh1YnRycGFwbGl2b3l1dWxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzA4NzIsImV4cCI6MjA5MjAwNjg3Mn0.LYld-iKM_Mtn0YfO1omEfnsyRFG1btXQyAt5ctheP78';

// ─────────────────────────────────────────────
// Helper: llamada genérica a la REST API de Supabase
// ─────────────────────────────────────────────
async function sbFetch(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'Content-Type':  'application/json',
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Prefer':        'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error [${res.status}]: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

// ─────────────────────────────────────────────
// Obtener la jornada del día (crea una si no existe)
// ─────────────────────────────────────────────
async function getOrCreateJornada() {
  const today = new Date().toISOString().slice(0, 10);

  // Buscar jornada de hoy
  const rows = await sbFetch(`jornadas?fecha=eq.${today}&limit=1`, { method: 'GET' });
  if (rows.length > 0) return rows[0];

  // Crear jornada nueva para hoy
  const created = await sbFetch('jornadas', {
    method: 'POST',
    body: JSON.stringify({ fecha: today })
  });
  return Array.isArray(created) ? created[0] : created;
}

// ─────────────────────────────────────────────
// Leer estado completo (jornada + detalles)
// ─────────────────────────────────────────────
async function getDashboardData() {
  const jornada = await getOrCreateJornada();

  // Obtener detalles de movimientos
  const detalles = await sbFetch(
    `movimientos_detalle?jornada_id=eq.${jornada.id}&order=creado_en.asc`,
    { method: 'GET' }
  );

  // Obtener historial de envíos y errores
  const histEnvios  = await sbFetch(`historial_envios?jornada_id=eq.${jornada.id}&order=registrado_en.asc`, { method: 'GET' });
  const histErrores = await sbFetch(`historial_errores?jornada_id=eq.${jornada.id}&order=registrado_en.asc`, { method: 'GET' });

  return { jornada, detalles, histEnvios, histErrores };
}

// ─────────────────────────────────────────────
// Actualizar totales de la jornada
// ─────────────────────────────────────────────
async function updateJornada(jornadaId, patch) {
  const rows = await sbFetch(`jornadas?id=eq.${jornadaId}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=representation' },
    body:    JSON.stringify(patch)
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

// ─────────────────────────────────────────────
// Insertar detalles de movimientos
// ─────────────────────────────────────────────
async function insertMovimientosDetalle(jornadaId, detalles) {
  if (!detalles || detalles.length === 0) return [];

  // Primero borramos los detalles anteriores de esta jornada para evitar duplicados al recargar Excel
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });

  const rows = detalles.map(d => ({
    jornada_id: jornadaId,
    item:       d.item,
    tipo:       d.tipo.charAt(0).toUpperCase() + d.tipo.slice(1).toLowerCase().includes('interdeposito') ? 'Interdeposito' : 'Retiro',
    cantidad:   d.cantidad,
    deposito:   d.deposito
  }));

  return sbFetch('movimientos_detalle', { method: 'POST', body: JSON.stringify(rows) });
}

// ─────────────────────────────────────────────
// Guardar punto de historial (envíos o errores)
// ─────────────────────────────────────────────
async function appendHistorial(tabla, jornadaId, horaLabel, total) {
  return sbFetch(tabla, {
    method: 'POST',
    body: JSON.stringify({ jornada_id: jornadaId, hora_label: horaLabel, total })
  });
}

// ─────────────────────────────────────────────
// Resetear jornada completa
// ─────────────────────────────────────────────
async function resetJornada(jornadaId) {
  // Borrar detalles en cascada y resetear totales
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });
  await sbFetch(`historial_envios?jornada_id=eq.${jornadaId}`,    { method: 'DELETE', headers: { 'Prefer': '' } });
  await sbFetch(`historial_errores?jornada_id=eq.${jornadaId}`,   { method: 'DELETE', headers: { 'Prefer': '' } });

  return updateJornada(jornadaId, {
    colecta: 0, flex: 0, turbo: 0, andreani: 0,
    errores: 0, interdeposito: 0, retiros: 0, items_diferentes: 0
  });
}

// ─────────────────────────────────────────────
// Resetear SOLO movimientos
// ─────────────────────────────────────────────
async function resetMovimientos(jornadaId) {
  await sbFetch(`movimientos_detalle?jornada_id=eq.${jornadaId}`, { method: 'DELETE', headers: { 'Prefer': '' } });
  return updateJornada(jornadaId, { interdeposito: 0, retiros: 0, items_diferentes: 0 });
}
