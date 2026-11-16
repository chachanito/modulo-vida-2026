(() => {
  'use strict';
  // Conecta el motor de calculo, el catalogo y los controles visibles del cotizador.
  const core = globalThis.CotizadorRC;
  const $ = (id) => document.getElementById(id);
  const rows = $('rc-vehicles');
  const money = new Intl.NumberFormat('es-EC', { style:'currency', currency:'USD' });
  const number = new Intl.NumberFormat('es-EC');
  const addButton = $('rc-add');
  const catalog = globalThis.RCVehicleCatalog || {};
  const brands = Object.keys(catalog);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length:currentYear - 1998 + 1 }, (_, index) => String(currentYear - index));
  const passengerCounts = new Set(core.PASSENGER_COUNTS.map(String));
  // The form accepts only the same valid passenger counts used by the pricing engine, keeping the UI and totals in sync.
  // Obtiene la fecha local en formato ISO sin desplazar el dia por la zona horaria.
  function localDate() { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 10); }
  // Escapa datos del catalogo antes de incorporarlos a las opciones del formulario.
  function escapeHtml(value) { return String(value).replace(/[&<>"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[char]); }
  // Carga listas desplegables y listas de sugerencias para los campos editables.
  function fillOptions(select, values, placeholder, selected = '') {
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.replaceChildren(first, ...values.map((value) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      option.selected = value === selected;
      return option;
    }));
  }
  function fillDatalist(id, values) {
    let datalist = $(id);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = id;
      document.body.appendChild(datalist);
    }
    datalist.replaceChildren(...values.map((value) => {
      const option = document.createElement('option');
      option.value = value;
      return option;
    }));
  }
  // Crea una fila de vehiculo y enlaza su catalogo, validaciones y acciones.
  function vehicleRow(values = {}) {
    if (rows.children.length >= core.MAX_VEHICLES) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="rc-item"></td><td><select aria-label="Marca" data-field="brand"></select></td><td><select aria-label="Modelo" data-field="model" disabled></select></td><td><input aria-label="Año" data-field="year" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" list="rc-year-options" value="${escapeHtml(values.year || '')}" title="Año entre 1998 y ${currentYear}"></td><td><input aria-label="Placa, formato AAA1234" data-field="plate" maxlength="7" pattern="[A-Z]{3}[0-9]{4}" placeholder="AAA1234" title="Ingresa 3 letras seguidas de 4 números"></td><td><input aria-label="Pasajeros" data-field="passengers" type="text" inputmode="numeric" maxlength="2" pattern="12|15|17|20|25|30|35|40|45" list="rc-passenger-options" value="${escapeHtml(values.passengers ?? '')}" title="Elige o escribe una cantidad permitida"></td><td><input aria-label="PRIMA NETA por pasajero (USD)" data-field="passengerRate" type="number" min="0" step="0.01" value="${escapeHtml(values.passengerRate ?? '')}"></td><td class="rc-money rc-insured"></td><td class="rc-money rc-row-premium">Falta datos</td><td><button type="button" class="rc-remove" aria-label="Eliminar vehículo">×</button></td>`;
    rows.appendChild(tr);
    const brandSelect = tr.querySelector('[data-field="brand"]');
    const modelSelect = tr.querySelector('[data-field="model"]');
    const yearInput = tr.querySelector('[data-field="year"]');
    const passengersInput = tr.querySelector('[data-field="passengers"]');
    yearInput.dataset.acceptedPrefix = years.includes(yearInput.value) ? yearInput.value : '';
    passengersInput.dataset.acceptedPrefix = passengerCounts.has(passengersInput.value) ? passengersInput.value : '';
    fillOptions(brandSelect, brands, 'Selecciona marca', values.brand || '');
    const updateModels = (selected = '') => {
      const models = catalog[brandSelect.value] || [];
      fillOptions(modelSelect, models, models.length ? 'Selecciona modelo' : 'Primero elige marca', selected);
      modelSelect.disabled = !models.length;
    };
    updateModels(values.model || '');
    brandSelect.addEventListener('change', () => { updateModels(); recalculate(); });
    modelSelect.addEventListener('change', recalculate);
    // Restringe el anio al rango permitido y conserva solo prefijos posibles.
    yearInput.addEventListener('input', () => {
      const previous = yearInput.dataset.acceptedPrefix || '';
      const candidate = yearInput.value.replace(/[^0-9]/g, '').slice(0, 4);
      if (candidate && !years.some((year) => year.startsWith(candidate))) {
        yearInput.value = previous;
      } else {
        yearInput.value = candidate;
        yearInput.dataset.acceptedPrefix = candidate;
      }
      const year = Number(yearInput.value);
      yearInput.setCustomValidity(yearInput.value && (!Number.isInteger(year) || year < 1998 || year > currentYear) ? `El año debe estar entre 1998 y ${currentYear}.` : '');
      recalculate();
    });
    yearInput.addEventListener('blur', () => {
      if (yearInput.value && !years.includes(yearInput.value)) {
        yearInput.value = '';
        yearInput.dataset.acceptedPrefix = '';
        yearInput.setCustomValidity('');
        recalculate();
      }
    });
    // Permite escribir o elegir pasajeros, pero rechaza cantidades fuera de la lista.
    passengersInput.addEventListener('input', () => {
      const previous = passengersInput.dataset.acceptedPrefix || '';
      const candidate = passengersInput.value.replace(/[^0-9]/g, '').slice(0, 2);
      if (candidate && ![...passengerCounts].some((count) => count.startsWith(candidate))) {
        passengersInput.value = previous;
      } else {
        passengersInput.value = candidate;
        passengersInput.dataset.acceptedPrefix = candidate;
      }
      passengersInput.setCustomValidity(passengersInput.value && !passengerCounts.has(passengersInput.value) ? 'Elige una cantidad de pasajeros permitida.' : '');
      recalculate();
    });
    passengersInput.addEventListener('blur', () => {
      if (passengersInput.value && !passengerCounts.has(passengersInput.value)) {
        passengersInput.value = '';
        passengersInput.dataset.acceptedPrefix = '';
        passengersInput.setCustomValidity('');
        recalculate();
      }
    });
    // Normaliza la placa y exige tres letras seguidas de cuatro numeros.
    const plateInput = tr.querySelector('[data-field="plate"]');
    plateInput.addEventListener('input', (event) => {
      const entered = event.target.value.toUpperCase();
      let letters = '';
      let digits = '';
      for (const character of entered) {
        if (letters.length < 3 && /[A-Z]/.test(character)) letters += character;
        else if (letters.length === 3 && digits.length < 4 && /[0-9]/.test(character)) digits += character;
      }
      event.target.value = letters + digits;
      recalculate();
    });
    plateInput.addEventListener('blur', () => {
      if (plateInput.value && !/^[A-Z]{3}\d{4}$/.test(plateInput.value)) {
        plateInput.value = '';
        recalculate();
      }
    });
    tr.querySelector('.rc-remove').addEventListener('click', () => { tr.remove(); if (!rows.children.length) vehicleRow(); recalculate(); });
    tr.querySelectorAll('input').forEach((input) => input.addEventListener('input', recalculate));
    renumber();
  }
  // Mantiene la numeracion y el limite del boton para agregar vehiculos.
  function renumber() { [...rows.children].forEach((row, index) => { row.querySelector('.rc-item').textContent = index + 1; }); addButton.disabled = rows.children.length >= core.MAX_VEHICLES; }
  // Lee las filas y prepara los datos que consume el motor de calculo.
  function readVehicles() { return [...rows.children].map((row) => Object.fromEntries([...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value.trim()]))); }
  function readInput() { return { insuredValue:$('rc-limit').value, startDate:$('rc-start').value, quoteDate:$('rc-date').value, vehicles:readVehicles() }; }
  function setText(id, value) { $(id).textContent = value; }
  function formatDate(value) { if (!value) return '—'; const [year, month, day] = value.split('-'); return `${day}/${month}/${year}`; }
  function fieldValue(id, fallback = '—') { return $(id).value.trim() || fallback; }
  // Recalcula importes, actualiza el estado de validacion y sincroniza los resumenes.
  function recalculate() {
    renumber();
    const inputVehicles = readVehicles();
    const result = core.calculate({ ...readInput(), vehicles:inputVehicles });
    [...rows.children].forEach((row, index) => {
      const vehicle = result.vehicles[index];
      row.classList.toggle('is-incomplete', !vehicle.complete && Object.values(inputVehicles[index]).some(Boolean));
      row.querySelector('.rc-insured').textContent = vehicle.hasInsuredValue ? money.format(vehicle.insuredValue) : '';
      row.querySelector('.rc-row-premium').textContent = vehicle.complete ? money.format(vehicle.netPremium) : 'Falta datos';
    });
    setText('rc-count', number.format(result.vehicleCount)); setText('rc-insured-total', money.format(result.insuredTotal)); setText('rc-net-total', money.format(result.netPremium)); setText('rc-total', money.format(result.totalPremium));
    setText('rc-bank', money.format(result.bankContribution)); setText('rc-sc', money.format(result.scTax)); setText('rc-issue', result.issueFee === null ? '' : money.format(result.issueFee)); setText('rc-vat', money.format(result.vat));
    setText('rc-end', formatDate(result.endDate)); setText('rc-expires', formatDate(result.quoteExpires)); setText('rc-deductible', result.plan.deductible);
    const enteredVehicles = inputVehicles.filter((vehicle) => [vehicle.brand, vehicle.model, vehicle.year, vehicle.plate, vehicle.passengers].some(Boolean));
    const hasIncomplete = result.completedVehicles.length < enteredVehicles.length;
    const status = $('rc-status');
    status.className = 'rc-notice ' + (hasIncomplete || result.vehicleCount === 0 ? 'is-warn' : 'is-good');
    status.textContent = rows.children.length >= core.MAX_VEHICLES ? `Máximo ${core.MAX_VEHICLES} vehículos, como en el Excel.` : hasIncomplete ? `Verifica marca, modelo, año (1998–${currentYear}), placa AAA1234, pasajeros y PRIMA NETA por pasajero. Solo se suman filas válidas.` : result.vehicleCount ? `${result.vehicleCount} vehículos con prima calculada.` : 'Completa marca, modelo, año, placa, pasajeros y PRIMA NETA por pasajero para calcular.';
    renderQuote(result);
  }
  // Actualiza la plantilla imprimible con los datos del cliente y los resultados.
  function renderQuote(result) {
    setText('quote-id', fieldValue('rc-id')); setText('quote-client', fieldValue('rc-client')); setText('quote-broker', fieldValue('rc-broker')); setText('quote-phone', fieldValue('rc-phone')); setText('quote-email', fieldValue('rc-email')); setText('quote-city', fieldValue('rc-city'));
    setText('quote-date', formatDate(fieldValue('rc-date'))); setText('quote-expires', formatDate(result.quoteExpires)); setText('quote-start', formatDate(result.startDate)); setText('quote-end', formatDate(result.endDate)); setText('quote-deductible', result.plan.deductible);
    setText('quote-limit-coverage', money.format(result.plan.insuredValue)); setText('quote-count', number.format(result.vehicleCount));
    $('quote-vehicles').replaceChildren(...result.vehicles.filter((vehicle) => [vehicle.brand, vehicle.model, vehicle.year, vehicle.plate, vehicle.passengers].some((value) => String(value || '').trim())).map((vehicle) => { const tr = document.createElement('tr'); [vehicle.item, vehicle.brand, vehicle.model, vehicle.year, vehicle.plate, vehicle.passengers, vehicle.hasInsuredValue ? money.format(vehicle.insuredValue) : '', vehicle.complete ? money.format(vehicle.netPremium) : 'Falta datos'].forEach((value) => { const td = document.createElement('td'); td.textContent = value; tr.appendChild(td); }); return tr; }));
    setText('quote-net', money.format(result.netPremium)); setText('quote-bank', money.format(result.bankContribution)); setText('quote-sc', money.format(result.scTax)); setText('quote-issue', result.issueFee === null ? '' : money.format(result.issueFee)); setText('quote-vat', money.format(result.vat)); setText('quote-total', money.format(result.totalPremium));
  }
  // Genera el resumen en texto que se copia al portapapeles.
  function quoteText() { const result = core.calculate(readInput()); return ['COTIZACIÓN RC TRANSPORTE', `Cliente: ${fieldValue('rc-client')}`, `Identificación: ${fieldValue('rc-id')}`, `Vigencia: ${formatDate(result.startDate)} a ${formatDate(result.endDate)}`, `Vehículos: ${result.vehicleCount}`, `Suma asegurada total: ${money.format(result.insuredTotal)}`, `Prima neta: ${money.format(result.netPremium)}`, `Prima total: ${money.format(result.totalPremium)}`, `Deducible: ${result.plan.deductible}`].join('\n'); }
  // Carga sugerencias, conecta los botones y prepara la cotizacion inicial.
  fillDatalist('rc-year-options', years);
  fillDatalist('rc-passenger-options', core.PASSENGER_COUNTS.map(String));
  addButton.addEventListener('click', () => { vehicleRow(); recalculate(); });
  $('rc-print').addEventListener('click', () => window.print());
  $('rc-copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(quoteText()); $('rc-copy-status').textContent = 'Resumen copiado.'; } catch (_) { $('rc-copy-status').textContent = 'No se pudo copiar. Usa la opción Imprimir.'; } });
  $('rc-clear').addEventListener('click', () => { if (!confirm('¿Limpiar toda la cotización?')) return; document.querySelectorAll('.rc-client-grid input').forEach((input) => { input.value = ''; }); $('rc-date').value = localDate(); $('rc-start').value = localDate(); $('rc-limit').value = '5000'; rows.replaceChildren(); for (let index = 0; index < 4; index++) vehicleRow(); recalculate(); });
  document.querySelectorAll('.rc-client-grid input, .rc-settings input, .rc-settings select').forEach((input) => { input.addEventListener('input', recalculate); input.addEventListener('change', recalculate); });
  $('rc-date').value = localDate(); $('rc-start').value = localDate(); for (let index = 0; index < 4; index++) vehicleRow(); recalculate();
})();
