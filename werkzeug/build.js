/* build.js — macht aus src/ eine einzige dist/gd.html.
   Der Kern ist in CommonJS geschrieben, weil die Tests in Node laufen. Ein
   klassisches <script> macht top-level `const` aber NICHT zu einem window-
   Feld — der Browser-Export der Quelltexte war also gar keiner. Darum liegt
   jeder Modulcode in einem IIFE mit einem eigenen require und module, und die
   Reihenfolge ist die einzige Abhaengigkeit: physik, dann spiel, dann level. */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..');
const QUELLE = ['physik.js', 'spiel.js', 'level.js'];
const SPAETER = ['render.js', 'app.js'];
const NAMEN = { 'physik.js': 'PH', 'spiel.js': 'SP', 'level.js': 'LV' };

function liest(name) {
  return fs.readFileSync(path.join(WURZEL, 'src', name), 'utf8');
}

function modul(name) {
  const text = liest(name);
  if (text.includes('</script')) throw new Error(name + ' enthaelt ein </script>');
  return '/* ==== src/' + name + ' ==== */\n(function () {\n'
    + "  var module = { exports: {} };\n  var exports = module.exports;\n"
    + "  var require = function (p) {\n"
    + "    var k = String(p).replace(/^.*[\\/]/, '');\n"
    + "    if (!GD.module[k]) throw new Error('Modul nicht geladen: ' + k);\n"
    + "    return GD.module[k];\n  };\n"
    + text + "\n  GD.module['" + name + "'] = module.exports;\n"
    + "  GD." + NAMEN[name] + " = module.exports;\n})();\n";
}

const kern = QUELLE.map(modul).join('\n');
const spaet = SPAETER.map(function (n) {
  const text = liest(n);
  if (text.includes('</script')) throw new Error(n + ' enthaelt ein </script>');
  return '/* ==== src/' + n + ' ==== */\n' + text;
}).join('\n');

const js = '(function (global) {\n  var GD = global.GD = global.GD || { module: {} };\n'
  + kern + '\n' + spaet + '\n})(typeof window !== "undefined" ? window : globalThis);\n';

const muschel = liest('muschel.html');
if (!muschel.includes('<!--BAU-->')) throw new Error('muschel.html hat keinen <!--BAU-->-Platzhalter');
const html = muschel.replace('<!--BAU-->', '<script>\n' + js + '</script>');

fs.mkdirSync(path.join(WURZEL, 'dist'), { recursive: true });
fs.writeFileSync(path.join(WURZEL, 'dist', 'gd.html'), html);

fs.writeFileSync(path.join(WURZEL, 'dist', 'gd-buendel.js'), js);
console.log('dist/gd.html  ' + (html.length / 1024).toFixed(1) + ' KB');
console.log('davon Kern    ' + (js.length / 1024).toFixed(1) + ' KB');
