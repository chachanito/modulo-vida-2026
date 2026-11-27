/* Controlador de Macro Pesados. El catálogo base se carga antes desde public/js/data/. */
// 2. ESTADO DE LA COTIZACION Y PARAMETRIZACION
// ============================================================
let volumeDiscounts = JSON.parse(JSON.stringify(DEFAULT_VOLUME_DISCOUNTS));
let rates = Object.fromEntries(Object.entries(ORIGINAL_RATES).map(([age, r]) => [age, { bands: r.multiFlat !== null ? [{ min: 0, max: 180000, rate: r.multiFlat }] : r.bands.map((rate, i) => ({ min: [0, 20001, 50001, 100001][i], max: [20000.99, 50000.99, 100000.99, 180000][i], rate })) }])), hinoRates = JSON.parse(JSON.stringify(ORIGINAL_HINO)), vehicles = [], adminUnlocked = false, pendingTab = null;
// ============================================================
// 3. UTILIDADES, FORMATO Y VALIDACIONES GENERALES
// ============================================================
const $ = id => document.getElementById(id), money = n => Number(n || 0).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pct = n => Number(n || 0).toFixed(2).replace('.', ',') + '%';
// ============================================================
// 4. NAVEGACION Y MENSAJES DEL SISTEMA
// ============================================================
function status(t, err = false) { $('status').textContent = t; $('status').className = 'notice' + (err ? ' error' : ''); }
// ============================================================
// 5. CALCULO DE ANTIGUEDAD Y TASAS POR MARCA
// ============================================================
function ageNow(year) { return new Date().getFullYear() - Number(year); }
function multiRate(age, total) { let row = rates[String(age)]; if (!row || !Array.isArray(row.bands))
    return null; let hit = row.bands.find(b => total >= Number(b.min) && total <= Number(b.max)); return hit ? Number(hit.rate) : null; }
function quoteRate(brand, age, total) { const m = multiRate(age, total); const isHino = String(brand).trim().toUpperCase() === 'HINO'; if (isHino) {
    const h = Number(hinoRates[String(age)]);
    if (!Number.isFinite(h))
        return null;
    return { multi: m, hino: h, base: h, rate: h };
} if (!Number.isFinite(m))
    return null; return { multi: m, hino: null, base: m, rate: m }; }
function activate(tab) { document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab)); document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === tab)); }
function fmt(v) { return '$ ' + money(v); }
function parseMoney(value) { if (typeof value === 'number')
    return value; let s = String(value ?? '').trim().replace(/[^0-9,.-]/g, ''); if (!s)
    return 0; if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
}
else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
} let n = Number(s); return Number.isFinite(n) ? n : NaN; }
function normalizeMoneyInput(el) { let n = parseMoney(el.value); if (Number.isFinite(n))
    el.value = money(n); }
// ============================================================
// 6. INGRESO INDIVIDUAL DE VEHICULOS
// ============================================================
function updatePreview() { $('brand').classList.toggle('hino-selected', $('brand').value === 'HINO'); let year = Number($('year').value), val = parseMoney($('insured').value) || 0, extra = parseMoney($('extra').value) || 0, total = val + extra; $('total').value = fmt(total); if (!year || !val) {
    $('calcPreview').textContent = 'Completa marca, año y valor asegurado para calcular la tasa.';
    return;
} let age = ageNow(year), q = quoteRate($('brand').value, age, total); $('calcPreview').textContent = q ? `Antigüedad: ${age} años · ${String($('brand').value).trim().toUpperCase() === 'HINO' ? 'Tasa HINO' : 'Tasa MULTIMARCA'}: ${pct(q.rate)}` : `No existe tasa para antigüedad ${age} o valor asegurado ${fmt(total)}.`; }
function addVehicle() { let brand = $('brand').value, year = Number($('year').value), insured = parseMoney($('insured').value), extra = parseMoney($('extra').value) || 0, model = $('model').value.trim(), plate = $('plate').value.trim(), age = ageNow(year), total = insured + extra; if (!brand)
    return status('Selecciona una marca.', true); if (model.length > 50)
    return status('El modelo no puede superar los 50 caracteres.', true); if (!/^\d{4}$/.test($('year').value.trim()) || !Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)
    return status('El año de fabricación debe contener exactamente 4 dígitos y ser válido.', true); if (!Number.isFinite(insured) || insured <= 0)
    return status('Ingresa un valor asegurado mayor que cero.', true); if (!Number.isFinite(extra) || extra < 0)
    return status('El valor de extras no puede ser negativo.', true); let q = quoteRate(brand, age, total); if (!q)
    return status(`No existe una tasa configurada para la marca ${brand}, antigüedad ${age} y valor asegurado ${fmt(total)}.`, true); vehicles.push({ brand, model, plate, year, age, insured, extra, total, multi: q.multi, hino: q.hino, base: q.base, rate: q.rate, premium: total * q.rate / 100 }); render(); clearForm(false); status('Vehículo agregado y tasa calculada correctamente.'); }
function clearForm(clearStatus = true) { ['brand', 'model', 'plate', 'year', 'insured'].forEach(id => $(id).value = ''); $('extra').value = ''; $('insured').value = ''; updatePreview(); if (clearStatus)
    status('Formulario limpio.'); }
function saveVehicleEdit(i) {
    const v = vehicles[i];
    if (!v)
        return;
    const insured = parseMoney($(`edit-insured-${i}`).value), extra = parseMoney($(`edit-extra-${i}`).value);
    if (!Number.isFinite(insured) || insured <= 0)
        return status('El valor asegurado debe ser mayor que cero.', true);
    if (!Number.isFinite(extra) || extra < 0)
        return status('Los extras no pueden ser negativos.', true);
    const total = round2(insured + extra), q = quoteRate(v.brand, v.age, total);
    if (!q)
        return status(`No existe una tasa configurada para ${v.brand}, antigüedad ${v.age} y valor asegurado ${fmt(total)}. No se guardaron los cambios.`, true);
    vehicles[i] = { ...v, insured, extra, total, multi: q.multi, hino: q.hino, base: q.base, rate: q.rate, premium: round2(total * q.rate / 100) };
    render();
    status(`Vehículo ${i + 1} actualizado. Se recalcularon suma asegurada, tasa y prima.`);
}
function removeVehicle(i) { vehicles.splice(i, 1); render(); status('Vehículo eliminado de la cotización.'); }
function clearVehicles() {
    if (!vehicles.length) {
        status('No existen vehículos ingresados para limpiar.');
        return;
    }
    if (!confirm(`¿Deseas eliminar los ${vehicles.length} vehículos de esta cotización? Esta acción no se puede deshacer.`))
        return;
    vehicles = [];
    // Evita que una cotización guardada anteriormente vuelva a cargar los vehículos eliminados.
    localStorage.removeItem('stor_quote_draft_v2');
    if (typeof bulkPending !== 'undefined') bulkPending = [];
    if ($('bulkPaste')) $('bulkPaste').value = '';
    if ($('bulkPreviewRows')) $('bulkPreviewRows').innerHTML = '';
    if ($('bulkPreviewWrap')) $('bulkPreviewWrap').classList.add('hidden');
    if ($('bulkFeedback')) $('bulkFeedback').textContent = 'Pega aquí las filas copiadas desde Excel para validar antes de agregarlas.';
    if ($('addBulk')) $('addBulk').disabled = true;
    render();
    status('Se eliminaron todos los vehículos. Los datos del cliente y la parametrización se conservaron.');
}
// ============================================================
// 7. DESCUENTOS, RECARGOS Y CALCULO FINANCIERO
// ============================================================
function countVolumeDiscount() { const n = vehicles.length; const exact = volumeDiscounts[String(n)]; if (exact !== undefined)
    return Number(exact) || 0; const keys = Object.keys(volumeDiscounts).map(Number).filter(Number.isFinite).sort((a, b) => a - b); const eligible = keys.filter(k => k <= n); return eligible.length ? Number(volumeDiscounts[String(eligible[eligible.length - 1])]) || 0 : 0; }
function adjustedRate(v) { const afterVolume = round2(v.rate * (1 - countVolumeDiscount() / 100)); const afterDiscount = Math.max(0, afterVolume - Math.max(0, Number($('discount').value) || 0)); const increaseAfterVolume = Math.max(0, Number($('increase').value) || 0); const patrimonial = $('patrimonial').value === 'SÍ' ? 0.30 : 0; return round2(afterDiscount + increaseAfterVolume + patrimonial); }
function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function emissionRight(net) { if (net <= 250.99)
    return 0.50; if (net <= 500.99)
    return 1; if (net <= 1000.99)
    return 3; if (net <= 2000.99)
    return 5; if (net <= 4000.99)
    return 7; return 9; }
function financials() { const insured = vehicles.reduce((s, v) => s + Number(v.total || 0), 0); const avgBaseRaw = vehicles.length ? vehicles.reduce((s, v) => s + Number(v.rate || 0), 0) / vehicles.length : 0; const afterVolume = round2(avgBaseRaw * (1 - countVolumeDiscount() / 100)); const afterDiscount = Math.max(0, afterVolume - Math.max(0, Number($('discount').value) || 0)); const increase = Math.max(0, Number($('increase').value) || 0); const patrimonial = $('patrimonial').value === 'SÍ' ? 0.30 : 0; const avgRate = vehicles.length ? Math.max(3.00, round2(afterDiscount + increase + patrimonial)) : 0; const vehiclePremium = round2(insured * avgRate / 100); const lucro = $('lucro').value === 'SÍ' ? vehicles.length * 200 : 0; const net = round2(vehiclePremium + lucro); const supercias = round2(net * 0.035); const campesino = round2(net * 0.005); const rights = net > 0 ? emissionRight(net) : 0; const iva = round2((net + supercias + campesino + rights) * 0.15); const total = round2(net + supercias + campesino + rights + iva); return { insured, avgRate, vehiclePremium, lucro, net, supercias, campesino, rights, iva, total }; }
function recalcVehicles() { vehicles = vehicles.map(v => { let age = ageNow(v.year), q = quoteRate(v.brand, age, v.total); return q ? { ...v, age, multi: q.multi, hino: q.hino, base: q.base, rate: q.rate, premium: v.total * q.rate / 100 } : { ...v, age, multi: null, hino: null, base: null, rate: null, premium: null }; }); }
// ============================================================
// 8. ACTUALIZACION DE PANTALLAS Y TABLAS
// ============================================================
function render() {
    const f = financials(), total = f.insured, volDisc = countVolumeDiscount();
    const base = vehicles.reduce((s, v) => s + v.total * v.rate / 100, 0), avgBase = vehicles.length ? vehicles.reduce((s, v) => s + Number(v.rate || 0), 0) / vehicles.length : 0;
    const pointsAdj = vehicles.length ? vehicles.reduce((s, v) => s + Math.max(0, v.rate - Math.max(0, Number($('discount').value) || 0)), 0) / vehicles.length : 0;
    const avgApplied = vehicles.length ? Math.round((vehicles.reduce((s, v) => s + adjustedRate(v), 0) / vehicles.length) * 100) / 100 : 0;
    const volDiscAmount = total * Math.max(0, pointsAdj - pointsAdj * (1 - volDisc / 100)) / 100;
    $('countVehicles').textContent = vehicles.length;
    $('kpiSum').textContent = fmt(total);
    $('kpiPremium').textContent = fmt(f.net);
    $('sumInsured').textContent = fmt(total);
    $('premiumBase').textContent = fmt(f.vehiclePremium);
    $('volumeDiscount').textContent = pct(volDisc);
    $('volumeDiscountAmount').textContent = fmt(volDiscAmount);
    $('premiumAfterVolume').textContent = fmt(f.net);
    $('premiumTotal').textContent = fmt(f.total);
    $('baseRate').textContent = vehicles.length ? pct(avgBase) : '—';
    $('appliedRate').textContent = vehicles.length ? pct(f.avgRate) : '—';
    $('lucroAmount').textContent = fmt(f.lucro);
    $('primaNeta').textContent = fmt(f.net);
    $('supercias').textContent = fmt(f.supercias);
    $('socialCampesino').textContent = fmt(f.campesino);
    $('derechosEmision').textContent = fmt(f.rights);
    $('iva').textContent = fmt(f.iva);
    $('dashRows').innerHTML = vehicles.length ? vehicles.map(v => `<tr class="${v.brand === 'HINO' ? 'hino-selected' : ''}"><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${esc(v.plate)}</td><td>${v.year}</td><td>${v.age}</td><td>${fmt(v.total)}</td><td>${pct(v.rate)}</td><td>${fmt(v.total * adjustedRate(v) / 100)}</td></tr>`).join('') : '<tr><td colspan="8">Aún no hay vehículos ingresados.</td></tr>';
    $('vehicleCount').textContent = vehicles.length + ' registros';
    $('vehicleRows').innerHTML = vehicles.length ? vehicles.map((v, i) => `<tr class="${v.brand === 'HINO' ? 'hino-selected' : ''}"><td>${i + 1}</td><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${esc(v.plate)}</td><td>${v.year}</td><td>${v.age}</td><td><input class="edit-money" id="edit-insured-${i}" type="text" inputmode="decimal" value="${money(v.insured)}" aria-label="Valor asegurado vehículo ${i + 1}"></td><td><input class="edit-money" id="edit-extra-${i}" type="text" inputmode="decimal" value="${money(v.extra)}" aria-label="Extras vehículo ${i + 1}"></td><td>${fmt(v.total)}</td><td>${fmt(v.total * adjustedRate(v) / 100)}</td><td><div class="row-actions"><button type="button" onclick="saveVehicleEdit(${i})">Actualizar</button><button class="danger" onclick="removeVehicle(${i})">Quitar</button></div></td></tr>`).join('') : '<tr><td colspan="11">Agrega el primer vehículo.</td></tr>';
    $('resCount').textContent = vehicles.length;
    $('resSum').textContent = fmt(total);
    $('resPremium').textContent = fmt(f.total);
    $('resultsRows').innerHTML = vehicles.length ? vehicles.map(v => `<tr class="${v.brand === 'HINO' ? 'hino-selected' : ''}"><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${esc(v.plate)}</td><td>${v.year}</td><td>${v.age}</td><td>${fmt(v.total)}</td><td>${pct(v.multi)}</td><td>${pct(adjustedRate(v))}</td><td>${fmt(v.total * adjustedRate(v) / 100)}</td><td class="good">OK</td></tr>`).join('') : '<tr><td colspan="11">Sin resultados.</td></tr>';
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
// ============================================================
// 9. PARAMETRIZACION ADMINISTRATIVA
// ============================================================
function renderVolumeDiscounts() { const body = $('volumeDiscountRows'); if (!body)
    return; const keys = Object.keys(volumeDiscounts).map(Number).sort((a, b) => a - b); body.innerHTML = keys.map(n => `<tr data-volume-row><td><input type="number" min="0" max="150" step="1" value="${n}" data-volume-count></td><td><input type="number" min="0" max="100" step="0.01" value="${volumeDiscounts[String(n)]}" data-volume-rate></td><td><button type="button" class="danger" data-remove-volume>Eliminar</button></td></tr>`).join(''); body.querySelectorAll('[data-remove-volume]').forEach(b => b.onclick = () => b.closest('tr').remove()); }
function saveVolumeDiscountInputs() { const next = {}; let invalid = false; document.querySelectorAll('[data-volume-row]').forEach(tr => { const c = tr.querySelector('[data-volume-count]').value, d = tr.querySelector('[data-volume-rate]').value, n = Number(c), v = Number(d); if (c === '' || d === '' || !Number.isInteger(n) || n < 0 || n > 150 || !Number.isFinite(v) || v < 0 || v > 100 || next[String(n)] !== undefined) {
    invalid = true;
    return;
} next[String(n)] = v; }); if (invalid || !Object.keys(next).length) {
    status('Revisa los tramos: cantidades enteras únicas entre 0 y 150 y descuentos entre 0% y 100%.', true);
    return;
} volumeDiscounts = next; try {
    localStorage.setItem('stor_volume_discounts_v1', JSON.stringify(volumeDiscounts));
    render();
    status('Descuentos por cantidad guardados correctamente.');
}
catch (e) {
    status('No fue posible guardar los descuentos.', true);
} }
function addVolumeDiscountRow() { const body = $('volumeDiscountRows'); const tr = document.createElement('tr'); tr.setAttribute('data-volume-row', ''); tr.innerHTML = '<td><input type="number" min="0" max="150" step="1" placeholder="Cantidad" data-volume-count></td><td><input type="number" min="0" max="100" step="0.01" placeholder="Descuento %" data-volume-rate></td><td><button type="button" class="danger" data-remove-volume>Eliminar</button></td>'; body.appendChild(tr); tr.querySelector('[data-remove-volume]').onclick = () => tr.remove(); }
function renderRates() {
    const hinoAges = Object.keys(hinoRates).sort((a, b) => Number(a) - Number(b));
    $('hinoRateRows').innerHTML = hinoAges.map((age, index) => `
      <details class="year-accordion" ${index === 0 ? 'open' : ''}>
        <summary><span>Antigüedad: <strong>${age}</strong> años</span><span class="year-summary-value">Tasa HINO: ${pct(hinoRates[age])}</span></summary>
        <div class="year-accordion-content">
          <table class="rate-edit-table"><thead><tr><th>AÑO DE ANTIGÜEDAD</th><th>TASA HINO (%)</th><th>ACCIÓN</th></tr></thead>
          <tbody><tr data-hino-row>
            <td><input type="number" class="rate-cell" value="${age}" data-hino-age></td>
            <td><input class="rate-cell" type="number" min="0" max="100" step="0.01" value="${hinoRates[age]}" data-hino-rate></td>
            <td><button type="button" class="danger" data-remove-hino>Eliminar</button></td>
          </tr></tbody></table>
        </div>
      </details>`).join('');

    $('multiRateRows').innerHTML = Object.keys(rates).sort((a, b) => Number(a) - Number(b)).map((age, index) => {
      const bands = rates[age].bands || [];
      const rateSummary = bands.map(b => `${money(b.min)}–${money(b.max)}: ${pct(b.rate)}`).join(' · ');
      const rows = bands.map(b => `<tr data-multi-row>
        <td><input type="number" class="rate-cell" value="${age}" data-multi-age></td>
        <td><input type="number" min="0" step="0.01" class="rate-cell" value="${b.min}" data-multi-min></td>
        <td><input type="number" min="0" step="0.01" class="rate-cell" value="${b.max}" data-multi-max></td>
        <td><input type="number" min="0" max="100" step="0.01" class="rate-cell" value="${b.rate}" data-multi-rate></td>
        <td><button type="button" class="danger" data-remove-multi>Eliminar</button></td>
      </tr>`).join('');
      return `<details class="year-accordion" data-age="${age}" ${index === 0 ? 'open' : ''}>
        <summary><span>Antigüedad: <strong>${age}</strong> años</span><span class="year-summary-value">${bands.length} rango(s) · ${rateSummary}</span></summary>
        <div class="year-accordion-content">
          <div class="year-toolbar"><span class="helpnote">Configura los límites y la tasa para esta antigüedad.</span><button type="button" class="secondary" data-add-range-age="${age}">+ Agregar rango</button></div>
          <div class="tablewrap"><table class="rate-edit-table"><thead><tr><th>ANTIGÜEDAD</th><th>VALOR ASEGURADO DESDE ($)</th><th>VALOR ASEGURADO HASTA ($)</th><th>TASA BASE (%)</th><th>ACCIÓN</th></tr></thead><tbody>${rows}</tbody></table></div>
        </div>
      </details>`;
    }).join('');

    $('rateType').onchange = () => {
      const h = $('rateType').value === 'HINO';
      $('hinoRatePanel').classList.toggle('hidden', !h);
      $('multiRatePanel').classList.toggle('hidden', h);
    };
    $('rateType').onchange();

    document.querySelectorAll('[data-remove-hino]').forEach(b => b.onclick = () => {
      b.closest('details').remove();
    });
    document.querySelectorAll('[data-remove-multi]').forEach(b => b.onclick = () => {
      b.closest('tr').remove();
      const detail = b.closest('details');
      const count = detail.querySelectorAll('[data-multi-row]').length;
      detail.querySelector('summary .year-summary-value').textContent = `${count} rango(s) de valor asegurado`;
    });
    document.querySelectorAll('[data-add-range-age]').forEach(b => b.onclick = () => addMultiRangeForAge(Number(b.dataset.addRangeAge), b.closest('details')));
}

function saveRateInputs() {
    let newHino = {};
    document.querySelectorAll('[data-hino-row]').forEach(tr => { let age = Number(tr.querySelector('[data-hino-age]').value), rate = Number(tr.querySelector('[data-hino-rate]').value); if (tr.querySelector('[data-hino-age]').value !== '' && tr.querySelector('[data-hino-rate]').value !== '' && Number.isInteger(age) && Number.isFinite(rate) && rate >= 0)
        newHino[String(age)] = rate; });
    let newRates = {};
    let invalid = false;
    document.querySelectorAll('[data-multi-row]').forEach(tr => { let age = Number(tr.querySelector('[data-multi-age]').value), min = Number(tr.querySelector('[data-multi-min]').value), max = Number(tr.querySelector('[data-multi-max]').value), rate = Number(tr.querySelector('[data-multi-rate]').value); if (tr.querySelector('[data-multi-age]').value === '' || tr.querySelector('[data-multi-min]').value === '' || tr.querySelector('[data-multi-max]').value === '' || tr.querySelector('[data-multi-rate]').value === '' || !Number.isInteger(age) || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(rate) || min < 0 || max < min || rate < 0) {
        invalid = true;
        return;
    } (newRates[String(age)] ??= { bands: [] }).bands.push({ min, max, rate }); });
    if (invalid) {
        status('Revisa la parametrización: antigüedad, rangos y tasas deben contener valores válidos.', true);
        return;
    }
    for (let [age, row] of Object.entries(newRates)) {
        row.bands.sort((a, b) => a.min - b.min);
        for (let i = 1; i < row.bands.length; i++) {
            if (row.bands[i].min <= row.bands[i - 1].max) {
                status(`Hay rangos superpuestos en la antigüedad ${age}. Corrige los límites antes de guardar.`, true);
                return;
            }
        }
    }
    if (!Object.keys(newHino).length || !Object.keys(newRates).length) {
        status('Debe existir al menos una tasa HINO y una fila MULTIMARCA.', true);
        return;
    }
    rates = newRates;
    hinoRates = newHino;
    try {
        localStorage.setItem('stor_multimarca_rates_v2', JSON.stringify({ rates, hinoRates }));
        status('Parametrización guardada: años, rangos y tasas actualizados en este navegador.');
    }
    catch (e) {
        status('No fue posible guardar la parametrización.', true);
    }
    recalcVehicles();
    renderRates();
    render();
    updatePreview();
}

function addHinoAgeRow() {
    const raw = prompt('Ingresa el año de antigüedad que deseas agregar (por ejemplo, 12):');
    if (raw === null) return;
    const age = Number(raw.trim());
    if (!Number.isInteger(age) || age < -1 || age > 100) {
      status('Ingresa una antigüedad entera válida.', true);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(hinoRates, String(age))) {
      status('Esa antigüedad ya existe en la matriz HINO.', true);
      return;
    }
    hinoRates[String(age)] = 0;
    renderRates();
    const item = [...$('hinoRateRows').querySelectorAll('details')].find(d => d.querySelector('[data-hino-age]')?.value === String(age));
    if (item) item.open = true;
    status('Antigüedad HINO agregada. Ingresa la tasa y guarda la parametrización.');
}

function addMultiRangeRow() {
    const raw = prompt('Ingresa el año de antigüedad al que deseas agregar un rango (por ejemplo, 12):');
    if (raw === null) return;
    const age = Number(raw.trim());
    if (!Number.isInteger(age) || age < -1 || age > 100) {
      status('Ingresa una antigüedad entera válida.', true);
      return;
    }
    if (!rates[String(age)]) rates[String(age)] = { bands: [] };
    renderRates();
    const item = [...$('multiRateRows').querySelectorAll('details')].find(d => d.dataset.age === String(age));
    if (item) {
      item.open = true;
      addMultiRangeForAge(age, item);
    }
    status('Rango agregado a la antigüedad seleccionada. Completa los límites y la tasa y guarda la parametrización.');
}

function addMultiRangeForAge(age, detail) {
    const bands = detail.querySelectorAll('[data-multi-row]');
    const last = bands[bands.length - 1];
    const min = last ? Number(last.querySelector('[data-multi-max]').value) + 0.01 : 0;
    const row = document.createElement('tr');
    row.setAttribute('data-multi-row', '');
    row.innerHTML = `<td><input type="number" class="rate-cell" value="${age}" data-multi-age></td>
      <td><input type="number" min="0" step="0.01" class="rate-cell" value="${min.toFixed(2)}" data-multi-min></td>
      <td><input type="number" min="0" step="0.01" class="rate-cell" value="180000" data-multi-max></td>
      <td><input type="number" min="0" max="100" step="0.01" class="rate-cell" value="0" data-multi-rate></td>
      <td><button type="button" class="danger" data-remove-multi>Eliminar</button></td>`;
    detail.querySelector('tbody').appendChild(row);
    row.querySelector('[data-remove-multi]').onclick = () => {
      row.remove();
      const count = detail.querySelectorAll('[data-multi-row]').length;
      detail.querySelector('summary .year-summary-value').textContent = `${count} rango(s) de valor asegurado`;
    };
    detail.querySelector('summary .year-summary-value').textContent = `${detail.querySelectorAll('[data-multi-row]').length} rango(s) de valor asegurado`;
}
function restoreRates() { if (!confirm('¿Restaurar los valores originales de la hoja STOR MULTIMARCA?'))
    return; rates = Object.fromEntries(Object.entries(ORIGINAL_RATES).map(([age, r]) => [age, { bands: r.multiFlat !== null ? [{ min: 0, max: 180000, rate: r.multiFlat }] : r.bands.map((rate, i) => ({ min: [0, 20001, 50001, 100001][i], max: [20000.99, 50000.99, 100000.99, 180000][i], rate })) }])); hinoRates = JSON.parse(JSON.stringify(ORIGINAL_HINO)); localStorage.removeItem('stor_multimarca_rates_v2'); renderRates(); recalcVehicles(); render(); status('Se restauraron las tasas originales.'); }
// ============================================================
// 10. ACCESO Y SEGURIDAD DE PARAMETRIZACION
// ============================================================
const ADMIN_KEY = 'stor_admin_password_v2';
async function digest(pass, salt) { let b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pass)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function requestAdmin() { return new Promise(resolve => { pendingTab = 'config'; let first = !localStorage.getItem(ADMIN_KEY); $('adminTitle').textContent = first ? 'Crear contraseña de administrador' : 'Acceso de administrador'; $('adminHint').textContent = first ? 'Crea una contraseña privada de al menos 8 caracteres.' : 'Ingresa la contraseña para editar las tasas.'; $('confirmBox').hidden = !first; $('adminPassword').value = ''; $('adminConfirm').value = ''; $('adminError').textContent = ''; $('adminOverlay').hidden = false; $('adminPassword').focus(); window.adminResolve = resolve; }); }
$('adminCancel').onclick = () => { $('adminOverlay').hidden = true; window.adminResolve?.(false); };
$('adminForm').onsubmit = async (e) => { e.preventDefault(); try {
    let pass = $('adminPassword').value, stored = localStorage.getItem(ADMIN_KEY);
    if (!stored) {
        if (pass.length < 8)
            throw Error('La contraseña debe tener al menos 8 caracteres.');
        if (pass !== $('adminConfirm').value)
            throw Error('Las contraseñas no coinciden.');
        let salt = crypto.getRandomValues(new Uint8Array(16));
        let s = [...salt].map(x => x.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(ADMIN_KEY, JSON.stringify({ salt: s, hash: await digest(pass, s) }));
    }
    else {
        let o = JSON.parse(stored);
        if (await digest(pass, o.salt) !== o.hash)
            throw Error('Contraseña incorrecta.');
    }
    adminUnlocked = true;
    $('adminOverlay').hidden = true;
    window.adminResolve?.(true);
    status('Acceso de administrador habilitado.');
}
catch (err) {
    $('adminError').textContent = err.message;
} };
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = async () => { let t = b.dataset.tab; if (t === 'config' && !adminUnlocked) {
    let ok = await requestAdmin();
    if (!ok)
        return;
} if (t !== 'config')
    adminUnlocked = false; activate(t); });
$('saveDraft').onclick = saveDraft;
$('clearClientData').onclick = clearClientData;
$('generatePdf').onclick = openExecutivePicker;
$('addVehicle').onclick = addVehicle;
$('clearVehicles').onclick = clearVehicles;
$('clearForm').onclick = () => clearForm();
$('goVehicles').onclick = () => activate('vehicles');
$('year').addEventListener('input', () => { $('year').value = $('year').value.replace(/\D/g, '').slice(0, 4); updatePreview(); });
$('model').addEventListener('input', () => { if ($('model').value.length > 50)
    $('model').value = $('model').value.slice(0, 50); });
['brand', 'year', 'insured', 'extra'].forEach(id => $(id).addEventListener('input', updatePreview));
['insured', 'extra'].forEach(id => { $(id).addEventListener('blur', () => { normalizeMoneyInput($(id)); updatePreview(); }); $(id).addEventListener('focus', () => { if ($(id).value)
    $(id).value = String($(id).value).replace(/\./g, '').replace(',', '.'); }); });
['discount', 'increase', 'patrimonial', 'lucro'].forEach(id => $(id).addEventListener('change', render));
$('saveRates').onclick = saveRateInputs;
$('addVolumeDiscount').onclick = addVolumeDiscountRow;
$('saveVolumeDiscounts').onclick = saveVolumeDiscountInputs;
$('addHinoAge').onclick = addHinoAgeRow;
$('addMultiRange').onclick = addMultiRangeRow;
$('resetRates').onclick = restoreRates;
$('exportCsv').onclick = exportCSV;
$('exportCsv2').onclick = exportCSV;
$('saveSummary').onclick = () => { localStorage.setItem('stor_summary_v1', JSON.stringify({ discount: $('discount').value, increase: $('increase').value, patrimonial: $('patrimonial').value, lucro: $('lucro').value })); status('Preferencias del resumen guardadas.'); };
function openExecutivePicker() { if (vehicles.length < 3) {
    status('El PDF solo se puede generar cuando existan 3 o más vehículos ingresados.', true);
    return;
} $('executiveSelect').value = ''; $('execOverlay').hidden = false; $('executiveSelect').focus(); }
$('execCancel').onclick = () => { $('execOverlay').hidden = true; };
$('execContinue').onclick = () => { const name = $('executiveSelect').value; if (!name) {
    alert('Selecciona una ejecutiva comercial para continuar.');
    $('executiveSelect').focus();
    return;
} $('execOverlay').hidden = true; generatePDF(name); };
// Limpia únicamente los datos del cliente y la vigencia; conserva vehículos y parámetros.
function clearClientData(){
    const fields=['clientId','clientName','broker','clientEmail','clientPhone','clientCity','startDate','endDate'];
    fields.forEach(id=>{if($(id))$(id).value='';});
    status('Datos del cliente y vigencia limpiados. Los vehículos y la cotización se mantienen.');
}

// ============================================================
// 11. GUARDAR Y RECUPERAR COTIZACIONES
// ============================================================
function saveDraft() { const clientFields = ['clientId', 'clientName', 'broker', 'clientEmail', 'clientPhone', 'clientCity', 'startDate', 'endDate']; const clientData = Object.fromEntries(clientFields.map(id => [id, $(id).value])); const data = { vehicles, clientData, discount: $('discount').value, increase: $('increase').value, patrimonial: $('patrimonial').value, lucro: $('lucro').value, savedAt: new Date().toISOString() }; try {
    localStorage.setItem('stor_quote_draft_v2', JSON.stringify(data));
    status('Cotización guardada en este navegador. Puedes volver y continuar agregando vehículos.');
}
catch (e) {
    status('No se pudo guardar la cotización en este navegador.', true);
} }
function restoreDraft() { try {
    const d = JSON.parse(localStorage.getItem('stor_quote_draft_v2') || 'null');
    if (!d)
        return;
    vehicles = Array.isArray(d.vehicles) ? d.vehicles : [];
    for (const k of ['discount', 'increase', 'patrimonial', 'lucro'])
        if (d[k] !== undefined && $(k))
            $(k).value = d[k];
    if (d.clientData)
        for (const [id, value] of Object.entries(d.clientData))
            if ($(id))
                $(id).value = value;
    recalcVehicles();
    status('Se recuperó la cotización guardada. Puedes continuar agregando vehículos.');
}
catch (e) { } }
// ============================================================
// 12. GENERACION DEL PDF Y COBERTURAS
// ============================================================
function formatDate(value) { if (!value)
    return ''; const p = value.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value; }
function generatePDF(executiveName) {
    if (vehicles.length < 3)
        return status('El PDF solo se puede generar cuando existan 3 o más vehículos ingresados.', true);
    const f = financials();
    const rows = vehicles.map(v => `<tr class="${v.brand === 'HINO' ? 'hino' : ''}"><td>${esc(v.brand)}</td><td>${esc(v.model)}</td><td>${v.year}</td><td>${esc(v.plate)}</td><td>${fmt(v.insured)}</td><td>${fmt(v.extra)}</td><td>${fmt(v.total)}</td></tr>`).join('');
    const summaryRows = [
        ['TASA PROMEDIO APLICADA', pct(f.avgRate)],
        ['PRIMA NETA', fmt(f.net)],
        ['PRIMA TOTAL', fmt(f.total)],
        ['AMPARO PATRIMONIAL CON FUGA', $('patrimonial').value],
        ['LUCRO CESANTE', $('lucro').value === 'SÍ' ? `SÍ · ${fmt(f.lucro)} (${vehicles.length} × $ 200,00)` : 'NO · $ 0,00']
    ].map(([label, value]) => `<tr><th>${label}</th><td>${value}</td></tr>`).join('');
    const coverageSections = [
        { title: 'Responsabilidad Civil (Daños a terceros)', rows: [
                ['Subdividida 50% daños materiales 50% lesiones corporales en exceso SPPAT', '$30.000'],
                ['Daños que ocasiona la mercadería a terceros', '$700']
            ] },
        { title: 'Accidentes Personales y Gastos Médicos', rows: [
                ['Accidentes personales por ocupante (max 2) por vehículo', '$5.000'],
                ['Gastos Médicos por ocupante en exceso SPPAT (max 2) por vehículo', '$2.500']
            ] },
        { title: 'Amparo Patrimonial (Cobertura por negligencia)', rows: [
                ['Desatención de las señales de tránsito, licencia caducada, infracciones menores, estado de embriaguez, drogas', 'Aplica con Prima Adicional'],
                ['Fuga del conductor', 'Sí aplica considerando que el deducible se incrementará en un 50% adicional a los mencionados más adelante, según suma asegurada']
            ] },
        { title: 'Gastos de Wincha y Remolque', rows: [
                ['Gastos de wincha y remolque por accidente · Incluye rescate · Aplica mediante reembolso · Se considerará tonelaje y kilometraje recorrido', 'Hasta $1.200']
            ] },
        { title: 'Lucro Cesante – Aplica siempre y cuando se pague la prima adicional de $200,00 por vehículo', rows: [
                ['$200 diarios con un límite de $4.000 por los siguientes 20 días laborables. 10 días laborables de deducible. Aplican condiciones.', 'Cobertura aplica si se selecciona con pago de prima adicional']
            ] },
        { title: 'Fianza Judicial', rows: [
                ['Cobertura liberación del vehículo o fianza por liberación del conductor', 'Se indemniza 50% de honorarios razonables y del mercado hasta $700 tanto para la liberación del vehículo como del conductor. Incluye gastos de grúa, gastos de abogado o bodegaje']
            ] },
        { title: 'Deducibles Multimarca – Excepto HINO', rows: [
                ['Pérdidas Parciales', 'Suma asegurada menor a $50.000,99: 12% del valor del siniestro, mínimo 2% del valor asegurado no menor a $600,00. Suma asegurada mayor a $50.001,00: 12% del valor del siniestro, mínimo 2% del valor asegurado no menor a $1.000,00'],
                ['Pérdidas Totales por daños propios', 'Hasta 10 años de antigüedad: 20% del Valor Asegurado. De 11 a 15 años de antigüedad: 30% del Valor Asegurado. De 16 años en adelante: 40% del Valor Asegurado.'],
                ['Pérdidas Totales por Robo', 'Hasta 10 años de antigüedad: 25% del Valor Asegurado. De 11 a 15 años de antigüedad: 30% del Valor Asegurado. De 16 años en adelante: 40% del Valor Asegurado.'],
                ['Responsabilidad Civil', 'Vehículos de hasta $50.000,99 de suma asegurada: 10% del valor del siniestro, mínimo $500,00. Vehículos de más de $51.000,00 de suma asegurada: 10% del valor del siniestro, mínimo $1.000,00.']
            ] },
        { title: 'Deducibles Vehículos HINO', rows: [
                ['Pérdidas Parciales', 'Suma asegurada menor a $50.000,99: 12% del valor del siniestro, mínimo 2% del valor asegurado no menor a $750,00. Suma asegurada mayor a $50.001,00: 12% del valor del siniestro, mínimo 2% del valor asegurado no menor a $1.500,00.'],
                ['Pérdidas Totales por daños propios', 'Hasta 10 años de antigüedad: 30% del Valor Asegurado. De 11 a 15 años de antigüedad: 30% del Valor Asegurado. De 16 años en adelante: 40% del Valor Asegurado.'],
                ['Pérdidas Totales por Robo', 'Hasta 10 años de antigüedad: 30% del Valor Asegurado. De 11 a 15 años de antigüedad: 30% del Valor Asegurado. De 16 años en adelante: 40% del Valor Asegurado.'],
                ['Responsabilidad Civil', 'Vehículos de hasta $50.000,99 de suma asegurada: 10% del valor del siniestro, mínimo $500,00. Vehículos de más de $51.000,00 de suma asegurada: 10% del valor del siniestro, mínimo $1.000,00.'],
                ['Nota sobre robo parcial', 'En caso de robo parcial que afecte a llantas, aros, cerebros o cualquier componente eléctrico, electrónico o mecánico; si el robo sucede cuando el vehículo se encuentra parqueado en las vías públicas, en un lugar abierto sin ningún tipo de cerramiento, en parqueaderos públicos abiertos sin ningún tipo de seguridad; o fuera del predio de su lugar habitual de parqueo, el deducible a aplicar será del doble del estipulado para esta cobertura.']
            ] },
        { title: 'Protección Automovilística', rows: [
                ['En caso de robo o asalto dentro del vehículo asegurado, se entregará el valor indicado para duplicado de llaves, matrícula y/o licencia. Un evento al año independiente del número de pólizas.', '$45']
            ] },
        { title: 'Notas Aclaratorias', rows: [
                ['Restitución automática de la suma asegurada', 'SÍ'],
                ['Reparación en concesionario hasta', '2 años de antigüedad'],
                ['Depreciación de partes y piezas', 'Sí aplica']
            ] },
        { title: 'Formas de Pago', rows: [
                ['Descuento Pronto Pago', 'Aplica cuando el cliente pague el total de la póliza dentro de los 15 días de la fecha de pago indicada en la póliza. El pago debe hacerlo en ventanillas de Sweaden, en efectivo o cheque a la fecha.'],
                ['Pago por servicios bancarios', 'Si el pago lo realiza por Pago Servicios Pichincha, Guayaquil y Produbanco, solicite luego a su ejecutivo le emitan la Nota de Crédito por descuento pronto pago, para que este valor le sea devuelto.'],
                ['Crédito directo', 'Si en la póliza se acordó crédito directo en la forma de pago, estos valores mensuales solo serán aceptados con efectivo, cheque a la fecha o pagos servicios.'],
                ['Débito bancario', 'Si el cliente no tiene cuentas en los Bancos Pichincha, Guayaquil y Produbanco, puede realizar sus pagos mediante Débito Bancario de cualquier Banco o Cooperativa del País.'],
                ['Tarjeta de crédito', 'La aceptación de pagos con tarjeta de crédito diferido será: primas menores a $599 diferido a 3, 6 o 9 meses sin intereses; primas mayores a $600 diferido hasta 12 meses sin intereses.']
            ] },
        { title: 'Notas Importantes', rows: [
                ['Condiciones de la oferta', 'Condiciones pueden variar sin previo aviso; los términos finales de la oferta se validarán con la póliza. La cotización por sí sola no representa la cobertura automática. Se aplican exclusiones, condiciones particulares y generales. La presente cotización tiene validez de 15 días.'],
                ['Valor del vehículo', 'El valor del vehículo debe corresponder al valor comercial del mercado vigente; es responsabilidad del asegurado la información proporcionada.'],
                ['Extras', 'Se excluyen brazos hidráulicos, brazos autocargables, torres de perforación, vacum y grúas.'],
                ['Suscripción', 'La aseguradora se reserva el derecho de aceptar o no el riesgo y/o modificar condiciones luego de la inspección.'],
                ['Inspección y análisis', 'La presente cotización está sujeta a inspección del vehículo y debe pasar por un proceso de suscripción y análisis de riesgo de acuerdo con nuestras políticas para poder otorgar cobertura al vehículo.'],
                ['Canales excluidos', 'La presente cotización no aplica para canales como: CasaPlan-MotorPlan, Vehicentro, Ecuasueña, Credisur, Mavesa y Teojama Comercial. Revise condiciones con su Ejecutiva Comercial.']
            ] }
    ];
    const coverageHtml = coverageSections.map(section => `<section class="coverage-section"><h3>${esc(section.title)}</h3><table class="coverage-table"><tbody>${section.rows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join('')}</tbody></table></section>`).join('');
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>MACRO PESADOS</title><link rel="stylesheet" href="${new URL('public/estilo/modules/macro-pesados-export.css', window.location.href).href}"></head><body>
 <img class="banner" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAvAAAAByCAIAAAC6I3LXAACp8ElEQVR42uz9Z7Bl15UmiK219z7m+nfv8z69B5BAAiAMPVlkkSywfJtqW9JI0z0KtTQzGmliJkLRIUUoJkZSS6ORpiO6Z3omumu6qlhVzSpa0IAO3gPp/cvn7X3X3+P2Xks/znXPJECyOsjM5P0IAu96d87Z3/nWt76FzAz3JfZ92wh99NFHH3300cevHtR9+8773KWPPvroo48++ughNNVq1Ws2iQiwzxL66KOPPvroo497AuPj4z8boamUy1tbW1rrX8rb7XAo7vl370387+/J42t6WRv3t5c++uijjz76eDAIDRFprZVSvxROQ3e/6a/PNvguV/IextNHH3300Ucffdy/aHloENEYY4z5hb1wL6XY9++/FsHBn+GO3Kc1ffTRRx999PFgEJpfIvhujIV/HoLSfSx+uA6D/ZJTH3300UcfffQJzc9KMOCnEWP2FUx4j/nlQ1+PP5zf7Mul+mpNH3300UcfffQJzf7sAvbQF/4AvsM7mUWclPNzaCmIH8Rv7vJm+symjz766KOPPvqE5u6s5UP5TkeD6WEw/HM8404mhHv5DXx4PQv30Ko++ujj5z/QKCmkQEAAYGCjjTHU/1r66KOPe53Q/FQm391KCO/DYPiv9/K9lxCAeR9yw/szF97z/vvMpo8+fg4IgUS8ulT0vCgmNChwIJ/K5BKAwNS3sfXRRx/3HqHZSww+SF/piDHcczV/KD8BAO6Up/YSDu5VZPY8yz7kBtt3vDutgb5g00cffw02s75c+tZX36hVvEQiIRA1mYnpwjOfOjU4nEHE+3b6Sh999HGPHXD+vfAY3s/2u/89sH2ZmZk5rgvxDptLzyVm6L25dTXv58vhLmlp/cM9f/Ce99O6mYFbt3P3A/D+Mg/uc0sfffSxPxARABbmNr/z9bevXl2Ryh6fGJqaHrUt+83Xbrz4/YtrKyVE7OeT99FHH/9e8NdVaHplkv2pDLRJDENXjOG7PdVdKk7801d+uHM03fk6va+MuPO+sVyDvOOxH+Ad7qs1ffTx4WdLUty+tvrD751/+82bB2fHDh+ZPnfEdW3rQi4TRvr9t+Zs27I/YY2M5bQ2/a+rjz5+vnOG/S/2XIh1UCJ64NXQn5/Q8F7asfc2/JCiUkxi9n8q5h4qtOvxP0UYXssRjB0Osx+52cFsOhbiFrNB/AAHTT+Rr48+PuhQK3Dxzubz33j7wrtzY+ODY6OF44dHHsu8Z9syOPpUqViq15pXLyxYlnzy48cLg+m+R7iPX0EWcldG0v4LO2fmzJ0/OiCimKZ0/k1ETGRoN2zLzuSyruMQPcg72s9DaPYaZveTZHqoDN+N7fAeGQZhR3mo9fPtZSqd2tOuzWHXxtElQ8wtcoMAgNz7/Hs0mxYVYt7hHd5Ja7hvrOmjj7scr5l5c63yZ//mx/N3NvOFTC6bmpoZOzNUykbbaNSRbGlldnxtvVSpNC6+O18p1b/4e0+m0u4+O3sffTxYu0Y8aGgvBaH23y0dBdvFWMS2MaNFVeJMfx1pMiaMojAMtdaB74dhGIRBEARhEHpeMwgCP/B9P/B9v+n7E2PjX/rSFx9++OEwDLm7jEL8Hn51Cc1d1JTdkkwvWdilx+zRSVqsgPcymF01oD3HO4HEjF0jcMxaOpc6vxNizFA6r9AmN7uYTQ8hYmDsafzGfYzDvJPc9NFHH/FBeHuz+uf/+kfrqxVAYVnW+PjQzMzwSPgTOyoRygJempz85MrkcKlU09pUSt63/vyNz/3muVwhteuEpo8+HqRdo1arra9vFItFY3Sz2YzC0Pf9ZtPzA7/peaEfNL1m0/fCSJMx2mhjiIkMMxNxx/jZWWrjvQ3byxgiAAhs34CA2L3T2sb6jRs30+mMk3CJjDEEzEoq13WSyeSvHKH58BFL2MM49nfU8n4kpssKWo/krmLSvY16+pM6bAYob92o63HPDCCa+DHUrlDh7hZtZuphLHtMM7xXsOlx2LTUGtzpf97N1fro41f8kA1C4MLcxvN/+eb125tAnEw4w8P56cnC8cGmU6uS0QDa8denC+W1ycLaeml5aX19oxxpevXHVx9/5ujIWK5fe+rjgYRt22++8cb3X3hhvVhUQuwqKsXrS/t/7R1KAArZ27mD+yw3+xRLcM9ylEwkXnrl5W98+1uhDuOeHMuy08nkQ2fO/MN/8A/aLTq/GoSGP5zK3LW6hL1uXOY9JIZ7ZZjud0q8ryTTrjahAJNQGxPqX8+b32vwUxLMrlO7WLTj9nNgm2+1SpJEgNhTUWIE2CXY9EoxjN377L29z2n66AMAhBALc5s/+v7FN965PTKY87wgmXImJkemJ7KTwfsW+QwCACSHQ80rYyOPTE2NFLdK1Xozm01dem8hkXSsJw7lB1N9TtPHA8r4hVKWbSuJsmOOiZt9sfckGru0hLv+mVhqaa9XreULuzbU7uV4CSUEFEIKgSBAKCm0VLYFonVm7ti2ZSl4sCw1H05o9u/H3qvKwI6+6x2SzI7beUdFqceryxTThl2vw7v+QgBiaYnasHrHglsurlnY1CxwVysUArd8M11+02Y3bVob05qOaNcNp8G2Wxk7hK0r1UDbL8x3jePro49fPTaD62uV7z3/7luvXp8cyRcr9VTCGRkuTE8WZgchVbqFQIwCAAQFucblsfyJyfH85vpw/ebCxUu3n3j85Duv36w3vF/70mO2Lftmmj4eMDCzVNJ2bNdxhRCR1oZICGEpJRAjoyleWOKFRyAAMgIjUrz0IKIQQgghhZQShZRSoBAohGj5JVprq0AUxNXtbTDspFNWKgnMzTBqRn5EmrFtzEBElCjkrxCh4X31rK4reB8qg7tas3uOTB09ZheJ6dxnR2c3xy/NHVLaeVpmlFDJiZ8AUEFdDujgZnhaYrjzDXY7pHCXLMctNQgReqtR3Vpki91gJ8SvE77XbfDucJoeCoN9qaaPX8UTTwCGej346p+8dPXS0sBABgCkELlsanxq7MAwTtN1gK7XjQEBcNzcLhYOr02NbmxuL68Wi1vlifGhW5dXtzd/+Pf+15/tf6l9PGCIouiJJ5+cmZ3d3NwE5u/+8AfXluYPHzj06Wc+OpDLfeN732k0mwDQ9LxyveYIK5fJ2MqC2CPMzBS7ho3RxDoyFOjYPxwvqUIgIgqMpRwllYzIFQoNbTfqlpRSSpFLi4Qd+kEmmRwo5AcSqZzlHpic/lUhNPuny/Bd7TK7erC7NIW7zpjeDqUOldlDYroP77aqxfoIMIOwhJdWywpvAYiUeMvFA8QPY8vq2yYxe1qUuCcWuK0LdetfXcGmw056BKSYNO+Wajp93dxNG8Z+R3cfv3LajGjW/X/xz74+v1gcHMzZlppbWh/KZcdGh2amRyaytUztMu3YJxAA8rX3R7ITY5NjW2ub1VrzzfM3fuMLTx/Lz964Pv8n//0PfuvvfDSRcqhfe+rjAVJoXMc5MDt7+NChKIreP3/+xtzt2dHxTz/zMT8Mnv/mt4UfSSUtRiUlC1Su4yQSUinHdZKOk0wkHcdJOG7STTiWSiSTjmU7luXYtmM5tm0py1JSWUoppZj4//n/+md35uY+/7GP/YO///d93wdAY8x3X/j+X33ja7/57CefeebZZCqptQaAX+Eup57GaobdNab2DdxTpdmpynCr4IPtyhO3WQ/2NDjx7ipT94kAkFgm5GLBOs8gAFBgIylXM2q9rjOiJ8i3Jdy1KQsyIjJ3bDXAO3J/sfX6GLeaY6sIhTuYCvfm1nBvXzfv4DR99PGrA8uSa8ulr33l1bml4thwXgqxvV1LOnZ+IDM5PXpoiMbUFpgQcM+hhqJhXD2QT23PjG9ulWt179WXL557/PiZh46+8fql13505dwzR3OFlNF9TtPHA0Vr2gF3nEq4yUTCkBGI/8f/7D9TljJMb148/5Xnv3Xi+PEvfOrTQ4V8aCIQMtLaaI0iVloQ40YZIimkkgqZEAQyCAARL1sMwrGFpQyZaq0WhSEAOI6jlBQobNuOu78fvEwa9QHazN3YzJ4y0y7a0WUvLZcMtrqXdlaXugIOtCcU7Hi27gt1I2cY2JC04U5WvBgbDIllQmxk5Y1adI7A4F16qxm7HCdmMMhtWtMSbLAVP7PDNQzYKjJ1RjF0XTW7LTV3UbL66ONBhbLkykLxxy9ceO3tWxNDA9l0cmO7Umk2xwbz42OFyQNTE+pmrnqBcJ86PaHK1a+PJTLj00c3VjfLlcbi6ubS8ubYSP706UPf/855J+U8+uShRMKm/gDLPh4UIKKyLJVwhk4eOTZRsA7MXo5KoSVuVMslz/PCoKk89ZnH3w2Cl975QRBpYwy1V0IhBEophJBSCqmEUkopKZUUaEvlKuVKZUmJQqLA4Hc/k2w+fVuoF6urs+mB0VTWi7RnImkp3B2j/0ATmn1cwLtMM/s5ZnrJyA7Ow72Vpx4e075pPz60IxWxewRkYBAptZ2xlgVWDCcAgMFyxY2cfGmFzgK2+rtjf9Se5jVuea46zKQj2PSUnnr+4p7sYGzn1PQk1uy11OzXS9enNX08kBACK+Xmiy9eeeH77w/ns6dOzl64Nr++WcqlkoOF7PTM6OERKJgyhnUQ9r7HdhWWC4n12fzB7ZnRzc1yrdG8dOUOAf/B3/5cs+F989+9Wdqu/9qXHrWsvke4j/setuOErrjild/butMIg/WpbGNQLTS2fvDiLbNdUZ4v/QiDiIPIeGEUBBAEQmskA8xCCABouT4RSAgSEqQIbSVcV2RTOJSHsTFKpQwgoABE23FGC/mikv/d+m25TiyktOz0seHZ43+fZTI1mLc0edo8YOvTT6HQ3MU0s8cx0xo42XWbMPfyl92SDHcf1Mtd9lKazn+Y2LDMOdez6jZx55xPIPqOXB2wF7eDcWaBolVsAqAdSs1OcsPtXibAFqPBVpJwm70idPvIe4nLh1pq7trZ3UcfDw4Y8N/98UuvvXytkM8eOTS5vlGu1ZpKylwmOT5WmDwwMQm3U+HavvJMW6QRbrg1LBfGpg5NrBbL5Vq94a2sFF/+8XuPP32amN959Xqj1vjdv/vx/n7Ux/0O34Vvrd58bW2p4Yeh79Vu3s5tVbO+ThNaQkZRqMMoDvcN/TAyWgui9vk19UgDCL3LD1K7ZoD5jHX2pH38SGiYUQRRRKFvRwzVMiMya1/rRhRtEF9Ipv9FefmTo5NfGJw+ojKVShkelAmx6oOozE4e0CEYPT7ZHROXWmbsXrbSIjW4k7308J8d/IZ3sKae5+ue0zFk1Csp+ZZht6c2JSysD9qXS/6wYRvbRsJW3xJ2m7hbNpqdtAYYW//fEZyH0E4Ujt9L21UTJw3jPpaau1PD/uG4jwcJUgpm/v/+1395+epKKp08ODM2Njb4je+/EYVRPpseGhqYnhmdGU3lyrekt0Fo3ZUSobL99QJcHR58eHp6dGurVK01NkrVH79+8YlnTz/2+Ikw1Devrn39T1758t96RkjR9wj3cf+iGDY3vXq56flNz9/aOlz006EkwMCEnh/qKNI6CqNIax0PQwBNcWtgPAUhtpe2WA2xsmzLtqSUSinLUlIKJh5FCx33Pc+TgIYoq5yRhEuhIYaqJTzL1lKS0dxsoFf/0c3zLy/dODt64P8w87BXrZMxDwCtUb1LL991QtNOVrHDEIzc45jp9iW1KYzEMKW2NdmVcAwxRKA9Q7Z6FZlOXHAnEq8T9AvMPGCvuVBHg8iy581KC8sF8U0BTzA77UyZFg1pqS2IKLp94TsSg7Hl4BEAhILIsoWXVlt1PcogOg/nrqUYWhd2yT69HuF+I3cfDyhsW21v1b76xy9dubGqlHzo1IGxscKLL12IosixVD6bmpgcmZkdnhTzDjX5bky/R+axqTFlrlUnxtbWR4vbtboX+F7wL/67v/on/8nf+ORnzn37Gy+/+85cvpB+4mMn0plEfy53H/cd4kVorVkren6gtfT90c3KWDLj6ZoX+JExmjQhU9yTIkBIREIU8YxsZmQGHBoczGazbirhJtyE6zACcLd3EBEjbQ5OTkOucN1fDgCAOQRO+OHDKyXhhwY4Qggs6Tuq7tpLiXRzcLQZ1IvlDX/G8INy3v2BCs3+LuD9ykzQ06DEOwJoQsqMW98Zcl5v2AfXoy9sB5OGAVm3WERbnulSm55S0w6+AwIBxu2XU7hOJgGsdjpWNJIesNa2gkRkFAK1SEzvpzEcz/uK1ZWOA6g15wklg8iqzSHrJVesVMwzNT3MLLonk21Os/e72uER7kxI6Dc99fHAwbJkcaP62otXXn7jhivVyeMzA9nUwuLGylbJtmQm6Y4MD0zNjA8P53Jb35ZRlT8stotRSt0YqJ4fHDwyOT22tV4sV+qh1ssbxR+98PbTT5/5xKcf+/7zb3zzG2+7afeRc4cSKbvf99THfUdpEKHoNytR0NRmxEl87tTDUa3p+74fBr7neZ7vNZv1RrNWr4Um0gJIAOvWGX86lT577iwjAzOKOHAm1hGQux4JloIoilQQFix7NTLErUKViLQIIyZyAJwABwMrybZ6+721wK9Nj8iHTpa9eqZ9gv4gEBq+2wDtzpLM+9Md7pldsJfNtPy+rMv6SVds5uW3k+LtKXt2K/pkMXiooZPMBtkAUA8j6hCjbtGqfeAzlgjTcMEyFeIk7GSUDFKAnFQvVYOMZyYsYWLpKKYg2DNUoUVKsGXwZRaAlqv8YftCQX3LESu2WKubk8XwGLFApNj3G1ejOmoPdDu6eeef+8sx/WSaPh4ACCF8X7/66vU/+4tXk7Y9Oz167tyJxZXNN9+7JgQ6ysoPZCemx2YnUpNqxYrKQAZQfPixnrQTbI7BYmV0YGN6dLNYbjYDbeg7339zYnbsU598rFZthj9+76tfebVa8z72qTOuq/p9T33cV3QGUMp6pL3IKMCclClUJSYQYFlKypSbcHK5DDEzU7lcuTM3X6tUDbAxJpPOTE1NCoWIor3a7hi8xG1Sg4gmDEUQJi0LI4pXYwI2zN0QfAbSxqtUR91ksFEs4VpletKPgjS4D8bypPaXZ3ramnYuzDsML70ml261qSelhpgBolI4ZcPpgeQbFmwrrE7Yt0atdNMc2gx/bdM/GBmFoBGo+2Tcw4faoysk6IJas0wEJIGs1iSDLk1gBM7iRRc/UsMxIm77exGw7eEBEHGeNAOgYJCWxIK9NGS/nlZvW1iWWBfghXSkoj/t6ZQQptsp1d5qMH6XrY7uVoANdmWaVsrwrqan/tG3jwfgoGyIv/qVV370g/O2UlPjQx/75KNrK1vvvXfDD3U64aZTibHRwuSBqdEBkS++hWz4pyvJMyKyyVUujWQ/OjEzsbG6WS43Aq1rofe959+whXz2k2eDIHr5pfdf/P4FHerf+N2PUKj7v0gf99fJQGAoMCar1ASq2nZNa83UMmAIIRFRAgCi4zrKtjorh+Pa+UIeO0FsO9SGzl+tc23SBrS2XbFjXk98Gt8awY1EZIjcRNK2LDRkosjTEQsH2v6KB4fQ7DnS8L7yTG8WcLt+0/bTdr71tv+XmZl1TR/bCL80bP3PAFpiVWHVFlspeW3CGdwOP7bhn60GA8AaUXf7nrrkBgxIG7wZ9WOLI6AEcmcA6Y6JBgjhgCjWsV43CYEGWwWz1iB1BCQCBgGokrIxnni/YH/PlkWFvoAmAwMIgV4lOroePgOgmQBFu3e71QiOve1OvMMi0/pXl93AbjNNX6Tp475lM0jEf/I/vfD6GzeNhgNTQ489enR0JP/yqxfuLK65ju3aajCfmZgenR5NDlvrVn2eu2PyPvzpAThRv1kYODM+Mr4xNbqxWW54fqT17fnll145f+zE7OMfORUG4euvXXr9pWtszHN/4xmj6cGLBevjQd19hJQRmYhNEjDFSMyxK6L3brFbpifKDYhJWVZ2IOMHPnKP5RM6M316h0IjE4HWUriInYnKLXEGhUBEIopj/RKuoyxLsBHGBKRZ3MU+ez8Smt1Hnd6FmmE3penNveuUcniXwTe2xVBrJhJHTZ3b9I8PWwkEn1uDByJbbNhyyxXrQ9YPGu6hreCJjeZYQAkAEEitghUIQtviIKvnef1G0QtNBEYbMrv4L9ouSIWZxBtpK10VjzEIwaYz6gsYGJQtzaCzOGy/lbPetpUnsQhoGGQrlAZMg56p6Mc9nZAYMQIQYCsYkDucBrEzCgp3eWV64op41wDLvkjTx30Ky1bNRvD8V994461bvhdNjQ0+cvboM5989F//j9+6en1BSOlYVjadHB8rTB2cGk952cZtYLNPNPCHCDUm27g+5qY2ZyfWVjYrlXoQ6VCba9cX/vSPv/+f/5//3lMffTgMojffvPLKy9ey2dRHPn7CSdg66nuE+7i3ERtupfCMjoglkcVGSolhOy6/jfjsmxlMe34TGVJSplIp3/d3rSLYGVnYbu1GRDbEmpTorkUUn9G3W2I6BMuybSmlJM3aNLVm9YAsUGr/tXZnpB1225Z6Q/LapbyOr7f13za96Zl7YAga0fBW+FzB/oaEOoMCQAYJhAoqlqgl5ErWuX5w+j+qVKpLRbXp5UFYksOMfzNZu2z7SxZVS9rvjYUR2NXaDLAOkAEErqbwa1PqzSh1wE8frdvTETgKopxVHrMv5sRFV21bqqywwsSMkoVoD3Zigc117yPbwUngsOWHbifTdDhNm+lxK6SmJ0q4t8jEuwZY7qw99XWaPu4X2LaqlBpvvnzt+z+8EAZ6bCR/7vETpx8+8s6b1y5fn296YcKxEo41WMhNz45NTRYK9L6zfYl+VjYDwCgTpcuF0dGxycenZ0a3tip1zw+19oPwwqVbf/JvXvjil59+5hNnI0PvvH31m994S0hx9olD6Vyyz2n6uOcZDQohmlqHZBSAw2j2ySRpLW3MFMcTMLOllG3bKER32djLadqLSuuMm9kWssVmiBglouAdahEysFJSSikMgKEmaX5QygcK9pVnelSvHbJMZwpTT08TQ0+bdO/c7LaDiQiYdUiJxfozmdzLSjZa7hhGZAEkOfKFNZIZ+317+rMFTA0tvbp14yfFxRWobyldU6aq2BMChZSWRCVBSiFkbPduvbQhJgPasDGgTNUNa1G0FFXfy6hBmclnB0zBWrehrLAEHLFGEgmQBtAgEAsCNACqFn2qEh0LyBEQtjWbdoheZ+42d7cs7LnUDuaDD02m6dee+rhvjg5KVkvNV1688rWvvekHeiSfeeThI48/eYol/sVf/bje9C1L2pbKZpIT44PTBybG3XK6ugraB+n+7K+GaIJUsDKW3dyeHV9dLZardT+INFHT87/5rVeOnpg9febA0x97WEf67bevfvNrb0pbPfH0MSGw7xHu454GAggMDGkiCdIGjIwm6Jh5e1wbHMsqFC+mbsJ1HCcIgu5q0tOp035szwOJgNmRMs6VbTtJkYlICCJipvgx0lIoBBCR0Q0KCToJJw8YoWl/ax3yiDv7sHk/htjxBXcFtHatrjXgnJkBtU5vBp8Zdb9ri2UmBxmBJYQBqmk1+LvW7D8CKy0AoLzMt15I1hqCIiHBstBxHCc9YGXGpJuTiRwqpzV9oP0js9EUNTlqmvq6aW7qoBmGfhQ1w2CDIiXrrDORO+iwbYNQgAakAUaQrU+BQhug9eBjzWiQQXc/c5eetM3B2HYYx/3fnbapTgIf9NKafZJp+ofePu6PgzBCtep94y9ff/5bb5erzbFCbnZy9CPPPFSte3/6x9+7NbeipEjYVsa2Bwey0zNjY1NjA9vfUsXzpEPWP49pl5js4tU8J0cmfm1ycnh1ZWt9vdSseX4UbZeq//Kf/+Uf/q9+47HHjjZrXmmr8sZbV//oX31/c7P83O98BPqEpo97GwQQGkPEElAyBMTttBLo7b5p9d4SxVGwiUTCdZzA93G3jLPzArei0oiIjXGEiNcsYiZkIQQKEa/HrZdAVEoqIQSz1rqu9QOz/6gd2syu4Jndq2/ry4aeJm1uixREFEWamaRSllKO4yQSSaWkbdko0BjjeX69Xl+uP5MSb464tzQngARog/ZJa/wPrMnfQysNAFtv/Kvtd/4sLJUsWyaSieTgpFM4qLKTMjGAdhKlDcoFlDvbrxjIMIVAmqMG6CZ5ZV1djEq3w0bV800QcCUQzbrODFmJjBQWMmD8QYAROGJO+3CkGMyExkbUJDB2zLRHdff2ryNgh9Uwtm9txSG3mp6wK9LsM1KqL9L0cX/Ar5tf+/wzX/rNT6NAR6lCPjM6MVSvN8dnhmLBUiC6tpVJJwfymfRANtl4Tkaf4A9v1b4LGBDBtrLJxNThIyOf/uKTtYYXhFE71wEPHpoYG8uPTeQfeuzIdqkWhJGOwkoxSOes/o/Vx70MDRQSGWYJLNsTDDvemY7dJV5BiCheT2zbtmwrjCLYuSK3rA+7aQ7GEoJq74Cx9RiFkEIYJmyFpAEAMLGSUqH0o6gY+dRKwHyAu5z2Zs7sNAJjz4hs0iaVTk1NT0kppRBCSGUp27aVVMpSCGiMCaMwCMJG0/DmrXqzmYAFprRQB+0D/7Eafw4A/NXz5avfq1z6GtUWM7lceuyoO/aQlR4S7gDYaRCqNZupRwGJBy+gnQY7L6QDACAEkGavKKtztld0S7fczWt+dd3z2W/q0mqkfZkqCOUis4lJh4TA44Gl4AtelGQgBGYCFNzRaWLW0i4itRWZnkZubo+57DhsoDtqA3ZE+PVFmj7uHzQb4eHDE4eOTBGR7Vhu0pFKJBK2LZVtW4igLGU5lmUrIRApgPQM/AzNTfsfdySAjTKXGx2bHI6CKAwjigwgRlGUSCfdhJNMubl8NvACo2nu1tLtW/PpAau/U/Vxz2qdDKzJREwMLAAkQ1y56FnFoJNSwsxkKF5glFJKKWbqBLpiz/qM3HuCDG2GBBJRtKb9cGwKBgBE0c7cZwCItEYpHSkbWm9GAXWCah5MQrOr3sS7uVuPPMPAYIgSieTU1NTuMzzPL5fLUsp0Op1MJpPJZD4Pjez/Qi8Tbv1zNoJ1A43vzf+ocvOlxsL7wdZVW4QDs2fSk2ftwqzITIGbRysJKFsKSVjlqAwUAkoEZGmJ1BQmRsFKYs9EX7KzqBuYHBXpCZk/Ym1dttcvOrZXb4S1otERZ4eklZRxs5XBQo1OrjUPEwtA6tKVPWpKS2xpqy69Yw3a1KU7Ompn2N4+47j7Ik0f9zgGhhLPf+ul61dXnKRdyKZPnDrwxFOnVleK3/jLF6ueLxAHMqmpqeEjR6cOHpnKDCRzqz+xq3cAxc+5ZTMgsudOLCSfXFvanJtbXV7e3C5VPT8CBNdyv/Sbz549d3RtaePdN69dv7lU2iofPT7+1CdO9NlMH/cymCE0keFWzIAgiplGi8dwy62BEDc2ERMxMAILbCUD884Y2d0GzU5/DLc6tbv8BlgIwZ1py+1JPtoYKaWtJBiqaiJ8MASaLqHpZth9YL1pZwd3+5IQotlsLC8vDw4OOo6DiNVq7c7cXBiEQRAgYiKRyA8WJicnLUulMvlw/Mu+vy62vw7Gby685jUSzaWLUfF2KuVmp55ITp1TQycwOYrOANhpVEkQKq52sfaovsDeKpAPKEX2kEhNg7QBgLUHFABKkA4AAQcAAuyMKGSt5IhMDqnlVyy7VquGzYomDQPjSrmo0CvR8ZXomdAIgSwAmABE69MJ0dVgOoUn3DmjsyXFUJy2h3uozM6Nr89p+rh/jsK5fGJwJLn9eum9H88N5jK3ri96dX98ajibz/zF11+UUmSTiemxwZXFQ816cPDUISg1M+u3lL/BQv0cryhI6/T4qpN9e+v6hXevXLu+sLZRqjX9UGtt6Pd/59cc1164tfzai+d/8qN3L12dP/fk4fGZE8m0FQb9nL0+7lV9BoGBfdKGGAEkQydspj1akHdILD3aDcaERgjojVzaZcvsGb0du1dFW87plJxamTQcO3cAAcmQpZSjFBoKDWG81D0oCg23vKwfdO7EvRHAbQdwi+SgwEajcevmLddN2LaNiI16/ebNW5ayAJiIiWh9fT0MwsNHDkkpRfq4Gn6Ot74px/8Oph9PyXzyyBe5sYpb7zvDR0UiD1YKcwdiVw3rJugAhIXSRdsS6Slin5tLjEqkJkDaQBH5m9y4A0aDUCAUmDDejIANAKA7IMeetK2EWHlNiI16LWw2wtKqLoxLkcyV9IH1YBbBtOmKgO6U9m75KNZlOk4ZaPtmui7gVjeU6Ik+2mmm2W9aRp/T9HHPggw9+sRhx7UViis3V5dWt9544/In04899fSZyxfnrtycN0SVhre8vDk8tzI4kk8NnXVN2VotxecYPzOhYawlDs6bg3du3b5zZ61YroXGoBIpJ3H44PRzv/VMLpN8+7VLb715dX5l65mPn/6N33ri0JEx3w/7v1Qf9/R+xFyPAk0miegwRMa0W2WIdy0JDF3FBkAIIaRos5A9SwZ2px7GTSrx0ypE0WpzYhP7HZh2mkZAmwgFKiHRGEMmHhD1gBAa3hVnu+PbbTc3ddkmd+YS9N6dmI0x1C4NokClFAoEwJggBEFw+9atkZHhgfyAkkCJoVJzOFv4teTEY53XM4vDHDUYDHLEQRmCIkc1Nh6QBpWUAydAOCBdUImYeMRp0QAAKEA6ICw2AYQVoDBOEmr3YRlQSo6eQ5WE5ReB5wGdRi2oKa2Hz27Lo5FhS3T8Mtx1XjEDAQjoiZ/pKjMtrtu2B7cUP2TkOJ0G998Kd1KYPpvp4x4WaRgAjx4b//LvfKT+Rz9eW69cv7HoOtZjj5/4rd/6+Pb/+I3Vje2mH2yXqstLG+OTQ+nCiUxqyrYHpGn8zJs2k0mObpvBO6v+6spmpdYItTHAQFwYzP69f/CFVNK++N71V1+5sLC0cfz4+G/+7kfGJwtBEPV/pj7uaYUGkNhUQk8zpaRyGbXWsHPoc28kraFWjHAcXS+EYP6gZ4c9Dd0CW4EmxEzADEjMAuKphjJ+La0NIkpENkYb01JoOm259y0E7JsUvGOtbesTPeE0sQe7Q216xkzwzqNh9zYi8jyvXqu1fk5M1fwjW+/8ee3q89QsAgCQBisFAgANR1UqXTBbb1Ntjv0NDjch3OSo3mqEiMchgCZvHZhAWCIxJguPifwjcuAhMXAGk5MEIYBhNAAGUANo4FAMnVLjT9iFqXRKJJK2V9Zr1fGKHhYQdeZstkW/HlCHS3OPN70jFXazgaFnKueOolyXR++j0PQNAH3cszCGLNc6dnrq9//ms5Pj+WrDu3Tlzvn3bjiO+tQnHhsaytUafrXura5tL95Z294oVu0pb/BhpJ+ZZwjWldTxRT+/eGd5c6PUaPqRNr4fDRZyn/vsEydOTt++tvjKSxfm5laGhtO/+zefGR3LATBzf+/p4x4nNGCYt0MvYkpK6SBoY3pyQbDX5kFx6zW1KiFCSCEE7Fw39o8366TUY9c8YpiJGQS0pyq3AMDGGCGlJSUYMoYRBeCDU3LaS2Z2/93LUQCgE7cc15xwd0INdHIQe3gCICJ1zVBIzaB09Y8sXXEHJkRyEACA6myqQB5IF60hTAyhkwdhATCiROm2vds+U4XBpuo7IloRVh5EAoSLMol2Du0cWwmKiuyvMxF24noJAFDkZlRUY387DVFNh7I6L2CKkkcE6y6/6MRKx8YhRO7wqHiWXuejd7+K1kR33NNRt7uo1G/a7uP+4jTaSCnOPXUsisy3v/H2nTsbl6/OSyGe+djZxeX1WqXR8ILtUmVxcX14fDCdPZoYOJHcfFvwz8Zp2B1YDodvr5vVpbVytRFEOtImlXAee/TY57/w1PULt197+cLN64tjY7nP/8ZjM4dGDVE/T6+P+4DQIBqidb8REuWldNhEke5Jqt21brbOpmNegkIIIXoH/exyB/cszF0iA908fyJg3FlPap+jgyWFFEKYOG3vATmxvqt3r8cazHuIDu9an7kV2XsX8aEzHqF33JP29dZlN5FM5sdUIt26n6lxtMlCycSUHDyHdp5Zg/GBDaBgoTBmsVQns47ssFkn/yKgQpkDmUKZVLmnhDsJMiWSk7pxCYxmkBj/xBTrOwrdlCwcduiaTrmF2uWwmfMSM4wIDEhtCw33tDO1GrNj8tKuMfUE0LRD97rdTR8US4N9LtPHfQYiDoLoqY+fMkTf+eY7c3c2hRCZXPrk0Wmv6b/21hXXttbWS4t31gbHhvPjmUT+TLr0PpCGnyaThglQVnIPL6+LxYX1zWKl4QWaKAyjp588/alPnSuXqq+9evHixdvjUwOf+fWz554+1qj7/R+lj/tGoQHYDPyIyFG2haSNbvksY/bSs2ASM8XW3XhJ3ZOBgLv6anfJDdyZ39TWfuKYEURgjLP34tTbePVHYiTi9kzlB4fQtJdc3lebaX3nbQNNl9e0qzCdKQd7+ExHnWmxGcuypZQAYPwqh7VExrVSGbSc1oHN1ChcF7mTIn8G7Tzrmi69ysE6cAAqrQqfQGeMAYADNkVgIXMfZ13jaBOoDrrJlGBqtKQ7XWS9xSZCkPHWwYxMgAwgJGYGoWK7SdCBlzLraX+u4h4W7RRp6HS4ce+X0J5/gNBNZ2wxlw7BQdydHQw7BlTiPi3cfcmmj/sCYRA9/tRxRPG1r76+ulZ6843Ln/zkY7OzY4tLm9vl2na5trKyObawOpg74Aw9lqxcEfRTNR8hohH2opldWK+sr2xUqs1A60jrwwcmnnn2ocHB7Pe//dr5928Nj+U+99zjDz16oM9m+riX0Y38iE+ChUCQDWMMk0IUAIYIpNjh1IDuItkRHhlASKGUMmygZ52OT7dFtzGqu7RIKYWQ1LpLhyExcmwaASZmMmQIEFCCFEJSPFjqwSI0H/Dj3FXAwb1um72/bNtpQswMqVQqN5AVQuhG0V89bztOMpsWlmxl/zCzrnO0CXgSVQaAKdg05Vc4WASVEMljKNMAiKhEYlaGp6lx2Rr8IhCRP8+mDsJGZ0KoHABQ84YpfY/NRmvYKANT/PMKJgCQwFqkC0hbtuumvU2vcbHmHiSWwHEkUat/qaeEBEwMEttyFWG8RWHPbLCO9rczO7h3iMK+Ak1fN+/jfjlSSyUeeeygUvIrf/LSerHyyqsXzpw6+PQTJ59/4c2mF6xvlJYW1oZGhzKHh7PJqUTjDprwg0UaZGLl1t0DcxtmYalYLJabfmCIJIrnnvvo+EjhtZfOv//+zVTG+fLvP3XoyFjg913AfdzDO4iUUkpsTxnUWgtEIUVkNDBIQGQwRDvOdjtNtYBxBg2iEAiWkr7nb29thyaCHZMSobvwtD2bcU+TYGwApw+MUruV2xB5nh8Vy8CEiERkiCzLSqSSynYK+fwhSgVoW0KyAQYQAIiC71t3mvoZf7C2NgM9RtfuF429hJMMxZ0+ZIwSNDSYmT18wnUTAOCtXa5dfd5xLDuTRsFMUYsNmAabMkclNk1UKZEYV4VPcLCGzphInQE2wITClskTKLNB9XVTuyASR4V7EFAAEJNP/pKpv6dLz5vKT1ANI7jANoAClkAAhEAILJABbcnAlmO7QT3rX0OeacrhEAdCSGm2gOLkPuyxDXWT9drcBLhtqOHOvKc2r8GeKU5dQQbbg7j7vpo+7kMYTW7CfujsrGD+yldeXlrdSqUSB2fHHjp56MLVue1SdWVpc3hkdaiQSA8+7oRbSm8wflALNwIFMr1gP7K8vLW2slmuNf0oEkI8/eTJmemR+bmVt9+6Yjniy7/7kZnZYSHQGOr/Cn3co6upUspSiWQylUrXa7VqrUrMQkkkE7QmaBMytX3AzEBdu0tMTAwBsS0lo7BcWdwsbm9tx2usIdNp344LU9zbj8MMgKHv5w5NnTg5S8wIzMBBFG2XKtU7C8AQNx0nkonJqalsIqNs202mhqRUnthYWbaHRl034YVB028qRNdxBWK7OAVKKSFkPJZB90xqi13GRPfKXqngp15Hd5t+99hrOC7TAQKAZduFQh4FAUUIPDiQnJmeyI7MAkBQmq9d/16w9n5ucAAkA/uxXxeEYhOwrlLlbZOYEqNfQJlQg58CADY+Na9Ga1/D1HGZOA5sotLzUemPOFqXmY+gPcogAQh02VRfM43XmdZRZMHbZEghZABTAA6wBBBgJFBcDxIsQFlSOckk1UaDP5eDYxVxuESjdSr4PKw5qTlBJFBw3NbPxF2lD3vEGYCdgw+4PS0Be0e+98Tt7aYwfZGmj/sFWhtlq0efOlopN7773feu31xEhIfOHFpc3ajXvPWt8vLi2thEIXnscNYeUn7pA7k6g3IbOHBzUy4ubRVLlabvI+LU+NBv/d4nb19bfOWl85YjP/+5R089MsPMfTbTx70MoaSbSKSSSWC6ffvWrTtziVTq6IGDlEmERLGfARkESg2Gu/HA7XNgQDKGtBGAFNs+iaHVXwuxHTPWfkgzkeFYyxFIZAAABQopLctStgWBDwwRsUcmZQwDSgEMmMymx2emp0bHq9vlyvqWNkYKgVJcv3PnE8987PDU+Pr26nsLc4NW5qHDxweyOUMUG3lq9Urdb0ohs8mUZbstBxBRGIZRFLmuK4W4F34CtfcIc9dDz44Tq647u/UzMQAKN5ESUgBAoTD4zLPPmKgiqOIms2CNAgBQSM2ljR//v6vXfuC6rmVLoNA0VkT1Flo5Dovsb0JYNo0bHG5wVBTpKRCKo7KpnzeVF0x4HigQ1hEQSYCGTJ2j4JJp/IQ56BwxhXsUnRGMJHOdpUATsImAasgugA1oAyswgkgASRCMgpUERNX0TN4UR63VcaepRboCD1XMdEUPeno44rwBh9iKvwYR+2uI4lFfLcrSqjN1S0otYxZ0/cPdLxL3+7uPPu4TkCEC+NQXH/VD/cPvn795ewUZzhybvXRtoVSpr6xujdxZyw/ly5kzSjecxgKL/YdHCta+Pb7GBxcXNtbWt2v1pueH4+NDn/30uflbq2+8fhkFPfWxE49/9LjXCPpfex/3MqSUm6XiqdHRwsDA91944YUXfrCxsW6UWDxz6tC5R3SsYWAnHbhHBujRCpjZaKPDyBhq9zu1At+kkkZrrU2v5VdJqZQKIwIANhT5gdbaSboUBIzMwKE2TR0hABPYrm3ls42UdfvW7fJ2kYiFaOW2pBLJV958Y+GmAl18c315KnMsA9Hs4IBSKp5k8uJrL1+Zn8sOjDxx+olDk0NSKmlZ1Vp9eWW5Uq8fO/7w4OCQUuqXXqj60JJTrw7Bu5hNh3ECsMTQEQ1XlMBEDLYQynEUuEMAQ2B8DjY42jaVy82L/4M3f4sNWsq2lOAoNGuvU/UGujngkKNVhhpISf6V4M5/CcJnYUAyoES0UaRApEjPqYHnnLH/HFRab/xZVPlziOYBFYAlEg870/8UWOnNfxNV/h1ACKKt6OkIjAEKgRUbCUYCCSAAEEIJKWUUGGZJbBtCwCAnX8rboVBe3ZwuR49Xo4maHtGUIkgxukJIy1LM0JYB21smtNuaugymk3q0M1qPeU+EdR993FdSTWQ+/9zjibT7V3/+6q07q8lUIpdOBH64tlmau708MJh1j06n3EW3uXS3g5wQYj0svFvOz9+5tLVdrXtBJpU4eXTmwKHJb/zlT8LA+8SvP/Lksyf6bKaPexyIaDu2rnPNq4e+f3turlKrhlpbqDbK29vLtyJBgABCcFygaQfAMVCbsSAIJEMmiuJ8WmbqzeQ3kdZaM4AUcWYMx2YdYnKTCTeR8OoNr95gAOE6KACJgdkwR8wOIhAlkkmTcJbC5pCJsvmCLSUAEBETR2FowrBRCSBqJIkd2y7euVh57UpQWgGBUdTYDFJZmRweGDBB/co3/9hxk24ms1Fq3FjYlIlsOplNpzO2bRtj7jFCs29Y8P73YASSGAlsWlhNydUBe75+/Stu7ohIHAaZbQW/UMTeoim/R5Xz5G9H9SSDFAKFQFQ2JgbRskAgmyZwkyGAuFCDElUChAVS7+lOI5E4LAfOAgA1H8H6dzk0AIgy7cz8X1X2MQBAyzXNixReZiREAcgg2v1WxsT920AcZwAjghQiAmxP0bBA2CBcg0abmiNujSWujyfAcLLJn6vKz/pq0rLT2Ww2jMJmo1Gt1jzP61IT7kQHxyzm7l3aO7/qHRWsPvq45xEfc5/9+MlsNvmv/vvvXb2xcOTAuGaaX9pksxhFJiKVnhxKpaes+hJ3Qr27Gzw17MlrK9arb1+5M7dYqjW8IHzqyVOPPnLkh999o1qrf+G3njhxeioK+y7gPu4H2ZJYB1GtVh0YnXji8cfnlheEkn7SDQYyiGiIAYAQSWAs8bdbXdsJ8wiIyESkibmbS9teg5lM3OGCACCkEEICABlDmizHHp4aa5ZrKEQ6P2AQe0dEMWLcCc4IvtFlxMzxmZGSP2jZANBs+vGrZQt5pWtbxS0hSABIoSw7YdwUAIBAESoMNUaaGYJ6PaiUKqtB2SP2HUtIidhpf/nlE5qf8n0gYm/PNgJbsjlgrYxY30uJtxC2iW0KMdogblEGAAA0AskGcoBclKnIF6QJkaWbtaY+YR/+TZE/DHYWAEzlWnDpn5J3GSACZAZCvNuIKRP/xMC67RGXzGG08s8R/zHao7r8AwpvAlCbJxAAAQhGB6RCFKAFEwFQy/eDoDWjNShTA5iewcQooAYE7b9K4TWmOoBAmSmMf3R05IsgB3rfytbm1uXLl40xcYVpRyGRe7JsPoys9G00fdyPB3Gp5PGTE3/3b3/8T7/y8uJqMenaQwOZRtPf3KqszC+v5seHcgeH6vuINBLhdmPo6oa7vTXveUGo9cnD08P57J35tfXN7d/9g4/OHBpWlqS+b6aP+4Hca62bpUrVtqOhkUKhMDM9cz66uTCRz0wOHyBmzQKxyrrGJieEb6Juhl57VKJgNlobY7AnpabTQIs9g5Jtx8kPDdYr1TAMpaXCIFi+NT91cDY7MkhDuUYUdoZ4IyJKGc+mDLRGLxhiGncjJYU1O+kq5a5tSpT5gYFMfmB7/ur6Ql04AgWyYWplV3JLMOJWeAkAshAIsjVigQ3eM8uX6qymeFeR5m4LsNDs+pSu6xmWRQsdBJDoA0bt8kosUggACazi7k0iZtaWk3Gnn3Wf+acAAKQ5qgMKYWc52gYOWw/Eve/sAyCAgqjy56bxGlOdqYgi1f4kDGihlUd3QrgnAZPIADqixrop3eDAQ2CpLLsw7Z7539jTn+rtMnUAguX/Nlz+v6NKujP/jSp8GoQy2tORz5gAANu2G42G5/m2bfUwk94k4d3emp/lQ/XRx70Oo00i6Tz2zLHV5eIrr1zzAfK5dNMLKtX6yvL6zYnRfGI45xRkWNn1QO0MXl2Sl+ZrlWrNNzrh2E88cTIKooXFlU9/7uHZw8NSij6b6eO+IffGDOQGTGTu3LlDho4fPtIUQI2S1fATI4Oy3LQQl4mg0Zzd2GoGPmnTipxph4Ewgu8HIISbTmpjiJi4Z9wOxD1QhADGmHKxaLQGABMxMkRBcO39S5PHDo2cPrzq+aYt7ZAQMfEAIXQYpqPESH5gKJG5PpF8UfrjIX12LH98ZObgwYNXrtyobq2bqB6kCiyUsB2VzDomBGCpm8KPSEeGCRCUkwQ2QFJEIcXMhxnujTWtN1jvw7WCjhU4jtU1ZJWCySJPI/ymK2sD6s6Q9QNH3BTYEGgQor3PhQhgIjVyJHHo063j2sJ39dqPKNpCoTlYjxvhY9IL3DssCe+mcTAwokKVRxAAhOgADgLH6VsaxKDKfsYa+0NZOLfrgcF7/4/oznc5rLrTTxWe/i9Ueph1g8rnyVvE1JQaeByEbeU+Z+o3dOMlmX8WhDK6ubG6ODe3UGsSESWTCSGkZVnQzZ1uM5cPZGS8Y6xYH33cz5zGkBDwN/7wk6Exr798LfDDkcHcRrGyvrG9Mr+8lhudGD49tP0qAnGnFRDEVvrsSq22tb5cb/gA8LGPnF5b3jRGP/zo7JMfPx4GUX+yQR/3l0gzPT196fLly5cvzxw8wMRDwrbThWYmuW4hIEiBiYQdKJjz6nY90DpiAFQSJBIi2hbbFmaTzvSIY1usJHWKOIZ0FFEYGT8gP6QgpDCkIBJaM1HcpwIAGGr32EE8PLNe2Yqj3QQCSjSW1AiWpRLZ9MjEWK5QuFDd9HODwxILynUmxo8fOfHDH/4wmUocOHOmOmBvl2qTAEMzp6YefdayBOvI6HD7u3+1vXA9AKOc5PTHngMTAUW3524vXDyvXWGQ7xGNplehwd7epd0UZseVMSONb2cBmok9nWiEpxbMKVsGObU85Lyds16VoiaYu/4nBDctpGK0UjI5BADcWA/n/lxvvYxuEoUBCwAEMAEqEBYqANk5RTNMIfB+2aPUEOlnEsf+VFgZADD1m9HG/xRt/XNAG4isqX9sT/4TRAAKmUJgAmGjdAFYDpyK5IvW2FH3kX8k08NMUXj1v9Ebf0WwIhJDcOaPVOY0MVXD4yXvwDFwJACgYyeH88OQ8LxarWoMGdKtqQbtoQe9cXy9XxnuJTd910wfD8jRHJqN4G/9w0+lsslv/9Vbtm9LgfWGt7a8PjdSKBRmC/iG5M6+jFokV2BqrXqlXKkywnghn0i4m7XiybPTz372oX56Xh/3I+r1+vHjxycnp27N3crmsidPn1peWFysV9M5RyIkFNrGZA5PJY7ONrfLSQSS0khBUipLMrMhCrUJjA6MjsgQtdZeEY/JFqiEFCgYkRERBRALbVBrAcAA0rWXieYrRTAmzgVGQ6xkkM+ER8bHQ5g5fLgaha+ff8edGs+vlFKAEtWl+dI7L77s553S3M3c0u1UCANTh5U1Utmc56V3OWqCkEKiX9oUISEhM4dBYFm2nUxZySxIS9M9tIDt3+WEO5Ua3DX0YB/lBoFJIIHgyIhNPbXenEH4zZyzXrDn8/LdJM5J0LEJlwGEnRGpIQAA7YGwUGVQuiA1gAfAKAuy8Kw1+bdE9iFsN3ySNx8u/w+68qfMG3uPpiismM0AgEwfoeDxcEOjkNbo/94a/G1E4KgSzf2raPnfmsoda/YPE4/+10Ca/RJoX2an5dBxYOLSFURUw5+B5BQmZoQ7CwDFxuCN0qOValXenJudnXFcZ3CwMDhYiF/L9/07d+YXFxdRSMSfsZLUn+vUx4MFHelP/9ojmUzyL/74xYFcplJrbBYry8sb40P2oZFH8vVLQjcA0MhEJX1isxxtl6r1pjeQzzx05tDtW8uffe6x02dn+mWmPu5TIGLg+5aSp0+ctG2biMceHiqE5W9sXrcQAZBZ1xu1GgDYaIgADDNoQq0lC6Wl1AqB2SKSJkQTsTEKwEE0RIZMqFuyJfPujmNg4HYzIDIzsEQOTWQbGvPDZISnnzx3QdElvyG/8IlSKr0CIJmkMcTkITrlzeZi6Vhp+6RIpMEXSvi1crh2w6+sA4AJ617dUhHbwKHXuPHWV5E1k19qGuVZScdFw/eIC1TtpTK70pURdshJreHV0BrSyPEQx567xJ32QhhmLvlDRW8I+LGErBes5YK8PZS8njt4yp5+UrgDAADpMffs/wmFBCtjqjf99/+3aI3aR/531sSXAABYU7CKMoUqKxKzzqH/wlz6AfjXd38I4ZB3J5j7r9T435bOFKBENRDPolT5Z0Vimk1giq+FS/8SNAt7mCs3gvP/DEGGC99De0AWzgAAoMDBh63Bh3u0E65Va0tLi9vbW0KIa9eulUqlQqGQzWZSqVQqlUKBrutOT08x08ryKnJPLE3cqvWz7g/9Q0If9zOIOJG0Hzk7GzaCb3zzbUQRhNHqysbScHp59FAab7pQB+BIJhfcsyu317e3y7lMemIwv7Gx/dt/55mp2UEpoF9p6uN+hzEmbn2VxNoYFJh0bEZ0lLKkilBVWDZRNlEFAAbYxDOWgAFAAgOTVAoZEDlE9EEoBFdIF1EhC2YgBiAgQiIgA0REhrSOtA6MCY0GYiACYwAhkx146mMn/8IONxvVJLEJwsg1ApGAmUiEYRKAQYhEQjg2aAS04nyaeCFHRhAyrjkQA8Vjf0ACSohHJLZcovewQrNLSYiJDOxkhp0RRgxxynIrHbcd+kPQMgYTAzSjRD04tMCHctkvP/rxc4NDw60lXLqYOwQArAOgkE3kHvtP1fjnmchU3g5u/BOObonM0/b4P1LDX0DhqtTnyFsADnfyYpv1Srj9L8XAR4U9jigBCEAJdUrYUwAA4RZVLwALAAZhUX3eVJaAkCOWydm2XEJL8/O1epOYicj3/EajUavXiUgIEedGbxeL28UiIAqBlmWfPHVidHTUdd1MJgOw2jsEtTP2oE9T+vjVEmm0yeZTz3z6dGm7dv69+WrNK5Vqi0vbV8dHJwsTLjRZKD91YLNCi0tbzYafcO3pmeFjpyenZgctS907Gep99PHXUmuEUJZlJRJWFKa95MxgwpKWFJJANAyz1kYbZraBCcAwahYBcwSkGTUIR7AAiHPpmdknqBqNiApBIgJABBJRKglKoQCUiEMSJ6SUACUdcRQ2mo1yvW6EqOSzP1FhBYBdVxOgNsgEKFFIDr3BavMTiWzWHXnFyYO0TcQGbGAwzIIRCDtxaSyYkeLEWGIABEY0AiPFBuDe8tDsMKh2wpj39Dt1OreRWw3ubQ92ZwlHQG65trmj6HDbn8OhhurmYsaKVKoglAsAZunHZutdU79h6jet0S+L3EMAQLUL4bX/C0frIvmYcI6BaI2DMf47rDfuwsN6mQMjSmkfAOF0b2XBxPEsJ2DBhMAGGKE1GRMqtebc7dte01NKAQKisCxl2bYxRlnq6NGjzUZza2ur6XnKsjOZTDaTEUL4vh8EYZwi0N+N++jDGHJc9Xt//+Oe/73LF5a01mtrW0vza6vDRzNWSQgo2keWr60vL28M57OZTGJ4LHP2qUNkqM9m+rhf6QuA5djCto0STTRl8ismQuSqXy2GvnQyeQaPKCBDzAIgIwRKaDKHTBrAsNBMFnPAMkQmZgEsgeP4E4kAwKqdhkKt2BJEAAIIGSzEpJANxroGAEaQoBI6m0gmM8kwRIaM62AQhraNQlhhGC/qlsBmEDTrjZHMSD4SI5yqyEQg/RCUAfRsCSll2EZAHelAs88mdAWgdCemJQIiNMrlyuZ2NZk5huIe+SFUh6q0VJcP9gUztytOsf+1/ScKoFiSQYGCYnmmpdT0zFIX0PSa5998uTGVP/HIU2LwCAAEd76ul76LtoOOKzOHUSUBQOYeTn7kL9slLwQQwDrafpHCeYAPmd8LAMgIRlBUBzIAACKB1ghQPLIAgQDIIKHKHQ+qFaxvWABCiJOnjgPz3O25KIqGh4eHR4anZ6ajMFpcXKzX6gcPHRRCxH350B7KBQCVcnltdRX/fdCZvqLTx4MBZjCG/tYffuY7X3/rpR9cqte95aX1d8ZH88OjjiUvbqUX529FkUbm02dnPv7rDwVe2P/S+ri/YCllJ9xA4Yb2l6Nmk7w0uxhBNQorURgYLZRKbtfk8qbte+70eHIoZ7lJGwUiErNndNMYz2jfGM9Qk6hGVCP2mENgzUDA2G6HtoAlctyMLREtQIlsYyutEoGJDQALBAUgABm5QhQJkU+nZ2wrbdlOFEnDYNmhsgSiQGAiN51Kg1hvVrab0ScffmbgqU9fXl782o0r49o8+uivj+cL2mgAECi+/tYP3rh1NbLTJ5O5h577jxHRVtblhVtX336lVKkTWsj3pIcG9kTW9iT7tCpOsVWkLcAwMCIztSQaat0nLqxhe+g0iHjIFgI35XBT5LrrNhEYAkPACjNHUSYBmIJt9rfiVCAKt6h+iWovRt6PAXxA56f4XBIMUe0tjooAB9EpqMnn2CtS9QaHnkhMyeGPiMGH0UrVv/2feEsX+WgjlUpJqU6dOXXy9Mm4wBSjElWMMWEUVcrlfKEgBHYoR7PZXFxY2NjYjCKNrW8IeyJ0YNe3uNsD3Fd0+rjfT0w/MHvAsvHjn3lIKfX8199aW9/O3bzzpph0bGtu/s7ySrHZ8H/9tx8/++ShKNAfcDrA3LfU9HHvUHUQUijHqjvyq1tLq1VvyHZHHNcj09QafN8WaAthC5lSLl1f2Lp0jf1waHg4OH99/ImHvYLlAdkgbSFSypVCCBRxVLBmCozxjWnqqKZ13ei61tvGbBvTYGYGRwjVihWmiE1ch4pVm46DtZMwTO3yylZECcTH3ERCSGlioaGdV8sMllVMwXfqtUaWn9KVg9X6WuRTOuUl7Dm/QpBK5tJMhAibuYHG5AGlrNWkmE5KKZUl5fZAujo96Uzo5YJzylUFIe+90Qe7fz7sMcy0eAoDA3WHMrYKTm0egwKAWsJMe/Y29F5ARBK2xkT82kgIhNzqRZPxXah6yX/nP0QnDYIYNWAA6CF7IC0mEReJAADYMHnMAYLYURxjBCOBpdl8XTiz6A6jnbNP/EfABMyAAqQNgBDV2MrOLZeD195+9NwjAwM50TMytLhVLBaLa6trlUpVSPHGG28mEslEwrUsZQw1Pc8YTdR1Q3MPg9knTG8Pa+xrMn38kumI6NlAd2iM2DN39a70Wwjc3KiVt+tRFO3rgLdde3g09/THjgvg73zzndu3lgI/UFJsbpaLW+Xf/oOPPvTobKPqrS4W44m2u0BE+cHs0EjWsuReWrPritYYv/Zu1YmM76aS9dHHX3+9lLJi8R1oLpQbi6E3oFTOVrYUCSXzlm2AIiKfdDkMIs+rvf3uRCLjDg0tr6xIIRoXLq+O52rZhGvZlpS2lI6QtpS2VK6QrlAJKTNKDTppS0gEiIjKkV8JQ82QsdSKV7/q1Vej0DATUIvrIyAAEkFrrmK8Y7AEJAaB6DMthjzg4ZiSAfO2IQt39PgYWzUGcqExb1aLb/jNMNSJpAoPTv4Z6OrmnL3BaAwyRQnkmZEmwNcw+Nbt91lJElID6KlhBPwW8ClHHFDSD3/Jrbtqxxq7V5zpPZjxnslD2C5CtZNX4jyf2C7Uegx2j55AgtkgAAlXq3R8vdFMGqQtwBBX53ngONq2SEyr4ef0xlcZAxRSZB+2Jn5f5B8PbvynXP0Jxo3vKKyRL1qjX9Jb3wwX/1uKloAlgGx9LmMBOuGd/x/7a/bs/xIzBzpGHACg8m2z/HLl8jc2K1C1HylvFn/8gx9ZtpXNZqVSge83m80W2+WWc0gb02g0PK8phOiKVgKxlUmNuIeZYF+M6eOXoJq09r1OVbTX4NW6DpGJb99YjUItpIhCXd6qlbfrRCwEBoHe3q6Vy/V4d0bESNP6Vs2PNO88CBC18ttxn3MhCILo859/9Ne/+NgnPvfw+NTg9mZdKSWEmJwtDAw9dOqRmfffvPm977x3/faapeR+Z1MghBACe718DCAF5pLuQC6hpIi5CiKOTxTS6YSUgomFwLGpoWTaQYG2rfKD2YF8EuMBN9wektPeuwGgJ4+1Lwj1AR8gFjoJ1wN/xa8rAY8N5HOWExq94TWKgedp7RntGR1oE4ZRVKo+lEr5TW+juBUEwfjo6CtL80VdwJFBaVlCSpDx1o1SoBDCklIhShS2kI4QloCZVCYprXLgrzRrGaVm0pmCxK0gxNbUSmgZc3dIDu0lOBZhGBkwALjseY+ns1niLa17DRvY0hckMEREkY5CIksqR0o0OiTNxiitwWjJJNpsiXRAyiLLQiktIQEYwMj2+cMvd6lT++vI7b0ad+gICAjcHoOOgO056G1bCcRtTrGVhtt9TrGJuCXnICIgCgGinYLo+REFlEwq0jpafUWMP4N2VqRmnTP/pd38BwAa7BxaA6gygFLlf4eby6zb8XrCAQBU40ApiIDL75LMo7BM8S0kG1ACcbTybb3+hrDHReowgDLlG1RfY41ho1krbVlDDyWc1HbAQRhEURT4AYo4MICFQETRqT21JpzGWwy2yAy2Nol4C2qNucDeJaU7bXtfptNHHz8PX2ltYwiidaHFqYUU6yul4mYVACrFemm7zszlcn15aSs+fK5t1Sp1XwgEAB0ZZo75OhnueHKZmYh7LboMQGafKKoPJupE/N3n323U/b/7h58++dB0ZzBb/N5vXFp8/vl3L15eFEKEob77KrLP8alaaS6v73jtS9dX4w8VQyrRJnMopBACgUEKkUu7gwNJYs7lUvlCxnGUstTYRMFN2rZj5YcyhUKKiDtpH9ymQK3/98WeX+VdDwAFFpvNd9eWq4wns+lBaa01m7drVc9QRBQZMgwG2EQ6qtVTDj45MHYilW1EwdtLd9Yd5SFagUZNIEXLZNrefTvdM0yEzPmEm0V5rdm8tl2SAEcGMsdzuUEps8wNJhOLM20G3hNK005Q6dyMyCA9BIlgIYq2eaR31wZgC1gIFMCStWa5VK/WtDahT6Ff9T0yAZFhAAWcYRixEphMguuysi2lpu3kbw8fHwa75nm/9M6YuwTrtQpLADt6nTptS3HVjqE9AyGmLNwWbKDttGnfHUC0fiwQAlAq1K6IRxNAEOiwEagEOS5G66/L+eftw78DzgDaObRz3e/d3wwX/lhvfo2Dutl6K6D/mxw4CyY01XdN9U3y7wCIaPlfRSt/AoygfeAUk0BCIEPBFjVKWLoFhBxFYFiHWCt7bk4Opi+GMLBhDiBQPIpdcDz4AlGIzqbWFmJ6CEp7vih2O7X3dQb/tFUl7M+n7KOHtQjRJi2iw2FASFHcrFXKjWbN21gth0G0vl6uVZueF1ZqXtULgEEbMtoAABkyhgDAGNLaxNus1mSI9npf9my5O4pI8d1/Vue7lBhq8+YbN0wQ/f3/8HOOq5gYBZLhzY3Kn33llZu311oazAd9FbCveGOIuWfH0Sb6MCbEAFgsVueXBDNIiVLGpAeVFU8LRqlaJ80z4wMCMZtNDg5lHccayKez+VS2kB7Ip9IZNzYKxuyGuHW+HA/w62+6D6Yy0/mDGY0Jmv5yM/DCYBIRw0iHUVWbqDOTOd42LHU9ihZKK4n1eQCoKBll0tJxkBkMMTEg8g4Nn4FIEEkyCUsdGxu9vLm1WatHkXYtiUS2EGklMxKiiDSw4W5lFZm5JUDGkmPbWcPMiAaYBMYNP6K7M3QC5aA961u4Qg1n0+OjE9ejUKBxDQRx9IyQ0k2RsAQiCCwJRZaNlpuyrWHHOZbNT+fy2AwbkYZfdrev+qB1ddca2yPaQscPyPFQrfjOCCgYqCvtMHdLUe38HVeZBGwInQYYAwDDwvcCVQ8RHcuG4Nq/1cs/lIVTcvA0SIejMnsrpnGTvFugy0x1QIu9Db32F3rz28DEpgEUxvo0cxOoCYwAkkkhABsBseeGkE3IhAJUGFKzGagUJAfQcsIhXJrG24vNAwLbIkuHh+0yEmD7sN7DbGDfjm1mbGcTYXcD2iWD7VhT+gMrfwUhpBCx0NIRAgUaw5VyY3O1VCs3q+XGxnqlUml4XrBZagSRiSJtiMmQjjQzR5EhQ8RsDBsi2GnU7W5zXZcbSPmL67GUUjS84N3z89l/+9Jv/N5T2XyKidc3yv/y//OtuaUtQ/zBbOZDzwF6+BZ+GBOKdVSINAGANrwP9WkvXVubFQSUUkglhEAppZRCKCGlsJTMJJxsxslmU7lcMl/IDI/lbUdNzgzmBlLaUJvmcGe4YD8q8L6jL/GRXiJKKZWylKWEFAIFK1RNkRKCo2iryp6tXB1hveH6gUuMEhlF7L8QDKQkpFxwLCDKSwGWYqPZ1/EqIgAY0TBB3KTNIJkdSw3mBwqDQzfKla1ag6LQApaMREYAuog2ALKJ51S2VieG2MnJ3Th/NNByfcQhfMjAzG0zMAhAbi9JCjGFKBB9xCZxg9GxHRsYJXg61AKTltKWe6owfCibH3BcBq5rsxUGVWOylnMsnZlN5VaETuSsgWwiEZhSuQLil7aUqbucA2FLseo5anSqRrtORLBlDY7vwm2zcC8t6AbYMMiR5PoA3wznvm5IcuSnnTumkKnXQmZIZxyLGya6aWoLuPYTEACggX1mDyBARBYKUAEQmADAb79VGRcTmeMQnPgfwQSt1BlCIGBCwdL3tOeFIHVuWAnHGCmz8vqkgPXwH1KbrbT4Kor4CtGR+Ht5TIfX7knx6X7qdnfY3U99+/jV1WCIaP7WemW7Xqs0t4u1zc1KFOrljUoziNhQFGptyOj4D0PEkTbcGu/Ytewi4k9T/fmlLhAQBPVvfe89y1Gf/cKjpVL9z/7nFy9dW6J7+D13SmA9J+fdo6AUQkqhpJBKKiUtWwlEy1G2pVKuNVRIZbOpbDY5NlkYGc/brj08nBES+/LNvc9kBGDCTYiE0wRTMsFG6NeMF2rSEREQAQdGh76XkUoxR2FUJ/Ik2smkchzQmiMtjEFjDBEzQ1y8ZAZg1pp1GBu+BLY1WCGEEFJKJaVQlu3alutUpFwtbm97AekoXlYNcTkMb1Q3y2TWWFRkUqAiiHNIOsIDWth2RQAgsNXxSCAmUFz1KWBUwjEMUWtRBAcxI4QrMDIUAhuGCFAzhACRMVpro41BqZR1KJs7OZBPWY4B9gxN6qgUhsUwuFSrvFuvzTquK4QhGrcSny6MNit1Jvql7N5qH20We5lKxwPD3fM87AyS5s5whHY3E7YsfLGmJoBNt4sbAUDKkeSrA/h6VFOsiQ05CXdgyqpvUm0rJOJ02nZciRxRtI2SAAEEgERAt10eJMCYxOyQj5gROLZ5I1Cb1hAzIxAKRiDRaES+H1pJSg9J4RgQBgSB9JJyfSJ9Z7VxwIDs8SR0nArYLjt1FBoBXSdwjx7fO/igR3bBvSeVffxqg4ibzbBe87Qh27UHR3KZgRQTzRweI+Lu1tTdc+7n4EYGYh4eyoEQiaTzyKOHzpw9eF/vC9wzUYe7F1AJtCyplFRKosByqW5ZanAoLUD0S8r3OFKJ5IaMbpDXCBoMHAJpNJEgQ2SAIjLa6CAMhNYWSkmkGUADkQgQA5SgBEolYoN5S6Kjdl9tV0eMnZdxnj4i6papFEEgoIBQG4p0ZIAIuZVDQ0zbYXip3hhLpc8NZLNWwhIyXgiJQTOHRF7c8m1MReuqiRBZAgpEFzElhEQwcbANSAWgBCJwyOQTB8QhgW45SIABDENAJoi0iSIiw9JyBQqmQIeaKWT2jQmJEXjIdvK2U46i12uVgAwCKBSv1av/pDDrhCbQ0S/+mKU+4Bi00x3cUmzaITTcTQLmFpFop9K0HTQM8SyI2FwY+50mkjey9gKKCnEKlEQhwZCdMlkppIXV9VAbSoZWMmlZjgVEJBgpLmvF20CLMu0/rZzjWQttqYiRSSAjEEYhNRq+4SgxgG5OSIcYDUgDwrBAWxSnUt/d9P/QkBOnPXe8wK3PKHr8vx220z4xbruCu+oM7ux77dabuPWAvRWmPtX5FVNowHWt2UOjO7ahdvd0Z+OWLRlAiJ2HBmImQ1qTMQYRLUtZtow78sJIR6Het8whpHBsFR91iSjwo33vFpt1bNsioijSwGA71ocdm1hr0rGGtN8TxskVtmMxp/ODmejuLuD4zo5r4V0OS0xMzMaQMaade7U/LEtatvqAOyAAMUdhFJ9IC4HKklLK+G1EkfmA99lR2ixb2paKIhNGmttOmpabmDg+Fe/ba+5lSCHQUtdEswokJDqh8ZtNYnO9UtyMIo2AABEDGY06HHfchLQkgmSmuM0PgAGJ2ZCJiIwxQCaJYsxJDLmJtGVJxEjrehhs+145CqvMRkoUUkohpRSAguIeGgPAyIwM7QTYFn22DEXNYNtgYEWOrEshNLMQwpHSkdKSKiXVqO04QkZkNsNgPfC3tWZmhSChZTcjZg3QBADDzGCYCVgAWAIahqgdUWOYA0NRFKLRiCiEVAA1v7klpVQqIA6IQmYDkLOciURmOpl9r+lVTSQFatINr7YtzAjyL2VFU7DPzIMdmSq8axJCt7W7M7AIoccj3JokgHFeb7e6LQCF0pPJv0xYdwzbIKir7CArV6aHpZWQjc3Qa3hRYLnJhONayhIouEWYBLRHPvb4lVsCWyu6LqY1TAgMAgSy0GEUNP1Qa5mUiQzaSRCWYWFAdAgNC9FMyuujqYUN72hENopup5Lo9jK1vpCuPRh7KkrY7vvqWif3kWf6rKUP6CErqbQLd1m3hUDbsYoblStv3rxydXljuxbrHIjoWiqfTUxODh4+MTk5M1Qt1d9969Y75+9IIcJQP/744Y88fTyTTVDPIhqfjpS3619/4fzcrfVs2h0Zyvzac09ksoldFg+BqDVtrFde/dGFbDb56JNHhRI/+d75aqXBbWV+1/LMDFKKI8cmj56ayuQSZue4bIGoI7OyuH3+nZu1qielGBnLf/oLjxIREe/6+AIxDPT83Mbzz78TBFFvLlT80q6tBgdSg4PZicnCgaPj+aGMMdSiHTufyrGtd9+88f5bt2zHiuVkJtglkxhNmVzyIx87NTiUsWxV3KjeuLx0Z24NEcMgeuSJI48+eTTwwrvtt1KIZsN/48Wrb7xz6+zZg+eeOJLJJXZzxH4r+D2vtpFA7UqfYMhnWfdNGGmtN7eLM16jFtZvQlRTUqAwCLYxyQzaSdna7pkNU6i1NtoBfGxw+Mzo5IGhkcF0xibQjaZfrXnNRhgEZLHISOW4IuGQkg0TbjUac6Wtq6WtpcBny1JS2aLlqOO4i4aAAeLcvUaoA/LKzdAAAHBGqo8PjY0aJephFDQ8E5lM4pIOqhKTbiLl2NOuO8Fw0/eXwkAhIrAB0MRBEOjQs5VFiSQJKZkd4CSCiTdSBgDWTJoMRyGSQSEYkZgqgZ8Q0lJWyKwBfOYQ2EIZEfkUMrBCjDUhgfjC9vJn7cFRYUf8ix5monqpDO+SC3gfCWGvSNOdXYlxJxP3FKHi/mYgEgr98cSVhJoX6BPYIFrzrbhVHNK2Q67N2jm5UZ2KqtVs9UrCa9qOYzmOsqVUCKbFbFoWqF2BvPH7YAAQyEDEgR9Q0KzSUN0+bGXt8cwN1y6yIBICkEFqkATCABILFhhMp7/R0H9QCg8jhj0ZHj0A6A7R7mQD93bN9lKXPXWmrtlhpzzT72/6FT6W7ic1MliOCoPoB996990L80uLW8WtahSY8dFcbiC1XaxubdcJYGQk98Ry8de//EQ6m/RD89or12xbhaGWDJNj+VNnD3AvsUBk5svv3Xnz1eu372wkHCuTdsenhh5+9GAq41LPPdES5e3aKz+8+P0Xzj/68MGHHj3UqDRe/smlta0aA0sUjiVdW/au0UysLOk69uyhEcgldok0whKeF3zzq69dvrrkBRERT00NHj8zPTySE1LsujNL1NqUirW337rVbAZKSWMoCKLWyBEGy5LplJtOJ7LZxEA+ffDAyKOPHjxz7pDvhbtGQUklbt5a//Z33kulXACwpHAtqZTofedRpIdHB049cmggn3IEVkuNC+/NvfbmDRSoI3Pr9ka11Pjk5x/xvXB/TiIgiszy/NZbb9ws5NMPPTwLnOC+Bfj+0koBI6QaREM144ZUqzSbjaYQIgMWspwoNTeCejHjSDfBEgOiZhiFKkCmUEc1P5hMJJ6amj07dbBgOVCp+ttlb+36YtPzml6j2fQ9L4zCeICARGnZtuPYtm1LSzm2fSaVfHjkQOham2Fwpbh2s15tINq2bQlBPSuIAPC10QSMRjBPWs7n8qPTxh5Qjp3KaEeXq9U7t5dPDQ1cF9Hl7bJIJefTqY8VhkdtaznwawwCmADzzJ8cGnsmO1i5c3Vr/VbFwblM/qad8wzKNp0h5oiItCatkRmFRAQi9nRUCwNlTMigETVgBBBaxiez7DUjMrGXVAIQ808a5ScSQzPKigL/F+ykUXs12P3HUUKPSNONnOGOBNGmMa22bW731QODQCC0bLExmfgziT6x1aIeggBZiECwCPTEtn6kEgxXYaqRyGkRbLsns3o5699KeBuO0sp2hWVLiVJJIeKSNO9gDAyk2RjNUWCMDsmu4sS2NVuTk9oeVLbaik4VxNqIcymt5lDUCSULAEGMsX2JU+pKwZ0PeSIgG5FjJzr22IS7FG2nIZN7ooF7r9thCe6lQXuLe/3jSh+dQokttzerb7x89dvffndzuwbaPPzIwU997mw25TgJK/Cj9fXyhfPzF96dGxkvWI6VyydnDgzlUi4JlEpurpcW5tbPPHZwVx0HAK9eXqxVm4mkjYDNILr03p0DB0eyA8leTUUpWS03zr97u+6FUwdHBwYzlUojCCI/0oY4k7AfefTgMx8/1ZscE4c2FQazybRrNO16XSKuVLzzlxbqXoiI2pjNYu2NF69+9jceS2cSWpt9C16Oo4whIp6dGf7ox08ODmcFoiEuFetz11duXF++fWcD7mzcurl69crimfN3vvBbTyZTro5076FMG/JCLSzNzKePTTz+5NHJ2SEddV+RiBzHGhnNCoFxGS4MjReZuMB3/daqeEGMjRdmj4wKgfuX5wCkEo6jpBR9Bfa+JDQIRptmzUtWwtXtUqlU9n0/bm3TYJxQD9S9BIWRlMAqIvKjqBGgH4anU7mPPnJi1k3pjWL5/NX5eqNarVaq1UazEYaRUiqdSUspvTBoNJrKUul0hky0vVlu1BsIIIRMuG4mnUomk6mE8/RA7smp0aWgcaW0teA3bNuVUqJolR0kASAHoX9AOZ9J5R9ysoEXVGpVJkKBZGhyYHh7Y+vj0+PHJ6b+zY3LG4Y+MjCYliItMTJAgAKN1WzMSOcZdG6dvzTlVb3K9uEBNX7i4I8Hj3YSqIg4IgPGkNECgEVs9OBQmwaGUhkNghAZZQBMDBHz7cDXzC2PM4AxpkocWhKkgOCXUXLq7Jl72ExPigr3iDTtQhQKEXMaBsZWM3xbOeF2LQqBWLjSH3QWbXEHQDKIeDaBEBGzW48e2vZPlPzpup5q6pQ2wEBgZQJryDeHSu5xJ9xMmO20Xs/4t9hIIaVUQogd5RzmeAyl0TLZkJM1Od60Bn056NsjJp79pKEKhTIf2IwO5ezlweTcoHte4johM6g4X5gZRt03PTOy5p2VItihvWC3sNTJo+myGmwNFd/l4OTdnaX9WQd9/BSHV+Jr11b+6q/erDZ9Y+hjHzv16188d/zUVNw6IaU4FujjJ6aeeurY4eNTqbRDxNlMYmZycGGtJBBXNyoLK9uWpXZyDmg0gjtLxXozECp228CN6yv1ui+VhF6nCEO17i+sbCcsdejoWH4wffsGtRVKtpWYnBp87KljfjPYdaAwRHH43s6ymiwX65feu+NFWmtjWdJSKvCj11+/8fSnTmeyyQ/+NowxmWzi3LnDs4dalKLZCIrnDq2vl99+4+bb785tbdeat9aWlorVSvPzzz0+NTscBlHvl9mRVguFzIlT00dPT/XeIT4ra1l/4nMyAaJda2YQc/ObX/nTl/+Df/z5wmB6b4NnHw/GLseawkYjLDdXV1er1ZoxJj5cW45lWU5WWolSRWfSjEjEXhhmMuk/OPHIqeRAuLG1snBtZXVla3vbdhwppW1biWQKpT88PLy0uFSpVDKZzNjYWGS01/S2Njdd1x0ZHa1Vq5lshojKtdrK2joC57LZ3MDA1EBuNDOwlob3K9tVYEYJiPGAHdLG9oKJpHNQuV7T394qVut1HenYc5bJZlHIAQM5Uo/mCu9oTwAoRBUXrUDYgoU2/vZWeW1j693LycJwbrWWGIoqR/ICiQja6cMcEqGOczZZMAAwEWljfKElMKM0iCDAA9DMjLihtUG0dETVGhMNjAxHTBUKm2hh2wbyS1No7irSdK9tOWmQdwbWtK+G1sIe+3jjy07auj7ufJfBAjACfQQroJnt4OF6OFSLDtfCMV87ABpYy/grZAKGSKaCxJGGe1CaIEVrCWGlzBxQSAaZOtMVWtOZbBuU8G+aj27i6VBmI5GIHcJxfxogAuiIVJEOVMxs0ZzKBacy9nLemU+pmxLXiV0GmVIXB+xDVX0iYtGT9tvjB+5pa9rBZgBAiN5iE+8OJrsrkenTmz66G4MQ9aq3ury9sV1LJZ1AR2fOHjzzyGyt5sV30JFBhNHJwuTMUBRpIjbapFLu8ROTSxtlMBBEplhqbKyXU2m3JVkLDAM9f3OtWvcjTbYQsSCxulnZ2Kwe9sLOUi2EqJQaK8ulyNChmeF8PimV2GmpA2NMGEThh7ll22qT2twov/TDi0bTqeOTpUpzc6vKjGtblbkbq+m0m0g5ZD6g0I5EHIba90MhBDMrS07MDk0dHJk9MDI4mHn55avL6+VAmx/96CIK8ZnPPTJzeHS3kxcBGGKDcxje/Z331NlTjgq0YcQw0leuLf35v33xd/7Ws+MThTCM+pvog7fPEZFfb4bVSqPRDMOwbSdBAHDTbtKybT+CKAIpgJm1Hpb2JwsT7776xuLykhf42hipVDabXVhc9JrNXC43kM+XS+Xbt+eKW8WpqcmhocFGo3H71tzmxubIyHAmk44bttdW15g5PzAQhGHD9ytLS/baWjqdHshlnsyl39B+CUAoFWfxmSAc1JQ3EDb9etTY2NwMgqC9QmPT8yYmxhv1ZrNePTM1eGHbFwgGkFqbNjPIRDoTBmauXq2PZPwxVx+aXMk7FwpTACKeYhL743ytUUdA8aLPggmJyZgIRRS7e4QwzCAVAIaGImYlILhytTY3D65rHz924ODsWlBbFjyNrv7F+inUhyyuuA/L2fF3z1lLi/kgQjuYOS4sJa163rqSkm8RKIBcTR+vhMeq0cFqdMjTSSIC1lJEzAztsQPxiwhmAYYRtEw0rela6vERa0mRp40FxL3REEKAtGQAB6r1U/VwWmEgwUCXhWC38Qg1ANajfC0aToTBVrCZte/k7Bs565Yj5gC8gv1+wDMLzWcV6J584J1spiPRtNkM4q4wmh55pmON5rt+pX300dkqokBHoVZSAAAK3N6obG9WExm3UythBqONaRdrDHEqkzj+0OwPXrpMzErJWqV5/eLi2SePCCmYWQgRBNHVCwthEA0OpITAasNHxIh58c7m0aPjoxP5uPSjlFia37x+adF17RMnpxzHpjjA6+c89cUw0Kvrlfnl4thI7vO//tjLr15dWi4mEjYxv/7SlbHx/OETE4H5GZyDzKwjA2AGR3Of+9JjUomv/dUbEbER+OKLlwcK6elDo3+d75+YpRSf+vRDly4s3FncimOMX3nlaqGQ/vTnHhmbKgR+n9M8aJooMTd1qIOAjGlH06GU0rJUfJyXlmStwVhEJmFZthfeuHjl0tUrTc9HBCGE7djLy8vzc/PVamVycrJQKCwsr0RhZFkWM9dr9Wqt2mzUpZRRFG1tFlOZ9ML8wuLCIgDQzMzMgRnHcTY3NwM/KJVK3srK5NSUnZEil2SlwBjwQw4CGyXqqFar+UHkB4FpjwASQgCwpVTke9V6NcgnBREwGOR2fiRpwopS72q6Ywvx8Imo4AQ5q6Tcok4YFqo9epGIfK2Nifu4RatVGYiNiQA5zq+VMkKRsaQELOuImfX7V5svvmk2izCcX9Pm0YnJG7I26KjDbir2D/3CsE9m6D6J4bsD4rqDirD93317gQQAoBq2Xhy03vHp1Hb0+QXvb99p/u0F77k1/1HfuAhaCiNE3Bkdx44joognD7SAKAUxiHV/yscsWiydSCVN5x8raaQbkjTrdDbkjMRIILQfKkQ7v6h9DQqBSrAlI02qFEwvNT4xV/+bc/W/uez/dt08mZCrw873MlZViB2O4J0qTdxy1bbO7FyROu3cPcUm3EsY+9WnPvZfs6HT/Au2rV575dqPXrgQeKGbsC1L7m2fJkOJpD19YDhhWwJACFGrNG9cWerEc0spwlCfvzBfq3sfefr42ccO+UEEAEqKW9eWluc3pWodB5QlV5e3b1xftmx14uHZRNI25udn3UqJOzdWL753R1ry0UcOnHp4ZmZmKJty42c8f2lhdb38c7dBRKHOD2UeeuTAmZPTzCyFqDT8GzdX566t/HXSh2M/0InTM1987omTJ6fCIAIEUOKHP7zwyotXKsX6LzJnuY9fyCkEkkTPkWS0QLAsZdt2IpFIpZLpXEYw+JH2LMHMHEUQhg4ghubmrVuAuL6+fvHCpYX5BYG4vrHBTJZlEXMQhp7nAbCUgpmjKAqDkAGFFIYoDEMBUKlUhBBhGG1ubZExpe3S0uKS1/SSqRQjbqyv61pdaMPGUBhyGAoyNR1te57XaGqtO6HAcTRfIplMJhOJZMIHc7u4AUQC4rEF0J6azFWiBYU38snbU9M3Byau48i6zhLbgAKkallFiLXWRketKUZdog+aKDQmNCbUJjTGQYkIZaMFYvTmxeRqeTDEbLEhFta27izVPB8sS1nWL/jXVB+ovO4ol+xbeOrMd2p/vfE943YjZAALQ0ZV0o9U9UMNM9mIcsSEENkyYIZWGh5yG4jA2OmWavlzQAISY5MyFT7hyJKFW8xW74AtRDLgrjUORZCSsjWzr5P50o7z7TZjYyuvERANInkm3TTntvXDOWshoy5Zopl3ljeCI8QSkdvMrSf7uPen7ubVwM5O7p133M/622czfexVCDLZ5OBgxpEtLrK4XPz+C+e3S/WDB0cmJwcnZ4fdpB0EUW83DQpMpeyp8bznh36kqzXv+u01FBibCrU2pVJjcXVbAT7y2KEgCF958bIBEELcvL2+sl6ybRULD1FkNoq1rWJ9amZo5tCo41q8s3UoliSlFGLPus57hhk5rnX92vJ7b91KZxLnnj6eySUPHxg9dGDk0o0VoWTNC29dXz18cHR4YmCXlfinROBHQyO5h88dfvvCPAA7trW6WDz/zu2Dx8aZza5TB4R2NOuudx7HxfQ2bTF4XvjYU0elJWsV787SlmXJct3/yY8v27b1619+vL+VPmCaqJHCc4W0UFoKBQKwECCVROCy11gLvaolmYijEAxbQllK1QN/e3u7Wqn4vqdNmoh0FMVqKDDrKDKmUyIAY1qTxxCADRmtEZEMMQAKAQyNemN5ZWV9bd3LekKgbVlCCCTmSJMMIQiJjGBokNkKvRKrpHSUlPHJumUpx3HGJyZIm2boVyVcr1fZye+ewi2E8D2ztl5eWhFEqbHR/NRElErVjRGt4GKBAESktSFtsJ21JuJ/EA1zRASAzBQw2kISinIYONWa0wyIUTOqRpBYL1+8ev305MhwIsFC9MTM/pIIzV1Emk5McNce0usYbrti2x3V7Sg8BFOMntVkhWQhaCEijDOnEBGA4hxFjrshWjE2cSQVAnb7wJkFAiJuRA9n7MuOmjec6tkiDUGyro/W9CCBJYXplUV68nyxl37EJfl2CDAjamJRDI+U9AlHNhNyC9qTjGHXgCfsoS1d9aZjhsbd/dqI+9aW+mymj312PeJU2jl1ZvrZZ0++9Mo1AlC2Wlsvf+Mbbw0OpGYPjBw5OnHi9NTBw2OJlKMj3QqrJUYhTpyYWt4oe9tRSLRVamxv1QaHs8qS25u1G5eXiWF2qpDLukzO4QMj1+5sIGLNC9fXq9ubNdu1EGF9ubSxWVG2mhodSCZtxN2ePiYO/KhSauytvFiO6hWQEKFUrC8sFete8OjxiQNHxgDhyMnJE3c2LlxZAiVtS1145/bM1ODUweGm/nnaIYgok0tOzAwyxz2J2Gz6pVJtd2QlAjNEoW7U/Wq5udNhwyiEk7Cl2Ef3evjsAb8ZfOVPXqo0AttSK2vbP/rRhWwu8cwnTzMzGepvrg/MbucjbVraFmEqMjYxGB3UKzUyC2FzCbWxLGQAwwogYdsJx90i8poeEUmpACAKIzJdWmw6pStABmjPru9OrmSIw4RjFYS11jqKlLK01s1mM51Otxy6xlAUgTGdOsmWia5x/agwSkhLSCnQUiKRcKWAjeLmzUbpCkYVJew97T2odfON9yovvdZYXRe2NTwzffSpc/mHT9q5bMkPgFthssQUaW2IrJ62G8GIsUjD8QQpjIClEFqKSsVz5xYsqbZ05IeRpSQ3/PLiimz6UmCEv+iFTt2NtO7b7tR7fTyuk9sBNN15lZ0OZo7Fc9sAMLDCkHdm5gKAQIy9MDGNayk93Pojpk/txDpm5u1wYjw5OKAkUNgZdI0YhGZ4I3waUYr2W8A412/HXALey2liMQdbc7NBoQY0EdkhT0owArvUaGcGcK82gz0NV7g7Rm9PsQn3pYx99NERHoJodDz/5d9/Rjn2hfdub23XGUDZqtwItt6/8/bbtw8dGn3q2eNnzswcPDoOAHF7s5LixEMzr759c2OzKqUwhq6cX3j86WOF4cz2VvXS+7cR4eSZ2Uw2CQyHjk1cmVsXAJat1la2r15cPPvkYUS8cXlpZWFrcChz6swswO5EOET0I3P+wkKlEfR2ese9V8ePTZ56aKbVBI4ghHjvjVu3b64NDmfPPnJASWEMDY8NHDoyNjSQqvmhkGJhuXh7br1R93++iHRmsCzpJuyecy7clcXX4TQLy8Xvv3A+987tXiKiNeVyyY9+/NTwaG7XezDaDAymzz5+uF7zvv71N+vN0LKtlZXtr/75K4ODmUPHxy1L9ffiB0GhQRSIzLyqg4ZpWJ7vBBqNboZBGaHmWNqxpFJxr0pCyYxtO47DzMaYVjhHPOqgfVxnbqcHtwRA4J2JU60k6Z7lgIjizExjSGsjpNCRNszMBMRA8ZxCIQFrbG5EHrEeBpm3nYRSSGFZhwtbaxtobnG4KsGyM7izKsACzPkbled/Urt0NTVUKCSzuLxZ+tGbds3PP/lwLZchYgRExrhtm4HiVBVkkABMHIKJAA0gAKFEYiFRsBBBGOYW1rXnh5EOwwDBlpaVKNWoXPUCP3ATv/yS010LT7xbpNkRGxzrMl1iAx3C0ZVymHsX/XgLEIhxRB8zdqr+nU2NoT3BiQERNam6OdGkBUfcZLBahzUUflTY9A8BKgHxHNOupoJdmiVg1zXY4wHqaDCIACR6r++k0d+VzeyqM3X1m32dMv3gmT4+eJ1GxNHxgb/7h5967Scjl68sLSxsbayVvMjYlkRb3V7YXFwuXnp//ovPPX789LSbsOOD4OyRsUzaRQAUqCN9/fLimUcPSCVLpfqNW2vEfObRgwOFNDMfOTEpvvNeXNJaXyvdur587umjKPD69ZXFha1Dx8YfOnco7oTaVW6KDK+slrZL9V5KTsSWJTOufeT4OMbNFYAA+O67t5cWNs88cvDRp44JiYAYRXpsbOAjTx//3g/OAwAJXFwsXn7vzkPnDu3JH/5pvyv4KR6GiKVqw7sWKiV7rw8jPTIy8Ohjh4ZGsnsfEwY6nU184nNny6XGj1+6XKl5SsmtcvNP/ugnf/8/+MyBw6NS9PfjB6XuxGAJUVVKuioJxm9GNSWbEtFSUikW2E7Cby0fzNyeu4Gt/Jae7TBmMe1rumOwW+2/8cWe+8ePRoyrnyxQdAK5YxMGEAMCCyEYAtKXdXNcQ9aru61B2VxVct2WoWtbltt5xVbtAFlrqvzg5Wh5LTs6PDI0lEuloyD01otrP3ojU66nvvTxquu0okaMIaORiUAAAzJIYGIOiQwKQoxDa42MR4oLE2m9slktl8fGx7Qx5XLZsR0TRPVSpdxohG7O/sWevasPOlh8ANHZVXjaZabhThxuZ0VvzYGK2Qm3iEBb5el96J4ZUnHETbwZKTSl8EzaWhhPXDZsxfWmiCbq+rRvklJoBN51ptXrb+kJ/+3c1tuJ3b1TJxQYodch07l+x5DtXZRmRyJwn8308fNwGmbDSonPfuncUx87dePK0ntv37p2Y3V5eTuMjG1JZrh4dWm7WPubf+fjDz92UCoJAMmkPTacm086zUhHkbl6fTmKtNcIVtcqpZo3MZofnyo4roWIE5ODhWyyXPdAwFaxfnt+M4qMMbS6WWl4QaGQnpwd0pHeM+KAE446d/bgR545Ee4q3CAOjQ2kMgljKB4kvrVRvbNUFIgzk4XCYLpZD+Ic90wueebRgz/80UVNZFlyean49hu3Hjp3+OcTLpnZ9HiJ+C60iJgPTg2dO3d4Ynoo6gnWYyInYY+O5/eyN2jNjSLbls/9/jPlmvfWWzeDUBPQtdtr333+vS/8xrmjJyb72+oDsschkJRHcpnDuexQ0ytvbN6pVm+QKAphlBQoGRGZfGMaQRD6PnXbbDtx+dxLsrlLthl2Wd877bncK9Z0hpzGaXbUYlBCoqLuEiMlCAFKzvl+VhsnMr4xnq3ISSglZSxPxrOh26sYaaNXNupLSwp4bHR0KJPdKm4DAFqWV29EF68MTY3gY6dRSoHATMYYyWwYmVEyELCJXSKiZSkhBkZkgUgEDc/f2g794NTTJ6enZ+bm7rz77nvSD7ZLlWKzEQ6S/Ytd7dSHEdf9RRrsGafUMu7iTn2m4xGOKUl3HHd71FPPYOqOcAcAKIAZmFp8kXviXOIDYl0P1qLxsUQ6foDAsBFNboePSEk7Wqt7p0V2GquxZ2AB9GTktStEPSOadow1gI5XfKcFeA/Tg26rF+zDZqDPZvr4WVZrrxkoW5594sjpsweuX1x8+61bly4urG1WIm2UkgtrpVdfuprLJY+fmQ4jbQwdOjh66/b6ncUtA7xWrNfqvndt5c7NtUw68cjpaUvKmHDYtjxxbOKt83eCUBumasNfmt/yGkG16g3mU5OjOSlQ7/d+LCWmDwx/5JOnfC/YdYxuBesRSynCwLz6w4v1ajOZSaytl7/6F691Cj1KyVq1GechSIGVmndrfmNzvVIYSu9bLfpg3SUIomqlie1IYtu2kklnFy+KU0WGhnOnzx48enpqZ5YMxn3gu86YO7tqTJbSaee55x4H4ldfvwaAtq1+8MJ5x1GZTCKRtPsb6oOBlIRPW4mBlZXSnUXVbKYxSFvZd4hXAexkAgCQOESu+15d1Tgeo71jI+tZFrpNJK2M2Z3cpT2qB5F3jh3idjGi+2RCgGW1HBOAjIIRhcCjA+ljQqWawXa5shGFRcaSMYaE7Hk2YjACIYz4/asWw0A+P5DKIErf9wHQsixU0jS8yivvwpmjKCQDxiF6Artvixlbg55afTvxMi1YSKw35ep65IfDQ8PEfPTY0RPHjr/6yqsKuFxvVLwm/aJz9T6Q0Nw9KGVvzaklt7R+n5jAcLsI1XHBxGpL62eORTbsyDltVYMRgWVLmmuxJMTWvC4Gw+DTbF0/kZSvAwCDWzeTFT0tUCOIjneX2y3pPRSlt9KEO6LxoGN56Q2PaY072FUFwx5ZJv7XjsiZu7Q1YV+b6ePnozXEvh8iwvGHZx596ug7r17/5tffeuf9O8qStqVWl4vFzaqQAkJg5kPHxocvzN+8s66UkFLM3Virbdfnbq8lks7x0zO2o5iYgd2Ec+L0zHtXFj0/lFJ6jeDi27fCQNdrzYnJwdkDo2Zfx2tvsF7wAeOy0fPCl1+50qz7btK5fWfj2o2Vzo4Vd4Jkc4lytWkMocRKpfHGTy5/5jceSySdn+n4J5XYWqvM31yL9zqjzeh4/vjJado1gntXsF7wgcF6+0Frc+jExKcaD3mN4K33blu2cpL2T354USJ88ctPds6Z+rgfgYiMIIgOmVCubW1evLV5e4EBRdYdHhYFMhtC6kRStksIkYnCKOhogdxiGrhDg2+r961z/Lg4sUPGaZOanQN8Ws5RBImtMZWIgChZxlOGBCNazBNsftdxE6trzc3irKEwmdiyBq449rzkJpNgACZgZoEEqLUO5xYcFKlUSiA2vWbcSY4ItmWzocbaRrZU1dlECEhMRKZjtUBAYIp1COZ4eQdEtJUUSlKxrOdXWJujR46MjY0FUcgEs7Mzm+vrZd9v+l5EhPdOyQnu5g7uneTULTz1spx2raldKooHIWCrChULL7g7grS9fTGzaKs+rUe1txNmACSPJovho6nEywDg0dmmOWnYUtJAa/xCz1O3mrU7xIVhNyPZUT3qmmI6ZGdnR/Ye00yPjbv3eftspo+/7nF29xmgjky10nzsmeMNL1xa2CrWmgDQaPi+H8YbJxFPHRwZHMkh/f/b+9IgO67zurv28vbZV2A2DAbLAMROLNw3URQlWRvtshU7tiM7yQ+n/N+p/EhVqpKqVCVOpeyyK45TlhWXLUuhRYmESEkkSIIgQezbAJgBMJgZzL69tZd775cft/u9fjMDgKBAEpTfB4KY9+YtPW+6+54+3/nOCU7Uw5cm5udzc/O51o76DVs6ucF1IJFlGxu2dpr/xHNQopTk887JE9cUguxycXBbd1df64qgx49ehOBS0R29PjOfLaWT9oH9A339rZ4nVzxGKfX9Hxybnc9RSgp55/33rxx8elssbqF70dEwRqcmF0+fuKYPcCVVW0dD/+A6+AQyfosFd3BnDxAyPbt8a2YJI+RIeebcTQKE0oq1Zq0+ryWl6ZSy03P5qfnCUgFzhkHFmpIJhG0FRQQY9FIfdJMCPBNmOpaFNcEgSzW+iXKcUQ95gEjjKtBqBGtSaFSvkB4il8GluZQy6Zb2+HkzFy+OZ/NzeYyBp6HTznd0bjkq/feWZ0xDkfCFASNPCHdqmvuCEup6nuO6bW3tQsrl5WVAyI7HHN8zr47KjeuAYqIUlr6iRCGEAAhCBCAczcF6gwChFOWIkGI2J6ZmOcGAgTJ289Ytzo1vfPObr/7olXlQi7ncnFNsJrGPfTK5/4AmeukCK7BHdSRCFWmDQh6m0obCqHogHcptp1BWA6FPXaDqDeafcOWLAHCAB4msaJeojuG5RW8wLzcwKgIuBaJ0DIpSLDjiB7iaG6xAlWhOUwTKVIOXVRd0+LYq4BqaqdXHKKUQpWsEIrqOl0nH+vpa505dA4S4QSmjZUYiFjOb6hOZpF0UgmB87sJN1xeM0fbGVHNrWhMVCCHGSUtLuq0xlVsu+qBcT9yYmHd9IXzR1lHXtq7BdbyPeULhbHJ84Z03zgkhd+/Z8MQXHupalUVACJFSXjg3Wiq6ecfzFUzMZm9en4nFTDtufOQ3oovzuYsXxy8PTxoWl1K1NaW71zemM7Fi4RPJxPNcv6+v5Xd+/+m/+PPDi4sFztnU9NLrc+f6upp8X9QAzef20kEbhOBphQkGlYpj1UQYNW0OdkIAAQRUSsQoAqAIcUw4YdGhpigKDykWEjVWxQSH07/BahhMcYc2J+XZ4GC9CAajlJ7txgGEQkgK5Di0lIup0tJCKTsy5iwtEkrovNmSti0FlkRMKAwItLcSYKSUKJVKiwtYIgQgheCMHTpwoHtDz+lTZy6cv1gqFQzOYWJGtjdIEyspMUU+MTDCJEBEqJwEEUpISB3ngNHScq40M29SOr+wkHPdWDq1aWN/1/p12wa3Xh0fmcvnZ5zSQ4mMdJ1PjaQhH+HXXeXPg6qZtbBViCL/VqGAiJdd6AUTKlMqY0IY60y4imYlRKkEY4IJJuVvYoIxwshVLYv+VxQ05EVTSWUIDsboA6vh4MmEBFA3avUbhmcHj0SkHKgdegKTstdMVdZ2JWW7yggYR8TCsOJTWE3W1KpWdzsmKVlaLFw6P5ZbLmkXu/KuqbWrExPzQ5fHMUZKqq6e1pa2urJCRQjZ2prp6mrSSKjo+a4v6xsS/Rvblax0YrQJXn9/WzJl6/t9qTDGPZ0NbU2pO0tZQoe6lf+VZ/7m53OnzlxHANv39DW31xULrueJ6H+u6/u+fPjg5ubWOt+XhGCE4N1fnJ+fWeacrhqtQsFxXX4vSjDGueXiK//4/ptvnKEGBQBGyDPP79q1b8Ma0QShsV5whlix2R95Ukkp4Cbr62/7xq893FAfl0IyRhFGV65Pe8FPUavPWwHSuk0F6gZit5K2215PO5tQU4o2p8aJMYmxgxEBhQGQAhPhBDNNwy5f5YeTu2VAG+hly8Qq0ktY0KYAvTMrpcpMjV6D9MO1Zz4AKO3zqwAAKQCsAHwJBQeVPKnUsuPmnJKwTMhkVDqNMymWSk8tL81ll4IOiFRKKYURdlw2NYeVkkIAKNM0TdOYnJmcuHXri198/tlnnl5ezjLG1OISOK5QypFCqOi4d+XaHnAwQowxTnJDYpIt5N35BYSgUCjkC/mpqckb168XS0XKGCAsFSgFSMED1HK6O2ODg95gSNVEKJjgWwHYWaGqCUFp2IQq41SoyIUBV9Mf4XtTDAqbi2KQYteFdRDmQuLolt3OEaZa0VsZw0OVYCa9k+Jy2CSqyG9gjR5TuUNQkwDX6pe+XMRYSfjw+PD3/vrN55596MATWxoak5xRyqn22RobnTh9ZnR6sWBb3OB036FNGzZ1lCd3pFStHfXre5rPDY0jSjDGUsrGpvTgzt4ozQqAMMGbBtefvnBzenaZMapFtT19bU3NGXF7314A5Lp+brnkVFM4GCHGmWXzuZnsyPC0K9WG9Y2NDQnO6WqEoXHVwPb1zUcvXb16SydQnjx17ZGnB3txW7ULN5JSFQtOPlvChOipVt+X2WzpR39/9PzQeMHxOKPxmLlvZ+/ehzc0NKfWADQYIUC+L4p5J58tetXR4oRgw+IfMdBACsUN+sQXd9y8OXv0vcvLeYdSQikRQtZ23c8pogkutyUQpY5zqyHut2KkfLkk8XXfK3BGONPHjQSoYzxtWowxjBBjTAMUzjnnjDPuIAdjzBhnnBNGFSApFSHUjtlL2WU93M0YNQzD8zx9KCpQCoBSqp1p9eW1AgUIY6WwBlIAIBRyBLg+UtJF5Do1ek3XbEgQEWcErIQ5K9XF5YVbjIJ29wYllJSYqaKDpmYBYYyx63qZVLqjo2PTxk1LuWXLtppbm5OJhFJK5ApQcqQBnudzwwRAGEKL28hkTpmWSnCelTKXz3u5HNQ1NDY11zXUW7bd2dERi8WUkBIjhZEE9Sm7T95by2mtoaeqWyg6wV1Og4DKWFGgki576EVMafSIfvQVyxLpUBccHY7iy6JDoLgHCUpElZYXVR65Qg1cJhirTpkrjIAjeDvaY8KrXICrfPNqaKZW96MoJZNjC3NTywKpV3566o03zgz0t2/etr65rU4KOXZ95sSJkcmZZcviybj1yIGB3p5myki5pyOlam6r6+xuLgcRgIJMfaK7v7VsK6whBcZ4847uutdPl5kbKVXXhtam1swKRXAYS4IwwiVPnDl1Y3mxuIax3tZ1u/b3Dw+NH33zvGUbhx4bTKZjd1jp4wlzy8b2sWszY1OLlBLH86+NzPT0tpo2D306gDI6P5d948cnk6mY9sAsFNyJifnxyUUBwDmNx8zGhtQj+zc+99W9psVXoBn9Ivr65MbNmTdeO5U+djVqrCeFTNXFH3l6e1NzKvQIQSG/f1uexnX8l37nSWLwNw6fdqUggQso1PwyP689J0CgFAEESt3AZARRJQU2GCKcEoIoCzzMABjBBCEplcF5Q32d4ziWaXV0tMfs2Lp168bGxgzO29vbTc7bWlulJwjGjQ31nR0dhUKhWCgWC8WG+obOjs6Z2dlMOr2MECU0nUolEolUMlEqFjk3bNsSvg8KIQCsAClAGJCQ4AukFFHIxeQ8tkkcNTPXklIalkimrvpwVXk5yikwpCSSSh/k0vfE4hJSijHmu57n+8m6VM9A363x8aGhS8uLy/39G0auXxeuZy0u17mc5vJFMxZodiiiBHMMBFWErApjwJgxhrM5tJSlhBKCM5mMZZqJWKyhvh5jMjI8nK4zGzNp81ONPbhHhmYNuTKu9P/KhnsRABTqGiNSmaiZetmvrsKYVE93h58GVCKiIlgCEMv6zRgBxSvRRKhgCmU5VcKYkFcqkzQatlS0PmvAntX6mQqauU3IZA3N1OpjlFIqkYn19bc+NNo5Nr3seeLK6PTF4VtKAcaIMcoNlkzbTY2ppx7b+uhz2zlnUYUKANgxs6kx2dqQLAqppKpP2h0tacaIWMVccEY6WzOtjamiLwjGjNLu3pb6xmSx6K7AWKbJLYvrY2RsanH01kJ0/9bGepyzwYe65hcLkzPLzW2Zwd298YSlbp9tKYTs29i+cXR2PlswDK6UOXT2Rk9X4/Y9ffodlVSUUU/Is5fHowCDEpJI2wjjzpbMzp29u/b3t3bUC1+uUOoAIMaIbRmWyRFC2YJ3dmgcqrPDPU+0tma27eptbEwghAjBhsEsMyBs7gBPOCPPPvcQJfjV105yRjHCnFFUk9E82Nwnis5Fl11eMVKgPF8oRDDjLElwPKZcDxwPFADCQCjBWOncQYQWc9mpohNLxmCBbN6yqb6+HmGcy+W7e7qbmhrjiTildHZufmBgoKG+3rKsVCqFMN46ONjT3ZPNLre1tXd2dl64dLGhvn70xqhtWe3t7QtLC23t+0auDMficTtmX716lTAKoAAUBoUlwlKFlsN6tcInsZFAOIEUkbRYFDkbI84ZoQAAShElkQKMEPZ8uZxXShFGAaC+ob6nq+fqpUtudnHbtu37d+/eum3w5R++fPHCRSyk5SK1XIjZWWqaxDQ45zZjBmcznAqEsARMQGKEMSGUwXIOZwucc4RQsZhvaW1qbWldml949ZUfDw1d/s4f/duu7q7ics5Pfqrk5b21nG6Lacq9J1yxGcJlngZFm1M4ovGGCMkBVQ2hqq5R0H8EvDIZgmBY0fmBKns7XJ1KgKN20zjMnwraXkGDqQqPrJzKRmu5ANfQTK3uJ6AB2+YHHt28/5FNU7eWhs6Ojt2YWVou+L5PMGlprWtpq+sbaF/f10IwFkKupkA8T7S21X3zpUO55aIQsqWjvmtD65qzyr6Q+w5ubm2tzy7lKaPpTKKlOe26VcBH+LKxOf3s87ty2RKKukJVQwdKyLq+lqIjWprTv/nrh1o7GpqakoSsIWqOtm9a1zd++ev7H318KyEEIaCc1zcklIK2zsYvP79L+GK1wEUpME3es7GtbV1jPG4ijKRQK6BM8Dn4YvPGjpe+tp8b9LaftlSxhN3UksGECCHT9Ym9+zeuX9/Ysa6RcQrqTmisqS3z1LPb25rTuWxRCrVhS6cVM+/w89bqMyU+aSwe16Nw2kJXSCGlxJiYpilLucVs1uasPR53lXSk8g1TMV/4wpNKYIwpAlCWYfWn6m3HH7p6fub66Hx2mVuWbVkGY4RQrcPV3B4lhJxHmFBN9RMdI0koJfjijWsIAaMMI8QIwQhfvj5CCCGEGAYvCQ9nl+xE3PM8IRVISZSUBANGhFKMMFIKAQLGKDWLtizoqV5KMUZAaYDWFEihpJISISmEyBeQAkII4zyXzV26eNH1PUJIsmEWmXHDMJ57+pnhy1c8y7Cb0imCWxqa2uoaG5Jpy7SyhfzQ9MQtAlLPDivQTreIILmYk0s5RIhUqpgvGAbftm1bKV/67ne/W5/JNCfS3c1tBTslhXhwAc2dYE55+j703kFVaRUoEvwUbfdExqAAMKnchIqYBvBqxqQCYKqpl7VQ+UoQgyoTV5iQ6q2MYqgVzr93Uczg25I1tarVvZWGKc2t6Zb2h0gkwV1PiioFSt62OS2FzNTHDz49WNGiAaw5OamkWtfTtL6vuXy8KqVW9JuEkPWNqUPPbLvrXq3bLk3NyR17+0Bv5N1Wd0pwQ2OyoSlZPpr1n5bWdNtX7xRqrQAQwJ2VK74n+rd2Dgyuu8tmIwRKASApVCoT27GvD+MNSgHcLYvB90RdQ7L8yahwQavtvQ9UAQDnRmNTY3d3NwD4Qvi+L3xPChmUkgO29e8S6eV8djmfKxYLTqngOI7jOo7rO0KWpCgpWZKiwY53ZRpv3bw5mis0N7fEkimhpNaZA0ISFAl//QqBAKRA/wEl9Gqmoj1fUCpIeAqHmgBACmEZZmtDg2XbhsIiX5KEQiohEWCGKWcIY4UxJlhRgjDGUoInlBAkWLDCcEQplBBKKRASuy5CSIdpA4An/LnZOSEkUohxNjCwCWEkhexpbDm4a09zzs8Wi47vIg/7viMLbkbSAcIWpBCAMEUIYQbInZrLnr/sjU9SzjDGV4ZHevs3nDl9Zvjy1VQqtbFvg8G5U3IUfNoBrvcMaNb2yVkhEw7FMAFgjDyoIqwJjYQi8Y1hllOgyY2OfIdn88pbAUKIhFNaECKb6g5WNaaJvNcdcEwZcVXDmbsoZmqz2bX6JM7FID/OKQEAwUfLgtZv8cs/Jvrge5KSREP7ondKeR+QASiQ97Yx97b99/TJ1OqzKkIxpsRxnZnZ6cnJyYWFhWKxqKQyTdO2LMMwMKba+TdjJ+pjKUopY5QxxikjjFJKGWWMc0opY4xzTigFBNzgSirP9XzPE0JIKUrFkus4QgilpOf5juu6juP7vhDC932n5Die63quL3wF4HpuyXFdz5NSCKV8IRzPK5ZKzY0Ne7fvWM4tH782PFfMKwGu44OEYPS7bD8cuPhiSZknkQLAiBiEMUoxpggRWXSA4LTnyXg83tiYNC0llGlZDY0NjHPTNJOJZDyRiMUsN28RSolCTjY3P71UcN1SvmQw1tjYtKVnk21bP3/9jb//wfdnZmcty0QYAcAlQIRSSqlhGKDAc90LZy+cPXV2YmKiob5+YGBTMplS6jOIo/84DM1t86LxStIkalSDqoOPVopWormV4cg+jpqLYX0LVtMl0Zsk2saGqs3EkWlUvIbGdxUlE33dqFwG1dBMrT4tQANRNhN/Om+6gt/Um3FPY8krUmY/ys/4qf2A97A9t6OFq09dtXqQCyMkhFjOLnm+MzI8cv36jZmZmXwuL4SglAbkipS+70khFeiGFCGE4IrLDOiWEKXaC4QgUJSxA08dYpxLKQglhGAMJLAC0YsVw4STRCpJCMEEU0IIoZwx1/EW5xaLuYJpWoZh6PkmSmlgTUAwoZQzbpjGF556jjKCEVZK+VIKKZVSegsVIKQESCE9z/c9IaUvhUTIV+BJPd+ErFiMMka2N7Ct+wyF0qn0zMLi8LXhyYnxWCxGCO3o7Ozq6uKMz83PE5OTXKEwOW8LsrFnA6U0MGJAaHk5a8XjpmUxg2shDgZESDnpWadHwdDQJUIoozSbzy0sL7m+H0egVqRNP5iA5k5UDao2rom0jqq1NRHCJoIYwoC4CPLB5dC4Smfq9ttUjXIIXgVOoiAGRzDYSnXO2lAG35a1rp3banVfrymJU3Q/fPfK8WOXl5byLS11u/b2P/z45mrAcf9LKTj74bXxGzOd3S2mzfoG2qWEo29eOHty5NvfebaxKUkIufMGcION35h9/8ilfY9vaWpOsYjp34qilNwYmTl57Mq14clUKtbaVrf/iS0t7XXC/2xGoLnBrl+dev/IpfGxWcsymprSOx/esHFwXVSgQykpFpy33zhPMN66o7uju/Gz2tpafeSFCoNSXsnxfT+fLxSLRafkep4npCCSIoRAKSGF8IWUMgpVdYJ2mFlYCZBUAFIIylipVLIwCF+gVeF+gfQ4XN/CJG1kWubS4uKlcxevnr9CGQvCy6oPkIrlVMUDVo9xBwg7QFV60nuVhb1SqtxixhhnMpldu3Z961vfskxr6PIl1ykahjE3OzM3O0cw5ozNzc69+dabvu/PXhopXp/Erk/eZZwxTcBwxhhjlDFAiFGCo1lBmGhLfiGFYZqEUl/4vvDjGG/o60MILS4tU0w0XNOEQrjBVV61+rufPaBZQdWsnOiuLPXhpldLhqthS9nFJoI/InnbVS/6kS+McHS7qvyDq3AMWlsLjCo2jmht2W8Nx9TqE1pZJ27Mvv7jk+99cHXb1nW7eltHx+a++923Lpwbfem3H0vXJ6RQYYTIKrYg6pqAwtDdyIxf5CmROUNAAMA4Pfzy8bnpZSXh2DsXn/vK3njc+sHfvT10buyZL+5qbEpSSgAhgnH5RVaciBFGhsFm5rKvHD7V1d9aX58wjNBTNfIUbdlw+fz4337viO/6j+4fUAgdfv3M0ND481/es+vhfs/zozMpK7zLoueQYPRjBV+CESgon+1XvDXGlR+5ch5k9PyH11579dStycVnn95GCPn5m+cvXZ74wvM7Hn5iixTB8iCEGh9f/IcfHnMK7h+mnu8daKsBms8FqFEK/FJJKYUxIZQwzgkhej9U4bAIZRFTRwitAxRE7wBQRMt+GQ1MzAjGmOAVSwpUXxVrt3sAw+CMMW3mqqQEpaCK9odIgPeKJfa2kq7AmCC0iKnq4AJamFtwSs7Axo07du4UQk5PT4+Ojra1txqcNzU0HDt67CevvYYRKuaL2aUbZVP9aAKzRlZeyTO4pUCEvrfB6yuphBDcYowzjBGl1LZib731TiIesy07mUqmM+lEMmlZpmkanHFCKCGYMqo/PMboAwRoVjMyd6JxyhzMGoQNjkCEKs4GVY9FrYZLt8NUK5iY1SDmtjgmysrcHrDU0EytPpnrSYQAXR6ePPLe0G9889C+RwdSmfjCfO70hyPv/uK8VKqQd08eu3ry2OWS6+19eODhxzZnlwoXTo/ms8X5uVyh4HR0NhKKL10YTSRi3/rtJ9ySd/7U9fGbs0tLecbogce37djbyxkdvnzr8I+O57LF5ubMzr0b9hwaeP+tS7ml4tzs8vx8LpWOE0IUQHNzBjajju5mSsmRn549e+paNlvsXN/89Au7W9rSlBIAIARLoU4fHz727iXpy5IvKSOaZzrys3NHXj8rpOzobPzSN/a3dtSVr1nHrk/7eWfrjp4XXjogPNGxvun86evaR/jCmdHXX/lwfj7b09N68PGtg7t7SiX/h3/79o1rk4zRRMLO1CXaOhoIwR3rG7v7W0evz504eilTl0AA4zfnSiXvua/uc/LOqQ+vjo3Orlvf/Ogz29f1NE3enHv/naFLF26mUrGde/sHd3bXNSY0WCEUT0zMF5bymwfanv/6PgSopaPuwqkbCwv58vmHczp6bfrd1890tWau3Ji5fGliQ19b27p6KVVtv32Qi1IqpLw1OekLkUgmCCWu6yopAZDSJaVQQmfFh9hBaY08BIQHoEiKk1KKUKonm8LmZPXl/Mq1AUL7WEwI4ZzZsdjqliUAVKBU5F4UMcSEKoxfVhWv8USNSrRYZ3xiYtPmza7rGobZ1NyUy+U2bd6066HdS0vZhYXF5qZGqZTrOkqV/dtwuXlWvskolxKCrlwoDFFKeZ5HMOacU8Zs025saHIcB5QSUmqfQFDI933PMznnjFFGmW5pEUKU4oZxP/Pq2f05C98WVlTDD3QnwgZVJr3LiGGFCgav9bZrfrH6zfEaj8ArIA8uo9w7sDKoBmVq9YkVIWR+NntrbN6yjUee3WZZXCmVzsQffXLw4GNbuMH/8s8OD18a3z64flNH/f97+YOC47c0poav3Lp05da3Xjr0zpvnXz18qrOzoa+n5WdvX2j9+bnGusSVq7eGb8x8/Sv7Rq9N/9M/HF1ayu05sPF//umPX/zSHt/1P/hwePLw6fau5tnppaPHrgxs6jywZf17R87//f/52b/+4y/nc6XZ2aXsYn7k0vjhV0/u2N23rrvl2DsXZ6cX/9UfvVDfkJRSuY5/5dLEd797ZHBLZ3tv3ZXhSc15fO9/vXFrfL67t2VdT8sbr544+vPzh54a7FjfIITCGLV1NjLb+OnhU8ND4z09LV09zS9+4+GmtroTHwz/rz//6VNPbnv44KZjx668+tqpZCb+1uHTly+Pd3Y2CIXOXBhb315HCCaYpDIxhFAhVxy9Me05/q2Z5Ws3pg/s2XBrdOb11882NSb3PTwwMjz5X//zD//9f/yNd9+7fP78zRdf2H30yIW/+Muf/t4fPvvFL+0u5B2EkJSqf1Pn0JXJX7x98dbEfE9va0tL3aGnBtf3NpdnqThnM7PZ0+du/sZvPtp1aXx6cvHc6WvreptqgOYBLyEEADTVNxUKRYtbMcPO5wvFYkkpiShCCCsEBGPKGSAwDU4plVJiSrR3WoWt0TeUklIBRiY3YrEYCWJ5dLZGlIysyN3LcZa2ZbmlUiwea25pBgU4tGQMMH5FIg+gKmPgYTBT+RHh0GJ4D4RLKgS5z5HgZUCxeBxjJITwhVhYWBi+Ouz67uOPPvbOW0fef+9oS0tzLpdzXddzfQAglBBCCCKBF1wVlAKEGcEIkAreCCEApBB4nsCYppLp+ro60zRN04zHYpZtcc4RAl941COUUEqIIlggiRDCiCqk7vuxw+7ja+FVbBnc4duVrh9EAc/qhtSql4XbsyZrwpU1yBi0ar6pKoDr9ixUDcrU6pMuUKCUwhhzTvWJjlKipJoYm/ddMTWxsPWh7t/9N8/lsqW52eX5qUUnV0qnY3t39+450O+7fktzun9L5/bdvUJKECqXK9Wn4/t39z367LZnrd3/5T/948iNmX0HNn3xCzt91x+9MT0/n61rThdyRSnUwIa2fQf6N2zsYIwee/uClAoQCCEZp/1b1z2yVFheKtycmFeg/MB3GBNKCnnnyvmxtsbko08Pbt/Z+/ZbF85eHMMYX70xqzyBEZ6fXqqrSwxfuTUwuG59b7MOatiyo+uPuxpGLk9eOX9z7ObskWOXf/bGmQMHN2HKfCF9z88uFYUnAKHhoYm33hv62tf2P/rk1tmpJQywtJRXCnR6HgrcrsD3ZWMm3v344Je+vu/7f/N2Ombu27/x0acHJ8bmz/7J/706NLG8UJi4Ofv6qyfWrW/6k//w6129zaViEOAghere0PK7f/DMk89sv3xmdGx05p33Lte/ef7ZZ7c/9cIuISRlZOLm3OWLE9miMzUx7xTdkZszdkPiOVFDM58L4hObpsk5R5CGCgUTZlyjaOY1MMYWFxf/6q/+9+z8HKBQEcwY02NOjBmcW4Zx5uRpxhln3DA445wzbpqGYRimZZqWxTkzTM4YJ5QSShhjlNESKQmhOto6GzONKBrarZQs6321oZ6q3KVZIqmUkgo0ayRVBewEeAjpB5dxF8YEE0QIqaur7+zsdD23VCpOT09fv3790MGDJ46feuedd6amp9OZtPAFAswYC6POMNV6ae2fo+MTg2hETCKlZ74Mzi3bti3Ltm0rZlt6dkx/Fpxzw2CMmabJDR4ociihlGre574noLH7v+usYGRuR9is5mxQYDcMKx6w8nn4rm99u2+s0VSCuz75I36/VrW6H2gGIJ6yU+l4qeTdGJ7q6muJxc25qeV337r48isffvu3HtPZQ4mU7XnCsgyn5AkhOWdJizNOGaMGZ4bBTItnMnEplFLKNHkiZVmWwTjDlBTz7uWLYz8+fOrg3v5nXthj1yWGhsYRQoAgmbRitmFYLJWJlU3tKCVOyTt57MrQxbHNg1179w+0ttaNDN+qYH0A3xO+LwyDGRbHhOjDSkiFASEEUqpEwoY4GCYDBZhgJeGV77+XTMYGBtft3NtbLLhXL9763t8dGb4209vb4vpCAfi+qMvEDYP5nvB8adlGPGHlbMM0WchmYcqoFGpqbEEKBQgSSbulJWOYnHOaStuJlG3FzHjSxhgvLuQfeXTzzp090xMLVy9P/Ol/+9FXvvbwk09vZ4wAADfY4ZePu46/58DAxpcOSKVGR6Zfefn48ZPXnv+1fZQSQsmVS+PXhsa7WjOe49c3JJsbUvmF/NCZ0YFt6zhnUiopZc2G5sE7oIIlXoHCOOBcdCgx0veAtgtBSscNIBBSMM7379//k1d/PDs7hzEWSoc9BgsGwZgSijHW3E85DVBK2dbatuOhHVu3bskXCq7nuY5bKpUKBS1GdhzX8XxfCKknp7TXHqWM6gEhSillnLNg5WecMco1ZGCcG8wyLcPg3DC4YXDOKGWEkOrss6BDRDChlBoGTyQS9fX1Lc3NJ06ceOftdy6evzg1OfWjH72ytLxUX1+fiCeWl5YwxoZhYKOCWihjZUCjsU0wvU5puEmGaVm2ZdmWZmTMMoJhQVtJ4z+qfwoNBfVL6aNJS54po/f3180+uT3pLoQNWmv+O+oFHFXboFUw6KPhjmrGJvJyH611VAMxtfqUSymIxYzNmzqGzjT/j//+42+99EgmZR8/PnzyxMj2TR2btq774PjwuZPXfvA3RxKp2JtHLh46tLmpMTk7tQSII4SUvpxTgUs6AFDK5hYWzl4ca+9sHL0+vXhrsbe/1ZdqOVdMpuyZifmpiQXfFcvzeSWrTGGUCnlzQEqqfK5ULLipTKxYcj88ftU0meP4mvqOxc3ujW2vv3X+6JGha0OTJ06OIIKUUr2dDeOjs76QPRvbz5+7UV+fxOUoWoQam9Kv/eTkhUvjL355j1Dq/XcvWBgPDq7LNKVKJQ8BWt/dMjo+PzO9tH1PX1db5tSxKyZjy7niqbM325qTCKGJiXliUAXo8GsnYzYPw5gAY9y/qfMfv/8eHLnkFr0rQ+PKF80tmXePXh6/OfuVL+1pasmc+YvDjuObJpNS6rNNfX3yrZ+du3Bh7KtfP0Apefvn5/JL+a7ulrcOnzn+/uWXfvvJkdHZvCd+/zvPtrSmTdtobE2/d+Ti4Z+ciKfjr738/sYt63Y93J9I1MyCH7ADCpSSKujorGBlVOWLMl5RmgQBGBgYmJqcOn3m1MzcrJ6dhtBvUSIsiSSYCKkBDQEAIXzOzZgdd4rOsfc+KBaLJcdxXcd1XNfzfCGE0Pa9UoEmWMr0SplkiSxygWta1PceReaZ9CQUpoQSQgkllFLbMi3b5DwQ3mp2BTACpXzPyxcKGLAUghCsAAzDKBVLwheEElDYNAxCaBl5GBqx2Jp5sUxDx29yDbIYjyAuxkMoRkPLHkoJofofEiCYMuGjN5tg7fNX5aXyoAOaNQmbu6CGFWROVKsLcG8oY4XgBu4OYvA98DW1qtUnVb4ve/pb/8V3nnnz8Nmjb54rFV3T4o89tuW5F3cl07Gvf+vg6Q+GT394jXL6zDMPHXhsc3apUCq48aSNEIonrEx9wo6ZGKNUOqYU+L5IxM24yQ6/ctzg/JEntu18eANG8OTBzRfO3WhtrdvY29q9rvHK0HhLa51lG6bJMcZ23GpuTjNKEgm7ri6RzCT2PbIlmy2999aF9T0tTz6zY/Ta1OJ8PpOJW7Zh2sb2XT3f/vbjl8/dvDkyqRRs29hpWsY3fuux4+8OnTk+PHVrIZWMPfvinq4NLb6n1wC0ZWePQujy+bF/+NsjUkoM+KvfOvjQnj6n5P7e7z194eS14SsTjc3pL3xhx+CObi2jefetc54v0kkznYrvPjhw6oPhsydGrl+d3LJlnet4mbpELGbG4iYhZPveXsf1L54d/fnh08mk/S//4LnBh7pS6diJY/QXr58WUr34/K7du/vK5xUh1KaHuhAhZz4cfvXl9x3H44w+8dyOvv728yeuTU8uXjgzKorewIbW/k3tUirKyOCuvvn5/ND5Uc8TM1OLbR0Nqmay90BSNEpJFYxgB5gklKIEOEZFSkophJRKKik3bd5kx2JXrl6ZmBjL5nK+71eaPQASFMGkbPRLKTcMa3Z2bn5+UQoRviqUzWMiVQVlAgJJqZBPCv6tjPCtBjwhm6uHpwMmlTHDoIwTBBrwVC2plNJYLGYYhmGaQgjTNPWGUUxtyzYty+BBv8yOxWzLsizLMLgGL4Y2FQxnuIk2Hgz9Bwkh5TFvRmng1kOJ/gpjTAgtG8xhTBCuTFHddzMnDACjN27Mzs4ihMSnErtwJ87mzmQMvsc3+MjPral9a/VAlZ6nLuScQsGVUnFO7ZiZSFoASClwim6h4CCEEgnbihlCSLfkE4rtmOk6nvAVM6hh8FLR5Zye+XDkyoXxVCa279HNjJFY3LJsAxTkc6VSyeOcGgYDhIQv9RemyRmnnitKRTeZtl1HCCHtmIEQymdLruubJrdsw3V8yzYMk5UViL4r8jlHCEkIZozYccs0ebHgFvIlpRTnLJWJr7Cl8T1RKrqO4wMAYzSViZsmkxJ8T+SyRSGkafJ0XbxU8v76zw6DhO6elvmF3MULYy+8uHfvIwMAkM+VMEaWbSqpKCMEY0KJZRuYYM/xiwXX8wTnNJGKcU6lkMWiWyy4AJBMxSzboBRHfASR8KTeHqUU5zSetA2DFfJOqejaMVMKRQhO18VVeKFfLLhOyUul48vLecsyYnHrvmsCavVLHkee57meH51XCoBLqEVRUgohhJDa7df3fd/zPc/TIQm5XG52dnZqamp2bs4plaTmPxWoaCh7qJhdsTxHd/WK8LdyeQ5h3mTl7jWf+9GLMkJpGBkdGcDWgZJa3kMpdX0XhY22mBVrqG/knJumqfkYy7J0nytoejHGw/GkoDOmdTC6h0QpDhpSNOhPUUIpwShQ2yCkPTlxJTM6gmPKVM0dav+BAw80oFkBPPCd+ZuPAlbuEb6sCadq56FaPWhVNuvUJ7hyLwOT4LJMCwi1ZA/CbkvZeQUTzDk7++HIyNCthqbUoacHMcZSKn2u1C8eufLD0cvBYOZTKRxx6MZBHEzwRmuMiZLKZaG+KC1vajkyacV6E3XZUmEWUlktqHl3x/HPnbpx5PXT+VwpU5fo7m19+oWddtwklODK2R+XJ1zLLxL9NPTpu3xtGP0877w94QcF5TtX/IKUUtpvsNZsegABjeM4JcfxPU27SN8Xvu/pOALhC0/4nut5nif0/UL4vvBc13Edp+S4ujzPdV3HcXzfD3mcMteiQran8jdIUkZRdxhUPraqbkeAyx0QzF3BTRRIEYK0hg0qIUMBoCGEGFyPSWOEkZLKNK10KhOPxQzDsGOxWCxmW5ZpGgY3WCB05lqswwI9r24lUf03oomhBOv+Eg6COAMYFdgmowiOidzWmOZXBdCshij4nmJgPsb+XQMxtfpndkIvFV3X8Rkjuif1OS0h1Nz0kuN4hsnT6Xgiba8ZAlWrWq3Y/4ulUqGgBS1OsVAoFkulUslzXSGE63m+5/m+8H3f018LoW/6vu8LPwivLEMYFTSpItNJ5Unq8tA1hCKdaroFooZtANqZJoA2UfYmmJYOF0dYAWgqeDtyqVN2oylLnkPQDlq4gTHWkD8QIlPKKIsnkulUKpFI2rYdj8Vs3WgyTW5wPZ8UghjdaCpLZQKpTTAQRXCgjwlzHzDGKPgaUKT1pe0EV6+79xfQsM9+n7vbt+CXe3GoBk81EFOrfz4FAHbMjMUtzY98fn8QzmlHV1NAtwT6zVrV6u5FCTU4BwsYpZwx27ZdTckI4fme8KUIW0y+5wmps7iFlNIXUjejdC9KSd2eUlJK7USjpJTB9FOQNwDV/0MV9QtUt5xWSGKqulEhjtEWm7AGSEOoogsO3IoJJUSrhSt9j9ArRhMiuh/EKDMNw7Isy7bj8bimZCyt/DW5rirNL2W03FsqMzIshC+BSzIiBCNM9PuWpyMDWx4U8jTo46CZey32oO1/+Pb8zV1h0L2LZ2pVq199TAOf/2FiAJCiFjJQq3vebRhjtm0bhhFEHIVCXZ3cVIYlWgUc6GqkElJpEBOAGuFLoYQU+kZYUghfaOmNEFJKJaWQSgipVEDtBASPVABKd3tBO8lASPQEUKisCC6TLbAG0kFVBvq6MxsgFQ06CNXOeHqWSPMxgQsOpYwx0zBM0zItwzJNbhhlqxiNYThnjHMWNJh0ZynsKAWjSQRHKpIjhcozWZoc0nwMlKOq8Urm7BNamtkDvkfiT+zBtapVrWpVq1/twhhTRgkl0VgdpGMNInnaqEyolDtAEMIOFeIOAI1LVAhNwn5UiFeUkiGLoxFSCIoCcBPimzA6u/wAVeltqQACybDDBeWM7eis1IqFL/TEIwFvggnSEVMYa1yi3e1s247FbMu2LdMyTIMbPBT8BvrfQN4bzH0HvjQ6EVO/JiqTLWEywlqNJByFOpXVGeNPeqVmtT2+VrWqVa1q9SsKaCrrK4JQJI6AhPaPZTInCA/Qt1aIdqtSBhEAVGJ5QpVLVN5bFtOoChGjEESmtyMjV/puqRupqvLtcm526OoXPFgBSKkQKFAotBLWc1cAKzAF1ngmoHAMgxuGYRoGNzjjvNxFopgGIIiUG0lhrnZEwBtJ/65CJatHr9ccxv506IYaoKlVrWpVq1r96mKa6q8qLMNaFmgYr6FwWaNpW31PBdBUr/jR9O7VGxadeaok/+DqZ0TgUeUOpSLBT9UxUNEfObDfw0R7w5TZG0wqfSAdrbkiEjoUEVd/jJFnoLs4un1WVQM0tapVrWpVq3+WEGetu1YIPDBCsJpyWAufrEY/97a0w202NjQnKGcb4tUWsHgNV/wAKQGK+g6UXzEKgAgiFfj1eTbQZwgh3cvLZDKfydh2rWpVq1rVqla/GgVBasHHeOYnBNbW2MSVT8K/IgJUhhCqq683TVNKiXBNVlurWtWqVrWqVa0+f4Whlg9bq1rVqla1qlWtPuf1/wHiL+tZAlZ20wAAAABJRU5ErkJggg==" alt="Sweaden Compañía de Seguros">
 <div class="vig">INICIO DE VIG.: ${esc(formatDate($('startDate').value))}<br>FIN DE VIG.: ${esc(formatDate($('endDate').value))}</div><div class="clear"></div>
 <div class="doc-title">INFORMACIÓN DEL CLIENTE</div>
 <table class="client"><tbody>
 <tr><td class="label">No. Identificación:</td><td>${esc($('clientId').value)}</td><td class="label">Cliente:</td><td>${esc($('clientName').value)}</td></tr>
 <tr><td class="label">Correo:</td><td>${esc($('clientEmail').value)}</td><td class="label">Broker:</td><td>${esc($('broker').value)}</td></tr>
 <tr><td class="label">Teléfono:</td><td>${esc($('clientPhone').value)}</td><td class="label">Ciudad:</td><td>${esc($('clientCity').value)}</td></tr>
 </tbody></table>
 <div class="note">NOTA: Este cotizador aplica para flotas de más de 3 unidades.</div>
 <div class="section-title">INFORMACIÓN DE LOS VEHÍCULOS</div>
 <table class="vehicle-table"><thead><tr><th>MARCA</th><th>MODELO</th><th>AÑO</th><th>PLACA</th><th>V. ASEG.</th><th>EXTRAS</th><th>TOTAL</th></tr></thead><tbody>${rows}</tbody></table>
 <table class="summary"><tbody>${summaryRows}</tbody></table>
 <div class="coverage-title">COBERTURAS ADICIONALES</div>
 ${coverageHtml}
 <script>window.onload=()=>window.print()<\/script></body></html>`.replace("__EXECUTIVE_NAME__", "Ejecutiva Comercial: " + esc(executiveName));
    const w = window.open('', '_blank');
    if (!w)
        return status('Permite las ventanas emergentes para generar el PDF.', true);
    w.document.open();
    w.document.write(html);
    w.document.close();
}
// ============================================================
// 13. EXPORTACION DE INFORMACION
// ============================================================
function exportCSV() { if (!vehicles.length)
    return status('No hay vehículos para exportar.', true); let headers = ['MARCA', 'MODELO', 'PLACA', 'AÑO', 'ANTIGÜEDAD', 'VALOR ASEGURADO', 'EXTRAS', 'TOTAL ASEGURADO', 'TASA MULTIMARCA %', 'TASA HINO %', 'TASA BASE %', 'DESCUENTO PUNTOS', 'AUMENTO PUNTOS', 'DESCUENTO POR CANTIDAD %', 'TASA APLICADA %', 'PRIMA']; let rows = vehicles.map(v => [v.brand, v.model, v.plate, v.year, v.age, v.insured, v.extra, v.total, v.multi, v.hino, v.base, $('discount').value, $('increase').value, countVolumeDiscount(), adjustedRate(v), (v.total * adjustedRate(v) / 100).toFixed(2)]); let csv = '\ufeff' + [headers, ...rows].map(row => row.map(x => '"' + String(x ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n'); let url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a'); a.href = url; a.download = 'MACRO_PESADOS_cotizacion.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
// ============================================================
// 14. INICIALIZACION DEL SISTEMA
// ============================================================
function init() { try {
    let vd = JSON.parse(localStorage.getItem('stor_volume_discounts_v1') || 'null');
    if (vd && typeof vd === 'object')
        volumeDiscounts = vd;
    let saved = JSON.parse(localStorage.getItem('stor_multimarca_rates_v2') || 'null');
    if (saved?.rates && saved?.hinoRates) {
        rates = Object.fromEntries(Object.entries(saved.rates).map(([age, r]) => [age, { bands: Array.isArray(r.bands) ? ((r.bands[0] && typeof r.bands[0] === 'object') ? r.bands : r.bands.map((rate, i) => ({ min: [0, 20001, 50001, 100001][i], max: [20000.99, 50000.99, 100000.99, 180000][i], rate }))).filter(b => b && Number.isFinite(Number(b.rate))) : [{ min: 0, max: 180000, rate: r.multiFlat }] }]));
        hinoRates = saved.hinoRates;
    }
    let pref = JSON.parse(localStorage.getItem('stor_summary_v1') || '{}');
    for (let [k, id] of [['discount', 'discount'], ['increase', 'increase'], ['patrimonial', 'patrimonial'], ['lucro', 'lucro']])
        if (pref[k] !== undefined)
            $(id).value = pref[k];
}
catch (e) { } renderRates(); renderVolumeDiscounts(); restoreDraft(); render(); updatePreview(); }
// ============================================================
// 15. CARGA MASIVA DESDE EXCEL (COPIAR Y PEGAR)
// ============================================================
let bulkPending = [];
function normBrand(v) { return String(v || '').trim().toUpperCase().replace(/\s+/g, ' '); }
function parseBulkRows(raw) {
    const lines = String(raw || '').replace(/\r/g, '').split('\n').filter(x => x.trim() !== '');
    if (!lines.length)
        return { rows: [], errors: ['No hay filas pegadas.'] };
    let first = lines[0].split('\t').map(x => normBrand(x));
    const hasHeader = first.some(x => /MARCA|MODELO|PLACA|ANO|AÑO|VALOR|ASEGURADO|EXTRAS/.test(x));
    let map = { brand: 0, model: 1, plate: 2, year: 3, insured: 4, extra: 5 };
    if (hasHeader) {
        const find = (patterns, fallback) => { let i = first.findIndex(x => patterns.some(p => x.includes(p))); return i >= 0 ? i : fallback; };
        map = { brand: find(['MARCA'], 0), model: find(['MODELO'], 1), plate: find(['PLACA'], 2), year: find(['AÑO', 'ANO', 'FABRICACION', 'FABRICACIÓN'], 3), insured: find(['VALOR ASEGURADO', 'VALOR ASEG.', 'SUMA ASEGURADA'], 4), extra: find(['EXTRAS'], 5) };
    }
    const start = hasHeader ? 1 : 0, rows = [], errors = [];
    const known = new Map(BRANDS.map(b => [normBrand(b), b]));
    const usedPlates = new Set(vehicles.map(v => String(v.plate || '').trim().toUpperCase()).filter(Boolean));
    for (let idx = start; idx < lines.length; idx++) {
        const cells = lines[idx].split('\t');
        const get = k => String(cells[map[k]] ?? '').trim();
        const brandRaw = get('brand'), brand = known.get(normBrand(brandRaw));
        const model = get('model'), plate = get('plate'), yearRaw = get('year'), year = Number(yearRaw);
        const insured = parseMoney(get('insured'));
        const extraText = get('extra'), extra = extraText === '' ? 0 : parseMoney(extraText);
        const rowNo = idx + 1, issues = [];
        if (!brand)
            issues.push('Marca no reconocida: ' + (brandRaw || '(vacia)'));
        if (model.length > 50)
            issues.push('Modelo supera los 50 caracteres');
        if (!/^\d{4}$/.test(yearRaw) || !Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)
            issues.push('Año debe tener exactamente 4 dígitos y ser válido');
        if (!Number.isFinite(insured) || insured <= 0)
            issues.push('Valor asegurado no válido');
        if (!Number.isFinite(extra) || extra < 0)
            issues.push('Extras no válidos');
        const plateKey = plate.toUpperCase();
        if (plateKey && usedPlates.has(plateKey))
            issues.push('Placa duplicada: ' + plate);
        if (plateKey && !issues.length)
            usedPlates.add(plateKey);
        let q = null, total = Number.isFinite(insured) && Number.isFinite(extra) ? insured + extra : 0;
        if (brand && /^\d{4}$/.test(yearRaw) && Number.isInteger(year) && Number.isFinite(insured) && insured > 0 && Number.isFinite(extra) && extra >= 0) {
            const age = ageNow(year);
            q = quoteRate(brand, age, total);
            if (!q)
                issues.push('No existe tasa para antigüedad ' + age + ' y valor ' + fmt(total));
        }
        rows.push({ rowNo, brand, brandRaw, model, plate, year, insured, extra, total, age: Number.isInteger(year) ? ageNow(year) : null, q, issues });
    }
    return { rows, errors };
}
function previewBulk() {
    const result = parseBulkRows($('bulkPaste').value);
    bulkPending = result.rows.filter(r => r.issues.length === 0);
    const invalid = result.rows.filter(r => r.issues.length > 0);
    $('bulkPreviewWrap').classList.toggle('hidden', !result.rows.length);
    $('bulkPreviewRows').innerHTML = result.rows.map(r => `<tr class="${r.issues.length ? 'bulk-error' : 'bulk-ok'}"><td>${r.rowNo}</td><td>${esc(r.brand || r.brandRaw)}</td><td>${esc(r.model)}</td><td>${esc(r.plate)}</td><td>${r.year || ''}</td><td>${Number.isFinite(r.insured) ? fmt(r.insured) : ''}</td><td>${Number.isFinite(r.extra) ? fmt(r.extra) : ''}</td><td>${r.issues.length ? esc(r.issues.join('; ')) : 'VALIDO · ' + (r.brand === 'HINO' ? 'MATRIZ HINO' : 'MATRIZ MULTIMARCA')}</td></tr>`).join('');
    $('addBulk').disabled = bulkPending.length === 0;
    let msg = 'Filas leidas: ' + result.rows.length + '\nValidas: ' + bulkPending.length + '\nCon observaciones: ' + invalid.length;
    if (invalid.length)
        msg += '\nCorrige las filas marcadas en rojo y vuelve a validar. Puedes agregar unicamente las filas validas.';
    $('bulkFeedback').textContent = msg;
    $('bulkFeedback').className = 'notice' + (invalid.length ? ' error' : ' good');
}
function addBulkVehicles() {
    if (!bulkPending.length)
        return status('Primero valida el listado pegado.', true);
    const rows = bulkPending.slice();
    rows.forEach(r => vehicles.push({ brand: r.brand, model: r.model, plate: r.plate, year: r.year, age: r.age, insured: r.insured, extra: r.extra, total: r.total, multi: r.q.multi, hino: r.q.hino, base: r.q.base, rate: r.q.rate, premium: r.total * r.q.rate / 100 }));
    render();
    bulkPending = [];
    $('bulkPaste').value = '';
    $('bulkPreviewWrap').classList.add('hidden');
    $('bulkPreviewRows').innerHTML = '';
    $('addBulk').disabled = true;
    $('bulkFeedback').textContent = rows.length + ' vehiculo(s) agregado(s) correctamente. Las tasas se calcularon segun la marca: HINO o MULTIMARCA.';
    $('bulkFeedback').className = 'notice good';
    status(rows.length + ' vehiculos agregados desde Excel.');
}
$('previewBulk').addEventListener('click', previewBulk);
$('addBulk').addEventListener('click', addBulkVehicles);
$('clearBulk').addEventListener('click', () => { $('bulkPaste').value = ''; bulkPending = []; $('bulkPreviewWrap').classList.add('hidden'); $('bulkPreviewRows').innerHTML = ''; $('addBulk').disabled = true; $('bulkFeedback').textContent = 'Pega aqui las filas copiadas desde Excel para validar antes de agregarlas.'; $('bulkFeedback').className = 'notice'; });
$('bulkPaste').addEventListener('paste', () => { setTimeout(previewBulk, 80); });
init();
