# Módulo Vida 2026

## Aplicacion publica para GitHub Pages

Usar: https://chachanito.github.io/modulo-vida-2026/

El menú principal ofrece cuatro herramientas independientes:

- **Justificador:** prepara texto y tablas y los combina en un documento.
- **Cruce de datos:** compara las bases de créditos ACTUAL y ANTERIOR, aplica parámetros de asegurabilidad, concilia totales y exporta resultados.
- **Cotizador RC:** calcula responsabilidad civil para flotas de transporte, con detalle por vehículo, impuestos y formato imprimible.
- **Cotizadores:** agrupa en el menú lateral el Cotizador RC, Productos Cerrados y Macro Pesados, cada uno en su propio módulo y con sus cálculos independientes.

El cotizador RC reproduce las condiciones de cálculo del Excel: el valor asegurado depende de marca y modelo; la prima neta requiere además pasajeros y prima por vehículo. Año, placa y pasajeros tienen validaciones específicas y admite hasta 100 vehículos. La cotización imprimible incluye el detalle de coberturas, deducibles, forma de pago, notas importantes, ilustraciones de transporte y el logo de Swaden como marca de agua.

El menú lateral ofrece **Cruce de datos** como un acordeón con acceso a `cruce-datos.html`; **Cotizadores** permite abrir `cotizador.html` (RC), `cotizador-productos-cerrados.html` y `macro-pesados.html`. Las cotizaciones se procesan localmente en el navegador.

## Estructura del proyecto

- Las cinco páginas HTML de la raíz son los módulos activos del sitio.
- `public/estilo/` contiene todas las hojas CSS, separadas por propósito y módulo. El Conciliador V36 agrupa sus estilos por responsabilidad en `public/estilo/modules/cruce-datos/`.
- `public/js/pages/` contiene la navegación y el tema compartidos; `public/js/modules/` contiene los controladores de los módulos activos. La lógica del Conciliador está dividida en `public/js/modules/cruce-datos/`: núcleo, pólizas, parámetros, entrada de datos, conciliación, exportaciones y documentos.
- `public/js/data/` separa los catálogos y matrices de cálculo de su lógica; `public/js/vendor/` conserva las bibliotecas de terceros, incluido JSZip.
- Cruce de datos, Macro Pesados y Productos Cerrados cargan sus archivos en orden: bibliotecas o datos primero, controlador después. Esto mantiene visibles los datos globales requeridos por los controladores y evita volver a incrustar lógica en el HTML.
- `public/images/` y `public/templates/` contienen los recursos de la interfaz y las plantillas del Conciliador.
- `tests/` contiene las pruebas y la validación del sitio publicado. `views/` y `erp/` conservan la integración PHP.

Los comentarios del código señalan secciones y lógica que requiere contexto; no se comenta cada línea para evitar duplicar lo que el propio código ya expresa.

`MANIFIESTO.json` es un registro de la exportación original: sus rutas `public/css` son históricas, no rutas de carga de la aplicación actual.

`index.html` es una aplicacion independiente, sin cuentas ni dependencias del ERP. Permite justificar texto, importar PDF con texto y Word .docx, procesar Excel/CSV, ordenar secciones y copiar. El tema claro/oscuro se cambia desde el menú lateral, se guarda localmente y se comparte entre todos los módulos; inicialmente sigue el tema del sistema. La interfaz publica no contiene enlaces de descarga ni enlaces al codigo fuente. Todos los documentos se procesan en el navegador. Los lectores PDF.js, Mammoth y SheetJS estan incluidos localmente.

Los archivos admiten hasta 10 MB; los PDF hasta 300 paginas. No hay OCR para PDF escaneado ni se conserva la maquetacion original de PDF/Word. Revisar siempre el texto extraido. Los documentos no se guardan al recargar o cerrar; copiar el resultado para conservarlo. Se necesita un navegador moderno con soporte de modulos y workers.

Para probar localmente: desde esta carpeta ejecutar `php -S localhost:8080` y abrir `http://localhost:8080/`. No abrir el HTML con `file://`, porque los lectores usan modulos y workers.

El flujo `.github/workflows/pages.yml` publica automaticamente al subir a `main`. Configurar Settings > Pages > Source como **GitHub Actions**. Antes de publicar, valida que las rutas internas existan. El artefacto incluye las cinco paginas publicas y los recursos de `public/js`, `public/estilo`, `public/images` y `public/templates`; excluye endpoints PHP, pruebas, archivos fuente y datos de trabajo.

Pruebas de navegador: generar el DOCX de prueba con `powershell -File tests/create-fixture.ps1` y abrir `/tests/browser.html` en el servidor local. Debe mostrar PASS para temas, texto, tablas, secciones e importacion PDF/DOCX.

En Windows con Chrome instalado, `tests/run-browser.ps1` ejecuta las pruebas del Justificador y del cotizador RC, y comprueba los acordeones de **Cruce de datos** y **Cotizadores**, las rutas activas y la presentación móvil de Macro Pesados y Productos Cerrados usando el servidor local en el puerto 8087. `-LocalSiteUrl` permite indicar otro puerto si el predeterminado está ocupado. El parámetro `-SiteUrl https://chachanito.github.io/justificador_vida/` repite las pruebas compatibles sobre la aplicación publicada con documentos sintéticos. Las capturas quedan en `tmp/`, fuera de Git. GitHub Actions valida además todas las rutas locales del artefacto antes de desplegar.

Los archivos PHP originales siguen disponibles para integracion en un ERP, como se describe a continuacion. `MANIFIESTO.json` corresponde a la exportacion original, no a las modificaciones de la version web.

Paquete del modulo PHP Justificador Vida y sus motores compartidos de texto y tablas. Incluye el estado actual del modulo: texto de 75 caracteres, tablas Excel/CSV, numeracion de hasta cuatro caracteres en modo Listado, importacion PDF/DOCX, copia, descarga TXT y documento compuesto por secciones reordenables. Conserva los espacios entre parrafos y secciones.

## Alcance

Esta carpeta contiene el codigo del modulo para integrarlo en una aplicacion PHP. No es el ERP completo ni una aplicacion independiente con inicio de sesion. No incluye credenciales, bases de datos, documentos de usuarios, registros, respaldos ni el historial Git del ERP.

## Requisitos

- PHP 7.4 o posterior (PHP 8 recomendado), sesiones habilitadas y `proc_open` disponible.
- Python 3 y las dependencias de `requirements.txt` para importar PDF. DOCX usa bibliotecas estandar de Python.
- Navegador moderno. Excel/CSV se procesa en el navegador con SheetJS.
- Configurar PHP para aceptar cargas de al menos 10 MB (`upload_max_filesize` y `post_max_size`).

Instalar las dependencias desde esta carpeta:

```sh
python -m pip install -r requirements.txt
```

El lector busca Python en `.venv/Scripts/python.exe`, `.venv/bin/python` o en el PATH. Tambien admite la variable de entorno `PYTHON_PATH` con la ruta del ejecutable. No se necesita una base de datos para las funciones de estos justificadores.

## Integracion

1. Copiar `views`, `public` y el lector de `erp` a la aplicacion conservando las rutas. Si la aplicacion ya tiene `public/estilo/style.css`, combinar los estilos necesarios en lugar de reemplazar su archivo.
2. El endpoint `erp/justificador_documento.php` requiere `erp/bootstrap.php`. Usar el bootstrap de la aplicacion anfitriona para iniciar la sesion y cargar las funciones CSRF de `erp/csrf.php` (o sus equivalentes). No se incluye el bootstrap del ERP porque carga otros modulos y su configuracion.
3. Tras autenticar al usuario, la aplicacion debe proporcionar `$_SESSION['usuario_id']`, `$_SESSION['rol']` y `$_SESSION['permisos']`. El rol `admin` o el permiso `justificador_vida` da acceso al modulo y a la importacion. `justificador_tablas` da acceso a su pagina independiente. No asignar estos permisos automaticamente en un sitio publico.
4. Registrar la ruta `justificador_vida` para cargar `views/modules/justificador_vida.php`. Las otras vistas son `herramientas_justificar` y `justificador_tablas`. El anfitrion debe proporcionar una pagina `views/modules/403.php` para acceso denegado.
5. Cargar el CSS global y el CSS del modulo, y el controlador de Vida. La vista ya carga los motores compartidos, SheetJS y los controladores de texto y tablas. Ejemplo para la pagina integrada:

```html
<link rel="stylesheet" href="public/estilo/style.css" />
<link rel="stylesheet" href="public/estilo/modules/justificador_vida.css" />
<script src="public/js/modules/justificador_vida.js" defer></script>
```

La vista carga `justificador_tablas.css` automaticamente. Para la pagina independiente de texto, cargar tambien `public/js/modules/herramientas_justificar.js`; para tablas, cargar `public/estilo/modules/justificador_tablas.css` y `public/js/modules/justificador_tablas.js`.

## Limitaciones conocidas

- PDF escaneado sin capa de texto requiere OCR externo; este lector no hace OCR.
- Word debe ser `.docx`; convertir los archivos `.doc` antes de importarlos.
- Se extrae texto de PDF y Word, no se conserva su maquetacion original.
- GitHub Pages no ejecuta PHP/Python. La version original del ERP necesita un servidor con estos interpretes; la version independiente `index.html` usa lectores JavaScript para importar PDF/Word en GitHub Pages.

## Publicacion

Subir solo el contenido de esta carpeta al repositorio, no la carpeta completa del ERP. Revisar `TERCEROS.md` y elegir la licencia del codigo propio antes de publicarlo. La carpeta incluye `.gitignore` para evitar incorporar documentos y configuracion local por accidente.

`MANIFIESTO.json` identifica los archivos exportados mediante SHA-256. Se mantiene la logica del modulo; en la copia del endpoint se reemplazo la ruta personal de Python por rutas portables. No se modifico la aplicacion original.
