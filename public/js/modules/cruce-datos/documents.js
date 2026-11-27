/* Conciliador de Créditos V36: Documentos PDF, anexos y respaldo portátil.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* ===== V32: CONSULTA DOCUMENTAL AISLADA (NO ALTERA CÁLCULOS) ===== */
const DOC_STORE_V32 = "conciliador_documentos_polizas_v32";
let policyDocumentsV32 = {};

/* ===== V33 | PDF ORIGINAL POR PÓLIZA: IndexedDB + respaldo JSON ===== */
const PDF_DB_V33 = "conciliador_pdf_original_v33",
  PDF_TABLE_V33 = "pdfPorPoliza";
let pdfSessionV33 = new Map(),
  pdfViewerUrlV33 = null,
  pdfPreviewSeqV33 = 0;
function pdfDecodeB64V33(data) {
  const bin = atob(data),
    out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new Blob([out], { type: "application/pdf" });
}
function pdfToB64V33(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error || Error("Error al leer PDF"));
    r.readAsDataURL(blob);
  });
}
function pdfOpenDbV33() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(Error("IndexedDB no disponible"));
      return;
    }
    const r = indexedDB.open(PDF_DB_V33, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(PDF_TABLE_V33))
        r.result.createObjectStore(PDF_TABLE_V33);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function pdfSaveV33(number, blob) {
  pdfSessionV33.set(number, blob);
  const db = await pdfOpenDbV33();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_TABLE_V33, "readwrite");
      tx.objectStore(PDF_TABLE_V33).put(blob, number);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
async function pdfGetV33(number) {
  if (pdfSessionV33.has(number)) return pdfSessionV33.get(number);
  try {
    const db = await pdfOpenDbV33();
    const stored = await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_TABLE_V33, "readonly");
      const r = tx.objectStore(PDF_TABLE_V33).get(number);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
    db.close();
    if (stored) {
      pdfSessionV33.set(number, stored);
      return stored;
    }
  } catch (e) {
    /* Fallback to supplied reference document below */
  }
  return null;
}
async function pdfRefreshViewerV33() {
  const seq = ++pdfPreviewSeqV33,
    n = $("fichaPolicySelect").value;
  if (pdfViewerUrlV33) {
    URL.revokeObjectURL(pdfViewerUrlV33);
    pdfViewerUrlV33 = null;
  }
  $("fichaPdfFrame").removeAttribute("src");
  $("fichaPdfFrameWrap").hidden = true;
  $("fichaOriginalName").textContent = "";
  $("fichaOriginalStatus").hidden = false;
  if (!n) {
    $("fichaOriginalStatus").textContent =
      "Selecciona una póliza para ver su documento original.";
    return;
  }
  $("fichaOriginalStatus").textContent = "Cargando PDF original de " + n + "…";
  const blob = await pdfGetV33(n);
  if (seq !== pdfPreviewSeqV33) return;
  if (!blob) {
    $("fichaOriginalStatus").textContent =
      "Esta póliza todavía no tiene un PDF original almacenado. Asocia su documento con el selector superior y vuelve a esta vista.";
    return;
  }
  pdfViewerUrlV33 = URL.createObjectURL(blob);
  $("fichaOriginalName").textContent =
    policyDocumentsV32[n]?.source || "Documento asociado";
  $("fichaPdfFrame").src =
    pdfViewerUrlV33 + "#toolbar=0&navpanes=0&scrollbar=1";
  $("fichaPdfFrameWrap").hidden = false;
  $("fichaOriginalStatus").hidden = true;
}
function pdfSwitchTabV33(type) {
  const showPdf = type === "original";
  $("fichaOriginalPane").hidden = !showPdf;
  $("fichaSummaryPane").hidden = showPdf;
  $("fichaOriginalTab").classList.toggle("ficha-tab-selected", showPdf);
  $("fichaSummaryTab").classList.toggle("ficha-tab-selected", !showPdf);
  if (showPdf) pdfRefreshViewerV33();
}
$("fichaSummaryTab").onclick = () => pdfSwitchTabV33("summary");
$("fichaOriginalTab").onclick = () => pdfSwitchTabV33("original");
async function pdfExportDocsV33() {
  const items = {};
  const names = new Set([
    ...Object.keys(policyDocumentsV32),
    ...Object.keys(policyCatalog),
  ]);
  for (const name of names) {
    let blob = await pdfGetV33(name);
    if (blob) {
      items[name] = {
        name: policyDocumentsV32[name]?.source || name + ".pdf",
        mime: "application/pdf",
        base64: await pdfToB64V33(blob),
      };
    }
  }
  return items;
}
async function pdfImportDocsV33(documents) {
  let restored = 0,
    errors = [];
  for (const [n, record] of Object.entries(documents || {})) {
    if (
      !policyValidNumber(n) ||
      typeof record?.base64 !== "string" ||
      !record.base64
    )
      continue;
    try {
      const blob = pdfDecodeB64V33(record.base64);
      if (blob.size > 12 * 1024 * 1024) throw Error("supera 12 MB");
      await pdfSaveV33(n, blob);
      restored++;
    } catch (e) {
      errors.push(n + ": " + e.message);
    }
  }
  return { restored, errors };
}

function docStorageReadV32() {
  try {
    const x = JSON.parse(localStorage.getItem(DOC_STORE_V32) || "{}");
    policyDocumentsV32 =
      x && typeof x === "object" && !Array.isArray(x) ? x : {};
  } catch (e) {
    policyDocumentsV32 = {};
  }
}
function docStorageWriteV32() {
  try {
    localStorage.setItem(DOC_STORE_V32, JSON.stringify(policyDocumentsV32));
    return true;
  } catch (e) {
    return false;
  }
}
const docNormalizeV32 = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
function docDecodePdfLiteralV32(s) {
  return s.replace(/\\([0-7]{1,3}|[nrtbf()\\]|\r\n|\n|\r)/g, (_, c) => {
    if (/^[0-7]/.test(c)) return String.fromCharCode(parseInt(c, 8));
    return (
      {
        n: "\n",
        r: "\r",
        t: "\t",
        b: "\b",
        f: "\f",
        "(": "(",
        ")": ")",
        "\\": "\\",
        "\r\n": "",
        "\n": "",
        "\r": "",
      }[c] ?? c
    );
  });
}
async function docExtractPdfTextV32(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length > 12 * 1024 * 1024)
    throw Error("PDF demasiado grande (máximo 12 MB).");
  const raw = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  if (!raw.startsWith("%PDF-")) throw Error("El archivo no es un PDF válido.");
  const parts = [];
  let at = 0,
    count = 0;
  while ((at = raw.indexOf("stream", at)) >= 0) {
    const after = at + 6;
    if (raw[after] !== "\n" && raw[after] !== "\r") {
      at = after;
      continue;
    }
    const begin =
      after + (raw[after] === "\r" && raw[after + 1] === "\n" ? 2 : 1);
    const end = raw.indexOf("endstream", begin);
    if (end < 0) break;
    const pre = raw.slice(Math.max(0, at - 1200), at),
      dict = pre.slice(pre.lastIndexOf("<<"));
    at = end + 9;
    if (/\/Subtype\s*\/Image|\/FontFile|\/Type\s*\/ObjStm/.test(dict)) continue;
    if (
      !/\/FlateDecode/.test(dict) &&
      !/BT[\s\S]*?ET/.test(raw.slice(begin, Math.min(end, begin + 1000)))
    )
      continue;
    if (++count > 300) break;
    const expectedLength = Number(
      (dict.match(/\/Length\s*(\d+)/) || [])[1] || 0,
    );
    let stream = bytes.slice(
      begin,
      expectedLength > 0 && expectedLength <= end - begin
        ? begin + expectedLength
        : end,
    );
    // Algunos generadores PDF dejan un salto de línea antes de endstream.
    if (!expectedLength) {
      while (stream.length && [10, 13, 32].includes(stream[stream.length - 1]))
        stream = stream.slice(0, -1);
    }
    try {
      if (/\/FlateDecode/.test(dict)) {
        if (typeof DecompressionStream === "undefined")
          throw Error("Este navegador no puede descomprimir PDF.");
        const output = new Response(
          new Blob([stream])
            .stream()
            .pipeThrough(new DecompressionStream("deflate")),
        );
        stream = new Uint8Array(await output.arrayBuffer());
      }
      let content = Array.from(stream, (b) => String.fromCharCode(b)).join("");
      const blocks = content.match(/BT[\s\S]*?ET/g) || [];
      for (const block of blocks) {
        const tokens = [];
        const reg =
          /\(((?:\\.|[^\\)])*)\)\s*Tj|\[((?:[^\]]|\]\s*\w)*?)\]\s*TJ/g;
        let m;
        while ((m = reg.exec(block))) {
          if (m[1] !== undefined) tokens.push(docDecodePdfLiteralV32(m[1]));
          else
            tokens.push(
              [...m[2].matchAll(/\(((?:\\.|[^\\)])*)\)/g)]
                .map((z) => docDecodePdfLiteralV32(z[1]))
                .join(""),
            );
        }
        if (tokens.length) parts.push(tokens.join(" "));
      }
    } catch (e) {
      /* Other PDF streams or unsupported filters are ignored. */
    }
  }
  const text = parts.join("\n");
  if (text.trim().length < 120)
    throw Error(
      "No se encontró suficiente texto extraíble. El PDF podría ser escaneado o utilizar una codificación no compatible. No se inventarán condiciones.",
    );
  return text;
}
function docFindLinesV32(lines, regex) {
  return lines.find((x) => regex.test(docNormalizeV32(x))) || "";
}
function docExtractSectionV32(lines, start, endRegex) {
  const ix = lines.findIndex((x) => start.test(docNormalizeV32(x)));
  if (ix < 0) return "";
  const collected = [];
  for (let j = ix + 1; j < Math.min(lines.length, ix + 28); j++) {
    const l = lines[j].trim();
    if (endRegex.test(docNormalizeV32(l))) break;
    if (
      l &&
      !/^(CREACION|IMPRESION|CODIGO DE|CONDICIONES PARTICULARES|PAG\.|ASEGURADO\s*:|RAMO\s*:|POLIZA\s*:)/i.test(
        docNormalizeV32(l),
      )
    )
      collected.push(l);
  }
  return collected.join(" ").replace(/\s+/g, " ").trim();
}
function docReadValuesV32(text, filename) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const readAge = (regex) => {
    const x = docFindLinesV32(lines, regex);
    return x.match(/(\d{1,3})\s*a[nñ]os/i)?.[0] || "";
  };
  const limitLine = docFindLinesV32(lines, /LIMITE MAXIMO DE CREDITO/);
  const limit = limitLine.match(/\$\s*([\d.,]+)/)?.[1] || "";
  const rateLines = lines
    .filter((x) =>
      /Tasa Neta Mensual|Codeudor-Conyuge.*por mil/i.test(docNormalizeV32(x)),
    )
    .join(" ");
  const rate =
    (rateLines.match(/(\d+(?:[.,]\d+)?)\s*(?:por\s*mil|‰)/i) || [])[1] || "";
  const bands = lines
    .filter(
      (x) =>
        /^\d{1,3}\s*a[nñ]os?\b.*(?:\d+\s*%)/i.test(x) ||
        /^\d{1,3}\s*a[nñ]os?\s*\d+\s*d[ií]a\b.*\d+\s*%/i.test(x),
    )
    .slice(0, 12);
  const reqLine = lines.findIndex((x) =>
    /De\s*\$\s*0\s*a\s*\$\s*25[,\.]?000/i.test(x),
  );
  const requirements = [];
  if (reqLine >= 0) {
    requirements.push(lines[reqLine]);
    const fragments = [];
    for (let j = reqLine + 1; j < Math.min(reqLine + 9, lines.length); j++) {
      if (
        /Todos los socios|DESGRAVAMEN|EXCLUSIONES|En caso que/i.test(lines[j])
      )
        break;
      fragments.push(lines[j]);
    }
    if (fragments.length)
      requirements.push(fragments.join(" ").replace(/\s+/g, " ").trim());
  }
  const socioIndex = lines.findIndex((x) =>
    /Todos los socios mayores a/i.test(docNormalizeV32(x)),
  );
  if (socioIndex >= 0) {
    const fragments = [];
    for (let j = socioIndex; j < Math.min(socioIndex + 7, lines.length); j++) {
      if (j > socioIndex && /En caso que|DESGRAVAMEN/i.test(lines[j])) break;
      fragments.push(lines[j]);
    }
    requirements.push(
      fragments
        .join(" ")
        .split(/En caso que/i)[0]
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  if (socioIndex >= 0) {
    requirements[requirements.length - 1] = requirements[
      requirements.length - 1
    ]
      .split(/En caso que/i)[0]
      .trim();
  }
  const continuity = docExtractSectionV32(
    lines,
    /^CONTINUIDAD DE COBERTURA\s*:/,
    /^(NOVACION DE CREDITO|ERRORES U OMISIONES|CANCELACION DE POLIZA|PAGO POR|CREACION)/,
  );
  let billing = "";
  const bix = lines.findIndex((x) => /^FACTURACION$/i.test(docNormalizeV32(x)));
  if (bix >= 0) {
    const intro = lines
      .slice(bix + 1, bix + 4)
      .filter((x) => !/^IMPRESION|^CREACION/i.test(docNormalizeV32(x)))
      .join(" ")
      .split(/\d{2}\/\d{2}\/\d{4}/)[0]
      .trim();
    const items = lines
      .slice(bix + 1, bix + 65)
      .filter((x) =>
        /^[-•]\s*(Nombres|N[uú]mero|Fecha|Nro|Principio|Monto|Saldo)/i.test(x),
      );
    billing = [intro, ...items]
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const formatLimit = limit
    ? "USD " +
      (parseFloat(limit.replace(/,/g, "")) || 0).toLocaleString("es-EC", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "";
  return {
    source: filename,
    readAt: new Date().toISOString(),
    credit: formatLimit,
    rate: rate ? rate.replace(".", ",") + " por mil" : "",
    minAge: readAge(/Edad Minima de ingreso/i),
    maxAge: readAge(/Edad Maxima de ingreso/i),
    stayAge: readAge(/Edad Maxima de permanencia/i),
    bands,
    requirements,
    continuity,
    billing,
    confidence:
      "Extracción automática local: revisa los campos con el PDF original.",
  };
}
function docDisplayValueV32(x) {
  return x && String(x).trim() ? String(x) : "No identificado en el PDF";
}
function docListV32(items) {
  if (!items?.length)
    return '<div class="ficha-empty">No identificado en el PDF.</div>';
  return (
    '<ul class="ficha-list">' +
    items.map((x) => "<li>" + esc(x) + "</li>").join("") +
    "</ul>"
  );
}
function docPanelV32(p) {
  let html =
    '<div class="ficha-banner"><strong>CONDICIONES DEL DOCUMENTO</strong><div class="ficha-note">Archivo: ' +
    esc(p.source || "") +
    " · " +
    esc(p.confidence || "") +
    "</div></div>";
  html +=
    '<div class="ficha-grid">' +
    fichaCell("LÍMITE MÁXIMO DE CRÉDITO", docDisplayValueV32(p.credit)) +
    fichaCell("TASA NETA MENSUAL", docDisplayValueV32(p.rate)) +
    fichaCell("EDAD MÍNIMA DE INGRESO", docDisplayValueV32(p.minAge)) +
    fichaCell("EDAD MÁXIMA DE INGRESO", docDisplayValueV32(p.maxAge)) +
    fichaCell("EDAD MÁXIMA DE PERMANENCIA", docDisplayValueV32(p.stayAge)) +
    "</div>";
  html +=
    '<div class="ficha-subheading">LÍMITES DE COBERTURA SEGÚN EDAD</div>' +
    docListV32(p.bands);
  html +=
    '<div class="ficha-subheading">REQUISITOS DE ASEGURABILIDAD — TITULAR Y CÓNYUGE</div>' +
    docListV32(p.requirements);
  html +=
    '<div class="ficha-subheading">CONTINUIDAD DE COBERTURA</div><p class="ficha-note">' +
    esc(docDisplayValueV32(p.continuity)) +
    "</p>";
  html +=
    '<div class="ficha-subheading">FACTURACIÓN</div><p class="ficha-note">' +
    esc(docDisplayValueV32(p.billing)) +
    "</p>";
  return html;
}
function docSelectedPolicyV32() {
  return $("fichaPolicySelect").value;
}
async function docUploadV32(file) {
  if (!file) return;
  const number = docSelectedPolicyV32();
  if (!number) {
    $("fichaUploadMessage").textContent =
      "Selecciona una póliza antes de adjuntar el PDF.";
    return;
  }
  if (!policyCatalog[number]) {
    $("fichaUploadMessage").textContent =
      "La póliza debe estar guardada en el catálogo antes de asociarle un documento.";
    return;
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    $("fichaUploadMessage").textContent = "Selecciona un archivo PDF válido.";
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    $("fichaUploadMessage").textContent =
      "El PDF supera el límite de 12 MB para su respaldo portátil.";
    return;
  }
  $("fichaUploadMessage").textContent = "Guardando PDF de " + number + "…";
  try {
    const existing = await pdfGetV33(number);
    if (
      existing &&
      !confirm(
        "La póliza " +
          number +
          " ya tiene un PDF asociado. ¿Deseas reemplazarlo?",
      )
    )
      return;
    let persisted = true;
    try {
      await pdfSaveV33(number, file);
    } catch (e) {
      pdfSessionV33.set(number, file);
      persisted = false;
    }
    policyDocumentsV32[number] = {
      ...(policyDocumentsV32[number] || {}),
      source: file.name,
    };
    docStorageWriteV32();
    $("fichaUploadMessage").textContent = persisted
      ? "PDF vinculado a " +
        number +
        ". Para visualizarlo, utiliza el botón en 1. Parámetros."
      : "PDF vinculado solo durante esta sesión. El navegador no permitió guardarlo permanentemente. Descarga el catálogo portátil como respaldo.";
    pdfUpdateParamV34();
  } catch (e) {
    $("fichaUploadMessage").textContent =
      "No se pudo vincular el PDF: " + e.message;
  } finally {
    $("fichaPdfUpload").value = "";
  }
}
/* V35: la carga ahora utiliza docUploadV35, compatible con tres anexos. */
docStorageReadV32();

/* ===== V32: PESTAÑA DE CONSULTA SIN EDICIÓN ===== */
function fichaCell(label, value) {
  return `<div class="ficha-value"><span>${esc(label)}</span><strong>${esc(String(value))}</strong></div>`;
}
function fichaRefreshList() {
  const sel = $("fichaPolicySelect"),
    q = canon(($("fichaSearch").value || "").trim()),
    prior = sel.value;
  const entries = Object.values(policyCatalog).filter((p) =>
    canon([p.number, p.description, p.issuer].join(" ")).includes(q),
  );
  entries.sort((a, b) => a.number.localeCompare(b.number, "es"));
  sel.innerHTML =
    '<option value="">Selecciona una póliza</option>' +
    entries
      .map(
        (p) =>
          `<option value="${esc(p.number)}">${esc(p.number)} — ${esc(p.description)} · ${esc(p.issuer || "Sin asignar")}</option>`,
      )
      .join("");
  if (entries.some((p) => p.number === prior)) sel.value = prior;
  else if (q && entries.length === 1) sel.value = entries[0].number;
  fichaRender();
}
function fichaRender() {
  // V34: no se construyen resúmenes contractuales ni vistas internas.
  // La ficha de la V32 se conserva solo como metadato de compatibilidad con respaldos previos.
  const body = $("fichaBody");
  if (body) body.textContent = "";
}
$("fichaSearch").addEventListener("input", fichaRefreshList);
$("fichaPolicySelect").addEventListener("change", () => {
  $("fichaUploadMessage").textContent = "";
  fichaRender();
});
document.querySelector('[data-tab="ficha"]').addEventListener("click", () => {
  fichaRefreshList();
  const sel = $("fichaPolicySelect");
  if (
    !sel.value &&
    activePolicy &&
    [...sel.options].some((o) => o.value === activePolicy)
  ) {
    sel.value = activePolicy;
    fichaRender();
  }
});

/* ===== V34: ABRIR PDF ORIGINAL EN PESTAÑA DEL NAVEGADOR, SIN ALTERAR CÁLCULOS ===== */
let pdfOpenedUrlsV34 = [];
function pdfSelectedParamV34() {
  const sel = $("policyList")?.value || "";
  return sel && policyCatalog[sel] ? sel : "";
}
function pdfUpdateParamV34() {
  const number = pdfSelectedParamV34();
  $("policyOpenPdfV34").hidden = true;
  $("policyOpenPdfStatusV34").textContent = number
    ? "Documentos asociados a " + number + ":"
    : "Selecciona una póliza para consultar sus documentos.";
  pdfRenderParamListV35(number);
}
$("policyOpenPdfV34").addEventListener("click", async () => {
  const number = pdfSelectedParamV34();
  if (!number) {
    alert("Selecciona una póliza guardada.");
    return;
  }
  // Abrir una ventana en el gesto de clic, antes de la lectura asíncrona (evita bloqueo de popups).
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    alert(
      "El navegador bloqueó la nueva pestaña. Autoriza ventanas emergentes para este archivo y vuelve a intentarlo.",
    );
    return;
  }
  try {
    tab.document.title = "PDF de póliza " + number;
    tab.document.body.textContent =
      "Abriendo documento de póliza " + number + "…";
    const blob = await pdfGetV33(number);
    if (!blob) {
      tab.document.body.textContent =
        "La póliza " +
        number +
        " no tiene un PDF vinculado. Ve a 7. Cargar PDF para asociarlo.";
      return;
    }
    const url = URL.createObjectURL(blob);
    pdfOpenedUrlsV34.push(url);
    tab.location.replace(url + "#toolbar=0&navpanes=0");
  } catch (e) {
    try {
      tab.document.body.textContent = "No se pudo abrir el PDF: " + e.message;
    } catch (_) {}
  }
});
$("policyList").addEventListener("change", pdfUpdateParamV34);
$("issuerSelect").addEventListener("change", pdfUpdateParamV34);
$("policyNew").addEventListener("click", pdfUpdateParamV34);
document
  .querySelector('[data-tab="parametros"]')
  .addEventListener("click", pdfUpdateParamV34);
pdfUpdateParamV34();

/* ===== V35 DOCUMENTOS: identidad PDF, anexos múltiples y respaldos portátiles ===== */
const PDF_META_KEY_V35 = "conciliador_pdf_anexos_v35";
let pdfMetaV35 = {};
try {
  const v = JSON.parse(localStorage.getItem(PDF_META_KEY_V35) || "{}");
  if (v && typeof v === "object" && !Array.isArray(v)) pdfMetaV35 = v;
} catch (_) {}
function pdfPersistMetaV35() {
  try {
    localStorage.setItem(PDF_META_KEY_V35, JSON.stringify(pdfMetaV35));
    return true;
  } catch (_) {
    return false;
  }
}
function pdfKeyV35(policy, annex) {
  return "V35:" + policy + ":" + annex;
}
function pdfFormatIdV35(n, annex) {
  const code = String(n || "").split("-")[0] || "24",
    serial = String(n || "")
      .split("-")
      .at(-1)
      .replace(/\D/g, "")
      .padStart(7, "0");
  return (
    code +
    "_" +
    serial +
    "_" +
    String(annex).padStart(6, "0") +
    (String(annex) === "000000" ? "" : "_ACLARATORIO")
  );
}
function pdfExistingV35(n) {
  return (pdfMetaV35[n] || [])
    .slice()
    .sort((a, b) => a.annex.localeCompare(b.annex));
}
async function pdfGetStoredV35(n, annex) {
  let b = await pdfGetDbRawV35(pdfKeyV35(n, annex));
  return b;
}
async function pdfGetDbRawV35(key) {
  if (pdfSessionV33.has(key)) return pdfSessionV33.get(key);
  try {
    const db = await pdfOpenDbV33();
    const value = await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_TABLE_V33, "readonly");
      const req = tx.objectStore(PDF_TABLE_V33).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (value) pdfSessionV33.set(key, value);
    return value;
  } catch (_) {
    return null;
  }
}
async function pdfSaveRawV35(key, blob) {
  pdfSessionV33.set(key, blob);
  const db = await pdfOpenDbV33();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(PDF_TABLE_V33, "readwrite");
      tx.objectStore(PDF_TABLE_V33).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
// Recuperación sin pérdida de un único PDF almacenado previamente en V33/V34.
async function pdfMigrateLegacyV35(n) {
  if (pdfExistingV35(n).length) return;
  let legacy = null;
  try {
    legacy = await pdfGetV33(n);
  } catch (_) {}
  if (!legacy) return;
  let annex = "000000";
  try {
    const text = await docExtractPdfTextV32(legacy);
    const id = pdfReadIdentityV35(text);
    if (id && id.policy === n) annex = id.annex;
  } catch (_) {}
  const key = pdfKeyV35(n, annex);
  let stored = true;
  try {
    await pdfSaveRawV35(key, legacy);
  } catch (_) {
    pdfSessionV33.set(key, legacy);
    stored = false;
  }
  pdfMetaV35[n] = [
    {
      annex,
      display: pdfFormatIdV35(n, annex),
      source: policyDocumentsV32[n]?.source || "PDF anterior",
      stored,
    },
  ];
  pdfPersistMetaV35();
}
function pdfReadIdentityV35(text) {
  // V36: los PDF de Sweaden no siempre mantienen el orden de lectura visual.
  // La carátula puede separar POLIZA No. y ANEXO No. de sus valores;
  // en las condiciones particulares puede aparecer ENDOSO antes que POLIZA.
  const raw = String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const normalized = raw.replace(/\s+/g, " ");
  const result = (serial, annex) => {
    if (!/^\d{4,9}$/.test(serial || "") || !/^\d{1,8}$/.test(annex || ""))
      return null;
    const value = String(Number(serial));
    if (value === "0" || Number(annex) > 999999) return null;
    return { policy: "24-" + value, annex: annex.padStart(6, "0") };
  };
  // Número de pago compuesto: ramo (2), póliza (7) y anexo (6).
  const packed = normalized.match(
    /NUMERO\s+DE\s+POLIZA\s+PARA\s+EL\s+PAGO\s*:?\s*(\d{15})\b/,
  );
  if (packed) {
    const d = packed[1];
    return {
      policy: d.slice(0, 2) + "-" + String(Number(d.slice(2, 9))),
      annex: d.slice(9, 15),
    };
  }
  // Orden textual normal: PÓLIZA: 0002369 ENDOSO: 000002.
  for (const re of [
    /\bPOLIZA\s*[:.#ºNRO ]*\s*(\d{4,9})\s*(?:ENDOSO|ANEXO)\s*[:.#ºNRO ]*\s*(\d{1,8})\b/,
    /\bPOLIZA\s+NO\.?\s*(\d{4,9})\s*ANEXO\s+NO\.?\s*(\d{1,8})\b/,
  ]) {
    const m = normalized.match(re);
    if (m) return result(m[1], m[2]);
  }
  // Orden invertido de los PDF de endosos: ENDOSO : 000002 / RAMO / POLIZA : 0002369.
  // No asumir que el número de referencia o el número de pago es el anexo.
  const reverse = raw.match(
    /\bENDOSO\s*:\s*(\d{6})[\s\S]{0,115}?\bPOLIZA\s*:\s*(\d{6,7})\b/,
  );
  if (reverse) return result(reverse[2], reverse[1]);
  // En algunas carátulas los valores están desplazados respecto a los encabezados.
  // Buscar ambos rótulos, y limitarse al bloque previo a VIGENCIA DEL DOCUMENTO.
  const cover = raw.slice(0, Math.min(raw.length, 2200));
  const labelPolicy = cover.indexOf("POLIZA NO.");
  const labelAnnex = cover.indexOf("ANEXO NO.");
  if (labelPolicy >= 0 && labelAnnex > labelPolicy) {
    const p = (
      cover.slice(labelPolicy, labelAnnex).match(/\b0{0,3}\d{4,7}\b/g) || []
    ).at(-1);
    const ending = cover.indexOf("VIGENCIA DEL DOCUMENTO", labelAnnex);
    const chunk = cover.slice(
      labelAnnex,
      ending > labelAnnex ? ending : labelAnnex + 110,
    );
    const candidates = chunk.match(/\b\d{6}\b/g) || [];
    // Solo anexos de seis dígitos; fechas como 01/05/2025 no coinciden.
    const ann = candidates[0];
    if (p && ann) return result(p, ann);
  }
  return null;
}
async function pdfFindDuplicateV35(policy, annex) {
  for (const [n, docs] of Object.entries(pdfMetaV35)) {
    if ((docs || []).some((d) => d.annex === annex && n === policy)) return n;
  }
  // También comprobar el PDF heredado que aún no haya sido migrado.
  const old = await pdfGetDbRawV35(policy);
  if (old && !pdfExistingV35(policy).length) return policy;
  return null;
}
function pdfRenderExistingV35() {
  const el = $("fichaExistingV35");
  if (!el) return;
  const n = $("fichaPolicySelect").value;
  const docs = pdfExistingV35(n);
  el.innerHTML =
    docs.map((d) => "<span>📄 " + esc(d.display) + "</span>").join("") ||
    "<span>Sin documentos asociados</span>";
}
let pdfRenderSeqV35 = 0;
async function pdfRenderParamListV35(n) {
  const el = $("policyPdfListV35");
  if (!el) return;
  const seq = ++pdfRenderSeqV35;
  if (!n) {
    el.innerHTML = '<p class="policy-pdf-empty-v35">Selecciona una póliza.</p>';
    return;
  }
  await pdfMigrateLegacyV35(n);
  if (seq !== pdfRenderSeqV35) return;
  const docs = pdfExistingV35(n);
  el.innerHTML = docs.length
    ? docs
        .map(
          (d) =>
            '<div class="policy-pdf-item-v35"><button type="button" data-policy="' +
            esc(n) +
            '" data-annex="' +
            esc(d.annex) +
            '"><span>📄 ' +
            esc(d.display) +
            "</span><span>↗</span></button><small>Visualizar documento PDF en otra pestaña</small></div>",
        )
        .join("")
    : '<p class="policy-pdf-empty-v35">Esta póliza no tiene archivos PDF vinculados. Agrégalos en 7. Cargar PDF.</p>';
}
$("policyPdfListV35").addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-annex]");
  if (!btn) return;
  const n = btn.dataset.policy,
    annex = btn.dataset.annex;
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    alert("El navegador bloqueó la apertura de la pestaña.");
    return;
  }
  try {
    tab.document.title = pdfFormatIdV35(n, annex);
    tab.document.body.textContent =
      "Abriendo " + pdfFormatIdV35(n, annex) + "…";
    const blob = await pdfGetStoredV35(n, annex);
    if (!blob) {
      tab.document.body.textContent =
        "El archivo PDF no está disponible en este equipo. Recupera el catálogo portátil más reciente.";
      return;
    }
    const url = URL.createObjectURL(blob);
    pdfOpenedUrlsV34.push(url);
    tab.location.replace(url + "#toolbar=0&navpanes=0");
  } catch (err) {
    try {
      tab.document.body.textContent = "Error: " + err.message;
    } catch (_) {}
  }
});
async function docUploadV35(file) {
  if (!file) return;
  const msg = $("fichaUploadMessage"),
    number = $("fichaPolicySelect").value;
  try {
    if (!number || !policyCatalog[number])
      throw Error(
        "Selecciona una póliza guardada antes de subir el documento.",
      );
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))
      throw Error("Selecciona un archivo PDF.");
    if (file.size > 12 * 1024 * 1024)
      throw Error("El archivo supera el límite de 12 MB.");
    msg.textContent = "Leyendo la póliza y el anexo desde el PDF…";
    let id;
    try {
      id = pdfReadIdentityV35(await docExtractPdfTextV32(file));
    } catch (err) {
      throw Error(
        "No se pudo leer el número de póliza y anexo desde el contenido del PDF. " +
          err.message,
      );
    }
    if (!id)
      throw Error(
        "No se identificaron claramente POLIZA y ENDOSO/ANEXO dentro del documento. No se utilizará el nombre del archivo para asignarlo.",
      );
    if (id.policy !== number)
      throw Error(
        "El PDF corresponde a la póliza " +
          id.policy +
          " (anexo " +
          id.annex +
          "), pero seleccionaste " +
          number +
          ". Selecciona la póliza correcta.",
      );
    await pdfMigrateLegacyV35(number);
    const found = await pdfFindDuplicateV35(number, id.annex);
    if (found)
      throw Error(
        "DOCUMENTO DUPLICADO: " +
          pdfFormatIdV35(number, id.annex) +
          " ya existe en la póliza " +
          found +
          ". No se guardó una copia adicional.",
      );
    if (pdfExistingV35(number).length >= 3)
      throw Error(
        "Esta póliza ya tiene 3 documentos. No se permite adjuntar otro.",
      );
    const display = pdfFormatIdV35(number, id.annex);
    let stored = true;
    try {
      await pdfSaveRawV35(pdfKeyV35(number, id.annex), file);
    } catch (e) {
      pdfSessionV33.set(pdfKeyV35(number, id.annex), file);
      stored = false;
    }
    (pdfMetaV35[number] ??= []).push({
      annex: id.annex,
      display,
      source: file.name,
      stored,
      addedAt: new Date().toISOString(),
    });
    pdfPersistMetaV35();
    msg.textContent =
      "Documento asociado como " +
      display +
      (stored
        ? "."
        : ". Guardado solo durante esta sesión; exporta el catálogo JSON.");
    pdfRenderExistingV35();
    pdfUpdateParamV34();
  } catch (e) {
    msg.textContent = "ALERTA: " + e.message;
    msg.style.color = "#a02739";
  } finally {
    $("fichaPdfUpload").value = "";
  }
}
$("fichaPdfUpload").addEventListener("change", (ev) =>
  docUploadV35(ev.target.files[0]),
);
$("fichaPolicySelect").addEventListener("change", () =>
  pdfMigrateLegacyV35($("fichaPolicySelect").value).then(pdfRenderExistingV35),
);
document.querySelector('[data-tab="ficha"]').addEventListener("click", () => {
  pdfMigrateLegacyV35($("fichaPolicySelect").value).then(pdfRenderExistingV35);
});
async function pdfExportDocsV35() {
  const items = [];
  for (const n of Object.keys(policyCatalog)) {
    await pdfMigrateLegacyV35(n);
    for (const m of pdfExistingV35(n)) {
      const blob = await pdfGetStoredV35(n, m.annex);
      if (blob)
        items.push({
          policy: n,
          annex: m.annex,
          display: m.display,
          source: m.source,
          mime: "application/pdf",
          base64: await pdfToB64V33(blob),
        });
    }
  }
  return items;
}
async function pdfImportDocsV35(items) {
  let restored = 0,
    errors = [];
  for (const r of items) {
    try {
      if (
        !r ||
        !policyValidNumber(r.policy) ||
        !/^\d{6}$/.test(r.annex) ||
        typeof r.base64 !== "string"
      )
        throw Error("formato inválido");
      const n = r.policy;
      if (pdfExistingV35(n).some((d) => d.annex === r.annex)) {
        errors.push(
          pdfFormatIdV35(n, r.annex) + ": ya existe; se conservó el original",
        );
        continue;
      }
      if (pdfExistingV35(n).length >= 3) {
        errors.push(n + ": máximo 3 documentos");
        continue;
      }
      const blob = pdfDecodeB64V33(r.base64);
      if (blob.size > 12 * 1024 * 1024) throw Error("PDF mayor a 12 MB");
      await pdfSaveRawV35(pdfKeyV35(n, r.annex), blob);
      (pdfMetaV35[n] ??= []).push({
        annex: r.annex,
        display: pdfFormatIdV35(n, r.annex),
        source: r.source || "",
        stored: true,
      });
      restored++;
    } catch (e) {
      errors.push((r?.policy || "Desconocido") + ": " + e.message);
    }
  }
  pdfPersistMetaV35();
  pdfUpdateParamV34();
  return { restored, errors };
}
async function pdfImportLegacyV35(items) {
  let restored = 0,
    errors = [];
  for (const [n, r] of Object.entries(items)) {
    if (!policyValidNumber(n) || !r?.base64) continue;
    try {
      await pdfMigrateLegacyV35(n);
      if (pdfExistingV35(n).length) continue;
      const blob = pdfDecodeB64V33(r.base64);
      let annex = "000000";
      try {
        const id = pdfReadIdentityV35(await docExtractPdfTextV32(blob));
        if (id?.policy === n) annex = id.annex;
      } catch (_) {}
      await pdfSaveRawV35(pdfKeyV35(n, annex), blob);
      pdfMetaV35[n] = [
        {
          annex,
          display: pdfFormatIdV35(n, annex),
          source: r.name || "",
          stored: true,
        },
      ];
      restored++;
    } catch (e) {
      errors.push(n + ": " + e.message);
    }
  }
  pdfPersistMetaV35();
  pdfUpdateParamV34();
  return { restored, errors };
}
// Recuperar enlaces de consulta al cambiar de emisor, póliza o catálogo.
$("policyList").addEventListener("change", pdfUpdateParamV34);
$("issuerSelect").addEventListener("change", pdfUpdateParamV34);
setTimeout(() => pdfUpdateParamV34(), 0);
