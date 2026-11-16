// Expone el mismo motor de calculo en el navegador y en los entornos de prueba.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CotizadorRC = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Shared browser/test API: the pricing engine does not depend on the DOM or external data files.
  // Limites y tarifas compartidos por el formulario y los calculos.
  const MAX_VEHICLES = 100;
  const PASSENGER_COUNTS = Object.freeze([12, 15, 17, 20, 25, 30, 35, 40, 45]);
  const PLANS = Object.freeze({
    5000: Object.freeze({ insuredValue: 5000, basePremium: 51.35, deductible: '30% del valor del siniestro, mínimo USD 1.000 por vehículo.' }),
    10000: Object.freeze({ insuredValue: 10000, basePremium: 116.58, deductible: '35% del valor del siniestro, mínimo USD 2.000 por vehículo.' })
  });
  // Redondea importes a centavos evitando errores de precision de punto flotante.
  function roundMoney(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

  // Obtiene el derecho de emision segun el tramo de prima neta de la hoja de calculo.
  function emissionFee(netPremium) {
    const net = Number(netPremium) || 0;
    if (net === 0) return 0.90;
    if (net <= 250.99) return 0.50;
    if (net <= 500.99) return 1;
    if (net <= 1000.99) return 3;
    if (net <= 2000.99) return 5;
    if (net <= 4000.99) return 7;
    return net <= 9999999.99 ? 9 : null;
  }
  // Suma dias a una fecha ISO sin desplazar el dia por la zona horaria del navegador.
  function addDays(dateText, days) {
    if (!dateText) return '';
    const date = new Date(dateText + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  // Valida los vehiculos, calcula primas, impuestos, totales y fechas de la cotizacion.
  function calculate(input) {
    const plan = PLANS[String(input.insuredValue)] || PLANS[5000];
    // El valor asegurado requiere marca y modelo; la prima tambien requiere datos validos.
    const vehicles = (input.vehicles || []).map((vehicle, index) => {
      const brand = String(vehicle.brand || '').trim();
      const model = String(vehicle.model || '').trim();
      const passengersText = String(vehicle.passengers ?? '').trim();
      const passengers = Number(vehicle.passengers);
      const passengerRateText = String(vehicle.passengerRate ?? '').trim();
      const passengerRate = Number(vehicle.passengerRate);
      const year = Number(vehicle.year);
      const validYear = Number.isInteger(year) && year >= 1998 && year <= new Date().getFullYear();
      const validPlate = /^[A-Z]{3}\d{4}$/i.test(String(vehicle.plate || '').trim());
      const validPassengers = PASSENGER_COUNTS.includes(passengers);
      const hasInsuredValue = Boolean(brand && model);
      const complete = Boolean(hasInsuredValue && validYear && validPlate && passengersText !== '' && validPassengers && passengerRateText !== '' && Number.isFinite(passengerRate));
      return {
        ...vehicle,
        item:index + 1,
        passengers:Number.isFinite(passengers) ? passengers : 0,
        passengerRate:Number.isFinite(passengerRate) ? passengerRate : 0,
        hasInsuredValue,
        insuredValue:hasInsuredValue ? plan.insuredValue : 0,
        netPremium:complete ? plan.basePremium + passengers * passengerRate : null,
        complete
      };
    });
    // Solo las filas completas aportan prima e impuestos; el valor asegurado se suma aparte.
    const completedVehicles = vehicles.filter((vehicle) => vehicle.complete);
    const insuredTotal = roundMoney(vehicles.reduce((sum, vehicle) => sum + vehicle.insuredValue, 0));
    const netPremiumRaw = completedVehicles.reduce((sum, vehicle) => sum + vehicle.netPremium, 0);
    const netPremium = roundMoney(netPremiumRaw);
    // Calcula las contribuciones, el derecho de emision y el IVA sobre la base correspondiente.
    const bankContributionRaw = netPremiumRaw * 0.035;
    const scTaxRaw = netPremiumRaw * 0.005;
    const issueFee = emissionFee(netPremiumRaw);
    const issueFeeAmount = issueFee ?? 0;
    const vatRaw = (netPremiumRaw + bankContributionRaw + scTaxRaw + issueFeeAmount) * 0.15;
    const totalPremium = roundMoney(netPremiumRaw + bankContributionRaw + scTaxRaw + issueFeeAmount + vatRaw);
    return { plan, vehicles, completedVehicles, vehicleCount:completedVehicles.length, insuredTotal, netPremium, bankContribution:roundMoney(bankContributionRaw), scTax:roundMoney(scTaxRaw), issueFee, vat:roundMoney(vatRaw), totalPremium, startDate:input.startDate || '', endDate:addDays(input.startDate, 365), quoteExpires:addDays(input.quoteDate || input.startDate, 15) };
  }
  return { MAX_VEHICLES, PASSENGER_COUNTS, PLANS, calculate, emissionFee, addDays, roundMoney };
});
