/* negitivprobe.js — beweist, dass suite.js ueberhaupt Zaehne hat.
   Dauerhafte Arbeitsanweisung: jeder neue Test wird mit einer Negativprobe
   gesichert, bevor er als gruen gilt. Vorgehen: echten Code auf den alten bzw.
   kaputten Stand patchen, der Test MUSS dann FEHLER melden, Backup zurueck und
   mit diff -q bestaetigen.

   Die Proben patchen eine KOPIE von src/ in .probe/, niemals den echten Stand.
   Saemtliche String-Literals sind einzeilig: zweizeilige Literale sind beim
   Editieren dreimal zu echten Umbruechen geworden und damit Syntaxfehler, die
   der Test selbst nicht mehr melden konnte.

   Zwei Blindheiten der ersten Fassung sind hier festgehalten, weil sie genau
   die alte Lehre getroffen haben:
   - Eine Probe patchte die Messung im Audit und blieb gruen. Ein fehlender
     Kontakt macht ein Fenster GROSS, nicht klein, und die Schmerzgrenze faengt
     nur kleine. Dieselbe Regel wirkt auch im Builder, und dort kann der Bot sie
     pruefen — also wurde dort gepatcht. Eine blinde Probe ist erst ein Beweis
     ueber den Test, nie ueber den Code.
   - Eine Probe patchte die Roehren-Grenze der Builder-Wache von 7 auf 9 Zellen.
     Kein Level hat eine Summe ueber 7, der Patch war folgenlos. Unerreichbare
     Pruefungen hoehren an einem kuenstlichen Fall geprueft, nicht an einem echten. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WURZEL = path.join(__dirname, '..');
const PROBEN = path.join(WURZEL, '.probe');
const ZEILEN = /\r?\n/;

let anzahl = 0;
const Faelle = [
  {
    name: 'Fenster misst eine Zelle zu knapp',
    datei: 'spiel.js',
    alt: 'kontakt = gr.landung ? gr.anfang : Math.max(kontakt, gr.ende);',
    neu: 'kontakt = gr.landung ? gr.anfang + CELL : Math.max(kontakt, gr.ende) + CELL;',
    erwartet: 'Zielfenster',
    warum: 'Der g()-Versatz: Bauende und Audit massen verschieden.',
  },
  {
    name: 'Schiff steigt statt zu fallen',
    datei: 'spiel.js',
    alt: 'const beschl = (halten ? -SCHIFF_ACC : SCHIFF_GRAV) * z.grav;',
    neu: 'const beschl = (halten ? SCHIFF_ACC : SCHIFF_GRAV) * z.grav;',
    erwartet: 'Bot:',
    warum: 'Beide Zweige positiv: kein Signal konnte das Schiff steigen lassen.',
  },
  {
    name: 'Sprunfort aus der JETZIGEN Geschwindigkeit gerechnet',
    datei: 'spiel.js',
    alt: 'z.plan = stufe;',
    neu: 'z.plan = z.x + stufe * SPD * z.tm * FIXED_DT;',
    erwartet: 'Bot:',
    warum: 'TAKTWECHSEL plante bei 2086, der Sprung geschah bei 2082,5.',
  },
  {
    name: 'Landeflaeche zaehlt ab ihrer Rechtseite',
    datei: 'physik.js',
    alt: 'kontakt = letzte.landung ? letzte.anfang : letzte.ende;',
    neu: 'kontakt = letzte.ende;',
    erwartet: 'Zielfenster',
    warum: 'Ein Block von zwei Zellen verschob alles um zwei Zellen.',
  },
  {
    name: 'Portal und Schwerkraft-Kipp erhoehen den Kontakt nicht',
    datei: 'physik.js',
    alt: 'if (istWechsel(teil.t)) kontakt = Math.max(kontakt, teil.z + 1);',
    neu: 'if (false) kontakt = Math.max(kontakt, teil.z + 1);',
    erwartet: 'Bot:',
    warum: 'Nach einem Wechsel beginnt der Flug von vorn.',
  },
  {
    name: 'Roehre mit einer Zelle Gasse im echten Level',
    datei: 'level.js',
    alt: 'folge(p, 6, 3, roehre(3, 4)); p.g(6);',
    neu: 'folge(p, 6, 3, function (q) { q.pillar(4, 1); q.pillar(5, 0); }); p.g(6);',
    erwartet: 'Schiff-Durchlass',
    warum: 'Der Ur-Fall: 36 px Durchlass galten als fahrbar fuer 30 px.',
  },
];

function srcKopie(fallNr) {
  const ordner = path.join(PROBEN, 'fall' + fallNr);
  fs.rmSync(ordner, { recursive: true, force: true });
  fs.mkdirSync(path.join(ordner, 'src'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'test'), { recursive: true });
  for (const f of fs.readdirSync(path.join(WURZEL, 'src'))) {
    fs.copyFileSync(path.join(WURZEL, 'src', f), path.join(ordner, 'src', f));
  }
  fs.copyFileSync(path.join(WURZEL, 'test', 'suite.js'), path.join(ordner, 'test', 'suite.js'));
  return ordner;
}

fs.rmSync(PROBEN, { recursive: true, force: true });
fs.mkdirSync(PROBEN, { recursive: true });

let okay = 0, blind = 0, defekt = 0;
Faelle.forEach(function (f, i) {
  const ordner = srcKopie(i);
  const pfad = path.join(ordner, 'src', f.datei);
  const quelltext = fs.readFileSync(pfad, 'utf8');
  const treffer = quelltext.split(f.alt).length - 1;
  if (treffer === 0) {
    console.log('VORLAGE FEHLT   ' + f.name + ' — Codeschnipsel nicht mehr auffindbar');
    defekt++;
    return;
  }
  fs.writeFileSync(pfad, quelltext.replace(f.alt, f.neu));
  if (fs.readFileSync(pfad, 'utf8') === quelltext) {
    console.log('PATCH WIRKUNGSLOS  ' + f.name);
    defekt++;
    return;
  }
  let meldung = '', rot = false;
  try {
    meldung = execFileSync(process.execPath, [path.join(ordner, 'test', 'suite.js')],
      { encoding: 'utf8', cwd: ordner });
  } catch (e) {
    meldung = String(e.stdout || '') + String(e.stderr || '');
    rot = true;
  }
  const zeile = meldung.split(ZEILEN).filter(function (l) { return l.includes(f.erwartet); })[0];
  if (rot && zeile) {
    console.log('ZAHN OK   ' + f.name + '   (Vorlage ' + treffer + 'x im Stand)');
    console.log('          meldet: ' + zeile.trim().slice(0, 92));
    okay++;
  } else {
    console.log('BLIND !!  ' + f.name + ' — Suite blieb ' + (rot ? 'rot ohne den erwarteten Grund' : 'GRUEN'));
    console.log('          ' + f.warum + '  | erwartet enthielt: ' + f.erwartet);
    blind++;
  }
});

/* Zweite Serie: das ausgelieferte Artefakt. test/buendel.js prueft dist/gd.html,
   und ein gruener Kern-Test sagt ueber dieses Artefakt nichts aus — darum wird
   hier nicht src/ gepatcht, sondern die fertige Datei. Die Faelle sind die
   typischen stillen Buildfehler: ein Modul reicht sein Exportobjekt nicht
   weiter, ein Modul fehlt, ein Level fehlt. */
const BUENDEL = path.join(WURZEL, 'dist', 'gd.html');
if (!fs.existsSync(BUENDEL)) {
  console.log('dist/gd.html fehlt — Gebaeude-Pruefung uebersprungen (erst build.js laufen lassen)');
} else {
  const echt = fs.readFileSync(BUENDEL, 'utf8');
  var Gebaeude = [
    { name: 'eine Zellkante im Buendel versetzt sich um sechs px',
      alt: 'const CELL = 36;', neu: 'const CELL = 30;',
      erwartet: 'CELL im Buendel' },
    { name: 'ein Modul fehlt im Buendel',
      alt: '/* ==== src/render.js ==== */', neu: '/* ==== src/fehitl.js ==== */',
      erwartet: 'src/render.js fehlt' },
    { name: 'ein Level fehlt im ausgelieferten Buendel',
      alt: 'module.exports = { LEVEL, STUFEN,',
      neu: 'module.exports = { LEVEL: LEVEL.slice(0, 12), STUFEN,',
      erwartet: 'erwartet 13' },
    { name: 'die Huelle behaelt ihren Platzhalter',
      alt: '<canvas id="buehne"', neu: '<!--BAU--><canvas id="buehne"',
      erwartet: 'Platzhalter' },
    { name: 'das Fenster zeigt ein anderes Level als angeschaltet',
      alt: 'waehle(0);', neu: 'waehle(4);',
      erwartet: 'Titel zeigt nicht das erste Level' },
  ];
  Gebaeude.forEach(function (f, i) {
    const treffer = echt.split(f.alt).length - 1;
    if (treffer === 0) {
      console.log('VORLAGE FEHLT   [Gebaeude] ' + f.name);
      defekt++;
      return;
    }
    const kaputt = echt.replace(f.alt, f.neu);
    if (kaputt === echt) {
      console.log('PATCH WIRKUNGSLOS  [Gebaeude] ' + f.name);
      defekt++;
      return;
    }
    const pfad = path.join(PROBEN, 'buendel-' + i + '.html');
    fs.writeFileSync(pfad, kaputt);
    let meldung = '', rot = false;
    try {
      meldung = execFileSync(process.execPath, [path.join(WURZEL, 'test', 'buendel.js'), pfad],
        { encoding: 'utf8' });
    } catch (e) {
      meldung = String(e.stdout || '') + String(e.stderr || '');
      rot = true;
    }
    const zeile = meldung.split(ZEILEN).filter(function (l) { return l.includes(f.erwartet); })[0];
    if (rot && zeile) {
      console.log('ZAHN OK   [Gebaeude] ' + f.name);
      console.log('          meldet: ' + zeile.trim().slice(0, 92));
      okay++;
      anzahl++;
    } else {
      console.log('BLIND !!  [Gebaeude] ' + f.name + ' — blieb ' + (rot ? 'rot ohne den erwarteten Grund' : 'GRUEN'));
      console.log('          erwartet enthielt: ' + f.erwartet);
      blind++;
      anzahl++;
    }
  });
}

/* Gegenprobe: ohne Patch muss die Suite gruen sein, sonst ist der Beweis nichts. */
let grundGruen = false;
try { execFileSync(process.execPath, [path.join(WURZEL, 'test', 'suite.js')], { encoding: 'utf8' }); grundGruen = true; }
catch (e) { grundGruen = false; }
console.log('---');
console.log('ungepatchte Suite: ' + (grundGruen ? 'gruen (erwartet)' : 'ROT — Fehler!'));
console.log(okay + ' von ' + (Faelle.length + anzahl) + ' Negativproben melden korrekt'
  + (blind ? ', ' + blind + ' BLIND' : '') + (defekt ? ', ' + defekt + ' unbrauchbar' : ''));
fs.rmSync(PROBEN, { recursive: true, force: true });
process.exit(blind === 0 && defekt === 0 && grundGruen ? 0 : 1);
