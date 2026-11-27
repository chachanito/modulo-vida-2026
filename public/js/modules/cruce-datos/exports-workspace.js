/* Conciliador de Créditos V36: Exportaciones, procesamiento y limpieza del espacio de trabajo.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* 9.5 Exportación de libros Excel manteniendo sus formatos */
async function downloadXLSX() {
  if (!stats) throw Error("Primero procesa las bases.");
  let policyNumber = policyFilePrefix(),
    policyDescription = $("policyDescription").value.trim();
  let detail = bookRows(),
    s = stats;
  let controls = [
    ["INDICADOR", "VALOR"],
    ["CARTERA ACTUAL", s.totalA / 100],
    ["CARTERA ANTERIOR", s.totalB / 100],
    ["VARIACIÓN GLOBAL", s.variacion / 100],
    ["INGRESOS NUEVOS", s.ingresos / 100],
    ["AUMENTOS PERMANENCIAS", s.aumentos / 100],
    ["DISMINUCIONES PERMANENCIAS", s.disminuciones / 100],
    ["SALIDAS", s.salidas / 100],
    ["VARIACIÓN EXPLICADA", s.explicado / 100],
    ["CUADRE", s.cuadre / 100],
    ["TOTAL RESULTADOS", s.exportTotal / 100],
    ["REGISTROS ACTUAL", s.regActual],
    ["REGISTROS ANTERIOR", s.regAnterior],
    ["CÉDULAS NUEVAS", s.nuevas],
    ["PERMANENCIAS", s.permanencias],
    ...Object.entries(s.decisions).map(([k, v]) => ["REGISTROS " + k, v]),
  ];
  let p = getParams(),
    params = [
      ["PARÁMETRO", "VALOR"],
      ["NÚMERO DE PÓLIZA", policyNumber],
      ["DESCRIPCIÓN", policyDescription],
      ["CORTE", p.corte],
      ["EDAD MÍNIMA", `${p.min} años, ${p.minMes} meses, ${p.minDia} días`],
      [
        "POLÍTICA INGRESOS NUEVOS",
        p.allowNewEntries ? "PERMITIDOS" : "NO PERMITIDOS — SOLO PERMANENCIA",
      ],
      [
        "EDAD MÁX NUEVOS",
        p.allowNewEntries
          ? `${p.maxNuevo} años, ${p.maxNuevoMes} meses, ${p.maxNuevoDia} días`
          : "NO APLICA",
      ],
      [
        "EDAD MÁX PERMANENCIA",
        `${p.maxPerm} años, ${p.maxPermMes} meses, ${p.maxPermDia} días`,
      ],
      ["LÍMITE GENERAL", p.limite],
      [],
      [
        "DESDE AÑOS",
        "DESDE MESES",
        "DESDE DÍAS",
        "HASTA AÑOS",
        "HASTA MESES",
        "HASTA DÍAS",
        "LÍMITE USD",
        "OBSERVACIÓN",
      ],
      ...p.age.map((r) => [
        r.fromY,
        r.fromM,
        r.fromD,
        r.toY,
        r.toM,
        r.toD,
        r.limit,
        r.obs,
      ]),
      [],
      ["MONTO DESDE", "MONTO HASTA", "REQUISITO"],
      ...p.guarantees.map((r) => [r.from, r.to, r.obs]),
      [],
      [
        "EDAD DESDE A",
        "M",
        "D",
        "EDAD HASTA A",
        "M",
        "D",
        "MONTO DESDE",
        "MONTO HASTA",
        "REQUISITO COMBINADO",
      ],
      ...p.combined.map((r) => [
        r.fromY,
        r.fromM,
        r.fromD,
        r.toY,
        r.toM,
        r.toD,
        r.amountFrom,
        r.amountTo,
        r.obs,
      ]),
      [],
      [
        "REQUISITO SOLO NUEVOS",
        "ACTIVO",
        "EDAD DESDE A",
        "M",
        "D",
        "EDAD HASTA A",
        "M",
        "D",
        "MONTO DESDE USD",
        "OBSERVACION",
      ],
      [
        "DECLARACION DE SALUD",
        p.newOnly.enabled ? "SI" : "NO",
        p.newOnly.enabled ? p.newOnly.fromY : "",
        p.newOnly.enabled ? p.newOnly.fromM : "",
        p.newOnly.enabled ? p.newOnly.fromD : "",
        p.newOnly.enabled ? p.newOnly.toY : "",
        p.newOnly.enabled ? p.newOnly.toM : "",
        p.newOnly.enabled ? p.newOnly.toD : "",
        p.newOnly.enabled ? p.newOnly.amountFrom : "",
        p.newOnly.enabled ? p.newOnly.obs : "",
      ],
    ];
  controls.splice(
    1,
    0,
    ["NÚMERO DE PÓLIZA", policyNumber],
    ["DESCRIPCIÓN", policyDescription],
  );
  let sheets = [
    ["RESULTADOS", detail],
    ["TOTALES POR CEDULA", groupedRows()],
    ["CONTROL TOTALES", controls],
    [
      "SOLO ANTERIOR",
      [
        ["CÉDULA", "MONTO ANTERIOR"],
        ...missing.map((r) => [r.ci, r.monto / 100]),
      ],
    ],
    ["PARAMETROS", params],
  ];
  let zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file("xl/styles.xml", excelStyles);
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map(([name], i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`,
  );
  sheets.forEach(([name, rows], i) =>
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, excelXmlRows(rows, name)),
  );
  let blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  save(blob, "Conciliacion_Creditos_" + policyNumber + "_" + p.corte + ".xlsx");
}
function showStatus(msg, type = "") {
  let x = $("status");
  x.className = "notice " + type;
  x.textContent = msg;
}
async function processWithCutoff() {
  const f1 = $("actualFile").files[0],
    f2 = $("anteriorFile").files[0],
    t1 = $("actualPaste").value,
    t2 = $("anteriorPaste").value;
  const pasted1 = t1.trim().length > 0,
    pasted2 = t2.trim().length > 0;
  if ((!f1 && !pasted1) || (!f2 && !pasted2)) {
    showStatus("Carga o pega ambas bases (ACTUAL y MES ANTERIOR).", "error");
    return;
  }
  try {
    showStatus("Procesando bases localmente...");
    const aa = pasted1 ? readPastedExcel(t1, true) : await readExcel(f1, true);
    const bb = pasted2
      ? readPastedExcel(t2, false)
      : await readExcel(f2, false);
    actual = aa;
    previous = bb;
    compute();
    showStatus(
      `Conciliación completada: ${actual.length} registros de ACTUAL, ${previous.length} registros anteriores. Descuadre USD ${fmt(stats.cuadre / 100)}.`,
      stats.cuadre === 0 ? "good" : "warn",
    );
    document.querySelector("[data-tab=resumen]").click();
    $("cutoffSummary").textContent =
      "Fecha de corte de edad aplicada: " +
      $("corte").value.split("-").reverse().join("/");
    $("cutoffSummary").hidden = false;
    $("cutoffSummaryControl").textContent = $("cutoffSummary").textContent;
    $("cutoffSummaryControl").hidden = false;
  } catch (e) {
    showStatus("Error: " + e.message, "error");
    console.error(e);
  }
}
$("process").onclick = () => {
  const hasActual = $("actualFile").files[0] || $("actualPaste").value.trim();
  const hasPrevious =
    $("anteriorFile").files[0] || $("anteriorPaste").value.trim();
  if (!hasActual || !hasPrevious) {
    showStatus("Carga o pega ambas bases (ACTUAL y MES ANTERIOR).", "error");
    return;
  }
  const dialog = $("cutoffDialog");
  $("cutoffInput").value = "";
  dialog.showModal();
};
$("cutoffCancel").onclick = () => $("cutoffDialog").close();
$("cutoffForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const val = $("cutoffInput").value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    alert("Selecciona una fecha válida.");
    return;
  }
  $("corte").value = val;
  updateAgeFieldLimits();
  $("cutoffDialog").close();
  processWithCutoff();
});
$("recalc").onclick = () => {
  try {
    getParams();
    if (actual.length && previous.length) compute();
    alert("Parámetros aplicados correctamente.");
  } catch (e) {
    alert(e.message);
  }
};
$("exportAll").onclick = async () => {
  try {
    await downloadXLSX();
  } catch (e) {
    alert("No se pudo exportar: " + e.message);
  }
};
$("exportCSV").onclick = () => {
  if (!results.length) return alert("Primero carga las bases");
  try {
    downloadCSV(
      bookRows(),
      "Resultados_Conciliacion_" + policyFilePrefix() + ".csv",
    );
  } catch (e) {
    alert(e.message);
  }
};
$("exportMass").onclick = () => {
  if (!results.length) return alert("Primero carga las bases");
  let prefix;
  try {
    prefix = policyFilePrefix();
  } catch (e) {
    return alert(e.message);
  }
  let valid = results.filter((r) => r.decision === "APTO PARA CARGA");
  if (
    !confirm(
      `Se exportarán ${valid.length} registros APTO PARA CARGA. Los pendientes y excluidos no se incluyen. ¿Continuar?`,
    )
  )
    return;
  let ascii = (x) =>
    String(x ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/Ñ/g, "N")
      .replace(/ñ/g, "n")
      .replace(/[|\r\n]/g, " ")
      .trim();
  let lines = valid.map(
    (r) =>
      `C|${r.ci}|${ascii(r.nombre).toUpperCase()}|${r.fecha.split("-").reverse().join("/")}|M||${(r.monto / 100).toFixed(2)}|1|N`,
  );
  save(
    new Blob([lines.join("\r\n")], { type: "text/plain;charset=utf-8" }),
    "Carga_Masiva_Aptos_" + prefix + ".txt",
  );
};
$("downloadFiltered").onclick = () => {
  if (!results.length) return alert("Primero carga las bases");
  let keys = bookRows()[0];
  let seen = new Set();
  let rows = filtered().map((r) => rowForExport(r, seen));
  try {
    downloadCSV(
      [keys, ...rows],
      "Resultados_Filtrados_" + policyFilePrefix() + ".csv",
    );
  } catch (e) {
    alert(e.message);
  }
}; /* V14: limpieza total y explícita de datos, filtros, parámetros y reglas de esta sesión. */
function resetWorkspaceForNewPolicy() {
  actual = [];
  previous = [];
  results = [];
  missing = [];
  stats = null;
  $("actualFile").value = "";
  $("anteriorFile").value = "";
  $("actualPaste").value = "";
  $("anteriorPaste").value = "";
  $("search").value = "";
  $("decisionFilter").value = "";
  for (const id of [
    "cards",
    "movement",
    "decisions",
    "checks",
    "resultBody",
    "missingBody",
    "count",
  ])
    $(id).innerHTML = "";
  for (const id of policyIds) $(id).value = "";
  $("corte").value = "";
  $("cutoffInput").value = "";
  $("cutoffSummary").hidden = true;
  $("cutoffSummaryControl").hidden = true;
  $("newOnlyEnabled").checked = false;
  toggleNewOnlyDetails();
  $("allowNewEntries").value = "si";
  updateNewEntryMode();
  ranges = { age: [], guarantees: [], combined: [] };
  tableRanges();
  tableCombined();
  policyClearIdentity();
  policyRefresh();
  showStatus(
    "Nueva póliza: sesión vacía. Selecciona las bases después de configurar y guardar.",
    "good",
  );
}
function clearEverything() {
  if (
    !confirm(
      "¿Limpiar TODO? Se borrarán las bases cargadas, los resultados y los parámetros de esta sesión. Las pólizas guardadas permanecerán disponibles en el catálogo.",
    )
  )
    return;
  resetWorkspaceForNewPolicy();
  policyNotice(
    "Sesión limpiada. Las pólizas guardadas siguen disponibles en el catálogo.",
  );
  showStatus(
    "Sesión limpiada. Las pólizas guardadas se conservan en el catálogo de Parámetros.",
    "good",
  );
  document.querySelector('[data-tab="carga"]').click();
}
$("reset").onclick = clearEverything;
$("clearAllParams").onclick = clearEverything;
document.querySelectorAll("[data-tab]").forEach(
  (el) =>
    (el.onclick = () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((b) => b.classList.toggle("active", b === el));
      document
        .querySelectorAll(".pane")
        .forEach((p) => p.classList.toggle("active", p.id === el.dataset.tab));
    }),
);
