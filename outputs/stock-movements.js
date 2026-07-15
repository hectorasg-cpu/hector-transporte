(function () {
  if (window.__stockMovementsView) return;
  window.__stockMovementsView = true;

  const brandCode = {
    'Tio Lucas': 'TL',
    'Baron del Maule': 'BM',
    'Vinos Saavedra': 'SAAV',
    'Las casas del Morro': 'LCM',
    'Alfonsina': 'ALF',
    'Viña Saavedra': 'VSA'
  };
  const typeCode = {
    'Tinto': 'TIN',
    'Blanco': 'BLA',
    'Blanco-Pipeño': 'BPIPE',
    'Cabernet': 'CAB',
    'Cabernet Varietal': 'CAB-VAR',
    'Cabernet Reserva': 'CAB-RES',
    'Cabernet Gran Reserva': 'CAB-GRES',
    'Carmenere Varietal': 'CAR-VAR',
    'Carmenere Reserva': 'CAR-RES',
    'Carmenere Gran Reserva': 'CAR-GRES',
    'Syrah Reserva': 'SYR-RES',
    'Syrah Gran Reserva': 'SYR-GRES',
    'Dry Farmed': 'DRY',
    'Red Blend': 'RED',
    'Pais Evocare': 'PAI-EVO'
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  }
  function colorCode(value) {
    const clean = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (clean === 'ROJO') return 'ROJA';
    if (clean === 'NEGRO') return 'NEGRA';
    return clean;
  }
  function normKey(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function brandCodeFor(value) {
    const key = normKey(value);
    if (key.includes('tio lucas')) return 'TL';
    if (key.includes('baron del maule')) return 'BM';
    if (key.includes('vinos saavedra')) return 'SAAV';
    if (key.includes('las casas')) return 'LCM';
    if (key.includes('alfonsina')) return 'ALF';
    if (key.includes('vina saavedra')) return 'VSA';
    return colorCode(value).slice(0, 6);
  }
  function typeCodeFor(value) {
    const key = normKey(value);
    if (key === 'tinto') return 'TIN';
    if (key === 'blanco') return 'BLA';
    if (key.includes('pipe')) return 'BPIPE';
    if (key === 'cabernet') return 'CAB';
    if (key.includes('cabernet varietal')) return 'CAB-VAR';
    if (key.includes('cabernet gran reserva')) return 'CAB-GRES';
    if (key.includes('cabernet reserva')) return 'CAB-RES';
    if (key.includes('carmenere varietal')) return 'CAR-VAR';
    if (key.includes('carmenere gran reserva')) return 'CAR-GRES';
    if (key.includes('carmenere reserva')) return 'CAR-RES';
    if (key.includes('syrah gran reserva')) return 'SYR-GRES';
    if (key.includes('syrah reserva')) return 'SYR-RES';
    if (key.includes('dry')) return 'DRY';
    if (key.includes('red blend')) return 'RED';
    if (key.includes('pais')) return 'PAI-EVO';
    return colorCode(value).slice(0, 10);
  }
  function volumeCode(value) {
    return String(value || '').replace('1.5 L', '1_5L').replace('750 CC', '750CC').replace(/s+/g, '');
  }
  function packageCode(volume) {
    if (volume === '5 L') return 'BIDON-5L';
    if (volume === '3 L') return 'BIDON-3L';
    if (volume === '2 L') return 'BIDON-2L';
    if (volume === '1.5 L') return 'BOTELLA-1_5L';
    if (volume === '1 L') return 'BOTELLA-1L';
    return 'BOTELLA-750CC';
  }
  function capColor(product) {
    if ((product.cap || '') === 'Rosca' && (product.wineType || product.type) === 'Tinto' && product.volume === '2 L') return 'burdeo';
    return product.capColor || product.color || '';
  }
  function capCode(product) {
    const prefix = (product.cap || '') === 'Cápsula' ? 'CAPSULA' : 'TAPA-ROSCA';
    return prefix + '-' + colorCode(capColor(product));
  }
  function labelCode(product) {
    const brand = brandCodeFor(product.brand);
    const type = typeCodeFor(product.wineType || product.type);
    return 'ETIQUETA-' + brand + '-' + type + '-' + volumeCode(product.volume);
  }
  function integrationSku(product) {
    return product.integrationSku || product.integrationCode || product.normalizedSku || product.sku || product.id;
  }
  function recipeFor(product) {
    if (!product) return [];
    return [
      { kind: 'Envase', code: packageCode(product.volume), qty: 1 },
      { kind: (product.cap || '') === 'Cápsula' ? 'Capsula' : 'Tapa', code: capCode(product), qty: 1 },
      { kind: 'Etiqueta', code: labelCode(product), qty: 1 }
    ];
  }
  function orderStops(order) {
    return Array.isArray(order.stops) ? order.stops.filter((stop) => !stop.deletedAt && stop.active !== false) : [];
  }
  function normalizedLines(stop) {
    return (Array.isArray(stop.productLines) ? stop.productLines : [])
      .map((line) => ({ productId: line.productId || '', quantity: Number(line.quantity || line.qty || 0) }))
      .filter((line) => line.productId && line.quantity > 0);
  }
  function addImpact(target, code, kind, qty) {
    if (!target.has(code)) target.set(code, { code, kind, qty: 0 });
    target.get(code).qty += qty;
  }
  function impactForOrder(order, productsById) {
    const components = new Map();
    let units = 0;
    for (const stop of orderStops(order)) {
      for (const line of normalizedLines(stop)) {
        const product = productsById.get(line.productId);
        if (!product) continue;
        units += line.quantity;
        for (const component of recipeFor(product)) addImpact(components, component.code, component.kind, line.quantity * component.qty);
      }
    }
    return { units, components: Array.from(components.values()).sort((a, b) => a.code.localeCompare(b.code)) };
  }
  function formatNumber(value) {
    return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 }).format(Number(value || 0));
  }
  function statusHelp(status) {
    if (status === 'Ingresado') return 'No toca stock';
    if (status === 'En preparación') return 'Reserva futura';
    if (status === 'Preparado') return 'Descuento futuro';
    if (status === 'Cancelado') return 'Liberaria reserva';
    return 'Solo seguimiento';
  }

  async function getState() {
    const response = await fetch('/api/state?movements=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo leer pedidos');
    return response.json();
  }
  function movementInfo(currentStatus, targetStatus) {
    if (!targetStatus || targetStatus === 'Todos') return { type: 'none', label: 'Seleccione estado destino', help: 'Elige un estado para simular el movimiento.', affectsStock: false };
    if (currentStatus === targetStatus) return { type: 'none', label: 'Sin cambio', help: 'El pedido ya esta en ese estado.', affectsStock: false };
    if (targetStatus === 'Ingresado') return { type: 'none', label: 'No mueve stock', help: 'Ingresado solo registra el pedido.', affectsStock: false };
    if (targetStatus === 'En preparación') return { type: 'reserve', label: 'Reserva stock', help: 'Apartaria insumos para preparar el pedido.', affectsStock: true };
    if (targetStatus === 'Preparado') {
      if (currentStatus === 'En preparación') return { type: 'consume-reserved', label: 'Descuenta stock reservado', help: 'Convertiria la reserva en descuento real.', affectsStock: true };
      return { type: 'consume', label: 'Descuenta stock', help: 'Descontaria los insumos del inventario.', affectsStock: true };
    }
    if (targetStatus === 'Cancelado') {
      if (currentStatus === 'En preparación') return { type: 'release', label: 'Libera reserva', help: 'Devolveria al disponible lo que estaba reservado.', affectsStock: true };
      if (currentStatus === 'Preparado') return { type: 'manual', label: 'Requiere revision', help: 'Ya estaba preparado; no conviene devolver stock automaticamente.', affectsStock: false };
      return { type: 'none', label: 'No mueve stock', help: 'Si no habia reserva, no hay nada que liberar.', affectsStock: false };
    }
    return { type: 'none', label: 'Solo seguimiento', help: 'Despachado y Terminado no vuelven a mover stock.', affectsStock: false };
  }
  function movementKind(info) {
    if (info.type === 'reserve') return 'Reserva';
    if (info.type === 'consume' || info.type === 'consume-reserved') return 'Descuento';
    if (info.type === 'release') return 'Liberacion de reserva';
    return info.label;
  }
  function componentListForMovement(items, info) {
    if (!info.affectsStock) return '<span><strong>Sin movimiento</strong><small>' + escapeHtml(info.help) + '</small></span>';
    return items.length ? items.map((item) => '<span><strong>' + formatNumber(item.qty) + ' x ' + escapeHtml(item.code) + '</strong><small>' + escapeHtml(movementKind(info)) + ' · ' + escapeHtml(item.kind) + '</small></span>').join('') : '<span><strong>Sin insumos</strong><small>Pedido sin productos SKU.</small></span>';
  }
  function ensureView() {
    const nav = document.querySelector('.tabs');
    if (nav && !document.querySelector('[data-view="stockMovements"]')) {
      const button = document.createElement('button');
      button.className = 'tab';
      button.dataset.view = 'stockMovements';
      button.textContent = 'Movimientos stock';
      button.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'stockMovements'));
        document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === 'stockMovements'));
        renderMovements();
      });
      nav.appendChild(button);
    }
    const existingButton = document.querySelector('[data-view="stockMovements"]');
    if (existingButton && !existingButton.dataset.movementsBound) {
      existingButton.dataset.movementsBound = 'true';
      existingButton.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'stockMovements'));
        document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === 'stockMovements'));
        renderMovements();
      });
    }
    if (!document.querySelector('#stockMovements')) {
      const section = document.createElement('section');
      section.id = 'stockMovements';
      section.className = 'view';
      section.innerHTML = '<div class="section-heading"><div><h2>Movimientos stock</h2><p>Simulacion informativa. No reserva ni descuenta stock real.</p></div><button id="refreshStockMovements" class="ghost-button" type="button">Actualizar</button></div><div class="toolbar" style="grid-template-columns:minmax(180px, 240px) minmax(180px, 240px) 1fr;margin-bottom:18px"><label><span>Estado actual</span><select id="stockMovementCurrentFilter"><option value="Todos">Todos los estados</option><option value="Ingresado">Ingresado</option><option value="En preparación">En preparación</option><option value="Preparado">Preparado</option><option value="Despachado">Despachado</option><option value="Terminado">Terminado</option><option value="Cancelado">Cancelado</option></select></label><label><span>Cambiar a</span><select id="stockMovementTargetStatus"><option value="En preparación">En preparación</option><option value="Preparado">Preparado</option><option value="Cancelado">Cancelado</option><option value="Ingresado">Ingresado</option><option value="Despachado">Despachado</option><option value="Terminado">Terminado</option></select></label><span id="stockMovementHint" class="badge">Simulacion</span></div><div id="stockMovementSummary" class="metric-grid"></div><section class="panel table-card"><div class="section-heading"><h2>Por pedido</h2><span id="stockMovementCount" class="badge">0</span></div><div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Estado actual</th><th>Si cambia a</th><th>Movimiento</th><th>Insumos involucrados</th></tr></thead><tbody id="stockMovementRows"></tbody></table></div></section><section class="panel table-card"><div class="section-heading"><h2>Total movimiento simulado</h2></div><div id="stockMovementTotals" class="stack"></div></section>';
      const main = document.querySelector('main.app');
      const editor = document.querySelector('#editor');
      if (main) main.appendChild(section);
      else if (editor) document.body.insertBefore(section, editor);
    }
    const refresh = document.querySelector('#refreshStockMovements');
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = 'true';
      refresh.addEventListener('click', renderMovements);
    }
    const currentFilter = document.querySelector('#stockMovementCurrentFilter');
    if (currentFilter && !currentFilter.dataset.bound) {
      currentFilter.dataset.bound = 'true';
      currentFilter.addEventListener('change', renderMovements);
    }
    const targetStatus = document.querySelector('#stockMovementTargetStatus');
    if (targetStatus && !targetStatus.dataset.bound) {
      targetStatus.dataset.bound = 'true';
      targetStatus.addEventListener('change', renderMovements);
    }
  }
  async function renderMovements() {
    ensureView();
    const rowsEl = document.querySelector('#stockMovementRows');
    const totalsEl = document.querySelector('#stockMovementTotals');
    const summaryEl = document.querySelector('#stockMovementSummary');
    if (!rowsEl || !totalsEl || !summaryEl) return;
    try {
      const state = await getState();
      const productsById = new Map((state.products || []).map((product) => [product.id, product]));
      const currentFilter = document.querySelector('#stockMovementCurrentFilter')?.value || 'Todos';
      const targetStatus = document.querySelector('#stockMovementTargetStatus')?.value || 'En preparación';
      const allOrders = (state.orders || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const orders = currentFilter === 'Todos' ? allOrders : allOrders.filter((order) => (order.status || 'Sin estado') === currentFilter);
      const totals = new Map();
      let affectedOrders = 0;
      let affectedUnits = 0;
      rowsEl.innerHTML = orders.map((order) => {
        const currentStatus = order.status || 'Sin estado';
        const info = movementInfo(currentStatus, targetStatus);
        const impact = impactForOrder(order, productsById);
        if (info.affectsStock) {
          affectedOrders += 1;
          affectedUnits += impact.units;
          impact.components.forEach((item) => addImpact(totals, item.code, movementKind(info) + ' · ' + item.kind, item.qty));
        }
        return '<tr><td><strong>' + escapeHtml(order.code) + '</strong><small>' + escapeHtml(order.date || '') + '</small></td><td><span class="badge">' + escapeHtml(currentStatus) + '</span></td><td><span class="badge ready">' + escapeHtml(targetStatus) + '</span></td><td><strong>' + escapeHtml(info.label) + '</strong><small>' + escapeHtml(info.help) + '</small></td><td><div class="component-list">' + componentListForMovement(impact.components, info) + '</div></td></tr>';
      }).join('') || '<tr><td colspan="5">No hay pedidos para revisar.</td></tr>';
      const totalItems = Array.from(totals.values()).sort((a, b) => a.code.localeCompare(b.code));
      totalsEl.innerHTML = totalItems.length ? totalItems.map((item) => '<article class="item"><strong>' + escapeHtml(item.code) + '</strong><span>' + formatNumber(item.qty) + ' unidades · ' + escapeHtml(item.kind) + '</span></article>').join('') : '<p>Sin movimiento de stock para esta seleccion.</p>';
      document.querySelector('#stockMovementCount').textContent = orders.length + ' de ' + allOrders.length + ' pedidos';
      const hint = document.querySelector('#stockMovementHint');
      if (hint) hint.textContent = 'Cambio a ' + targetStatus;
      summaryEl.innerHTML = '<article class="metric"><span>Pedidos revisados</span><strong>' + orders.length + '</strong></article><article class="metric"><span>Pedidos con movimiento</span><strong>' + affectedOrders + '</strong></article><article class="metric"><span>Productos afectados</span><strong>' + formatNumber(affectedUnits) + '</strong></article><article class="metric"><span>Insumos distintos</span><strong>' + totalItems.length + '</strong></article>';
    } catch (error) {
      rowsEl.innerHTML = '<tr><td colspan="5">' + escapeHtml(error.message) + '</td></tr>';
    }
  }
  function start() {
    ensureView();
    renderMovements();
    setInterval(renderMovements, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
