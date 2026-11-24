import fs from 'node:fs';
import path from 'node:path';

const siteDir = path.resolve(process.argv[2] || '_site');
const pages = [
  'index.html',
  'cruce-datos.html',
  'cotizador.html',
  'macro-pesados.html',
  'cotizador-productos-cerrados.html',
  'capturacion_facturacion.html'
];

const releasePath = path.join(siteDir, 'version.json');
const release = JSON.parse(fs.readFileSync(releasePath, 'utf8'));
const commit = process.env.GITHUB_SHA || release.commit;
const runNumber = process.env.GITHUB_RUN_NUMBER || release.version?.split('.').pop();
const navVersion = String(commit || '').slice(0, 12);

if (!/^\d{4}\.\d{2}\.\d{2}\.\d+$/.test(release.version || '')) {
  throw new Error(`Versión inválida en version.json: ${release.version || '(vacía)'}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(release.date || '')) {
  throw new Error(`Fecha inválida en version.json: ${release.date || '(vacía)'}`);
}
if (release.commit !== commit) {
  throw new Error('version.json no corresponde al commit que se está publicando.');
}
if (!release.version.endsWith(`.${runNumber}`)) {
  throw new Error('version.json no corresponde al número de ejecución actual.');
}

const expectedScript = `public/js/pages/navigation.js?v=${navVersion}`;
for (const page of pages) {
  const html = fs.readFileSync(path.join(siteDir, page), 'utf8');
  const references = html.match(/public\/js\/pages\/navigation\.js(?:\?v=[^"']+)?/g) || [];
  if (references.length !== 1) {
    throw new Error(`${page} debe cargar navigation.js exactamente una vez; encontrados: ${references.length}.`);
  }
  if (references[0] !== expectedScript) {
    throw new Error(`${page} usa ${references[0]} en lugar de ${expectedScript}.`);
  }
}

const navigation = fs.readFileSync(path.join(siteDir, 'public/js/pages/navigation.js'), 'utf8');
if (!navigation.includes("fetch('version.json', { cache: 'no-store' })")) {
  throw new Error('navigation.js no consulta version.json sin caché.');
}

console.log(`Versión ${release.version} validada en ${pages.length} páginas para ${navVersion}.`);
