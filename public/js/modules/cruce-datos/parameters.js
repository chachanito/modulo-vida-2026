/* Conciliador de Créditos V36: Edición y validación visual de parámetros tarifarios.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

function tableRanges() {
  $("ageRanges").innerHTML =
    `<div class="tablewrap"><table><thead><tr><th>DESDE AÑOS</th><th>MESES</th><th>DÍAS</th><th>HASTA AÑOS</th><th>MESES</th><th>DÍAS</th><th>LÍMITE USD</th><th>OBSERVACIONES</th><th>CONTROL</th><th></th></tr></thead><tbody>${ranges.age.map((r, i) => `<tr>${["fromY", "fromM", "fromD", "toY", "toM", "toD", "limit"].map((k) => `<td><input style="min-width:76px;width:90px" data-group="age" data-i="${i}" data-field="${k}" type="${k === "limit" ? "text" : "number"}" ${k === "limit" ? 'data-money="1" inputmode="decimal"' : 'min="0"'} ${k.endsWith("M") ? 'max="11"' : k.endsWith("D") ? 'max="30"' : k.endsWith("Y") ? 'max="' + Number($("maxPerm").value) + '"' : ""} step="${k === "limit" ? ".01" : "1"}" value="${k === "limit" ? formatUsd(r[k]) : r[k]}"></td>`).join("")}<td><input style="min-width:220px" data-group="age" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td>${cmpAge([r.fromY, r.fromM, r.fromD], [r.toY, r.toM, r.toD]) <= 0 ? "OK" : "REVISAR"}</td><td><button class="secondary" data-remove="age" data-i="${i}">Eliminar</button></td></tr>`).join("")}</tbody></table></div>`;
  $("guaranteeRanges").innerHTML =
    `<div class="tablewrap"><table><thead><tr><th>MONTO DESDE USD</th><th>MONTO HASTA USD</th><th>OBSERVACIONES</th><th></th></tr></thead><tbody>${ranges.guarantees.map((r, i) => `<tr><td><input data-group="guarantees" data-i="${i}" data-field="from" data-money="1" type="text" inputmode="decimal" value="${formatUsd(r.from)}"></td><td><input data-group="guarantees" data-i="${i}" data-field="to" data-money="1" type="text" inputmode="decimal" value="${formatUsd(r.to)}"></td><td><input data-group="guarantees" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td><button class="secondary" data-remove="guarantees" data-i="${i}">Eliminar</button></td></tr>`).join("")}</tbody></table></div>`;
}
function tableCombined() {
  $("combinedRanges").innerHTML =
    `<div class="tablewrap"><table><thead><tr><th>DESDE AÑOS</th><th>MESES</th><th>DÍAS</th><th>HASTA AÑOS</th><th>MESES</th><th>DÍAS</th><th>MONTO DESDE USD</th><th>MONTO HASTA USD</th><th>REQUISITO</th><th></th></tr></thead><tbody>${ranges.combined.map((r, i) => `<tr>${["fromY", "fromM", "fromD", "toY", "toM", "toD", "amountFrom", "amountTo"].map((k) => `<td><input style="min-width:76px;width:86px" type="${k.startsWith("amount") ? "text" : "number"}" ${k.startsWith("amount") ? 'data-money="1" inputmode="decimal"' : ""} data-group="combined" data-i="${i}" data-field="${k}" step="${k.startsWith("amount") ? ".01" : "1"}" value="${k.startsWith("amount") ? formatUsd(r[k]) : r[k]}"></td>`).join("")}<td><input style="min-width:230px" data-group="combined" data-i="${i}" data-field="obs" value="${esc(r.obs)}"></td><td><button class="secondary" data-remove="combined" data-i="${i}">Eliminar</button></td></tr>`).join("")}</tbody></table></div>`;
}
const _originalTableRanges = tableRanges;
tableRanges = function () {
  _originalTableRanges();
  updateAgeFieldLimits();
};
const _originalTableCombined = tableCombined;
tableCombined = function () {
  _originalTableCombined();
  updateAgeFieldLimits();
};
/* V18: moneda en todos los importes de parámetros, sin convertirlos en texto de cálculo. */
document.addEventListener("focusin", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.dataset.money !== "1") return;
  const n = parseUsd(el.value);
  el.value = Number.isFinite(n) ? String(n).replace(".", ",") : "";
  el.select();
});
document.addEventListener("focusout", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLInputElement) || el.dataset.money !== "1") return;
  const n = parseUsd(el.value);
  if (Number.isFinite(n) && n >= 0) el.value = formatUsd(n);
});
function readRanges() {
  document.querySelectorAll("[data-group][data-field]").forEach((x) => {
    let r = ranges[x.dataset.group][+x.dataset.i];
    r[x.dataset.field] =
      x.dataset.field === "obs"
        ? x.value
        : x.dataset.money === "1"
          ? parseUsd(x.value)
          : Number(x.value);
  });
}
document.addEventListener("click", (e) => {
  if (e.target.dataset.remove) {
    readRanges();
    ranges[e.target.dataset.remove].splice(+e.target.dataset.i, 1);
    tableRanges();
    tableCombined();
  }
});
$("addAge").onclick = () => {
  readRanges();
  if (ranges.age.length >= 10) {
    alert("Máximo 10 rangos");
    return;
  }
  ranges.age.push({
    fromY: Number($("min").value),
    fromM: Number($("minMes").value),
    fromD: Number($("minDia").value),
    toY: Number($("maxPerm").value),
    toM: Number($("maxPermMes").value),
    toD: Number($("maxPermDia").value),
    limit: 10000,
    obs: "COBERTURA HASTA $10.000",
  });
  tableRanges();
};
$("addCombined").onclick = () => {
  readRanges();
  ranges.combined.push({
    fromY: Number($("min").value),
    fromM: Number($("minMes").value),
    fromD: Number($("minDia").value),
    toY: Number($("maxPerm").value),
    toM: Number($("maxPermMes").value),
    toD: Number($("maxPermDia").value),
    amountFrom: 0,
    amountTo: parseUsd($("limite").value),
    obs: "DECLARACIÓN DE SALUD",
  });
  tableCombined();
};
$("addGuarantee").onclick = () => {
  readRanges();
  ranges.guarantees.push({
    from: 0,
    to: parseUsd($("limite").value),
    obs: "SOLICITAR DOCUMENTO",
  });
  tableRanges();
};
tableRanges();
tableCombined();
updateAgeFieldLimits();
function cmpAge(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
/* 9.2.1 Rangos cronológicos: meses 0–11, días según mes de referencia de la fecha de corte. */
function maxAgeDays() {
  const d = $("corte").value || "2026-09-01";
  const [y, m] = d.split("-").map(Number);
  return new Date(y, m - 1, 0).getDate() - 1;
}
function updateAgeFieldLimits() {
  const maxD = maxAgeDays();
  document
    .querySelectorAll(
      'input[id$="Dia"],input[id="newOnlyFromD"],input[id="newOnlyToD"],input[data-field="fromD"],input[data-field="toD"]',
    )
    .forEach((x) => {
      x.max = maxD;
      x.title =
        "Días permitidos 0–" +
        maxD +
        " según el mes de referencia de la fecha de corte";
    });
  document
    .querySelectorAll(
      'input[id$="Mes"],input[data-field="fromM"],input[data-field="toM"]',
    )
    .forEach((x) => {
      x.max = 11;
      x.title = "Meses permitidos de 0 a 11";
    });
}
$("corte").addEventListener("change", updateAgeFieldLimits);
document.addEventListener("input", (e) => {
  if (
    e.target.matches(
      'input[id$="Dia"],input[id$="Mes"],input[data-field$="D"],input[data-field$="M"]',
    )
  )
    e.target.setCustomValidity("");
});
updateAgeFieldLimits();
/* V17.1 Política por póliza: una póliza solo de permanencia no admite ingresos nuevos.
   El campo de edad máxima se deshabilita visualmente, pero conservamos sus valores
   en el perfil para cuando la póliza vuelva a permitir ingresos. */
function updateNewEntryMode() {
  const allow = $("allowNewEntries").value !== "no";
  const panel = $("newAgePanel");
  panel.style.opacity = allow ? "1" : ".43";
  for (const id of ["maxNuevo", "maxNuevoMes", "maxNuevoDia"])
    $(id).disabled = !allow;
  panel.title = allow
    ? ""
    : "NO APLICA: la póliza es exclusivamente de permanencia.";
}
$("allowNewEntries").addEventListener("change", () => {
  updateNewEntryMode();
  if (actual.length && previous.length) {
    try {
      compute();
    } catch (e) {
      showStatus("Revisa parámetros: " + e.message, "error");
    }
  }
});
updateNewEntryMode();
/* 9.2.2 Umbral adicional, exclusivamente para las cédulas clasificadas NUEVO. */
function getNewOnlyRule(p) {
  if (!$("newOnlyEnabled").checked || p.allowNewEntries === false)
    return { enabled: false };
  const r = {
    enabled: true,
    fromY: Number($("newOnlyFromY").value),
    fromM: Number($("newOnlyFromM").value),
    fromD: Number($("newOnlyFromD").value),
    toY: Number($("newOnlyToY").value),
    toM: Number($("newOnlyToM").value),
    toD: Number($("newOnlyToD").value),
    amountFrom: parseUsd($("newOnlyAmount").value),
    obs: $("newOnlyObs").value.trim(),
  };
  const days = maxAgeDays();
  for (const k of ["fromY", "fromM", "fromD", "toY", "toM", "toD"]) {
    const val = r[k],
      max = k.endsWith("Y") ? 100 : k.endsWith("M") ? 11 : days;
    if (!Number.isInteger(val) || val < 0 || val > max)
      throw Error(
        "Revisa años, meses y días del requisito exclusivo para ingresos nuevos.",
      );
  }
  if (r.toY === 100 && (r.toM || r.toD))
    throw Error(
      "El requisito para nuevos no puede superar los 100 años cumplidos.",
    );
  if (cmpAge([r.fromY, r.fromM, r.fromD], [r.toY, r.toM, r.toD]) > 0)
    throw Error("El rango de edad para ingresos nuevos está invertido.");
  if (
    !Number.isFinite(r.amountFrom) ||
    r.amountFrom < 0 ||
    r.amountFrom > p.limite
  )
    throw Error(
      "El monto mínimo del requisito para nuevos debe ser igual o menor al límite general de crédito.",
    );
  if (!r.obs)
    throw Error("Escribe la observación del requisito exclusivo para nuevos.");
  return r;
}
