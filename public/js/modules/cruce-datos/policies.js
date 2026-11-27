/* Conciliador de Créditos V36: Catálogo de pólizas, persistencia y acceso local.
   Este archivo comparte el ámbito global clásico con los módulos cargados antes que él. */
"use strict";

/* 9.2 Parámetros iniciales y rangos */
const paramsDefault = () => ({
  min: 18,
  minMes: 0,
  minDia: 0,
  maxNuevo: 70,
  maxNuevoMes: 0,
  maxNuevoDia: 0,
  maxPerm: 75,
  maxPermMes: 0,
  maxPermDia: 0,
  limite: 60000,
  age: [
    {
      fromY: 75,
      fromM: 0,
      fromD: 0,
      toY: 75,
      toM: 0,
      toD: 0,
      limit: 10000,
      obs: "COBERTURA HASTA $10.000",
    },
  ],
  guarantees: [
    {
      from: 10000.01,
      to: 60000,
      obs: "SOLICITAR FORMULARIO DE ASEGURABILIDAD",
    },
  ],
  combined: [
    {
      fromY: 18,
      fromM: 0,
      fromD: 0,
      toY: 74,
      toM: 11,
      toD: 29,
      amountFrom: 40000.01,
      amountTo: 60000,
      obs: "DECLARACIÓN DE SALUD",
    },
  ],
});
let ranges = paramsDefault();
/* 9.2.V16 Catálogo de pólizas: almacenamiento local con respaldo portable.
   No se almacenan datos personales de las bases ACTUAL ni MES ANTERIOR.
   El guardado es explícito; cambiar de póliza no sobrescribe las configuraciones. */
const POLICY_STORE = "conciliador_creditos_perfiles_v16";
let policyCatalog = {};
let activePolicy = "";
let savedSnapshot = "";
const policyIds = [
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
  "newOnlyFromY",
  "newOnlyFromM",
  "newOnlyFromD",
  "newOnlyToY",
  "newOnlyToM",
  "newOnlyToD",
  "newOnlyAmount",
  "newOnlyObs",
];
function policyNotice(msg, bad = false) {
  const el = $("policyMessage");
  el.textContent = msg;
  el.className = "policy-message " + (bad ? "bad" : "ok");
}
/* V27: Asignación solicitada de las pólizas históricas al emisor BALSECA.
   Sólo modifica el campo issuer; los snapshots y sus cálculos no se alteran.
   Se aplica tanto al catálogo local como a un respaldo JSON importado. */
const BALSECA_ISSUER = "BALSECA CARDENAS EDWIN MAURICIO";
const BALSECA_POLICY_NUMBERS = new Set([
  "24-2368",
  "24-2369",
  "24-2603",
  "24-2604",
  "24-2605",
  "24-2606",
  "24-2607",
  "24-2608",
  "24-2660",
  "24-2687",
  "24-2697",
  "24-2752",
  "24-3036",
]);
function assignBalsecaPolicies(catalog) {
  let changes = 0;
  for (const [key, profile] of Object.entries(catalog || {})) {
    if (!profile || typeof profile !== "object") continue;
    const number = String(profile.number || key)
      .trim()
      .toUpperCase();
    if (
      BALSECA_POLICY_NUMBERS.has(number) &&
      profile.issuer !== BALSECA_ISSUER
    ) {
      profile.issuer = BALSECA_ISSUER;
      changes++;
    }
  }
  return changes;
}
function policyStorageWrite() {
  try {
    localStorage.setItem(POLICY_STORE, JSON.stringify(policyCatalog));
    return true;
  } catch (err) {
    policyNotice(
      "El navegador no permitió guardar automáticamente. Descarga el respaldo JSON para conservar las pólizas. " +
        err.message,
      true,
    );
    return false;
  }
}
function policyStorageRead() {
  try {
    let obj = JSON.parse(localStorage.getItem(POLICY_STORE) || "{}");
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      policyCatalog = obj;
      const moved = assignBalsecaPolicies(policyCatalog);
      if (moved) policyStorageWrite();
    }
  } catch (e) {
    policyCatalog = {};
    policyNotice(
      "No fue posible leer el catálogo guardado: " + e.message,
      true,
    );
  }
}
function policySnapshot() {
  readRanges();
  let fields = {};
  for (let id of policyIds) fields[id] = $(id).value;
  fields.newOnlyEnabled = $("newOnlyEnabled").checked;
  fields.allowNewEntries = $("allowNewEntries").value;
  return { fields, ranges: JSON.parse(JSON.stringify(ranges)) };
}
function policyDirty() {
  return !!activePolicy && savedSnapshot !== JSON.stringify(policySnapshot());
}
function policyConfirmLeave() {
  return (
    !policyDirty() ||
    confirm(
      "Hay cambios sin guardar en los parámetros de la póliza actual. ¿Deseas descartarlos y continuar?",
    )
  );
}
function policyValidNumber(n) {
  return (
    !["__proto__", "prototype", "constructor"].includes(
      String(n).toLowerCase(),
    ) && /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/.test(n)
  );
}
function policyRefresh(preferred = "") {
  let select = $("policyList"),
    was = preferred || activePolicy,
    issuer = $("issuerSelect").value;
  const available = Object.values(policyCatalog).filter(
    (p) => (p.issuer || "") === issuer,
  );
  select.innerHTML =
    '<option value="">+ Nueva póliza</option>' +
    available
      .sort((a, b) => a.number.localeCompare(b.number, "es"))
      .map(
        (p) =>
          `<option value="${esc(p.number)}">${esc(p.number)} — ${esc(p.description)}</option>`,
      )
      .join("");
  select.value =
    policyCatalog[was] && (policyCatalog[was].issuer || "") === issuer
      ? was
      : "";
  if ($("policySearchInput")) policySearchRefresh();
  updateTemplateDownloadNames();
  const cnt = $("portableCount");
  if (cnt) {
    const n = Object.keys(policyCatalog).length;
    cnt.textContent = n + " " + (n === 1 ? "póliza" : "pólizas");
  }
}
/* V28 — búsqueda entre todos los emisores, incluidos perfiles antiguos sin asignar. */
function policySearchRefresh() {
  const out = $("policySearchResults"),
    term = canon(($("policySearchInput").value || "").trim());
  if (!term) {
    out.textContent = "Escribe un número o nombre para localizar su emisor.";
    return;
  }
  const hits = Object.values(policyCatalog)
    .filter((p) =>
      canon(
        [p.number, p.description, p.issuer || "Sin asignar"].join(" "),
      ).includes(term),
    )
    .sort((a, b) => a.number.localeCompare(b.number, "es"))
    .slice(0, 100);
  if (!hits.length) {
    out.textContent =
      "No se encontraron pólizas con ese dato en el catálogo cargado.";
    return;
  }
  out.innerHTML = hits
    .map(
      (p) =>
        `<button type="button" class="policy-search-hit" data-policy-open="${esc(p.number)}"><strong>${esc(p.number)} — ${esc(p.description || "")}</strong><br>Emisor: ${esc(p.issuer || "Sin asignar / pólizas anteriores")}</button>`,
    )
    .join("");
}
$("policySearchInput").addEventListener("input", policySearchRefresh);
$("policySearchResults").addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-policy-open]");
  if (!btn) return;
  const number = btn.dataset.policyOpen,
    profile = policyCatalog[number];
  if (!profile) return;
  if (number !== activePolicy && !policyConfirmLeave()) return;
  try {
    policyApply(profile);
    policySearchRefresh();
  } catch (e) {
    policyNotice("No se pudo abrir la póliza: " + e.message, true);
  }
});
function policyClearIdentity() {
  activePolicy = "";
  savedSnapshot = "";
  $("policyList").value = "";
  $("policyNumber").value = "";
  $("policyDescription").value = "";
  updateTemplateDownloadNames();
}
function policyApply(profile) {
  if (
    !profile ||
    !profile.snapshot ||
    !profile.snapshot.fields ||
    !profile.snapshot.ranges
  )
    throw Error("La póliza no contiene parámetros guardados.");
  let snap = profile.snapshot,
    rg = snap.ranges;
  for (let id of policyIds)
    if (Object.prototype.hasOwnProperty.call(snap.fields, id))
      $(id).value = snap.fields[id];
  $("newOnlyEnabled").checked = !!snap.fields.newOnlyEnabled;
  toggleNewOnlyDetails();
  $("allowNewEntries").value =
    snap.fields.allowNewEntries === "no" ? "no" : "si";
  updateNewEntryMode();
  ranges = JSON.parse(
    JSON.stringify({
      age: rg.age || [],
      guarantees: rg.guarantees || [],
      combined: rg.combined || [],
    }),
  );
  tableRanges();
  tableCombined();
  updateAgeFieldLimits();
  $("policyNumber").value = profile.number;
  $("policyDescription").value = profile.description;
  $("issuerSelect").value = profile.issuer || "";
  activePolicy = profile.number;
  savedSnapshot = JSON.stringify(policySnapshot());
  policyRefresh(activePolicy);
  if (actual.length && previous.length) {
    try {
      compute();
      policyNotice(
        "Póliza " +
          profile.number +
          " cargada y resultados recalculados con sus parámetros.",
      );
    } catch (e) {
      results = [];
      stats = null;
      policyNotice(
        "Póliza cargada. Revisa los parámetros antes de recalcular: " +
          e.message,
        true,
      );
    }
  } else
    policyNotice(
      "Configuración de " +
        profile.number +
        " — " +
        profile.description +
        " recuperada. Carga las bases para procesarla.",
    );
}
function policyCreateNew() {
  if (!policyConfirmLeave()) return;
  const selectedIssuer = $("issuerSelect").value;
  // V18: nueva póliza parte de una sesión completamente vacía; el catálogo guardado se conserva.
  resetWorkspaceForNewPolicy();
  $("issuerSelect").value = selectedIssuer;
  policyRefresh();
  policyNotice(
    "Nueva póliza: datos, parámetros, rangos y bases de la sesión en blanco. Registra el número y descripción antes de guardarla.",
  );
  document.querySelector('[data-tab="parametros"]').click();
  $("policyNumber").focus();
}
function policyLoad(number) {
  if (!number) {
    policyCreateNew();
    return;
  }
  if (number === activePolicy) {
    policyRefresh(activePolicy);
    return;
  }
  if (!policyConfirmLeave()) {
    policyRefresh(activePolicy);
    return;
  }
  try {
    policyApply(policyCatalog[number]);
  } catch (e) {
    policyRefresh(activePolicy);
    policyNotice("No se pudo abrir la póliza: " + e.message, true);
  }
}
function policySave() {
  try {
    const n = $("policyNumber").value.trim().toUpperCase(),
      d = $("policyDescription").value.trim();
    if (!policyValidNumber(n))
      throw Error(
        "Ingresa un número de póliza válido (letras, números, guion, punto o guion bajo; sin espacios).",
      );
    if (!d) throw Error("Ingresa la descripción de la póliza.");
    const p = getParams(false);
    const snap = policySnapshot();
    if (
      activePolicy &&
      n !== activePolicy &&
      !confirm(
        "Has cambiado el número de la póliza. ¿Guardar como una nueva póliza " +
          n +
          "? La anterior permanecerá guardada.",
      )
    )
      return;
    if (
      policyCatalog[n] &&
      n !== activePolicy &&
      !confirm(
        "La póliza " +
          n +
          " ya existe. ¿Deseas sobrescribir sus parámetros guardados?",
      )
    )
      return;
    policyCatalog[n] = {
      number: n,
      description: d,
      issuer: $("issuerSelect").value,
      snapshot: snap,
      savedAt: new Date().toISOString(),
    };
    activePolicy = n;
    savedSnapshot = JSON.stringify(snap);
    policyRefresh(n);
    const kept = policyStorageWrite();
    if (catalogOpen && $("portableAuto").checked) policyDownloadBackup(true);
    if (actual.length && previous.length) compute();
    if (kept)
      policyNotice(
        "Póliza " +
          n +
          " — " +
          d +
          " guardada. " +
          (catalogOpen && $("portableAuto").checked
            ? "Catálogo portátil descargado: consérvalo para otra PC."
            : "Abre la pestaña 6. Catálogo para descargar el JSON portátil."),
      );
    else
      policyNotice(
        "No se pudo guardar en el navegador; " +
          (catalogOpen && $("portableAuto").checked
            ? "el catálogo JSON descargado contiene tu póliza."
            : "abre la pestaña 6. Catálogo para conservarla."),
        true,
      );
  } catch (e) {
    policyNotice("No fue posible guardar: " + e.message, true);
  }
}
function policyDelete() {
  let n = activePolicy || $("policyList").value;
  if (!n || !policyCatalog[n]) {
    policyNotice("Selecciona una póliza guardada para eliminarla.", true);
    return;
  }
  if (
    !confirm(
      "¿Eliminar la configuración guardada de " +
        n +
        "? Esta acción no borra los Excel ni sus datos.",
    )
  )
    return;
  delete policyCatalog[n];
  policyStorageWrite();
  policyClearIdentity();
  policyRefresh();
  policyNotice(
    "Configuración " +
      n +
      " eliminada del catálogo. Los parámetros que ves siguen en pantalla hasta cargar otra póliza o limpiar.",
  );
}
async function policyDownloadBackup(silent = false) {
  try {
    const pdfOriginales = await pdfExportDocsV33();
    const pdfArchivosV35 = await pdfExportDocsV35();
    const obj = {
      format: "ConciliadorCreditosPolicyCatalog",
      version: 1,
      createdAt: new Date().toISOString(),
      policies: Object.values(policyCatalog),
      documents: policyDocumentsV32,
      pdfOriginales: {},
      pdfArchivosV35,
    };
    save(
      new Blob([JSON.stringify(obj)], {
        type: "application/json;charset=utf-8",
      }),
      "CATALOGO_POLIZAS.json",
    );
    if (!silent)
      policyNotice(
        "CATALOGO_POLIZAS.json descargado: " +
          obj.policies.length +
          " pólizas y " +
          pdfArchivosV35.length +
          " PDF originales. Consérvalo en un lugar seguro.",
      );
  } catch (e) {
    policyNotice("No se pudo generar el respaldo completo: " + e.message, true);
  }
}
async function policyImportFile(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (
      data.format !== "ConciliadorCreditosPolicyCatalog" ||
      data.version !== 1 ||
      !Array.isArray(data.policies)
    )
      throw Error("Formato de respaldo no reconocido.");
    let incoming = {};
    for (let p of data.policies) {
      if (
        !p ||
        !policyValidNumber(p.number) ||
        typeof p.description !== "string" ||
        !p.snapshot ||
        !p.snapshot.fields ||
        !p.snapshot.ranges
      )
        throw Error("Se encontró una póliza mal formada en el respaldo.");
      incoming[p.number] = {
        number: p.number,
        description: p.description,
        issuer: ISSUERS.includes(p.issuer) ? p.issuer : "",
        snapshot: p.snapshot,
        savedAt: p.savedAt || "",
      };
    }
    const duplicates = Object.keys(incoming).filter((n) => policyCatalog[n]);
    if (
      duplicates.length &&
      !confirm(
        "El respaldo contiene " +
          duplicates.length +
          " póliza(s) ya guardadas. ¿Sobrescribir sus configuraciones?",
      )
    )
      return;
    if (!policyConfirmLeave()) return;
    if (
      data.documents &&
      typeof data.documents === "object" &&
      !Array.isArray(data.documents)
    ) {
      const safe = Object.entries(data.documents)
        .filter(
          ([n, v]) =>
            policyValidNumber(n) &&
            v &&
            typeof v === "object" &&
            !Array.isArray(v),
        )
        .map(([n, v]) => [n, v]);
      for (const [n, v] of safe) {
        if (
          policyDocumentsV32[n] &&
          !confirm(
            "El catálogo contiene una ficha documental para " +
              n +
              ". ¿Reemplazarla?",
          )
        )
          continue;
        policyDocumentsV32[n] = v;
      }
      docStorageWriteV32();
    }
    // Restaurar archivos originales adjuntos al catálogo, si el respaldo los incluye.
    let restoredPdfV33 = { restored: 0, errors: [] };
    if (Array.isArray(data.pdfArchivosV35)) {
      restoredPdfV33 = await pdfImportDocsV35(data.pdfArchivosV35);
    } else if (data.pdfOriginales && typeof data.pdfOriginales === "object") {
      restoredPdfV33 = await pdfImportLegacyV35(data.pdfOriginales);
    }
    Object.assign(policyCatalog, incoming);
    assignBalsecaPolicies(policyCatalog);
    policyStorageWrite();
    if (activePolicy && incoming[activePolicy]) {
      activePolicy = "";
      savedSnapshot = "";
    }
    policyRefresh(activePolicy);
    policyNotice(
      "Se importaron " +
        Object.keys(incoming).length +
        " pólizas y " +
        restoredPdfV33.restored +
        " PDF originales. " +
        (restoredPdfV33.errors.length
          ? "Algunos PDF no se pudieron guardar en este equipo; revisa el espacio disponible. "
          : "") +
        "Selecciona una póliza para consultar sus condiciones.",
    );
  } catch (e) {
    policyNotice("No se pudo importar: " + e.message, true);
  } finally {
    $("policyImport").value = "";
  }
}
function policyFilePrefix() {
  const n = $("policyNumber").value.trim().toUpperCase(),
    d = $("policyDescription").value.trim();
  if (!policyValidNumber(n))
    throw Error(
      "Indica el número de póliza en 2. Parámetros antes de exportar.",
    );
  if (!d)
    throw Error(
      "Indica también la descripción de la póliza antes de exportar.",
    );
  return n.replace(/[^A-Za-z0-9._-]/g, "_");
}
const ISSUERS = [
  "OCANIA CEVALLOS NAYELI ANAHI",
  "MORALES VARGAS SHARON NATALIA",
  "ACHIG DONOSO JHOSELYN PAMELA",
  "PAREDES YANEZ JAMILETH ALEJANDRA",
  "POZO ENCALADA ANDREA LIZETH",
  "BALSECA CARDENAS EDWIN MAURICIO",
];
$("issuerSelect").addEventListener("change", (e) => {
  if (!policyConfirmLeave()) {
    e.target.value = policyCatalog[activePolicy]?.issuer || "";
    return;
  }
  // V29: al cambiar de emisor, borrar la configuración visible de la póliza anterior.
  // El catálogo persistente permanece intacto. Se limpia también la sesión de bases
  // para evitar conciliar datos de un producto con los límites de otro.
  const targetIssuer = e.target.value;
  resetWorkspaceForNewPolicy();
  $("issuerSelect").value = targetIssuer;
  $("policySearchInput").value = "";
  policyRefresh();
  updateTemplateDownloadNames();
  policyNotice(
    targetIssuer
      ? "Emisor " +
          targetIssuer +
          " seleccionado. Póliza, parámetros y bases de la sesión limpios; elige una póliza o registra una nueva."
      : "Emisor sin asignar seleccionado. Póliza y parámetros de la sesión limpios.",
  );
});
/* V29 — Nombres de plantillas con número de póliza, sin modificar los Excel internos. */
function updateTemplateDownloadNames() {
  const number = $("policyNumber").value.trim().toUpperCase();
  const suffix = policyValidNumber(number) ? number : "SIN_POLIZA";
  $("templateActual").download = "PLANTILLA_ACTUAL_" + suffix + ".xlsx";
  $("templatePrevious").download = "PLANTILLA_MES_ANTERIOR_" + suffix + ".xlsx";
}
$("policyNumber").addEventListener("input", updateTemplateDownloadNames);
$("templateActual").addEventListener("click", updateTemplateDownloadNames);
$("templatePrevious").addEventListener("click", updateTemplateDownloadNames);
$("policyList").addEventListener("change", (e) => policyLoad(e.target.value));
$("policyNew").onclick = policyCreateNew;
$("policySave").onclick = policySave;
$("policyDelete").onclick = policyDelete;
$("policyBackup").onclick = () => {
  if (catalogOpen) policyDownloadBackup();
};
$("policyImportButton").onclick = () => $("policyImport").click();
$("policyImport").onchange = (e) => policyImportFile(e.target.files[0]);
$("portableDownload").onclick = () => {
  if (catalogOpen) policyDownloadBackup();
};
$("portableOpen").onclick = () => $("policyImport").click();
/* V26: mostrar campos únicamente cuando el requisito esté marcado. */
function toggleNewOnlyDetails() {
  $("newOnlyDetails").hidden = !$("newOnlyEnabled").checked;
}
$("newOnlyEnabled").addEventListener("change", toggleNewOnlyDetails);
toggleNewOnlyDetails();
$("issuerSelect").value = BALSECA_ISSUER;
policyStorageRead();
policyRefresh();
updateTemplateDownloadNames();

/* V26 — CLAVE LOCAL PARA PESTAÑA 6. No cifra el archivo exportado. */
const CATALOG_LOCK_KEY = "conciliador_catalogo_clave_v26";
let catalogOpen = false;
function catalogHash(value, salt) {
  if (!globalThis.crypto || !crypto.subtle)
    throw Error(
      "Este navegador no admite protección con clave en archivos locales. Usa Edge o Chrome actualizado.",
    );
  const enc = new TextEncoder();
  return crypto.subtle
    .importKey("raw", enc.encode(value), "PBKDF2", false, ["deriveBits"])
    .then((key) =>
      crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          salt: enc.encode(salt),
          iterations: 120000,
          hash: "SHA-256",
        },
        key,
        256,
      ),
    )
    .then((bits) =>
      Array.from(new Uint8Array(bits), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join(""),
    );
}
function catalogLockUI() {
  $("catalogUnlocked").classList.toggle("active", catalogOpen);
  $("catalogLock").classList.toggle("hidden", catalogOpen);
  $("catalogPassword").value = "";
  let exists = false;
  try {
    exists = !!localStorage.getItem(CATALOG_LOCK_KEY);
  } catch (e) {
    $("catalogLockMessage").textContent =
      "El almacenamiento del navegador no está disponible: " + e.message;
  }
  $("catalogLockHelp").textContent = exists
    ? "Introduce la clave que configuraste en este navegador."
    : "Primer acceso: crea una clave de al menos 6 caracteres. Se guardará solamente el verificador en este navegador.";
  $("catalogUnlock").textContent = exists
    ? "Abrir catálogo"
    : "Crear clave y abrir catálogo";
}
async function catalogUnlock() {
  const pass = $("catalogPassword").value;
  const msg = $("catalogLockMessage");
  msg.textContent = "";
  if (pass.length < 6) {
    msg.textContent = "La clave debe contener al menos 6 caracteres.";
    return;
  }
  try {
    const current = JSON.parse(
      localStorage.getItem(CATALOG_LOCK_KEY) || "null",
    );
    if (current) {
      let test = await catalogHash(pass, current.salt);
      if (test !== current.hash) {
        msg.textContent = "Clave incorrecta.";
        return;
      }
    } else {
      if (
        !confirm(
          "¿Crear esta clave para proteger el acceso local a la pestaña Catálogo? Guárdala en un lugar seguro.",
        )
      )
        return;
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
        x.toString(16).padStart(2, "0"),
      ).join("");
      const hash = await catalogHash(pass, salt);
      localStorage.setItem(CATALOG_LOCK_KEY, JSON.stringify({ salt, hash }));
    }
    catalogOpen = true;
    catalogLockUI();
  } catch (e) {
    msg.textContent = "No se pudo abrir el catálogo: " + e.message;
  }
}
$("catalogUnlock").onclick = catalogUnlock;
$("catalogPassword").addEventListener("keydown", (e) => {
  if (e.key === "Enter") catalogUnlock();
});
$("catalogRelock").onclick = () => {
  catalogOpen = false;
  catalogLockUI();
};
$("catalogChangePassword").onclick = async () => {
  const existing = prompt("Introduce la clave actual para cambiarla:");
  if (existing === null) return;
  const current = JSON.parse(localStorage.getItem(CATALOG_LOCK_KEY) || "null");
  if (
    !current ||
    (await catalogHash(existing, current.salt)) !== current.hash
  ) {
    alert("Clave actual incorrecta.");
    return;
  }
  const next = prompt("Nueva clave (mínimo 6 caracteres):");
  if (next === null) return;
  if (next.length < 6) {
    alert("La clave debe tener al menos 6 caracteres.");
    return;
  }
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  localStorage.setItem(
    CATALOG_LOCK_KEY,
    JSON.stringify({ salt, hash: await catalogHash(next, salt) }),
  );
  alert("Clave local actualizada.");
};
catalogLockUI();
