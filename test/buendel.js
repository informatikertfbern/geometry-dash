/* buendel-test.js — prueft das ausgelieferte Artefakt, nicht den Quelltext.
   Es reicht nicht, dass src/ in Node gruen ist: der Browser bekommt eine
   einzige HTML-Datei, in der jeder Modulcode in einem IIFE mit eigenem require
   liegt. Genau dieses Zusammensetzen kann kaputt sein, waehrend samtliche
   Quelltext-Tests gruen bleiben — ein top-level `const` wird im Browser eben
   gerade KEIN window-Feld, und ein IIFE, der sein Exportobjekt nicht
   weiterreicht, gibt still ein undefined weiter. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WURZEL = path.join(__dirname, '..');
/* Ein Pfad als Argument, damit die Negativprobe ein absichtlich kaputtes
   Buendel-pruefen kann, ohne das echte zu ersetzen. */
const htmlPfad = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(WURZEL, 'dist', 'gd.html');
if (!fs.existsSync(htmlPfad)) { console.log('FEHLT: dist/gd.html — erst build.js laufen lassen'); process.exit(1); }
const html = fs.readFileSync(htmlPfad, 'utf8');

const gruende = [];
function erwartet(ob, text) { if (!ob) gruende.push(text); }

/* 1) Die Huelle ist heil: ein einziges Script, kein vorzeitiges </script>. */
erwartet(html.indexOf('<!--BAU-->') === -1, 'Der Platzhalter <!--BAU--> ist noch im Endgeraet');
const stuecke = html.split('<script>');
erwartet(stuecke.length === 2, 'erwartet genau ein <script>-Block, fand ' + (stuecke.length - 1));
for (const teil of ['physik.js', 'spiel.js', 'level.js', 'render.js', 'app.js']) {
  erwartet(html.includes('src/' + teil), 'src/' + teil + ' fehlt im Buendel');
}

/* 2) Der Dom-Attrap. Bewusst karg: was hier nicht vorhanden ist, wirft, und ein
      Wurf im Attrap waere einer im Browser. */
function atrap() {
  const zeichner = new Proxy({}, {
    get: function (ziel, e) {
      if (e in ziel) return ziel[e];
      if (typeof e === 'symbol') return undefined;
      return function () {};                    /* jede Zeichenmethode ist erlaubt */
    },
    set: function (ziel, e, w) { ziel[e] = w; return true; },
  });
  function knoten(name) {
    return {
      tagName: name, children: [], innerHTML: '', textContent: '',
      style: {}, width: 0, height: 0,
      appendChild: function (k) { this.children.push(k); },
      addEventListener: function () {},
      blur: function () {},
      getContext: function () { return zeichner; },
    };
  }
  const knoten_feld = {};
  const warteschlange = [];
  const fenster = {
    requestAnimationFrame: function (f) { warteschlange.push(f); return warteschlange.length; },
    addEventListener: function () {},
    devicePixelRatio: 1,
  };
  fenster.window = fenster;
  fenster.document = {
    readyState: 'complete',
    getElementById: function (id) { return knoten_feld[id] || (knoten_feld[id] = knoten(id)); },
    createElement: function (n) { return knoten(n); },
    addEventListener: function () {},
  };
  return { fenster: fenster, knoten: knoten_feld, rahmen: function (n) {
    for (let i = 0; i < n; i++) {
      const f = warteschlange.shift();
      if (!f) throw new Error('Nachlauf ist leer — die Schleife hat sich selbst beendet');
      f(i * 16.7);
    }
  } };
}

const a = atrap();
try {
  vm.createContext(a.fenster);
  vm.runInContext(html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>')),
    a.fenster, { filename: 'gd.html' });
} catch (e) {
  console.log('LADFEHLER im Buendel: ' + e.message);
  console.log(e.stack.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}

const GD = a.fenster.GD || {};
erwartet(GD.PH, 'GD.PH fehlt — physik.js reicht sein Exportobjekt nicht weiter');
erwartet(GD.SP, 'GD.SP fehlt — spiel.js reicht sein Exportobjekt nicht weiter');
erwartet(GD.LV, 'GD.LV fehlt — level.js reicht sein Exportobjekt nicht weiter');
erwartet(GD.render && GD.render.zeichne, 'GD.render.zeichne fehlt');
/* Der haufigste stilldefehler ueberhaupt: das Modul ist geladen, aber seine
   Groessen sind undefined, und jede Rechnung wird zu NaN. */
if (GD.PH) {
  erwartet(GD.PH.CELL === 36, 'CELL im Buendel ist ' + GD.PH.CELL + ', erwartet 36');
  erwartet(GD.PH.LEVEL === undefined, 'PH.LEVEL waer ein Zeichen fuer ein zu grobes Fenster');
}
if (GD.LV) erwartet(Array.isArray(GD.LV.LEVEL) && GD.LV.LEVEL.length === 13,
  'GD.LV.LEVEL hat ' + ((GD.LV.LEVEL || []).length) + ' Level, erwartet 13');

/* 3) app.js hat init() durchgespielt: Level-Knoepfe sind gebaut. */
erwartet(a.knoten.liste && a.knoten.liste.children.length === 13,
  'Level-Auswahl hat ' + ((a.knoten.liste || {}).children || []).length + ' Knoepfe, erwartet 13');
erwartet(a.knoten.titel && /ERSTFLUG/.test(a.knoten.titel.textContent),
  'Der Titel zeigt nicht das erste Level, sondern: ' + JSON.stringify((a.knoten.titel || {}).textContent));

/* 4) Die Schleife laeuft: rahmen() zeichnet und bewegt, ohne zu werfen. */
try { a.rahmen(90); } catch (e) { gruende.push('Bildschirmrahmen wirft: ' + e.message); }

/* 5) Der Kern im Buendel faehrt alle 13 Level — dieselbe Rechnung, die in Node
      gruen ist, mit dem Code, der im Browser liegt. */
if (GD.PH && GD.SP) {
  for (const def of (GD.LV ? GD.LV.LEVEL : [])) {
    try {
      const lvl = GD.PH.baue(def);
      const r = GD.SP.fahre(lvl);
      if (r.fehler) gruende.push('Buendel ' + def.name + ': ' + r.fehler);
      else if (r.prozent < 99) gruende.push('Buendel ' + def.name + ': Bot nur ' + r.prozent.toFixed(0) + ' %');
    } catch (e) { gruende.push('Buendel ' + def.name + ': ' + e.message); }
  }
}

if (gruende.length) {
  console.log('BUENDEL FEHLERHAFT');
  for (const g of gruende) console.log('  - ' + g);
  process.exit(1);
}
console.log('Buendel in Ordnung: ' + (html.length / 1024).toFixed(1) + ' KB, 13 Level, Schleife laeuft');
