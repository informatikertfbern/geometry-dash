/* erklaerung.js — erklaert jeden Bot-Fehler mit dem Zustand im Todesmoment.
   Steht im Projekt und nicht in /tmp, weil diese Umgebung /tmp verliert: der
   erste Projektstand ist genau dadurch verloren gegangen. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

const NAMEN = { 1: 'SPIKE', 2: 'BLOCK', 3: 'PLAT', 4: 'COIN', 5: 'PAD', 6: 'ORB',
  7: 'GRAV', 8: 'PORTAL', 9: 'SPD', 10: 'PILLAR', 11: 'FIN' };

function beschreibe(o) {
  let s = NAMEN[o.t] + '@' + Math.round(o.x);
  if (o.h) s += ' h' + (o.h / P.CELL);
  if (o.w) s += ' b' + (o.w / P.CELL);
  if (o.unten !== undefined) s += ' u' + o.unten;
  if (o.down) s += ' unten-um';
  if (o.y !== undefined && (o.t === P.T.PILLAR)) s += ' y' + Math.round(o.y);
  return s;
}

let rot = 0;
for (const def of L.LEVEL) {
  let lvl, r;
  try { lvl = P.baue(def); r = S.fahre(lvl); } catch (e) { console.log(def.name + ' BAU-FEHLER ' + e.message); rot++; continue; }
  if (!r.fehler) continue;
  rot++;
  const z = r.z, x = z.todBei;
  const nah = lvl.objs.filter(o => Math.abs(o.x - x) < 220).map(beschreibe).join('  ');
  console.log(def.name + ' | ' + r.fehler + ' | ' + z.modus + ' tm=' + z.tm + ' grav=' + z.grav + ' y=' + z.y.toFixed(0) + ' vy=' + z.vy.toFixed(0));
  console.log('    ' + nah);
}
console.log(rot === 0 ? 'keine Bot-Fehler' : rot + ' Level rot');
