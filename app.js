// ⚠️ PEGAR AQUÍ LA URL DEL APPS SCRIPT (la que termina en /exec)
const API_URL = 'https://script.google.com/macros/s/AKfycbxU7MwNNiwjDVpeYw_TbuNwPQxpjfgEbzytag75PeegiSWuK3sycnZFfyh9FpxUKYB5/exec';

let proveedores = [];
let plan = [];

/* ---------- Utilidades ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function nuevoID() { return 'ID-' + Date.now() + '-' + Math.floor(Math.random()*1000); }

function fechaHoy() {
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function limpiarTelefono(t) {
  if (!t) return '';
  return String(t).replace(/[^0-9]/g, '');
}

function linkWhatsApp(tel) {
  let n = limpiarTelefono(tel);
  if (!n) return null;
  // Si es número argentino local (10 dígitos), agregar 549
  if (n.length === 10) n = '549' + n;
  else if (n.length === 11 && n.startsWith('0')) n = '549' + n.slice(1);
  else if (n.startsWith('54')) { /* ya tiene código país */ }
  else if (n.length > 10 && !n.startsWith('54')) n = '54' + n;
  return 'https://wa.me/' + n;
}

function linkInstagram(ig) {
  if (!ig) return null;
  ig = ig.trim();
  if (ig.startsWith('http')) return ig;
  return 'https://instagram.com/' + ig.replace('@','');
}

/* ---------- Llamadas API ---------- */
async function apiGet(accion) {
  const r = await fetch(`${API_URL}?accion=${accion}`);
  return r.json();
}

async function apiPost(payload) {
  const r = await fetch(API_URL, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' } // evita preflight CORS
  });
  return r.json();
}

/* ---------- Carga inicial ---------- */
async function cargarTodo() {
  try {
    const [prov, pl] = await Promise.all([
      apiGet('listarProveedores'),
      apiGet('listarPlan')
    ]);
    proveedores = (prov.datos || []).filter(p => p.ID);
    plan = (pl.datos || []).filter(p => p.ID);
    renderRecursos();
    renderSeguimiento();
    renderPlan();
    llenarFiltroRubros();
  } catch (err) {
    alert('Error al cargar datos: ' + err.message);
  }
}

/* ---------- Render Recursos ---------- */
function llenarFiltroRubros() {
  const rubros = [...new Set(proveedores.map(p => p.Rubro).filter(Boolean))];
  const sel = $('#filtroRubro');
  const actual = sel.value;
  sel.innerHTML = '<option value="">Todos los rubros</option>' +
    rubros.map(r => `<option>${r}</option>`).join('');
  sel.value = actual;
}

function renderRecursos() {
  const q = $('#buscar').value.toLowerCase();
  const rubro = $('#filtroRubro').value;
  const estado = $('#filtroEstado').value;
  const ocultarDesc = $('#ocultarDescartados').checked;

  const filtrados = proveedores.filter(p => {
    if (ocultarDesc && p.Estado === 'Descartado') return false;
    if (rubro && p.Rubro !== rubro) return false;
    if (estado && p.Estado !== estado) return false;
    if (q) {
      const blob = [p.Nombre, p.Zona, p.Telefono, p.Direccion, p.Instagram, p.Notas]
        .join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  const cont = $('#listaRecursos');
  if (!filtrados.length) { cont.innerHTML = '<p>No hay proveedores que coincidan.</p>'; return; }

  cont.innerHTML = filtrados.map(p => tarjetaProveedor(p)).join('');
  cont.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', manejarAccionProveedor);
  });
}

function tarjetaProveedor(p) {
  const wa = linkWhatsApp(p.Telefono);
  const ig = linkInstagram(p.Instagram);
  const descartado = p.Estado === 'Descartado';
  const estadoClase = 'estado-' + String(p.Estado || '').replace(/\s/g,'');

  return `
    <div class="card ${descartado ? 'descartado' : ''}">
      <h3>${p.Nombre || '(sin nombre)'}</h3>
      <p><span class="badge">${p.Rubro || 'Sin rubro'}</span>
         <span class="badge ${estadoClase}">${p.Estado || 'Nuevo'}</span></p>
      ${p.Zona ? `<p>📍 ${p.Zona}</p>` : ''}
      ${p.Direccion ? `<p>🏠 ${p.Direccion}</p>` : ''}
      ${p.PrecioEstimado ? `<p>💵 ${p.Moneda || 'ARS'} ${p.PrecioEstimado}</p>` : ''}
      ${p.AveriguePrecio === 'Si' && p.QueMeDijeron ? `<p>💬 <em>${p.QueMeDijeron}</em></p>` : ''}
      <div class="row">
        ${wa ? `<a class="wa" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
        ${ig ? `<a class="ig" href="${ig}" target="_blank" rel="noopener">📷 Instagram</a>` : ''}
      </div>
      <div class="row">
        <button class="btn-mini" data-accion="editar" data-id="${p.ID}">✏️ Editar</button>
        <button class="btn-mini" data-accion="precio" data-id="${p.ID}">💲 Precio</button>
        <button class="btn-mini" data-accion="descartar" data-id="${p.ID}">
          ${descartado ? '♻️ Reactivar' : '🚫 Descartar'}
        </button>
      </div>
    </div>`;
}

/* ---------- Render Seguimiento ---------- */
function renderSeguimiento() {
  const conPrecio = proveedores.filter(p => p.AveriguePrecio === 'Si' && p.Estado !== 'Descartado');
  const cont = $('#listaSeguimiento');
  if (!conPrecio.length) { cont.innerHTML = '<p>Todavía no hay precios averiguados.</p>'; return; }

  cont.innerHTML = conPrecio.map(p => {
    const wa = linkWhatsApp(p.Telefono);
    return `
      <div class="card">
        <h3>${p.Nombre}</h3>
        <p><span class="badge">${p.Rubro}</span> <span class="badge">${p.Estado}</span></p>
        ${p.PrecioEstimado ? `<p>💵 <strong>${p.Moneda || 'ARS'} ${p.PrecioEstimado}</strong></p>` : '<p><em>Sin precio cargado</em></p>'}
        ${p.QueMeDijeron ? `<p>💬 ${p.QueMeDijeron}</p>` : ''}
        <div class="row">
          ${wa ? `<a class="wa" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
          <button class="btn-mini" data-accion="precio" data-id="${p.ID}">✏️ Editar precio/respuesta</button>
        </div>
      </div>`;
  }).join('');

  cont.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', manejarAccionProveedor);
  });
}

/* ---------- Render Plan ---------- */
function renderPlan() {
  const cont = $('#listaPlan');
  if (!plan.length) { cont.innerHTML = '<p>No hay ítems en el plan todavía.</p>'; return; }
  cont.innerHTML = plan.map(item => `
    <div class="card">
      <h3>${item.Item}</h3>
      <p><span class="badge">${item.Categoria || 'General'}</span> <span class="badge">${item.Estado || 'Pendiente'}</span></p>
      ${item.Responsable ? `<p>👤 ${item.Responsable}</p>` : ''}
      ${item.FechaLimite ? `<p>📅 ${String(item.FechaLimite).slice(0,10)}</p>` : ''}
      ${item.Prioridad ? `<p>⚡ Prioridad: ${item.Prioridad}</p>` : ''}
      ${item.Notas ? `<p>📝 ${item.Notas}</p>` : ''}
      <div class="row">
        <button class="btn-mini" data-accion="editarPlan" data-id="${item.ID}">✏️ Editar</button>
        <button class="btn-mini" data-accion="togglePlan" data-id="${item.ID}">
          ${item.Estado === 'Hecho' ? '↩️ Marcar pendiente' : '✅ Marcar hecho'}
        </button>
      </div>
    </div>`).join('');

  cont.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', manejarAccionPlan);
  });
}

/* ---------- Acciones proveedor ---------- */
function manejarAccionProveedor(e) {
  const accion = e.currentTarget.dataset.accion;
  const id = e.currentTarget.dataset.id;
  const p = proveedores.find(x => String(x.ID) === String(id));
  if (!p) return;

  if (accion === 'editar') abrirModalProveedor(p);
  if (accion === 'precio') abrirModalPrecio(p);
  if (accion === 'descartar') {
    const nuevo = p.Estado === 'Descartado' ? 'Nuevo' : 'Descartado';
    actualizarProveedor(id, { Estado: nuevo, UltimaActualizacion: fechaHoy() });
  }
}

function abrirModalPrecio(p) {
  const precio = prompt('¿Cuánto te dijeron? (solo número)', p.PrecioEstimado || '');
  if (precio === null) return;
  const moneda = prompt('Moneda (ARS / USD)', p.Moneda || 'ARS') || 'ARS';
  const dijo = prompt('¿Qué te dijeron?', p.QueMeDijeron || '');
  if (dijo === null) return;
  actualizarProveedor(p.ID, {
    PrecioEstimado: precio,
    Moneda: moneda,
    QueMeDijeron: dijo,
    AveriguePrecio: 'Si',
    Estado: p.Estado === 'Nuevo' ? 'Con presupuesto' : p.Estado,
    UltimaActualizacion: fechaHoy()
  });
}

async function actualizarProveedor(id, cambios) {
  const idx = proveedores.findIndex(x => String(x.ID) === String(id));
  if (idx === -1) return;
  proveedores[idx] = { ...proveedores[idx], ...cambios };
  renderRecursos(); renderSeguimiento();
  await apiPost({ accion: 'actualizarProveedor', id, datos: cambios });
}

/* ---------- Modal proveedor ---------- */
function abrirModalProveedor(p = null) {
  const form = $('#formProveedor');
  form.reset();
  $('#modalProvTitulo').textContent = p ? 'Editar proveedor' : 'Agregar proveedor';
  if (p) {
    for (const k in p) if (form[k] !== undefined) form[k].value = p[k];
  } else {
    form.ID.value = nuevoID();
  }
  $('#modalProveedor').classList.add('open');
}

$('#btnNuevo').addEventListener('click', () => abrirModalProveedor());
$('#btnCancelarProv').addEventListener('click', () => $('#modalProveedor').classList.remove('open'));

$('#formProveedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  const esNuevo = !proveedores.some(p => String(p.ID) === String(datos.ID));
  datos.UltimaActualizacion = fechaHoy();
  if (esNuevo) datos.FechaCarga = fechaHoy();

  if (esNuevo) {
    proveedores.push(datos);
    renderRecursos(); llenarFiltroRubros();
    $('#modalProveedor').classList.remove('open');
    await apiPost({ accion: 'agregarProveedor', datos });
  } else {
    const idx = proveedores.findIndex(p => String(p.ID) === String(datos.ID));
    proveedores[idx] = { ...proveedores[idx], ...datos };
    renderRecursos(); renderSeguimiento();
    $('#modalProveedor').classList.remove('open');
    await apiPost({ accion: 'actualizarProveedor', id: datos.ID, datos });
  }
});

/* ---------- Plan ---------- */
function abrirModalPlan(item = null) {
  const form = $('#formPlan');
  form.reset();
  $('#modalPlanTitulo').textContent = item ? 'Editar ítem' : 'Agregar ítem al plan';
  if (item) {
    for (const k in item) if (form[k] !== undefined) form[k].value = item[k];
  } else {
    form.ID.value = nuevoID();
    form.Estado.value = 'Pendiente';
  }
  $('#modalPlan').classList.add('open');
}

$('#btnNuevoPlan').addEventListener('click', () => abrirModalPlan());
$('#btnCancelarPlan').addEventListener('click', () => $('#modalPlan').classList.remove('open'));

$('#formPlan').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  const esNuevo = !plan.some(p => String(p.ID) === String(datos.ID));
  if (esNuevo) {
    plan.push(datos);
    renderPlan();
    $('#modalPlan').classList.remove('open');
    await apiPost({ accion: 'agregarPlan', datos });
  } else {
    const idx = plan.findIndex(p => String(p.ID) === String(datos.ID));
    plan[idx] = { ...plan[idx], ...datos };
    renderPlan();
    $('#modalPlan').classList.remove('open');
    await apiPost({ accion: 'actualizarPlan', id: datos.ID, datos });
  }
});

function manejarAccionPlan(e) {
  const accion = e.currentTarget.dataset.accion;
  const id = e.currentTarget.dataset.id;
  const item = plan.find(x => String(x.ID) === String(id));
  if (!item) return;
  if (accion === 'editarPlan') abrirModalPlan(item);
  if (accion === 'togglePlan') {
    const nuevo = item.Estado === 'Hecho' ? 'Pendiente' : 'Hecho';
    item.Estado = nuevo;
    renderPlan();
    apiPost({ accion: 'actualizarPlan', id, datos: { Estado: nuevo } });
  }
}

/* ---------- Tabs ---------- */
$$('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.tab-btn').forEach(b => b.classList.remove('active'));
    $$('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    $('#tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ---------- Filtros ---------- */
['#buscar','#filtroRubro','#filtroEstado','#ocultarDescartados'].forEach(sel => {
  document.addEventListener('input', (e) => {
    if (e.target.matches(sel)) renderRecursos();
  });
  document.addEventListener('change', (e) => {
    if (e.target.matches(sel)) renderRecursos();
  });
});

/* ---------- Init ---------- */
cargarTodo();
