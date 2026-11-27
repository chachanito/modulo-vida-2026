import json
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


PUBLISHED_PAGES = (
    "index.html",
    "cruce-datos.html",
    "cotizador.html",
    "cotizador-productos-cerrados.html",
    "macro-pesados.html",
)
REQUIRED_ASSETS = (
    "public/estilo/design-system.css",
    "public/estilo/modules/cruce-datos-pdf.css",
    "public/js/pages/navigation.js",
    "public/js/vendor/jszip-3.10.1.min.js",
    "public/js/modules/cruce_datos.js",
    "public/js/data/macro_pesados_catalog.js",
    "public/js/modules/macro_pesados.js",
    "public/js/data/productos_cerrados_catalog.js",
    "public/js/modules/cotizador_productos_cerrados.js",
    # La hoja se carga dentro del documento de impresión generado por Macro Pesados.
    "public/estilo/modules/macro-pesados-export.css",
    "public/templates/Plantilla_ACTUAL.xlsx",
    "public/templates/Plantilla_MES_ANTERIOR.xlsx",
)
REQUIRED_SCRIPT_SEQUENCES = {
    "cruce-datos.html": (
        "public/js/vendor/jszip-3.10.1.min.js",
        "public/js/modules/cruce_datos.js",
    ),
    "macro-pesados.html": (
        "public/js/data/macro_pesados_catalog.js",
        "public/js/modules/macro_pesados.js",
    ),
    "cotizador-productos-cerrados.html": (
        "public/js/data/productos_cerrados_catalog.js",
        "public/js/modules/cotizador_productos_cerrados.js",
    ),
}
REQUIRED_ELEMENT_IDS = {
    "cruce-datos.html": (
        "actualPaste",
        "anteriorPaste",
        "policySearchInput",
        "fichaPdfUpload",
    ),
}


class LocalReferences(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []
        self.scripts = []
        self.ids = set()
        self.inline_script = False
        self.inline_style = False
        self._inside_inline_script = False

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if attributes.get("id"):
            self.ids.add(attributes["id"])
        if tag == "style" or "style" in attributes:
            self.inline_style = True
        if tag == "script":
            source = attributes.get("src")
            if source:
                self.scripts.append(source)
            else:
                self._inside_inline_script = True
        for name in ("href", "src"):
            value = attributes.get(name)
            if value:
                self.urls.append(value)

    def handle_data(self, data):
        if self._inside_inline_script and data.strip():
            self.inline_script = True

    def handle_endtag(self, tag):
        if tag == "script":
            self._inside_inline_script = False

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: python tests/validate_pages.py <directorio-publicado>")

    root = Path(sys.argv[1]).resolve()
    errors = []

    version_path = root / "version.json"
    if not version_path.is_file():
        errors.append("Falta version.json")
    else:
        try:
            release = json.loads(version_path.read_text(encoding="utf-8"))
            version = release.get("version", "")
            date = release.get("date", "")
            commit = release.get("commit", "")
            run_number = release.get("run_number")
            if not re.fullmatch(r"\d{4}\.\d{2}\.\d{2}\.\d+", version):
                errors.append(f"Version invalida en version.json: {version}")
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
                errors.append(f"Fecha invalida en version.json: {date}")
            if not re.fullmatch(r"[0-9a-f]{40}", commit):
                errors.append(f"Commit invalido en version.json: {commit}")
            if not isinstance(run_number, int) or run_number < 1:
                errors.append(f"run_number invalido en version.json: {run_number}")
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"No se pudo leer version.json: {error}")

    navigation_source = root / "public/js/pages/navigation.js"
    if navigation_source.is_file():
        navigation_text = navigation_source.read_text(encoding="utf-8")
        if "fetch('version.json', { cache: 'no-store' })" not in navigation_text:
            errors.append("La navegacion no consulta version.json sin cache")

    cruce_source = root / "public/js/modules/cruce_datos.js"
    if cruce_source.is_file():
        cruce_text = cruce_source.read_text(encoding="utf-8")
        if "PDF_REFERENCE_2752" in cruce_text or "JVBERi0" in cruce_text:
            errors.append("El Conciliador incluye un PDF contractual precargado")

    expected_sha = os.environ.get("GITHUB_SHA", "")
    expected_nav_version = expected_sha[:12] if re.fullmatch(r"[0-9a-f]{40}", expected_sha) else ""

    for page in PUBLISHED_PAGES:
        if not (root / page).is_file():
            errors.append(f"Falta la pagina publicada: {page}")

    for asset in REQUIRED_ASSETS:
        if not (root / asset).is_file():
            errors.append(f"Falta un recurso requerido: {asset}")

    for private_path in ("erp", "tests", "views", "public/css", "capturacion_facturacion.html"):
        if (root / private_path).exists():
            errors.append(f"El artefacto incluye contenido no publicable: {private_path}")

    for html_path in root.rglob("*.html"):
        parser = LocalReferences()
        parser.feed(html_path.read_text(encoding="utf-8"))
        if html_path.parent == root and html_path.name in PUBLISHED_PAGES and expected_nav_version:
            expected_navigation = f"public/js/pages/navigation.js?v={expected_nav_version}"
            if expected_navigation not in parser.scripts:
                errors.append(f"{html_path.name} no usa la version de navegacion esperada")
        if html_path.parent == root and html_path.name in REQUIRED_SCRIPT_SEQUENCES:
            if parser.inline_script:
                errors.append(f"{html_path.name} todavía contiene JavaScript incrustado")
            if html_path.name == "cruce-datos.html" and parser.inline_style:
                errors.append("cruce-datos.html todavía contiene estilos incrustados")

            actual_scripts = [urlsplit(value).path for value in parser.scripts]
            position = 0
            for asset in REQUIRED_SCRIPT_SEQUENCES[html_path.name]:
                try:
                    position = actual_scripts.index(asset, position) + 1
                except ValueError:
                    errors.append(
                        f"{html_path.name} debe cargar {asset} en el orden requerido"
                    )
                    break

        if html_path.parent == root and html_path.name in REQUIRED_ELEMENT_IDS:
            for element_id in REQUIRED_ELEMENT_IDS[html_path.name]:
                if element_id not in parser.ids:
                    errors.append(f"{html_path.name} no contiene el control #{element_id}")

        for value in parser.urls:
            url = urlsplit(value)
            if url.scheme or url.netloc or not url.path:
                continue

            target = (html_path.parent / unquote(url.path)).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                errors.append(f"{html_path.relative_to(root)} apunta fuera del sitio: {value}")
                continue

            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                errors.append(f"{html_path.relative_to(root)} referencia un archivo inexistente: {value}")

    if errors:
        raise SystemExit("\n".join(errors))

    print("PASS: paginas publicadas y rutas internas verificadas")


if __name__ == "__main__":
    main()
