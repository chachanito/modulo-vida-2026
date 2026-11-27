/* Conciliador de Créditos V36: Estado compartido, utilidades y formato monetario.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* 9.1 Estado de aplicación y utilidades */
let actual = [],
  previous = [],
  results = [],
  missing = [],
  stats = null;
const $ = (s) => document.getElementById(s);
const fmt = (n) =>
  Number(n || 0).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const canon = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/* 9.1.1 Formato monetario visible: almacenamiento numérico sin cambiar los cálculos. */
function parseUsd(value) {
  let t = String(value ?? "")
    .replace(/USD|\$|\s/gi, "")
    .trim();
  if (!t) return NaN;
  if (t.includes(",") && t.includes("."))
    t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  return Number(t);
}
function formatUsd(value) {
  return (
    "USD " +
    Number(value || 0).toLocaleString("de-DE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}
const creditInput = document.getElementById("limite");
creditInput.addEventListener("focus", () => {
  let n = parseUsd(creditInput.value);
  creditInput.value = Number.isFinite(n) ? String(n).replace(".", ",") : "";
  creditInput.select();
});
creditInput.addEventListener("blur", () => {
  let n = parseUsd(creditInput.value);
  if (Number.isFinite(n) && n >= 0) creditInput.value = formatUsd(n);
});
/* 9.1.2 Regla exclusiva nuevos: configuración independiente, cantidad numérica en memoria. */
const newOnlyMoney = $("newOnlyAmount");
newOnlyMoney.addEventListener("focus", () => {
  const n = parseUsd(newOnlyMoney.value);
  newOnlyMoney.value = Number.isFinite(n) ? String(n).replace(".", ",") : "";
  newOnlyMoney.select();
});
newOnlyMoney.addEventListener("blur", () => {
  const n = parseUsd(newOnlyMoney.value);
  if (Number.isFinite(n) && n >= 0) newOnlyMoney.value = formatUsd(n);
});
