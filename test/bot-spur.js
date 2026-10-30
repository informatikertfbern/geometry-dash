/* bot-spur.js — zeigt, was der Bot kurz vor einem Tod tut. Der Fall aus der
   letzten Runde: ein gruener Test kann eine falsche Messlogik haben, und ein
   roter Test kann einen Bot-Bug haben, den das Level nicht verdient. Ohne diese
   Spur war der Fehler nicht zu finden. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

const name = process.argv[2] || 'TAKTWECHSEL';
const def = L.LEVEL.find(d => d.name === name);
if (!def) { console.log('Level nicht gefunden: ' + name); process.exit(1); }

const lvl = P.baue(def);
const r = S.fahre(lvl);
console.log(name + ': ' + (r.fehler || 'gefahren') + '  y=' + r.z.y.toFixed(0));
if (!r.fehler) process.exit(0);

const tod = r.z.todBei;
const z = S.zustandNeu(lvl);
let halten = 0;
for (let i = 0; i < 400000 && !z.tot && !z.durch; i++) {
  const e = S.bot(z);
  if (tod - z.x < 420 && tod - z.x > -20 && i % 8 === 0) {
    const g = S.gruppen ? null : null;
    console.log('x=' + z.x.toFixed(0).padStart(5) + ' bis=' + (tod - z.x).toFixed(0).padStart(4)
      + ' y=' + z.y.toFixed(0).padStart(4) + ' vy=' + z.vy.toFixed(0).padStart(5)
      + ' an=' + (z.anBoden ? 1 : 0) + ' plan=' + (z.plan === null ? '-' : z.plan.toFixed(0))
      + ' klick=' + e.klick + ' mod=' + z.modus + ' tm=' + z.tm);
  }
  S.schritt(z, e.klick, e.halten);
}

/* Jede einzelne Tipp-Stufe, die der Bot an der Todesstelle gehabt haette. */
console.log('\nTipp-Stufen an der Todesstelle (von=frueh, hoch=spaet):');
const probe = S.zustandNeu(lvl);
for (let i = 0; i < 400000 && !probe.tot && !probe.durch; i++) {
  if (tod - probe.x < 130 && probe.anBoden) {
    const zeilen = [];
    for (let s = 0; s <= 40; s++) if (S.rolleMitSprung(probe, s)) zeilen.push(s);
    console.log('  x=' + probe.x.toFixed(0) + ' gangbare Stufen: ' + (zeilen.length ? zeilen.join(',') : 'KEINE'));
    break;
  }
  const e = S.bot(probe);
  S.schritt(probe, e.klick, e.halten);
}
