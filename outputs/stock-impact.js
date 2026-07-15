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
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
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
    const brand = brandCode[product.brand] || colorCode(product.brand).slice(0, 6);
    const type = typeCode[product.wineType] || typeCode[product.type] || colorCode(product.wineType || product.type).slice(0, 10);
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
  function ensureView() {
    const nav = document.querySelector('.tabs');
    if (nav && !document.querySelector('[data-view="stockImpact"]')) {
      const button = document.createElement('button');
      button.className = 'tab';
      button.dataset.view = 'stockImpact';
      button.textContent = 'Impacto stock';
      nav.appendChild(button);
    }
    if (!document.querySelector('#stockImpact')) {
      const section = document.createElement('section');
      section.id = 'stockImpact';
      section.className = 'view';
      section.innerHTML = '<div class="section-heading"><div><h2>Impacto en stock</h2><p>Vista informativa. No reserva ni descuenta stock.</p></div><button id="refreshStockImpact" class="ghost-button" type="button">Actualizar</button></div><div id="stockImpactSummary" class="metric-grid"></div><section class="panel table-card"><div class="section-heading"><h2>Por pedido</h2><span id="stockImpactCount" class="badge">0</span></div><div class="table-scroll"><table><thead><tr><th>Pedido</th><th>Estado</th><th>Productos</th><th>Insumos calculados</th></tr></thead><tbody id="stockImpactRows"></tbody></table></div></section><section class="panel table-card"><div class="section-heading"><h2>Total insumos</h2></div><div id="stockImpactTotals" class="stack"></div></section>';
      const main = document.querySelector('main.app');
      const editor = document.querySelector('#editor');
      if (main && editor) document.body.insertBefore(section, editor);
      else if (main) main.appendChild(section);
    }
    const refresh = document.querySelector('#refreshStockImpact');
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = 'true';
      refresh.addEventListener('click', renderImpact);
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
      const orders = (state.orders || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
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
      document.querySelector('#stockImpactCount').textContent = orders.length + ' pedidos';
      summaryEl.innerHTML = '<article class="metric"><span>Pedidos revisados</span><strong>' + orders.length + '</strong></article><article class="metric"><span>Productos en pedidos</span><strong>' + formatNumber(totalUnits) + '</strong></article><article class="metric"><span>Insumos distintos</span><strong>' + totalItems.length + '</strong></article>';
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
