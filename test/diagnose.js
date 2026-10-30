/* diagnose.js — eine Zeile pro rotem Level, mit dem Kontext derbeanstandeten
   Stelle. Alles andere war Raten, und Raten hat hier schon Anlaeufe gekostet. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

const NAMEN = { 1: 'SPIKE', 2: 'BLOCK', 3: 'PLAT', 4: 'COIN', 5: 'PAD', 6: 'ORB',
  7: 'GRAV', 8: 'PORTAL', 9: 'SPD', 10: 'PILLAR', 11: 'FIN' };

function zeige(lvl, x, label) {
  const nah = lvl.objs.filter(o => Math.abs(o.x - x) < 260)
    .map(o => NAMEN[o.t] + '@' + Math.round(o.x)
      + (o.h ? ' h' + (o.h / P.CELL) : '') + (o.w ? ' b' + (o.w / P.CELL) : '')
      + (o.unten !== undefined ? 'u' + o.unten : '') + (o.down ? 'D' : ''))
    .join('  ');
  console.log('   ' + label + ' x=' + Math.round(x) + ': ' + nah);
}

for (const def of L.LEVEL) {
  let lvl, r, a;
  try { lvl = P.baue(def); r = S.fahre(lvl); a = S.audit(lvl); }
  catch (e) { console.log(def.name + ' BAU-FEHLER ' + e.message); continue; }
  const z = L.STUFEN[def.stufe];
  const aufZiel = a.fenster.filter(f => Math.abs(f.ms - z.ms) <= 6).length;
  const ok = !r.fehler && !a.fehler.length && aufZiel > 0;
  if (ok) continue;
  console.log('== ' + def.name + ' (' + def.stufe + ', Ziel ' + z.ms + ' ms)');
  if (r.fehler) {
    console.log('   BOT: ' + r.fehler + ' | ' + r.z.modus + ' tm=' + r.z.tm + ' y=' + r.z.y.toFixed(0) + ' vy=' + r.z.vy.toFixed(0));
    zeige(lvl, r.z.todBei, 'tod');
  }
  for (const f of a.fehler.slice(0, 2)) console.log('   AUDIT: ' + f);
  const schlecht = a.fenster.filter(f => f.ms < 150).slice(0, 3);
  for (const f of schlecht) {
    console.log('   FENSTER ' + f.ms.toFixed(0) + ' ms, ' + f.zellen + ' Zellen, modus=' + f.modus + ' sprung=' + f.sprung);
    zeige(lvl, f.bei, 'bei');
  }
  if (!r.fehler && aufZiel === 0) {
    const engsten = a.fenster.slice().sort((p, q) => p.ms - q.ms).slice(0, 3)
      .map(f => f.ms.toFixed(0) + '@' + Math.round(f.bei)).join(' ');
    console.log('   KEIN FENSTER auf Ziel. engste: ' + engsten);
  }
}
