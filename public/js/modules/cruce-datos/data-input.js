/* Conciliador de Créditos V36: Lectura de Excel/TSV y reglas previas a la conciliación.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* 9.3 Validación de parámetros; mínimo de ingreso y máximo de permanencia */
function getParams(requireCorte = true) {
  readRanges();
  const p = { allowNewEntries: $("allowNewEntries").value !== "no" };
  for (let k of [
    "corte",
    "min",
    "minMes",
    "minDia",
    "maxNuevo",
    "maxNuevoMes",
    "maxNuevoDia",
    "maxPerm",
    "maxPermMes",
    "maxPermDia",
    "limite",
  ])
    p[k] =
      k === "corte"
        ? $(k).value
        : k === "limite"
          ? parseUsd($(k).value)
          : Number($(k).value);
  if ((requireCorte && !p.corte) || !Number.isFinite(p.limite) || p.limite < 0)
    throw Error("Revisa fecha de corte y límite general.");
  for (let k of p.allowNewEntries
    ? ["min", "maxNuevo", "maxPerm"]
    : ["min", "maxPerm"]) {
    if (
      !Number.isInteger(p[k]) ||
      p[k] < 0 ||
      !Number.isInteger(p[k + "Mes"]) ||
      p[k + "Mes"] < 0 ||
      p[k + "Mes"] > 11 ||
      !Number.isInteger(p[k + "Dia"]) ||
      p[k + "Dia"] < 0 ||
      p[k + "Dia"] > 30
    )
      throw Error("Revisa años, meses y días de " + k);
  }
  if (
    p.maxPerm > 100 ||
    (p.maxPerm === 100 && (p.maxPermMes > 0 || p.maxPermDia > 0))
  )
    throw Error("La edad máxima de permanencia es 100 años cumplidos.");
  const maxD = maxAgeDays();
  for (const k of p.allowNewEntries
    ? ["min", "maxNuevo", "maxPerm"]
    : ["min", "maxPerm"])
    if (p[k + "Dia"] > maxD)
      throw Error(
        "En la fecha de corte seleccionada los días deben estar entre 0 y " +
          maxD +
          ".",
      );
  if (
    (p.allowNewEntries &&
      (cmpAge(
        [p.maxNuevo, p.maxNuevoMes, p.maxNuevoDia],
        [p.min, p.minMes, p.minDia],
      ) < 0 ||
        cmpAge(
          [p.maxPerm, p.maxPermMes, p.maxPermDia],
          [p.maxNuevo, p.maxNuevoMes, p.maxNuevoDia],
        ) < 0)) ||
    cmpAge(
      [p.maxPerm, p.maxPermMes, p.maxPermDia],
      [p.min, p.minMes, p.minDia],
    ) < 0
  )
    throw Error(
      "Las edades deben estar ordenadas: mínima, nuevo ingreso (cuando aplica), permanencia.",
    );
  for (let [i, r] of ranges.age.entries()) {
    if (
      ["fromY", "fromM", "fromD", "toY", "toM", "toD"].some(
        (k) =>
          !Number.isInteger(r[k]) ||
          r[k] < 0 ||
          (k.endsWith("M") && r[k] > 11) ||
          (k.endsWith("D") && r[k] > maxD),
      ) ||
      !Number.isFinite(r.limit) ||
      cmpAge([r.fromY, r.fromM, r.fromD], [r.toY, r.toM, r.toD]) > 0 ||
      r.limit < 0 ||
      r.limit > p.limite
    )
      throw Error(
        "Rango especial inválido en fila " +
          (i + 1) +
          ": verifica edad, días y límite monetario general.",
      );
    if (
      cmpAge([r.fromY, r.fromM, r.fromD], [p.min, p.minMes, p.minDia]) < 0 ||
      cmpAge([r.toY, r.toM, r.toD], [p.min, p.minMes, p.minDia]) < 0
    )
      throw Error(
        "Los rangos especiales no pueden ser inferiores a la edad mínima de ingreso: " +
          p.min +
          " años, " +
          p.minMes +
          " meses, " +
          p.minDia +
          " días. Corrige el rango " +
          (i + 1),
      );
    if (
      cmpAge(
        [r.fromY, r.fromM, r.fromD],
        [p.maxPerm, p.maxPermMes, p.maxPermDia],
      ) > 0 ||
      cmpAge([r.toY, r.toM, r.toD], [p.maxPerm, p.maxPermMes, p.maxPermDia]) > 0
    )
      throw Error(
        "Los rangos especiales no pueden superar la edad máxima de permanencia: " +
          p.maxPerm +
          " años, " +
          p.maxPermMes +
          " meses, " +
          p.maxPermDia +
          " días. Corrige el rango " +
          (i + 1),
      );
    for (let j = 0; j < i; j++)
      if (
        cmpAge(
          [r.fromY, r.fromM, r.fromD],
          [ranges.age[j].toY, ranges.age[j].toM, ranges.age[j].toD],
        ) <= 0 &&
        cmpAge(
          [r.toY, r.toM, r.toD],
          [ranges.age[j].fromY, ranges.age[j].fromM, ranges.age[j].fromD],
        ) >= 0
      )
        throw Error("Los rangos especiales de edad no deben superponerse.");
  }
  for (let [i, r] of ranges.combined.entries()) {
    for (let key of ["fromY", "fromM", "fromD", "toY", "toM", "toD"])
      if (
        !Number.isInteger(r[key]) ||
        r[key] < 0 ||
        (key.endsWith("M") && r[key] > 11) ||
        (key.endsWith("D") && r[key] > maxD)
      )
        throw Error("Revisa edad exacta de requisito combinado " + (i + 1));
    if (
      cmpAge([r.fromY, r.fromM, r.fromD], [p.min, p.minMes, p.minDia]) < 0 ||
      cmpAge([r.toY, r.toM, r.toD], [p.min, p.minMes, p.minDia]) < 0
    )
      throw Error(
        "El requisito combinado no puede empezar antes de la edad mínima de ingreso. Corrige el rango " +
          (i + 1),
      );
    if (
      cmpAge([r.toY, r.toM, r.toD], [p.maxPerm, p.maxPermMes, p.maxPermDia]) >
        0 ||
      cmpAge(
        [r.fromY, r.fromM, r.fromD],
        [p.maxPerm, p.maxPermMes, p.maxPermDia],
      ) > 0
    )
      throw Error(
        "La edad de requisitos combinados no puede superar la edad máxima de permanencia. Corrige el rango " +
          (i + 1),
      );
    if (
      cmpAge([r.fromY, r.fromM, r.fromD], [r.toY, r.toM, r.toD]) > 0 ||
      !Number.isFinite(r.amountFrom) ||
      !Number.isFinite(r.amountTo) ||
      r.amountFrom < 0 ||
      r.amountTo < r.amountFrom ||
      r.amountTo > p.limite ||
      !r.obs.trim()
    )
      throw Error(
        "Revisa el requisito combinado " +
          (i + 1) +
          ": el monto no debe superar el límite general del crédito.",
      );
  }
  for (let r of ranges.guarantees)
    if (
      !Number.isFinite(r.from) ||
      !Number.isFinite(r.to) ||
      r.from > r.to ||
      r.from < 0 ||
      r.to > p.limite ||
      !r.obs.trim()
    )
      throw Error(
        "Revisa las garantías: ningún monto puede superar el límite general del crédito.",
      );
  return {
    ...p,
    age: ranges.age,
    guarantees: ranges.guarantees,
    combined: ranges.combined,
    newOnly: getNewOnlyRule(p),
  };
}
function ci(v) {
  let s = String(v ?? "")
    .trim()
    .replace(/\.0$/, "")
    .replace(/\s/g, "");
  return s;
} /* VALIDACIÓN DE CÉDULA V11: réplica del validador Excel aportado.
   El estado CORRECTO corresponde a 10 dígitos numéricos y módulo 10 coincidente.
   No se restringe la tercera posición a 0–5: la fórmula Excel de referencia
   considera correctos números cuyo tercer dígito es 6 (ej. 1761426459).
   CORRECTO no acredita existencia o vigencia administrativa del documento. */
function validCI(s) {
  if (!/^\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(s[i]) * (i % 2 ? 1 : 2);
    sum += n > 9 ? n - 9 : n;
  }
  return (10 - (sum % 10)) % 10 === Number(s[9]);
}
function dateISO(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    let d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  let t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  let m = t.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
}
function age(b, c) {
  if (!/^\d{4}-\d\d-\d\d$/.test(b)) return null;
  let [y, m, d] = b.split("-").map(Number),
    [cy, cm, cd] = c.split("-").map(Number);
  let birth = new Date(Date.UTC(y, m - 1, d));
  if (
    birth.getUTCFullYear() !== y ||
    birth.getUTCMonth() !== m - 1 ||
    birth.getUTCDate() !== d ||
    b > c
  )
    return null;
  let yy = cy - y,
    mm = cm - m,
    dd = cd - d;
  if (dd < 0) {
    mm--;
    dd += new Date(Date.UTC(cy, cm - 1, 0)).getUTCDate();
  }
  if (mm < 0) {
    yy--;
    mm += 12;
  }
  return [yy, mm, dd];
}
const zipEntries = async (file) => {
  const zip = await JSZip.loadAsync(file),
    texts = {};
  for (let [name, obj] of Object.entries(zip.files))
    if (
      /^(xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/sheet\d+\.xml))$/.test(
        name,
      )
    )
      texts[name] = await obj.async("text");
  return texts;
};
const parseXml = (s) => new DOMParser().parseFromString(s, "application/xml");
const xmlNodes = (el, name) => Array.from(el.getElementsByTagName(name));
function xlsxRows(entries) {
  let strings = [],
    shared = entries["xl/sharedStrings.xml"];
  if (shared) {
    strings = xmlNodes(parseXml(shared), "si").map((n) =>
      xmlNodes(n, "t")
        .map((t) => t.textContent)
        .join(""),
    );
  }
  let book = entries["xl/workbook.xml"];
  let rels = entries["xl/_rels/workbook.xml.rels"];
  let file = "xl/worksheets/sheet1.xml";
  if (book && rels) {
    let first = xmlNodes(parseXml(book), "sheet")[0],
      id = first?.getAttribute("r:id");
    let rel = xmlNodes(parseXml(rels), "Relationship").find(
      (x) => x.getAttribute("Id") === id,
    );
    let target = rel?.getAttribute("Target");
    if (target) {
      file = target.startsWith("/")
        ? target.slice(1)
        : "xl/" + target.replace(/^\.\.\//, "");
    }
  }
  if (!entries[file])
    file = Object.keys(entries).find((k) =>
      /^xl\/worksheets\/sheet\d+\.xml$/.test(k),
    );
  if (!file) throw Error("No se encontró una hoja de cálculo.");
  let doc = parseXml(entries[file]);
  if (xmlNodes(doc, "parsererror").length)
    throw Error("XML no válido en " + file);
  let out = [];
  for (let row of xmlNodes(doc, "sheetData")[0]?.getElementsByTagName("row") ||
    []) {
    let values = [];
    for (let c of row.getElementsByTagName("c")) {
      let ref = c.getAttribute("r") || "A1",
        col = ref.match(/[A-Z]+/)[0],
        idx = 0;
      for (let letter of col) idx = idx * 26 + letter.charCodeAt(0) - 64;
      let type = c.getAttribute("t");
      let v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      if (type === "s") v = strings[+v] ?? "";
      else if (type === "inlineStr")
        v = Array.from(c.getElementsByTagName("t"))
          .map((x) => x.textContent)
          .join("");
      else if (type === "b") v = v === "1";
      else if (v !== "" && type !== "str" && type !== "e") v = Number(v);
      values[idx - 1] = v;
    }
    out[Number(row.getAttribute("r") || out.length + 1) - 1] = values;
  }
  return out;
}
async function readExcel(file, isActual) {
  if (!file || !file.name.toLowerCase().endsWith(".xlsx"))
    throw Error("Selecciona archivos .xlsx válidos.");
  let rows = xlsxRows(await zipEntries(file)),
    hi = -1,
    ix = {};
  for (let i = 0; i < Math.min(rows.length, 35); i++) {
    let cells = (rows[i] || []).map(canon),
      id = cells.findIndex((v) => v.includes("CEDULA")),
      amount = cells.findIndex((v) => v.includes("MONTO"));
    if (id >= 0 && amount >= 0) {
      hi = i;
      ix = {
        ci: id,
        monto: amount,
        nombre: cells.findIndex((v) => v.includes("NOMBRES")),
        fecha: cells.findIndex(
          (v) => v.includes("NACIMIENTO") || v.includes("FECHA NAC"),
        ),
      };
      break;
    }
  }
  if (hi < 0)
    throw Error("No se encontraron encabezados CÉDULA y MONTO en " + file.name);
  if (isActual && ix.fecha < 0)
    throw Error("Falta FECHA DE NACIMIENTO en ACTUAL");
  let output = [];
  for (let i = hi + 1; i < rows.length; i++) {
    let row = rows[i] || [],
      v = row[ix.monto],
      id = row[ix.ci];
    if ((id === undefined || id === "") && (v === undefined || v === ""))
      continue;
    if (v == null || v === "")
      throw Error(`Monto vacío en ${file.name}, fila ${i + 1}`);
    let monto =
      typeof v === "number"
        ? v
        : Number(
            String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", "."),
          );
    if (!Number.isFinite(monto))
      throw Error(`Monto inválido en ${file.name}, fila ${i + 1}: ${v}`);
    output.push({
      ci: ci(id),
      nombre: ix.nombre >= 0 ? String(row[ix.nombre] ?? "") : "",
      fecha: ix.fecha >= 0 ? dateISO(row[ix.fecha]) : "",
      monto: Math.round(monto * 100),
      fila: i + 1,
    });
  }
  if (!output.length) throw Error(file.name + " no contiene datos");
  return output;
}
/* V19: Conversión de rangos copiados desde Excel (TSV) al esquema común de readExcel.
   No modifica la conciliación: ambas fuentes producen {ci,nombre,fecha,monto,fila}.
   Se conserva el orden original y no se agregan registros por cédula aquí. */
function readPastedExcel(text, isActual) {
  const source = isActual ? "BASE ACTUAL" : "MES ANTERIOR";
  const raw = String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .trim();
  if (!raw) throw Error("No hay datos pegados en " + source + ".");
  // Excel copia cada celda separada por TAB y cada fila separada por salto de línea.
  // Se toleran valores con comillas que contengan saltos de línea o tabulaciones.
  let grid = [],
    cells = [],
    token = "",
    inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      if (inQuotes && raw[i + 1] === '"') {
        token += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "\t" && !inQuotes) {
      cells.push(token.trim());
      token = "";
    } else if (ch === "\n" && !inQuotes) {
      cells.push(token.trim());
      grid.push(cells);
      cells = [];
      token = "";
    } else token += ch;
  }
  cells.push(token.trim());
  grid.push(cells);
  if (inQuotes)
    throw Error("Comillas sin cerrar en los datos pegados de " + source + ".");
  grid = grid.filter((row) => row.some((v) => String(v).trim() !== ""));
  if (!grid.length) throw Error("No se encontraron filas en " + source + ".");
  let first = grid[0].map(canon),
    header =
      first.some((v) => v.includes("CEDULA")) &&
      first.some((v) => v.includes("MONTO"));
  let fields = {
      ci: 0,
      nombre: 1,
      fecha: isActual ? 2 : -1,
      monto: isActual ? 3 : 2,
    },
    start = 0;
  if (header) {
    fields = {
      ci: first.findIndex((v) => v.includes("CEDULA")),
      nombre: first.findIndex((v) => v.includes("NOMBRE")),
      fecha: isActual
        ? first.findIndex(
            (v) => v.includes("NACIMIENTO") || v.includes("FECHA NAC"),
          )
        : -1,
      monto: first.findIndex((v) => v.includes("MONTO")),
    };
    if (
      fields.ci < 0 ||
      fields.monto < 0 ||
      fields.nombre < 0 ||
      (isActual && fields.fecha < 0)
    )
      throw Error("Encabezados incompletos en " + source + ".");
    start = 1;
  }
  let output = [];
  for (let i = start; i < grid.length; i++) {
    const row = grid[i],
      line = i + 1,
      id = (row[fields.ci] ?? "").trim(),
      name = (row[fields.nombre] ?? "").trim(),
      rawAmount = (row[fields.monto] ?? "").trim();
    if (!id && !name && !rawAmount) continue;
    if (!id)
      throw Error(source + ": cédula vacía en la fila pegada " + line + ".");
    if (rawAmount === "")
      throw Error(source + ": monto vacío en la fila pegada " + line + ".");
    if (isActual && !(row[fields.fecha] ?? "").trim())
      throw Error(
        source + ": falta fecha de nacimiento en la fila pegada " + line + ".",
      );
    const amount = parsePastedUsd(rawAmount);
    if (!Number.isFinite(amount))
      throw Error(
        source +
          ": monto inválido en la fila pegada " +
          line +
          ": " +
          rawAmount,
      );
    output.push({
      ci: ci(id),
      nombre: name,
      fecha: isActual ? dateISO(row[fields.fecha]) : "",
      monto: Math.round(amount * 100),
      fila: line,
    });
  }
  if (!output.length) throw Error(source + " no contiene registros.");
  return output;
}
/* V25: aceptar importes pegados de Excel con separadores mixtos.
   Solo se usa en pegado; NO modifica cálculos, parámetros ni lectura de archivos XLSX.
   Casos: $11.756.28, $11,756.28, USD 11.756,28, 11756.28. */
function parsePastedUsd(value) {
  const raw = String(value ?? "")
    .replace(/USD|\$|\s/g, "")
    .trim();
  if (!/^\d[\d.,]*$/.test(raw)) return NaN;
  const marks = [...raw.matchAll(/[.,]/g)].map((m) => m.index);
  if (!marks.length) return Number(raw);
  const last = marks[marks.length - 1],
    digitsAfter = raw.length - last - 1;
  const before = raw.slice(0, last),
    after = raw.slice(last + 1);
  // Si hay un separador y tres cifras finales, corresponde a miles.
  if (marks.length === 1 && digitsAfter === 3 && before.length <= 3)
    return Number(before + after);
  // Los importes copiados de Excel usan centavos (1 o 2 cifras finales).
  if (digitsAfter >= 1 && digitsAfter <= 2)
    return Number(before.replace(/[.,]/g, "") + "." + after);
  // Separadores de miles repetidos sin decimales.
  if (digitsAfter === 3 && /^\d{1,3}(?:[.,]\d{3})+$/.test(raw))
    return Number(raw.replace(/[.,]/g, ""));
  return NaN;
}
/* V22: resumen de observaciones exclusivamente para pantalla y exportación.
   La evaluación, prioridades, totales y condiciones siguen sin cambios.
   El detalle original se conserva por separado para filtros de múltiples causas. */
function observacionBreve(decision, obs, errors, req) {
  if (decision === "APTO PARA CARGA") return "OK SIN NOVEDADES";
  if (decision === "SUPERA LA EDAD MÁXIMA DE INGRESO")
    return "SUPERA LA EDAD MÁXIMA DE INGRESO";
  if (decision === "NO PERMITE INGRESOS NUEVOS")
    return "NO PERMITE INGRESOS NUEVOS";
  if (decision === "SUPERA EL LÍMITE DE CRÉDITO") {
    const etiquetas = obs
      .filter((x) => x.startsWith("APLICA LÍMITE ESPECIAL POR EDAD - "))
      .map((x) => x.slice("APLICA LÍMITE ESPECIAL POR EDAD - ".length).trim())
      .filter(Boolean);
    return etiquetas.length
      ? [...new Set(etiquetas)].join(" | ")
      : "SUPERA EL LÍMITE DE CRÉDITO";
  }
  if (decision === "OTRAS VALIDACIONES / REVISAR")
    return [...new Set(errors)].join(" | ") || "REVISAR DATOS";
  if (decision === "PENDIENTE DE REQUISITOS")
    return (
      [...new Set(req.filter(Boolean))].join(" | ") || "PENDIENTE DE REQUISITOS"
    );
  return (
    [...new Set([...errors, ...req].filter(Boolean))].join(" | ") ||
    "OK SIN NOVEDADES"
  );
}
/* V28: presentación informativa de requisitos superados. NO altera el motor ni la decisión.
   Si el total ya supera el extremo superior de una franja documental, conserva el
   requisito iniciado al alcanzar su umbral mínimo. En permanencias no vuelve a
   solicitar documentos cuyo umbral ya se alcanzó en el período anterior. */
function requisitosParaMostrar(p, global, old, isNew, variation, ageParts) {
  if (!isNew && variation !== "AUMENTO") return [];
  const out = [];
  for (const r of p.guarantees) {
    const lo = Math.round(r.from * 100),
      hi = Math.round(r.to * 100);
    if (global > hi && global >= lo && (isNew || old < lo) && r.obs.trim())
      out.push(r.obs.trim());
  }
  if (ageParts)
    for (const r of p.combined) {
      const lo = Math.round(r.amountFrom * 100),
        hi = Math.round(r.amountTo * 100);
      if (
        global > hi &&
        global >= lo &&
        (isNew || old < lo) &&
        cmpAge(ageParts, [r.fromY, r.fromM, r.fromD]) >= 0 &&
        cmpAge(ageParts, [r.toY, r.toM, r.toD]) <= 0 &&
        r.obs.trim()
      )
        out.push(r.obs.trim());
    }
  return [...new Set(out)];
}
/* V28: observaciones visibles, prioridad de límite primero y luego requisitos.
   No modifica los errores, requisitos originales ni la decisión de carga. */
function observacionExportable(r) {
  if (r.decision !== "SUPERA EL LÍMITE DE CRÉDITO") return r.obs;
  const tags = [r.obs, ...(r.requisitosSoloReporte || [])].filter(Boolean);
  return [...new Set(tags)].join(" | ");
}
