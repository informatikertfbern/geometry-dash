/* wechsel-wirkung.js — bewiesen oder widerlegt: hat die Regel «Portal und
   Schwerkraft-Kipp erhoehen den Kontakt» ueberhaupt eine Auswirkung? Die
   Negativprobe meldete dafuer BLIND. Zwei Erklaerungen, und die Antwort ist eine
   Ansage wert, keine Vermutung:
     a) die Regel ist toter Code, oder
     b) die Suite beruehrt sie nicht, die Regel ist aber richtig.
   Fall b waere kein Fehler der Regel, sondern ein Loch im Test: dann gehoert ein
   Kuenstlicher Fall in die Negativprobe, der sie verletzt. */
const P = require('../src/physik.js');
const S = require('../src/spiel.js');
const L = require('../src/level.js');

/* Die Variante ohne Wechsel-Regel, mit denselben Bausteinen nachgerechnet. */
function fensterOhneWechsel(level) {
  const gruppen = S.hindernisse(level);
  let kontakt = P.START_X;
  const out = [];
  for (const gr of gruppen) {
    const zellen = (gr.anfang - kontakt) / P.CELL;
    if (zellen > 0.5) out.push({ bei: gr.anfang, zellen });
    kontakt = gr.landung ? gr.anfang : Math.max(kontakt, gr.ende);
  }
  return out;
}

let verschieden = 0;
for (const def of L.LEVEL) {
  const lvl = P.baue(def);
  const mit = S.audit(lvl).fenster;
  const ohne = fensterOhneWechsel(lvl);
  if (mit.length !== ohne.length) {
    console.log(def.name + ': Anzahl Fenster verschieden (' + mit.length + ' vs ' + ohne.length + ')');
    verschieden++;
    continue;
  }
  for (let i = 0; i < mit.length; i++) {
    if (Math.abs(mit[i].zellen - ohne[i].zellen) > 0.01) {
      verschieden++;
      console.log(def.name + ' @' + Math.round(mit[i].bei) + ': mit Regel ' + mit[i].zellen
        + ' Zellen, ohne ' + ohne[i].zellen);
    }
  }
}
console.log(verschieden === 0
  ? 'KEIN Fenster haengt an der Wechsel-Regel — sie ist fuer diese 13 Level folgenlos'
  : verschieden + ' Fenster haengen an der Regel');

/* Engpass-Audit an einer Kunst-Roehre: wenn kein Level sie beruehrt, muss ein
   kuenstlicher Fall sie beruehren, sonst ist die Pruefung unerwiesen. */
const kunst = P.baue({
  name: 'ENG', body(p) {
    p.portal(P.MODI.SCHIFF).g(4);
    p.pillar(4, 1); p.pillar(5, 0); p.g(4);   /* Gasse 10-4-5 = 1 Zelle = 36 px */
    p.fin();
  },
});
const bef = S.audit(kunst).fehler.filter(f => f.includes('Durchlass'));
console.log(bef.length ? 'Engpass-Audit greift an der Kunst-Roehre: ' + bef[0]
  : 'Engpass-Audit greift NICHT — Pruefung ist unerwiesen');
