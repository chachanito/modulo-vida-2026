/* Conciliador de Créditos V36: Motor de conciliación, filtros y presentación de resultados.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* 9.4 Motor de conciliación y decisiones (sin modificaciones de cálculo en V6) */
function sumMap(rows) {
  let m = new Map();
  for (let r of rows) m.set(r.ci, (m.get(r.ci) || 0) + r.monto);
  return m;
}
function compute() {
  let p = getParams(),
    a = sumMap(actual),
    b = sumMap(previous),
    seen = new Set();
  results = actual.map((x) => {
    let n = a.get(x.ci),
      old = b.get(x.ci) || 0,
      isNew = !b.has(x.ci),
      diff = n - old,
      variation = isNew
        ? "NUEVO"
        : diff > 0
          ? "AUMENTO"
          : diff < 0
            ? "DISMINUCIÓN"
            : "SIN VARIACIÓN",
      ap = age(x.fecha, p.corte),
      errors = [],
      req = [],
      obs = [isNew ? "INGRESO NUEVO" : "PERMANENCIA", variation],
      limit = Math.round(p.limite * 100);
    if (isNew && !p.allowNewEntries) errors.push("NO PERMITE INGRESOS NUEVOS");
    if (!validCI(x.ci)) errors.push("CÉDULA INVÁLIDA");
    if (!ap) errors.push("FECHA DE NACIMIENTO INVÁLIDA");
    else {
      if (cmpAge(ap, [p.min, p.minMes, p.minDia]) < 0)
        errors.push("NO CUMPLE EDAD MÍNIMA");
      if (
        isNew &&
        p.allowNewEntries &&
        cmpAge(ap, [p.maxNuevo, p.maxNuevoMes, p.maxNuevoDia]) > 0
      )
        errors.push("SUPERA EDAD MÁXIMA DE INGRESO");
      if (!isNew && cmpAge(ap, [p.maxPerm, p.maxPermMes, p.maxPermDia]) > 0)
        errors.push("SUPERA EDAD MÁXIMA DE PERMANENCIA");
      for (let r of p.age)
        if (
          cmpAge(ap, [r.fromY, r.fromM, r.fromD]) >= 0 &&
          cmpAge(ap, [r.toY, r.toM, r.toD]) <= 0
        ) {
          limit = Math.min(limit, Math.round(r.limit * 100));
          obs.push(
            "APLICA LÍMITE ESPECIAL POR EDAD" + (r.obs ? " - " + r.obs : ""),
          );
        }
    }
    if (n > limit) errors.push("SUPERA EL LÍMITE DE CRÉDITO");
    if (n < 0) errors.push("MONTO NEGATIVO");
    if (isNew || diff > 0) {
      for (let r of p.guarantees) {
        let lo = Math.round(r.from * 100),
          hi = Math.round(r.to * 100);
        if (n >= lo && n <= hi && (isNew || !(old >= lo && old <= hi)))
          req.push(r.obs.trim());
      }
      if (ap)
        for (let r of p.combined) {
          let minAge = [r.fromY, r.fromM, r.fromD],
            maxAge = [r.toY, r.toM, r.toD],
            lo = Math.round(r.amountFrom * 100),
            hi = Math.round(r.amountTo * 100);
          if (
            cmpAge(ap, minAge) >= 0 &&
            cmpAge(ap, maxAge) <= 0 &&
            n >= lo &&
            n <= hi &&
            (isNew || !(old >= lo && old <= hi))
          )
            req.push(r.obs.trim());
        } /* V14: regla adicional independiente, exclusivamente para ingreso NUEVO. */
      if (
        isNew &&
        p.allowNewEntries &&
        ap &&
        p.newOnly.enabled &&
        cmpAge(ap, [p.newOnly.fromY, p.newOnly.fromM, p.newOnly.fromD]) >= 0 &&
        cmpAge(ap, [p.newOnly.toY, p.newOnly.toM, p.newOnly.toD]) <= 0 &&
        n >= Math.round(p.newOnly.amountFrom * 100)
      )
        req.push(p.newOnly.obs);
      if (req.length === 0)
        obs.push(
          "SIN NUEVOS REQUISITOS POR AUMENTO / YA EXIGIDOS EN MES ANTERIOR",
        );
    } else obs.push("SIN NUEVAS GARANTÍAS");
    obs.push(...errors, ...req);
    /* V13: prioridad de exclusion por edad maxima de ingreso antes de limite de credito. No altera observaciones ni calculos. */ let decision =
      errors.includes("NO PERMITE INGRESOS NUEVOS")
        ? "NO PERMITE INGRESOS NUEVOS"
        : errors.includes("SUPERA EDAD MÁXIMA DE INGRESO")
          ? "SUPERA LA EDAD MÁXIMA DE INGRESO"
          : errors.includes("SUPERA EL LÍMITE DE CRÉDITO")
            ? "SUPERA EL LÍMITE DE CRÉDITO"
            : errors.length
              ? "OTRAS VALIDACIONES / REVISAR"
              : req.length
                ? "PENDIENTE DE REQUISITOS"
                : "APTO PARA CARGA";
    return {
      ...x,
      global: n,
      old,
      diff,
      estado: isNew ? "INGRESO NUEVO" : "PERMANENCIA",
      variation,
      edad: ap
        ? `${ap[0]} años, ${ap[1]} meses, ${ap[2]} días`
        : "SIN FECHA VÁLIDA",
      ciEstado: validCI(x.ci) ? "CORRECTO" : "INCORRECTO",
      /* V22: obsDetalle conserva todas las causas para filtros; obs solo contiene la observación breve. */ obsDetalle:
        [...new Set(obs)].join(" | "),
      obs: observacionBreve(decision, obs, errors, req),
      limiteSugerido: limit,
      requisitosSoloReporte: [
        ...new Set([
          ...req,
          ...requisitosParaMostrar(p, n, old, isNew, variation, ap),
        ]),
      ],
      decision,
    };
  });
  missing = [...b]
    .filter(([ci]) => !a.has(ci))
    .map(([ci, monto]) => ({
      ci,
      monto,
      nombre: (previous.find((r) => r.ci === ci) || {}).nombre || "",
    }))
    .sort((x, y) => x.ci.localeCompare(y.ci));
  let totalA = actual.reduce((s, x) => s + x.monto, 0),
    totalB = previous.reduce((s, x) => s + x.monto, 0),
    ingresos = 0,
    aumentos = 0,
    disminuciones = 0,
    salidas = missing.reduce((s, x) => s + x.monto, 0);
  for (let [id, n] of a) {
    let old = b.get(id) || 0;
    if (!b.has(id)) ingresos += n;
    else if (n > old) aumentos += n - old;
    else if (n < old) disminuciones += old - n;
  }
  let exportTotal = results.reduce((s, x) => s + x.monto, 0);
  let decisions = {};
  for (let r of results)
    decisions[r.decision] = (decisions[r.decision] || 0) + 1;
  stats = {
    totalA,
    totalB,
    variacion: totalA - totalB,
    ingresos,
    aumentos,
    disminuciones,
    salidas,
    explicado: ingresos + aumentos - disminuciones - salidas,
    cuadre: totalA - totalB - (ingresos + aumentos - disminuciones - salidas),
    exportTotal,
    regActual: actual.length,
    regAnterior: previous.length,
    cedActual: a.size,
    cedAnterior: b.size,
    nuevas: [...a.keys()].filter((id) => !b.has(id)).length,
    permanencias: [...a.keys()].filter((id) => b.has(id)).length,
    soloAnterior: missing.length,
    duplicadosA: actual.length - a.size,
    duplicadosB: previous.length - b.size,
    decisions,
  };
  render();
}
function metric(title, value, cls = "") {
  return `<div class="metric ${cls}"><small>${title}</small><b>${value}</b></div>`;
}
function kpi(l, v, cls = "") {
  return `<div class="kpirow"><span>${esc(l)}</span><strong class="${cls}">${esc(v)}</strong></div>`;
}
function render() {
  if (!stats) return;
  let s = stats;
  $("cards").innerHTML =
    metric("Cartera ACTUAL", "USD " + fmt(s.totalA / 100)) +
    metric("Cartera ANTERIOR", "USD " + fmt(s.totalB / 100)) +
    metric(
      "Variación global",
      "USD " + fmt(s.variacion / 100),
      s.variacion >= 0 ? "positive" : "danger",
    ) +
    metric(
      "Diferencia de cuadre",
      "USD " + fmt(s.cuadre / 100),
      s.cuadre === 0 ? "positive" : "danger",
    ) +
    metric("Registros ACTUAL", s.regActual) +
    metric("Cédulas ACTUAL", s.cedActual) +
    metric("Cédulas nuevas", s.nuevas) +
    metric("Permanencias", s.permanencias);
  $("movement").innerHTML =
    kpi("Ingresos nuevos", "+ USD " + fmt(s.ingresos / 100)) +
    kpi("Aumentos de permanencias", "+ USD " + fmt(s.aumentos / 100)) +
    kpi(
      "Disminuciones de permanencias",
      "- USD " + fmt(s.disminuciones / 100),
    ) +
    kpi("Salidas del anterior", "- USD " + fmt(s.salidas / 100)) +
    kpi("Variación explicada", "USD " + fmt(s.explicado / 100));
  $("decisions").innerHTML =
    Object.entries(s.decisions)
      .map(([k, v]) => kpi(k, v + " registros"))
      .join("") + kpi("Cédulas que salieron", s.soloAnterior + " cédulas");
  $("checks").innerHTML =
    kpi(
      "Total ACTUAL vs suma RESULTADOS",
      "USD " + fmt((s.totalA - s.exportTotal) / 100),
      s.totalA === s.exportTotal ? "green" : "red",
    ) +
    kpi(
      "Conciliación de variación",
      "USD " + fmt(s.cuadre / 100),
      s.cuadre === 0 ? "green" : "red",
    ) +
    kpi(
      "Filas RESULTADOS vs ACTUAL",
      `${results.length} / ${actual.length}`,
      results.length === actual.length ? "green" : "red",
    ) +
    kpi(
      "Suma global ACTUAL sin repetir por cédula",
      "USD " +
        fmt(
          [...new Map(results.map((r) => [r.ci, r.global])).values()].reduce(
            (a, b) => a + b,
            0,
          ) / 100,
        ),
    ) +
    kpi(
      "Suma global ANTERIOR (solo cédulas vigentes)",
      "USD " +
        fmt(
          [...new Map(results.map((r) => [r.ci, r.old])).values()].reduce(
            (a, b) => a + b,
            0,
          ) / 100,
        ),
    ) +
    kpi("Duplicados por cédula ACTUAL (registros adicionales)", s.duplicadosA) +
    kpi(
      "Duplicados por cédula ANTERIOR (registros adicionales)",
      s.duplicadosB,
    );
  $("missingBody").innerHTML = missing
    .map(
      (r) =>
        `<tr><td>${esc(r.ci)}</td><td>${esc(r.nombre || "—")}</td><td>${fmt(r.monto / 100)}</td></tr>`,
    )
    .join("");
  renderRows();
}
/* 9.4.1 Vista limitada a 50 registros. Los filtros consultan toda la base; las exportaciones no se limitan. */
const PAGE_SIZE = 50;
/* V12: los filtros por motivo no son excluyentes; una cedula puede superar el limite y la edad al mismo tiempo. */
/* V15: INGRESOS NUEVOS es un filtro de consulta, no modifica la decision de carga. */
function matchesDecisionFilter(r, d) {
  if (!d) return true;
  if (d === "INGRESOS NUEVOS") return r.estado === "INGRESO NUEVO";
  if (d === "NO PERMITE INGRESOS NUEVOS")
    return r.decision === "NO PERMITE INGRESOS NUEVOS";
  if (d === "SUPERA EL LÍMITE DE CRÉDITO")
    return r.obsDetalle.split(" | ").includes("SUPERA EL LÍMITE DE CRÉDITO");
  if (d === "SUPERA LA EDAD MÁXIMA DE INGRESO")
    return r.obsDetalle.split(" | ").includes("SUPERA EDAD MÁXIMA DE INGRESO");
  return r.decision === d;
}
function filtered() {
  let q = canon($("search").value),
    d = $("decisionFilter").value;
  return results.filter(
    (r) =>
      (!q || canon(r.ci + " " + r.nombre).includes(q)) &&
      matchesDecisionFilter(r, d),
  );
}
function renderRows() {
  let rows = filtered();
  let vistos = new Set();
  $("count").textContent =
    `Mostrando los primeros ${Math.min(PAGE_SIZE, rows.length)} de ${rows.length} registros filtrados (${results.length} registros en total); importe filtrado: USD ${fmt(rows.reduce((s, x) => s + x.monto, 0) / 100)}. La exportación conserva todos los registros.`;
  $("resultBody").innerHTML = rows
    .slice(0, PAGE_SIZE)
    .map((r) => {
      let primero = !vistos.has(r.ci);
      vistos.add(r.ci);
      return `<tr><td>${r.fila}</td><td>${esc(r.ci)}</td><td>${esc(r.ciEstado)}</td><td>${esc(r.nombre)}</td><td>${esc(r.fecha)}</td><td>${esc(r.edad)}</td><td class="alignright">${fmt(r.monto / 100)}</td><td class="alignright">${primero ? fmt(r.global / 100) : "—"}</td><td class="alignright">${primero ? fmt(r.old / 100) : "—"}</td><td class="alignright">${primero ? fmt(r.diff / 100) : "—"}</td><td>${esc(r.variation)}</td><td>${esc(observacionExportable(r))}</td><td><span class="tag ${r.decision === "APTO PARA CARGA" ? "g" : r.decision === "PENDIENTE DE REQUISITOS" ? "y" : "r"}">${esc(r.decision)}</span></td></tr>`;
    })
    .join("");
}
$("search").oninput = renderRows;
$("decisionFilter").onchange = renderRows;
function rowForExport(r, seen) {
  let first = !seen.has(r.ci);
  seen.add(r.ci);
  return [
    r.fila,
    r.ci,
    r.ciEstado,
    r.nombre,
    r.fecha,
    r.edad,
    r.monto / 100,
    first ? r.global / 100 : null,
    first ? r.old / 100 : null,
    first ? r.diff / 100 : null,
    r.estado,
    r.variation,
    observacionExportable(r),
    r.decision,
    first && r.decision === "SUPERA EL LÍMITE DE CRÉDITO"
      ? r.limiteSugerido / 100
      : null,
  ];
}
function bookRows() {
  let res = [
    [
      "FILA ORIGEN",
      "CÉDULA",
      "ESTADO CÉDULA",
      "NOMBRES COMPLETOS",
      "FECHA NAC.",
      "EDAD (A/M/D)",
      "MONTO ACTUAL",
      "SUMA GLOBAL ACTUAL (1 VEZ POR CÉDULA)",
      "SUMA GLOBAL ANTERIOR (1 VEZ POR CÉDULA)",
      "DIFERENCIA GLOBAL (1 VEZ POR CÉDULA)",
      "ESTADO",
      "VARIACIÓN",
      "OBSERVACIONES",
      "DECISIÓN DE CARGA",
      "SUGERENCIA / LÍMITE (USD)",
    ],
  ];
  let seen = new Set();
  for (let r of results) res.push(rowForExport(r, seen));
  return res;
}
function groupedRows() {
  let grouped = new Map();
  for (let r of results)
    if (!grouped.has(r.ci))
      grouped.set(r.ci, [
        r.ci,
        r.nombre,
        r.global / 100,
        r.old / 100,
        r.diff / 100,
        r.estado,
        r.variation,
      ]);
  return [
    [
      "CÉDULA",
      "NOMBRES COMPLETOS",
      "SUMA GLOBAL ACTUAL",
      "SUMA GLOBAL ANTERIOR",
      "DIFERENCIA GLOBAL",
      "ESTADO",
      "VARIACIÓN",
    ],
    ...grouped.values(),
  ];
}
function csvCell(x) {
  let str = String(x ?? "");
  return '"' + str.replace(/"/g, '""') + '"';
}
function save(blob, name) {
  let a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}
function downloadCSV(rows, name) {
  let s = "\ufeff" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
  save(new Blob([s], { type: "text/csv;charset=utf-8" }), name);
}
function excelXmlRows(rows, sheetName) {
  let moneyCols =
    sheetName === "RESULTADOS"
      ? [7, 8, 9, 10, 15]
      : sheetName === "TOTALES POR CEDULA"
        ? [3, 4, 5]
        : sheetName === "SOLO ANTERIOR"
          ? [2]
          : sheetName === "CONTROL TOTALES"
            ? [2]
            : [];
  let specialMoney = sheetName === "PARAMETROS";
  let monetary = (j, i) =>
    moneyCols.includes(j + 1) &&
    i > 0 &&
    (sheetName !== "CONTROL TOTALES" || i <= 11);
  let moneyParam = (row, i, j) =>
    specialMoney &&
    typeof row[j] === "number" &&
    ((row[0] === "LÍMITE GENERAL" && j === 1) ||
      (row.length === 8 && j === 6) ||
      (row.length === 3 && j <= 1 && i > 6) ||
      (row.length === 9 && (j === 6 || j === 7)));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><sheetData>${rows
    .map(
      (row, i) =>
        `<row r="${i + 1}">${row
          .map((v, j) => {
            let col = "",
              n = j + 1;
            while (n) {
              col = String.fromCharCode(65 + ((n - 1) % 26)) + col;
              n = Math.floor((n - 1) / 26);
            }
            let ref = col + (i + 1),
              head = i === 0;
            let style = head
              ? 1
              : monetary(j, i) || moneyParam(row, i, j)
                ? sheetName === "RESULTADOS" && j === 6
                  ? 3
                  : 2
                : sheetName === "RESULTADOS" && j === 6
                  ? 4
                  : 0;
            if (typeof v === "number" && Number.isFinite(v))
              return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
            return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${String(v ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c])}</t></is></c>`;
          })
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`;
}
const excelStyles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0.00"/></numFmts><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Arial"/></font><font><b/><color rgb="FF9C3E05"/><sz val="10"/><name val="Arial"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF256D73"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFE1BB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="2" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
