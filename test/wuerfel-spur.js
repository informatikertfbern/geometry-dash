/* wuerfel-spur.js — warum tippt der Wuerfel-Bot nicht? Zeigt pro boden-nahe Schritt
   nahe dem Tod: rolle-tot? frueheste ueberlebende Tipp-Stufe? aktueller Plan.
   Ohne diese Spur bleibt es Raten, und Raten hat hier schon zwei Anlaeufe gekostet. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

const name = process.argv[2] || 'TAKTWECHSEL';
const def = L.LEVEL.find(d => d.name === name);
const lvl = P.baue(def);
const r = S.fahre(lvl);
console.log(name + ': ' + (r.fehler || 'gefahren'));
if (!r.fehler) process.exit(0);
const tod = r.z.todBei;
const spike = lvl.objs.filter(o => o.t === P.T.SPIKE && Math.abs(o.x - tod) < 300)
  .map(o => o.x).join(',');
console.log('Tod ' + tod + ' | Stacheln in der Nahe: ' + spike);

const z = S.zustandNeu(lvl);
for (let i = 0; i < 400000 && !z.tot && !z.durch; i++) {
  const e = S.bot(z);
  if (tod - z.x < 300 && tod - z.x > -10 && z.anBoden && i % 3 === 0) {
    const ohne = S.rolle(z);
    let stufen = [];
    for (let s = 0; s <= 60; s++) if (S.rolleMitSprung(z, s)) stufen.push(s);
    console.log('x=' + z.x.toFixed(0).padStart(5) + ' bis=' + (tod - z.x).toFixed(0).padStart(4)
      + ' rolleTot=' + (ohne.tot ? 'JA' : 'NEIN')
      + ' stufen=' + (stufen.length ? stufen[0] + '..' + stufen[stufen.length - 1] + '(' + stufen.length + ')'
        : 'KEINE')
      + ' plan=' + (z.plan === null ? '-' : z.plan.toFixed(0))
      + ' klick=' + e.klick);
  }
  S.schritt(z, e.klick, e.halten);
}
