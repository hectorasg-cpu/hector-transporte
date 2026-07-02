window.__appVersion = 'avisos-20260702a';
const state = {
  clients: [
    { id: "c1", name: "Distribuidora Norte", contact: "Ana Morales", phone: "+56 9 6123 4455", city: "Santiago" },
    { id: "c2", name: "Supermercados del Valle", contact: "Luis Tapia", phone: "+56 9 7345 2211", city: "Rancagua" },
    { id: "c3", name: "Ferreteria Central", contact: "Paula Rojas", phone: "+56 9 8456 7812", city: "Valparaiso" }
  ],
  trucks: [
    { id: "t1", plate: "JK-2345", model: "Volvo VM", capacity: "12 ton", status: "Disponible" },
    { id: "t2", plate: "LR-9087", model: "Mercedes Atego", capacity: "8 ton", status: "En ruta" },
    { id: "t3", plate: "PX-4412", model: "Scania P", capacity: "16 ton", status: "Mantencion" }
  ],
  tractorTrailers: [
    { id: "tc1", type: "Tractor", plate: "TR-001", model: "John Deere 5075E", capacity: "75 HP", status: "Disponible" },
    { id: "tc2", type: "Coloso", plate: "CO-014", model: "Coloso agricola", capacity: "8 ton", status: "Disponible" }
  ],
  drivers: [
    { id: "d1", name: "Carlos Vega", phone: "+56 9 5566 7788", license: "A5", status: "Disponible" },
    { id: "d2", name: "Marcela Soto", phone: "+56 9 2221 9090", license: "A4", status: "En ruta" },
    { id: "d3", name: "Jorge Pino", phone: "+56 9 3004 1188", license: "A5", status: "Descanso" }
  ],
  helpers: [
    { id: "p1", name: "Nicolas Araya", phone: "+56 9 4112 8890", status: "Disponible" },
    { id: "p2", name: "Valentina Diaz", phone: "+56 9 6880 5511", status: "En ruta" },
    { id: "p3", name: "Manuel Cortes", phone: "+56 9 7330 1290", status: "Disponible" }
  ],
  orders: [
    { id: "o1", code: "PED-1001", origin: "Santiago", date: "2026-06-30", truckId: "t2", driverId: "d2", status: "En ruta", helperIds: ["p2"], settlement: { finished: false, driverSettled: false, helpersSettled: false, returnedAmount: "", notes: "" }, stops: [{ clientId: "c1", destination: "La Serena" }, { clientId: "c3", destination: "Coquimbo" }] },
    { id: "o2", code: "PED-1002", origin: "Rancagua", date: "2026-07-01", truckId: "t1", driverId: "d1", status: "Terminado", helperIds: ["p1", "p3"], settlement: { finished: true, driverSettled: false, helpersSettled: true, returnedAmount: "45000", notes: "Peonetas rindieron gastos de descarga." }, stops: [{ clientId: "c2", destination: "Santiago" }] },
    { id: "o3", code: "PED-1003", origin: "Valparaiso", date: "2026-07-03", truckId: "t1", driverId: "d3", status: "Terminado", helperIds: [], settlement: { finished: true, driverSettled: true, helpersSettled: true, returnedAmount: "18000", notes: "Dinero recibido al cierre." }, stops: [{ clientId: "c3", destination: "Concepcion" }] }
  ]
};

const STORAGE_KEY = 'transporte-pedidos-v1';
let serverMode = false;

function setSyncStatus(text) {
  const target = document.querySelector('#syncStatus');
  if (target) target.textContent = text;
}

async function loadSavedState() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Sin servidor');
    const saved = await response.json();
    if (saved && saved.clients && saved.orders) Object.assign(state, saved);
    serverMode = true;
    setSyncStatus('Servidor conectado');
  } catch (error) {
    serverMode = false;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && saved.clients && saved.orders) Object.assign(state, saved);
      setSyncStatus('Modo local');
    } catch (localError) {
      setSyncStatus('Modo local');
    }
  }
}

async function saveState() {
  if (serverMode) {
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    if (!response.ok) throw new Error('No se pudo guardar en el servidor');
    setSyncStatus('Guardado en servidor');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'transporte-datos.json';
  link.click();
  URL.revokeObjectURL(url);
}

function importState(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.clients || !imported.orders) throw new Error('Formato invalido');
      Object.assign(state, imported);
      await saveState();
      renderAll();
      alert('Datos importados correctamente.');
    } catch (error) {
      alert('No se pudo importar el archivo.');
    }
  };
  reader.readAsText(file);
}

const labels = { Disponible: "ready", Programado: "ready", "En ruta": "transit", Terminado: "ready", Pendiente: "pending", Mantencion: "maintenance", Descanso: "offline", Arrendado: "rented" };
const week = [["2026-06-29", "Lunes"], ["2026-06-30", "Martes"], ["2026-07-01", "Miercoles"], ["2026-07-02", "Jueves"], ["2026-07-03", "Viernes"], ["2026-07-04", "Sabado"], ["2026-07-05", "Domingo"]];
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function byId(collection, id) { return state[collection].find((item) => item.id === id); }
function badge(status) { return '<span class="badge ' + (labels[status] || "ready") + '">' + status + '</span>'; }
function settlementBadge(order) { const status = settlementStatus(order); const klass = status === 'Rendido' ? 'settled' : status === 'Parcial' ? 'partial' : 'unsettled'; return '<span class="badge ' + klass + '">' + status + '</span>'; }
function nextId(collection, prefix) { return prefix + (state[collection].length + 1) + '-' + Date.now().toString(36); }
function setView(viewId) { $$('.view').forEach((view) => view.classList.toggle('active', view.id === viewId)); $$('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === viewId)); }
function formatDate(value) { return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value + 'T12:00:00')); }
function shortDate(value) { return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit' }).format(new Date(value + 'T12:00:00')); }
function money(value) { const amount = Number(value || 0); return amount ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount) : 'Sin monto'; }
function escapeAttr(value) { return String(value || '').replaceAll('&', '&amp;').replaceAll('\"', '&quot;').replaceAll('<', '&lt;'); }
function isoDateOffset(days) { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function tomorrowDate() { return isoDateOffset(1); }
function notificationPermission() { return 'Notification' in window ? Notification.permission : 'unsupported'; }
function tomorrowAlerts() {
  const targetDate = tomorrowDate();
  const tomorrowOrders = state.orders.filter((order) => order.date === targetDate);
  const maintenanceTrucks = state.trucks.filter((truck) => truck.status === 'Mantencion');
  const assignedMaintenance = tomorrowOrders.map((order) => byId('trucks', order.truckId)).filter((truck) => truck?.status === 'Mantencion');
  const alerts = [];
  if (tomorrowOrders.length) {
    alerts.push({ type: 'trip', title: 'Mañana hay viaje', detail: tomorrowOrders.map((order) => order.code + ' - ' + orderDestinations(order)).join(' | ') });
  }
  if (tomorrowOrders.length && maintenanceTrucks.length) {
    const assignedText = assignedMaintenance.length ? ' Asignado en mantencion: ' + assignedMaintenance.map((truck) => truck.plate).join(', ') + '.' : '';
    alerts.push({ type: 'maintenance', title: 'Mañana hay viaje y hay camión en mantención', detail: 'Camiones en mantención: ' + maintenanceTrucks.map((truck) => truck.plate).join(', ') + '.' + assignedText });
  }
  return alerts;
}
function renderAlerts() {
  const container = $('#alertsList');
  if (!container) return;
  const alerts = tomorrowAlerts();
  const permission = notificationPermission();
  const button = $('#enableNotifications');
  if (button) {
    button.hidden = permission !== 'default';
    button.textContent = 'Activar notificaciones';
  }
  if (!alerts.length) {
    container.innerHTML = '<article class="alert-item"><strong>Sin avisos para mañana</strong><span>No hay viajes programados para el día siguiente.</span></article>';
    return;
  }
  container.innerHTML = alerts.map((alert) => '<article class="alert-item ' + alert.type + '"><strong>' + alert.title + '</strong><span>' + alert.detail + '</span></article>').join('');
}
function sendBrowserNotifications(force = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const alerts = tomorrowAlerts();
  if (!alerts.length) return;
  const key = 'transport-alerts-' + tomorrowDate() + '-' + alerts.map((alert) => alert.title + alert.detail).join('|');
  if (!force && localStorage.getItem(key)) return;
  alerts.forEach((alert) => new Notification(alert.title, { body: alert.detail }));
  localStorage.setItem(key, 'sent');
}
async function enableBrowserNotifications() {
  if (!('Notification' in window)) { alert('Este navegador no permite notificaciones.'); return; }
  const permission = await Notification.requestPermission();
  renderAlerts();
  if (permission === 'granted') sendBrowserNotifications(true);
}

function orderStops(order) { return order.stops || [{ clientId: order.clientId, destination: order.destination }]; }
function orderDestinations(order) { return orderStops(order).map((stop) => stop.destination).filter(Boolean).join(', '); }
function normalizedStop(stop = {}, index = 0) { return { clientId: stop.clientId || '', destination: stop.destination || '', bottles: stop.bottles ?? stop.botellas ?? '', drums: stop.drums ?? stop.bidones ?? '', collectPayment: Boolean(stop.collectPayment || stop.requiresPayment), collectionAmount: stop.collectionAmount ?? stop.amount ?? '', paymentStatus: stop.paymentStatus || (stop.collectPayment || stop.requiresPayment ? 'Pendiente' : 'No aplica'), notes: stop.notes || stop.detail || '' }; }
function operationalStops(order) { return orderStops(order).map(normalizedStop); }
function stopTotals(order) { return operationalStops(order).reduce((totals, stop) => { totals.drums += Number(stop.drums || 0); totals.bottles += Number(stop.bottles || 0); if (stop.collectPayment) totals.collection += Number(stop.collectionAmount || 0); return totals; }, { drums: 0, bottles: 0, collection: 0 }); }
function orderHelpers(order) { return (order.helperIds || []).map((id) => byId('helpers', id)).filter(Boolean); }
function helpersSummary(order) { const helpers = orderHelpers(order); return helpers.length ? helpers.map((helper) => helper.name).join(', ') : '<span class="muted-cell">Sin peonetas</span>'; }
function normalizedSettlement(order) { return { finished: false, driverSettled: false, helpersSettled: false, returnedAmount: '', notes: '', ...(order.settlement || {}) }; }
function settlementStatus(order) { const settlement = normalizedSettlement(order); if (!settlement.finished) return 'No terminado'; const hasHelpers = orderHelpers(order).length > 0; if (settlement.driverSettled && (!hasHelpers || settlement.helpersSettled)) return 'Rendido'; if (settlement.driverSettled || settlement.helpersSettled || settlement.returnedAmount) return 'Parcial'; return 'Por rendir'; }
function settlementSummary(order) { const settlement = normalizedSettlement(order); const totals = stopTotals(order); const returned = Number(settlement.returnedAmount || 0); const diff = returned - totals.collection; const diffClass = diff === 0 ? 'ok' : 'warn'; return '<div class="settlement-summary">' + settlementBadge(order) + '<span>Conductor: ' + (settlement.driverSettled ? 'rendido' : 'pendiente') + '</span><span>Peonetas: ' + (orderHelpers(order).length ? (settlement.helpersSettled ? 'rendido' : 'pendiente') : 'sin peonetas') + '</span><span>Cobros esperados: ' + money(totals.collection) + '</span><span>Vuelto: ' + money(settlement.returnedAmount) + '</span><span class="collection-diff ' + diffClass + '">Diferencia: ' + money(diff) + '</span></div>'; }
function stopsSummary(order) { const totals = stopTotals(order); return '<div class="route-list">' + operationalStops(order).map((stop, index) => { const client = byId('clients', stop.clientId); const payment = stop.collectPayment ? ' · Cobro ' + money(stop.collectionAmount) + ' (' + stop.paymentStatus + ')' : ''; return '<span><strong>' + (index + 1) + '. ' + (client?.name || 'Sin cliente') + '</strong> a ' + (stop.destination || 'Sin destino') + '<em> · ' + Number(stop.drums || 0) + ' bidones · ' + Number(stop.bottles || 0) + ' botellas' + payment + '</em></span>'; }).join('') + '<span class="totals-line">Total: ' + totals.drums + ' bidones · ' + totals.bottles + ' botellas · ' + money(totals.collection) + ' por cobrar</span></div>'; }

function renderDashboard() {
  $('#metricOrders').textContent = state.orders.length;
  $('#metricClients').textContent = state.clients.length;
  $('#metricTrucks').textContent = state.trucks.filter((truck) => truck.status !== 'Mantencion').length;
  $('#metricTractorTrailers').textContent = state.tractorTrailers.filter((item) => item.status !== 'Mantencion').length;
  $('#metricDrivers').textContent = state.drivers.filter((driver) => driver.status === 'Disponible').length;
  $('#metricHelpers').textContent = state.helpers.filter((helper) => helper.status === 'Disponible').length;
  $('#metricSettlement').textContent = state.orders.filter((order) => ['Por rendir', 'Parcial'].includes(settlementStatus(order))).length;
  $('#upcomingOrders').innerHTML = state.orders.slice().sort((a, b) => a.date.localeCompare(b.date)).map((order) => '<article class="item"><strong>' + order.code + ' - ' + orderStops(order).length + ' parada(s)</strong><span>Origen: ' + order.origin + ' - Destinos: ' + orderDestinations(order) + '</span><span>' + stopsSummary(order) + '</span><span>' + badge(order.status) + ' ' + settlementBadge(order) + '</span></article>').join('');
  $('#fleetStatus').innerHTML = state.trucks.map((truck) => '<article class="item"><strong>' + truck.plate + ' - ' + truck.model + '</strong><span>' + truck.capacity + '</span><span>' + badge(truck.status) + '</span></article>').join('');
  renderAlerts();
  sendBrowserNotifications();
}
function renderOrders() { $('#ordersTable').innerHTML = state.orders.map((order) => { const truck = byId('trucks', order.truckId), driver = byId('drivers', order.driverId); return '<tr><td>' + order.code + '</td><td>' + stopsSummary(order) + '</td><td>' + order.origin + '</td><td>' + formatDate(order.date) + '</td><td>' + (truck?.plate || 'Sin camion') + '</td><td>' + (driver?.name || 'Sin conductor') + '</td><td>' + helpersSummary(order) + '</td><td>' + badge(order.status) + '</td><td>' + settlementSummary(order) + '</td><td><div class="actions"><button class="text-button" data-edit="orders" data-id="' + order.id + '">Editar</button><button class="text-button" data-delete="orders" data-id="' + order.id + '">Eliminar</button></div></td></tr>'; }).join(''); }
function renderClients() { $('#clientsTable').innerHTML = state.clients.map((client) => '<tr><td>' + client.name + '</td><td>' + client.contact + '</td><td>' + client.phone + '</td><td>' + client.city + '</td><td><div class="actions"><button class="text-button" data-edit="clients" data-id="' + client.id + '">Editar</button><button class="text-button" data-delete="clients" data-id="' + client.id + '">Eliminar</button></div></td></tr>').join(''); }
function renderTrucks() { $('#trucksTable').innerHTML = state.trucks.map((truck) => '<tr><td>' + truck.plate + '</td><td>' + truck.model + '</td><td>' + truck.capacity + '</td><td>' + badge(truck.status) + '</td><td><div class="actions"><button class="text-button" data-edit="trucks" data-id="' + truck.id + '">Editar</button><button class="text-button" data-delete="trucks" data-id="' + truck.id + '">Eliminar</button></div></td></tr>').join(''); }
function renderTractorTrailers() { $('#tractorTrailersTable').innerHTML = state.tractorTrailers.map((item) => '<tr><td>' + item.type + '</td><td>' + item.plate + '</td><td>' + item.model + '</td><td>' + item.capacity + '</td><td>' + badge(item.status) + '</td><td><div class="actions"><button class="text-button" data-edit="tractorTrailers" data-id="' + item.id + '">Editar</button><button class="text-button" data-delete="tractorTrailers" data-id="' + item.id + '">Eliminar</button></div></td></tr>').join(''); }
function renderDrivers() { $('#driversTable').innerHTML = state.drivers.map((driver) => '<tr><td>' + driver.name + '</td><td>' + driver.phone + '</td><td>' + driver.license + '</td><td>' + badge(driver.status) + '</td><td><div class="actions"><button class="text-button" data-edit="drivers" data-id="' + driver.id + '">Editar</button><button class="text-button" data-delete="drivers" data-id="' + driver.id + '">Eliminar</button></div></td></tr>').join(''); }
function renderHelpers() { $('#helpersTable').innerHTML = state.helpers.map((helper) => '<tr><td>' + helper.name + '</td><td>' + helper.phone + '</td><td>' + badge(helper.status) + '</td><td><div class="actions"><button class="text-button" data-edit="helpers" data-id="' + helper.id + '">Editar</button><button class="text-button" data-delete="helpers" data-id="' + helper.id + '">Eliminar</button></div></td></tr>').join(''); }
function renderCalendar() { $('#weeklyCalendar').innerHTML = week.map(([date, day]) => { const orders = state.orders.filter((order) => order.date === date); const cards = orders.length ? orders.map((order) => { const driver = byId('drivers', order.driverId); return '<article class="calendar-card"><strong>' + order.code + '</strong><span>Origen: ' + order.origin + '</span><span>' + orderStops(order).length + ' parada(s): ' + orderDestinations(order) + '</span><span>' + (driver?.name || 'Sin conductor') + '</span><span>' + settlementStatus(order) + '</span></article>'; }).join('') : '<article class="calendar-card"><strong>Sin pedidos</strong><span>Disponible</span></article>'; return '<section class="day"><h3>' + day + ' - ' + shortDate(date) + '</h3>' + cards + '</section>'; }).join(''); }
function renderAll() { renderDashboard(); renderOrders(); renderClients(); renderTrucks(); renderTractorTrailers(); renderDrivers(); renderHelpers(); renderCalendar(); }

const schemas = {
  clients: { title: 'Cliente', prefix: 'c', fields: [['name', 'Nombre', 'text'], ['contact', 'Contacto', 'text'], ['phone', 'Telefono', 'tel'], ['city', 'Ciudad', 'text']] },
  trucks: { title: 'Camion', prefix: 't', fields: [['plate', 'Patente', 'text'], ['model', 'Modelo', 'text'], ['capacity', 'Capacidad', 'text'], ['status', 'Estado', 'select', ['Disponible', 'En ruta', 'Mantencion']]] },
  tractorTrailers: { title: 'Tractor/Coloso', prefix: 'tc', fields: [['type', 'Tipo', 'select', ['Tractor', 'Coloso']], ['plate', 'Patente/Codigo', 'text'], ['model', 'Modelo', 'text'], ['capacity', 'Capacidad', 'text'], ['status', 'Estado', 'select', ['Disponible', 'En ruta', 'Mantencion', 'Arrendado']]] },
  drivers: { title: 'Conductor', prefix: 'd', fields: [['name', 'Nombre', 'text'], ['phone', 'Telefono', 'tel'], ['license', 'Licencia', 'text'], ['status', 'Estado', 'select', ['Disponible', 'En ruta', 'Descanso']]] },
  helpers: { title: 'Peoneta', prefix: 'p', fields: [['name', 'Nombre', 'text'], ['phone', 'Telefono', 'tel'], ['status', 'Estado', 'select', ['Disponible', 'En ruta', 'Descanso']]] },
  orders: { title: 'Pedido', prefix: 'o', fields: [['code', 'Codigo', 'text'], ['origin', 'Origen', 'text'], ['date', 'Fecha', 'date'], ['truckId', 'Camion', 'trucks'], ['driverId', 'Conductor', 'drivers'], ['status', 'Estado', 'select', ['Pendiente', 'Programado', 'En ruta', 'Terminado']]] }
};
let editing = null;

function defaultValue(collection, key) { if (collection === 'orders' && key === 'code') return 'PED-' + (1000 + state.orders.length + 1); if (key === 'date') return '2026-07-02'; if (key === 'status') return collection === 'orders' ? 'Pendiente' : 'Disponible'; if (key === 'truckId') return state.trucks[0]?.id || ''; if (key === 'driverId') return state.drivers[0]?.id || ''; return ''; }
function fieldSelect(key, label, value, options) { const normalized = options.map((option) => Array.isArray(option) ? option : [option, option]); return '<div class="field"><label for="' + key + '">' + label + '</label><select id="' + key + '" name="' + key + '" required>' + normalized.map(([optionValue, optionLabel]) => '<option value="' + optionValue + '" ' + (optionValue === value ? 'selected' : '') + '>' + optionLabel + '</option>').join('') + '</select></div>'; }
function inputField(key, label, type, value) { return '<div class="field"><label for="' + key + '">' + label + '</label><input id="' + key + '" name="' + key + '" type="' + type + '" value="' + escapeAttr(value) + '" required></div>'; }
function stopRow(stop = {}, index = 0) { stop = normalizedStop(stop, index); const clientOptions = state.clients.map((client) => '<option value="' + client.id + '" ' + (client.id === stop.clientId ? 'selected' : '') + '>' + client.name + '</option>').join(''); return '<div class="stop-row stop-row-ops"><div class="stop-order"><strong>Parada ' + (index + 1) + '</strong><div class="move-buttons"><button type="button" class="ghost-button" data-move-stop="up">↑</button><button type="button" class="ghost-button" data-move-stop="down">↓</button></div></div><div class="field"><label>Cliente</label><select name="stopClient" required>' + clientOptions + '</select></div><div class="field"><label>Destino</label><input name="stopDestination" type="text" value="' + escapeAttr(stop.destination || '') + '" placeholder="Ciudad o direccion" required></div><div class="field"><label>Bidones</label><input name="stopDrums" type="number" min="0" step="1" value="' + escapeAttr(stop.drums) + '" placeholder="0"></div><div class="field"><label>Botellas</label><input name="stopBottles" type="number" min="0" step="1" value="' + escapeAttr(stop.bottles) + '" placeholder="0"></div><div class="field"><label>Cobro fisico</label><select name="stopCollectPayment"><option value="no" ' + (!stop.collectPayment ? 'selected' : '') + '>No</option><option value="yes" ' + (stop.collectPayment ? 'selected' : '') + '>Si</option></select></div><div class="field"><label>Monto</label><input name="stopCollectionAmount" type="number" min="0" step="100" value="' + escapeAttr(stop.collectionAmount) + '" placeholder="0"></div><div class="field notes-field"><label>Estado cobro</label><select name="stopPaymentStatus"><option value="No aplica" ' + (stop.paymentStatus === 'No aplica' ? 'selected' : '') + '>No aplica</option><option value="Pendiente" ' + (stop.paymentStatus === 'Pendiente' ? 'selected' : '') + '>Pendiente</option><option value="Cobrado" ' + (stop.paymentStatus === 'Cobrado' ? 'selected' : '') + '>Cobrado</option></select><input name="stopNotes" type="text" value="' + escapeAttr(stop.notes) + '" placeholder="Observacion"></div><button type="button" class="text-button" data-remove-stop>Quitar</button></div>'; }
function rerenderStopNumbers() { $('.stop-row').forEach((row, index) => { const label = row.querySelector('.stop-order strong'); if (label) label.textContent = 'Parada ' + (index + 1); }); }
function stopsEditor(stops) { const normalized = stops.map(normalizedStop); return '<section class="stops-editor"><div class="stops-title"><strong>Paradas del viaje</strong><button type="button" class="ghost-button" data-add-stop>Agregar parada</button></div><p class="hint">Agrega una fila por cada visita en el orden real de la ruta.</p><div id="stopsRows">' + normalized.map((stop, index) => stopRow(stop, index)).join('') + '</div></section>'; }
function helpersEditor(selectedIds = []) { return '<section class="helper-options"><strong>Peonetas del viaje (opcional)</strong><p class="hint">Marca una o mas peonetas si el viaje necesita apoyo. Puedes dejarlo vacio.</p><div class="check-grid">' + state.helpers.map((helper) => '<label class="check-item"><input type="checkbox" name="helperIds" value="' + helper.id + '" ' + (selectedIds.includes(helper.id) ? 'checked' : '') + '> ' + helper.name + '</label>').join('') + '</div></section>'; }
function settlementEditor(order) { const settlement = normalizedSettlement(order); return '<section class="settlement-box"><strong>Rendicion del viaje</strong><p class="hint">Usa esta parte cuando el viaje termina y se recibe el dinero que sobro.</p><div class="settlement-grid"><label class="check-line"><input type="checkbox" name="settlementFinished" ' + (settlement.finished ? 'checked' : '') + '> Viaje terminado</label><label class="check-line"><input type="checkbox" name="driverSettled" ' + (settlement.driverSettled ? 'checked' : '') + '> Rendido con conductor</label><label class="check-line"><input type="checkbox" name="helpersSettled" ' + (settlement.helpersSettled ? 'checked' : '') + '> Rendido con peonetas</label><div class="field"><label for="returnedAmount">Dinero recibido de vuelta</label><input id="returnedAmount" name="returnedAmount" type="number" min="0" step="100" value="' + escapeAttr(settlement.returnedAmount) + '" placeholder="0"></div><div class="field settlement-note"><label for="settlementNotes">Notas de rendicion</label><input id="settlementNotes" name="settlementNotes" type="text" value="' + escapeAttr(settlement.notes) + '" placeholder="Ej: entrego vuelto, faltan comprobantes"></div></div></section>'; }

function openEditor(collection, id) {
  const schema = schemas[collection]; const item = id ? byId(collection, id) : {}; editing = { collection, id };
  $('#editorTitle').textContent = id ? 'Editar ' + schema.title : 'Agregar ' + schema.title;
  const fields = schema.fields.map(([key, label, type, options]) => { const value = item[key] || defaultValue(collection, key); if (type === 'select') return fieldSelect(key, label, value, options); if (type === 'trucks') return fieldSelect(key, label, value, state.trucks.map((truck) => [truck.id, truck.plate + ' - ' + truck.model])); if (type === 'drivers') return fieldSelect(key, label, value, state.drivers.map((driver) => [driver.id, driver.name])); return inputField(key, label, type, value); });
  if (collection === 'orders') { fields.push(stopsEditor(orderStops(item).length ? orderStops(item) : [{ clientId: state.clients[0]?.id || '', destination: '' }])); fields.push(helpersEditor(item.helperIds || [])); if (id) fields.push(settlementEditor(item)); }
  $('#editorFields').innerHTML = fields.join(''); $('#editorForm').onsubmit = saveEditor; $('#editor').showModal();
}
function readStops() { return Array.from(document.querySelectorAll('.stop-row')).map((row) => { const collectPayment = row.querySelector('[name="stopCollectPayment"]').value === 'yes'; return { clientId: row.querySelector('[name="stopClient"]').value, destination: row.querySelector('[name="stopDestination"]').value.trim(), drums: row.querySelector('[name="stopDrums"]').value || '0', bottles: row.querySelector('[name="stopBottles"]').value || '0', collectPayment, collectionAmount: collectPayment ? (row.querySelector('[name="stopCollectionAmount"]').value || '0') : '', paymentStatus: collectPayment ? row.querySelector('[name="stopPaymentStatus"]').value : 'No aplica', notes: row.querySelector('[name="stopNotes"]').value.trim() }; }).filter((stop) => stop.clientId && stop.destination); }
function readSettlement() { return { finished: $('[name="settlementFinished"]')?.checked || false, driverSettled: $('[name="driverSettled"]')?.checked || false, helpersSettled: $('[name="helpersSettled"]')?.checked || false, returnedAmount: $('#returnedAmount')?.value || '', notes: $('#settlementNotes')?.value.trim() || '' }; }
async function saveEditor(event) { try { if (event) event.preventDefault(); setSyncStatus('Guardando...'); const formData = new FormData($('#editorForm')); const schema = schemas[editing.collection]; if (!schema) throw new Error('Formulario no reconocido'); const payload = Object.fromEntries(schema.fields.map(([key]) => [key, formData.get(key)])); if (editing.collection === 'orders') { payload.stops = readStops(); payload.helperIds = Array.from(document.querySelectorAll('[name="helperIds"]:checked')).map((input) => input.value); payload.settlement = editing.id ? readSettlement() : { finished: false, driverSettled: false, helpersSettled: false, returnedAmount: '', notes: '' }; } if (editing.collection === 'orders' && payload.stops.length === 0) throw new Error('Agrega al menos una parada completa'); if (editing.id) { const index = state[editing.collection].findIndex((item) => item.id === editing.id); if (index < 0) throw new Error('No se encontro el registro para editar'); state[editing.collection][index] = { ...state[editing.collection][index], ...payload }; } else { state[editing.collection].push({ id: nextId(editing.collection, schema.prefix), ...payload }); } await saveState(); $('#editor').close(); renderAll(); } catch (error) { console.error(error); setSyncStatus('No se pudo guardar: ' + error.message); } }
async function deleteItem(collection, id) { state[collection] = state[collection].filter((item) => item.id !== id); await saveState(); renderAll(); }

document.addEventListener('click', (event) => { const saveButton = event.target.closest('#saveEditor'); if (saveButton) { saveEditor(event); return; } const closeEditor = event.target.closest('[data-close-editor]'); if (closeEditor) { $('#editor').close(); return; } const tab = event.target.closest('[data-view]'), viewLink = event.target.closest('[data-view-link]'), edit = event.target.closest('[data-edit]'), remove = event.target.closest('[data-delete]'), addStop = event.target.closest('[data-add-stop]'), removeStop = event.target.closest('[data-remove-stop]'); if (tab) setView(tab.dataset.view); if (viewLink) setView(viewLink.dataset.viewLink); if (edit) openEditor(edit.dataset.edit, edit.dataset.id); if (remove) deleteItem(remove.dataset.delete, remove.dataset.id); if (addStop) { $('#stopsRows').insertAdjacentHTML('beforeend', stopRow({ clientId: state.clients[0]?.id || '', destination: '', drums: '', bottles: '', collectPayment: false, collectionAmount: '', paymentStatus: 'No aplica', notes: '' }, $('.stop-row').length)); rerenderStopNumbers(); } if (removeStop) { const rows = $('.stop-row'); if (rows.length > 1) { removeStop.closest('.stop-row').remove(); rerenderStopNumbers(); } } const moveStop = event.target.closest('[data-move-stop]'); if (moveStop) { const row = moveStop.closest('.stop-row'); if (moveStop.dataset.moveStop === 'up' && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling); if (moveStop.dataset.moveStop === 'down' && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row); rerenderStopNumbers(); } });
function on(selector, eventName, handler) { const element = $(selector); if (element) element.addEventListener(eventName, handler); }
on('#newOrder', 'click', () => openEditor('orders'));
on('#newOrderTop', 'click', () => { setView('orders'); openEditor('orders'); });
on('#newClient', 'click', () => openEditor('clients'));
on('#newTruck', 'click', () => openEditor('trucks'));
on('#newTractorTrailer', 'click', () => openEditor('tractorTrailers'));
on('#newDriver', 'click', () => openEditor('drivers'));
on('#newHelper', 'click', () => openEditor('helpers'));
on('#editorForm', 'submit', saveEditor);
on('#saveEditor', 'click', saveEditor);
on('#exportData', 'click', exportState);
on('#importData', 'change', (event) => importState(event.target.files[0]));
on('#enableNotifications', 'click', enableBrowserNotifications);
window.__bottomReached = true; setSyncStatus('Script listo');
loadSavedState().then(renderAll);
