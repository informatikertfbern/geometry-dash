/* suite.js — der Prueflauf. Er ist nur so viel wert wie seine Zaehne: siehe
   negitivprobe.js, das beweist, dass diese Suite Fehler tatsaechlich meldet. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

/* Regel aus der Vorarbeit: die beiden hoechsten Stufen brauchen das Ziel
   mindestens zweimal. Ein einzelnes engstes Fenster ist ein Ausreisser, keine
   Eigenschaft eines Levels. */
const MIN_FENSTER = { WAHNSINN: 2, EXTREM: 2 };

function pad(v, n) { return String(v).padEnd(n); }

let rot = 0, gesamt = 0;
console.log('Level              Stufe     Bot  engstes  Ziel  Treffer  Laenge  Teile');
for (const def of L.LEVEL) {
  gesamt++;
  let lvl, r, a;
  try { lvl = P.baue(def); r = S.fahre(lvl); a = S.audit(lvl); }
  catch (e) { console.log(pad(def.name, 18) + 'BAU-FEHLER: ' + e.message.slice(0, 70)); rot++; continue; }
  const z = L.STUFEN[def.stufe];
  const treffer = a.fenster.filter(f => Math.abs(f.ms - z.ms) <= 6).length;
  const braucht = MIN_FENSTER[def.stufe] || 1;
  const gr = [];
  if (r.fehler) gr.push('Bot: ' + r.fehler);
  for (const f of a.fehler) gr.push('Audit: ' + f);
  if (treffer < braucht) gr.push('Zielfenster ' + z.ms + ' ms nur ' + treffer + 'x, verlangt ' + braucht + 'x');
  if (r.prozent < 99) gr.push('Bot nur ' + r.prozent.toFixed(0) + ' %');
  if (gr.length) rot++;
  console.log(pad(def.name, 18) + pad(def.stufe, 10) + pad(r.prozent.toFixed(0) + ' %', 6)
    + pad(a.engstes.toFixed(0), 9) + pad(z.ms, 6) + pad(treffer + '/' + braucht, 9)
    + pad((a.laenge / P.CELL).toFixed(0) + 'Z', 8) + a.objekte
    + (gr.length ? '   ROT' : '   ok'));
  for (const g of gr) console.log('        - ' + g);
}
console.log(rot === 0 ? 'ALLE ' + gesamt + ' LEVEL GRUEN' : rot + ' von ' + gesamt + ' ROT');
process.exit(rot ? 1 : 0);
