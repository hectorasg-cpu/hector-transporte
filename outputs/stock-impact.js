(function () {
  if (window.__stockImpactView) return;
  window.__stockImpactView = true;

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
  function bidonColorCode(product) {
    const type = product.wineType || product.type || '';
    if (type.includes('Cabernet')) return 'NEGRO';
    if (type.includes('Blanco-Pipeño') || type.includes('Pipeño')) return 'ROJO';
    if (type.includes('Tinto')) return 'ROJO';
    if (type.includes('Blanco')) return 'VERDE';
    return colorCode(product.capColor || product.color || '');
  }
  function packageCode(product) {
    const volume = product.volume || product;
    if (volume === '5 L') return 'BIDON-5L-' + bidonColorCode(product);
    if (volume === '3 L') return 'BIDON-3L-' + bidonColorCode(product);
    if (volume === '2 L') return 'BIDON-2L-' + bidonColorCode(product);
    if (volume === '1 L') return 'BIDON-1L-' + bidonColorCode(product);
    if (volume === '1.5 L') return 'BOTELLA-1_5L';
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
      { kind: 'Envase', code: packageCode(product), qty: 1 },
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
  function ensureView() {
    const nav = document.querySelector('.tabs');
    if (nav && !document.querySelector('[data-view="stockImpact"]')) {
      const button = document.createElement('button');
      button.className = 'tab';
      button.dataset.view = 'stockImpact';
      button.textContent = 'Impacto stock';
      button.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'stockImpact'));
        document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === 'stockImpact'));
        renderImpact();
      });
      nav.appendChild(button);
    }
    const existingButton = document.querySelector('[data-view="stockImpact"]');
    if (existingButton && !existingButton.dataset.impactBound) {
      existingButton.dataset.impactBound = 'true';
      existingButton.addEventListener('click', () => {
        document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === 'stockImpact'));
        document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.view === 'stockImpact'));
        renderImpact();
      });
    }
    if (!document.querySelector('#stockImpact')) {
      const section = document.createElement('section');
      section.id = 'stockImpact';
      section.className = 'view';
      section.innerHTML = '<div class="section-heading"><div><h2>Impacto en stock</h2><p>Vista informativa. No reserva ni descuenta stock.</p></div><button id="refreshStockImpact" class="ghost-button" type="button">Actualizar</button></div><div class="toolbar" style="grid-template-columns:minmax(180px, 260px) 1fr;margin-bottom:18px"><label><span>Estado</span><select id="stockImpactStatusFilter"><option value="Todos">Todos los estados</option><option value="Ingresado">Ingresado</option><option value="En preparación">En preparación</option><option value="Preparado">Preparado</option><option value="Despachado">Despachado</option><option value="Terminado">Terminado</option><option value="Cancelado">Cancelado</option></select></label><span id="stockImpactFilterHint" class="badge">Todos los estados</span></div><div id="stockImpactSummary" class="metric-grid"></div><section class="panel table-card"><div class="section-heading"><h2>Por pedido</h2><span id="stockImpactCount" class="badge">0</span></div><div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Estado</th><th>Productos</th><th>Insumos calculados</th></tr></thead><tbody id="stockImpactRows"></tbody></table></div></section><section class="panel table-card"><div class="section-heading"><h2>Total insumos</h2></div><div id="stockImpactTotals" class="stack"></div></section>';
      const main = document.querySelector('main.app');
      const editor = document.querySelector('#editor');
      if (main) main.appendChild(section);
      else if (editor) document.body.insertBefore(section, editor);
    }
    const refresh = document.querySelector('#refreshStockImpact');
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = 'true';
      refresh.addEventListener('click', renderImpact);
    }
    const statusFilter = document.querySelector('#stockImpactStatusFilter');
    if (statusFilter && !statusFilter.dataset.bound) {
      statusFilter.dataset.bound = 'true';
      statusFilter.addEventListener('change', renderImpact);
    }
  }
  async function getState() {
    const response = await fetch('/api/state?impact=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo leer pedidos');
    return response.json();
  }
  function componentList(items) {
    return items.length ? items.map((item) => '<span><strong>' + formatNumber(item.qty) + ' x ' + escapeHtml(item.code) + '</strong><small>' + escapeHtml(item.kind) + '</small></span>').join('') : '<span><strong>Sin insumos</strong><small>Pedido sin productos SKU.</small></span>';
  }
  async function renderImpact() {
    ensureView();
    const rowsEl = document.querySelector('#stockImpactRows');
    const totalsEl = document.querySelector('#stockImpactTotals');
    const summaryEl = document.querySelector('#stockImpactSummary');
    if (!rowsEl || !totalsEl || !summaryEl) return;
    try {
      const state = await getState();
      const productsById = new Map((state.products || []).map((product) => [product.id, product]));
      const selectedStatus = document.querySelector('#stockImpactStatusFilter')?.value || 'Todos';
      const allOrders = (state.orders || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const orders = selectedStatus === 'Todos' ? allOrders : allOrders.filter((order) => (order.status || 'Sin estado') === selectedStatus);
      const filterHint = document.querySelector('#stockImpactFilterHint');
      if (filterHint) filterHint.textContent = selectedStatus === 'Todos' ? 'Todos los estados' : selectedStatus;
      const totals = new Map();
      let totalUnits = 0;
      rowsEl.innerHTML = orders.map((order) => {
        const impact = impactForOrder(order, productsById);
        totalUnits += impact.units;
        impact.components.forEach((item) => addImpact(totals, item.code, item.kind, item.qty));
        return '<tr><td><strong>' + escapeHtml(order.code) + '</strong><small>' + escapeHtml(order.date || '') + '</small></td><td><span class="badge ready">' + escapeHtml(order.status || 'Sin estado') + '</span><small>' + statusHelp(order.status) + '</small></td><td>' + formatNumber(impact.units) + ' unidades</td><td><div class="component-list">' + componentList(impact.components) + '</div></td></tr>';
      }).join('') || '<tr><td colspan="4">No hay pedidos para calcular.</td></tr>';
      const totalItems = Array.from(totals.values()).sort((a, b) => a.code.localeCompare(b.code));
      totalsEl.innerHTML = totalItems.length ? totalItems.map((item) => '<article class="item"><strong>' + escapeHtml(item.code) + '</strong><span>' + formatNumber(item.qty) + ' unidades · ' + escapeHtml(item.kind) + '</span></article>').join('') : '<p>Sin insumos calculados.</p>';
      document.querySelector('#stockImpactCount').textContent = orders.length + ' de ' + allOrders.length + ' pedidos';
      summaryEl.innerHTML = '<article class="metric"><span>Pedidos revisados</span><strong>' + orders.length + '</strong></article><article class="metric"><span>Productos en pedidos</span><strong>' + formatNumber(totalUnits) + '</strong></article><article class="metric"><span>Insumos distintos</span><strong>' + totalItems.length + '</strong></article><article class="metric"><span>Filtro activo</span><strong>' + escapeHtml(selectedStatus === 'Todos' ? 'Todos' : selectedStatus) + '</strong></article>'; 
    } catch (error) {
      rowsEl.innerHTML = '<tr><td colspan="4">' + escapeHtml(error.message) + '</td></tr>';
    }
  }
  function start() {
    ensureView();
    renderImpact();
    setInterval(renderImpact, 30000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
