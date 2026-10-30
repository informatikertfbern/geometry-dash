/* level.js — dreizehn Level.
   Jedes Level hat ein Stufenziel, und das Ziel ist keine Absichtserklaerung:
   `folge()` setzt den Abstand zwischen zwei Hindernisgruppen in Zellen, und die
   Physik uebersetzt den in Millisekunden. Welche Zellzahl fuer welche Stufe
   steht, ist in STUFEN nachgeschlagen, nicht gefuehlt.

   Zwei Regeln aus dem verlorenen Vorlaeufer sind hier eingebaut, weil sie sich
   bewaehrt haben:
   - Die beiden hoechsten Stufen brauchen das Stufenziel mindestens ZWEIMAL. Ein
     einzengstes Fenster ist ein Ausreisser, keine Eigenschaft eines Levels.
   - Die Laenge ist eine gepflegte Eigenschaft. Umbauten muessen zellneutral sein.
*/

const PH = (typeof require !== 'undefined') ? require('./physik.js') : window;
const { CELL, MODI, SPD } = PH;
const WUERFEL = MODI.WUERFEL, SCHIFF = MODI.SCHIFF, BALL = MODI.BALL, WELLE = MODI.WELLE;

/* Ziel-Fenster in ms und das Tempo, bei dem es gebaut wird. */
const STUFEN = {
  EASY:      { ms: 526, tm: 1,    zellen: 10 },
  NORMAL:    { ms: 311, tm: 1,    zellen: 8 },
  'NORMAL+': { ms: 311, tm: 1,    zellen: 8 },
  HARD:      { ms: 266, tm: 1.32, zellen: 10 },
  'HARD+':   { ms: 266, tm: 1.32, zellen: 10 },
  EXTREM:    { ms: 184, tm: 1.32, zellen: 9 },
  WAHNSINN:  { ms: 168, tm: 1.5,  zellen: 10 },
};

/* Setzt n Hindernisgruppen mit exakt `zellen` Abstand dazwischen. Der Abstand
   kommt aus p.luecke(), das ihn gegen dieselbe Gruppengrenze rechnet, die auch
   das Audit benutzt. Vorher stand hier eine eigene g()-Rechnung, und die traf
   die Stufe nur, wenn keine Gruppe eine Landflaeche hatte: ein Block von zwei
   Zellen verschob alles um zwei Zellen, und EASY baute 419 ms statt 526. */
function folge(p, zellen, n, baue_gruppe) {
  for (let i = 0; i < n; i++) {
    p.luecke(zellen);
    baue_gruppe(p, i);
  }
  return p;
}

/* Erste Gruppe nach einem Portal, abgesetzt von den folgenden. Zwei verschiedene
   Abstaende, weil zwei verschiedene Dinge zaehlen:
   - Zwischen zwei Hindernissen zaehlt der Abstand ab der letzten Gruppe. Das
     besorgt luecke(), und das ist auch die Messung des Audits.
   - Die ERSTE Gruppe nach einem Moduswechsel hat kein vorheriges Hindernis, das
     zaehlt: das Schiff beginnt auf dem Boden und muss erst steigen. Waere die
     erste Saeule zu hoch oder zu nah, existiert der Weg nicht. EREIGNISHORIZONT
     war genau dort gebaut und der Bot starb bei 26 % — nicht an Schwierigkeit,
     sondern an Physik. Ein luecke() kann das nicht setzen, es misst vom letzten
     Hindernis, und das liegt vor einem Portal weit zurueck; der Wert verpufft.
     Darum hier ein echter Baustrich-Abstand. */
function folgeAnflug(zellen, anflug, n, baue_gruppe, baue_erste) {
  return p => {
    p.g(anflug - 1);
    baue_erste(p, 0);
    for (let i = 1; i < n; i++) {
      p.luecke(zellen);
      baue_gruppe(p, i);
    }
  };
}

/* Stachelgruppe der Breite b. */
function stacheln(b) { return p => p.spike(b); }

/* Block zum Draufspringen: eine Gruppe mit Landflaeche. */
function mauern(h, b) { return p => p.block(h, b); }

/* Schiffsroehre: ein Bodenpfeiler und ein Deckenpfeiler, dazwischen die Gasse.
   Die Summe beider Haehe darf 7 Zellen nicht ueberschreiten, denn derSpieler ist
   30 px = 0.83 Zellen hoch und eine Zelle Gasse laesst 3 px je Seite. Ein Audit
   meldete `Durchlass nur 36 px, Spieler ist 30 px` — die Roehre war formal
   fahrbar und praktisch ein Zufallstreffer. */
function roehre(unten, oben) {
  return p => {
    if (unten + oben > 7) {
      throw new Error(`roehre(${unten},${oben}): Gasse nur ${10 - unten - oben} Zellen, verlangt mindestens 3`);
    }
    p.pillar(unten, 1).pillar(oben, 0);
  };
}

function dach(b) { return p => p.spikeDown(b); }

const LEVEL = [
  /* 1 — EASY: weite Abstaende, nur Wuerfel, eine Münze auf der Sprungkuppe. */
  {
    name: 'ERSTFLUG', stufe: 'EASY', bpm: 112, thema: 'Morgenblau',
    farben: { grund: '#12203a', boden: '#2f6fb0', akzent: '#7fd4ff', spieler: '#ffffff' },
    body(p) {
      p.g(8);
      folge(p, 10, 3, stacheln(1)); p.g(10);
      p.coin(3); p.g(7);
      folge(p, 10, 2, stacheln(2)); p.g(9);
      p.block(2, 2).g(7); p.coin(3).g(6);
      folge(p, 10, 2, stacheln(2)); p.g(10);
      p.pad().g(2).spike(2).g(9);
      p.fin();
    },
  },

  /* 2 — NORMAL: erster Tempowechsel, erste Roehre. */
  {
    name: 'ZONENWECHSEL', stufe: 'NORMAL', bpm: 124, thema: 'Zwei Welten',
    farben: { grund: '#1b1430', boden: '#7a4fd0', akzent: '#ffd166', spieler: '#fff3c4' },
    body(p) {
      p.g(8);
      folge(p, 8, 3, stacheln(2)); p.g(8); p.coin(3).g(6);
      folge(p, 8, 2, mauern(2, 2)); p.g(8);
      p.portal(SCHIFF).g(3);
      folge(p, 6, 4, roehre(4, 3)); p.g(6);
      folge(p, 6, 3, roehre(4, 3)); p.g(5);
      p.portal(WUERFEL).g(4); p.coin(3).g(5);
      folge(p, 8, 3, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 3 — NORMAL+ : Ring-Kombi, Deckenstacheln. */
  {
    name: 'DELTA', stufe: 'NORMAL+', bpm: 130, thema: 'Stromteilung',
    farben: { grund: '#06232a', boden: '#1f9c8f', akzent: '#8ef0d2', spieler: '#eafff9' },
    body(p) {
      p.g(8);
      folge(p, 8, 2, stacheln(2)); p.g(8); p.coin(3).g(5);
      p.orb(4).g(3).spike(3).g(8);
      folge(p, 8, 2, stacheln(2)); p.luecke(8);
      p.block(2, 2).luecke(8).dach(2).g(8);
      p.orb(4).g(4).spike(2).g(8); p.coin(3).g(5);
      folge(p, 8, 2, stacheln(3)); p.g(9);
      p.fin();
    },
  },

  /* 4 — NORMAL+ : Taktwechsel als Tempo-Portalpaar. */
  {
    name: 'TAKTWECHSEL', stufe: 'NORMAL+', bpm: 138, thema: 'Halb so schnell',
    farben: { grund: '#2a1020', boden: '#d0466e', akzent: '#ffb3c6', spieler: '#fff0f4' },
    body(p) {
      p.g(8);
      folge(p, 8, 3, stacheln(2)); p.g(6); p.coin(3).g(5);
      p.spd('slow').g(4);
      folge(p, 14, 3, stacheln(2)); p.g(12); p.coin(2).g(10);
      p.spd('normal').g(4);
      folge(p, 8, 3, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 5 — HARD: Ball-Abschnitt, Schwerkraft. */
  {
    name: 'NEONABSTURZ', stufe: 'HARD', bpm: 150, thema: 'Fallhuehe',
    farben: { grund: '#0b0620', boden: '#b026d3', akzent: '#ff5bf0', spieler: '#f6d9ff' },
    body(p) {
      p.g(8); p.spd('fast').g(3);
      folge(p, 10, 3, stacheln(2)); p.g(9); p.coin(3).g(7);
      p.portal(BALL).g(4);
      folge(p, 9, 4, i => i % 2 ? p.spikeDown(2).g(0) : p.spike(2)); p.g(6);
      p.portal(WUERFEL).g(4); p.grav().g(3);
      folge(p, 10, 2, dach(2)); p.g(6); p.grav().g(4);
      folge(p, 10, 2, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 6 — HARD: dichte Roehren, zwei enge Fenster. */
  {
    name: 'SCHATTENLAUF', stufe: 'HARD', bpm: 152, thema: 'Korridor',
    farben: { grund: '#0a0f14', boden: '#3d5a6c', akzent: '#9ad7ff', spieler: '#dff2ff' },
    body(p) {
      p.g(8); p.spd('fast').g(3);
      folge(p, 10, 4, stacheln(2)); p.g(9); p.coin(3).g(7);
      p.portal(SCHIFF).g(3);
      folge(p, 5, 5, roehre(3, 3)); p.g(5);
      folge(p, 5, 4, roehre(4, 3)); p.g(6);
      p.portal(WUERFEL).g(4); p.spd('normal').g(3);
      folge(p, 8, 2, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 7 — HARD+ : Pad-Kette ueber eine Stachelfront. */
  {
    name: 'KERNZONE', stufe: 'HARD+', bpm: 158, thema: 'Reaktor',
    farben: { grund: '#1d1405', boden: '#e08a1e', akzent: '#ffd479', spieler: '#fff4d6' },
    body(p) {
      p.g(8); p.spd('fast').g(3);
      folge(p, 10, 2, stacheln(2)); p.g(9);
      p.pad().g(2).spike(3).g(6);
      folge(p, 10, 3, stacheln(3)); p.g(8); p.coin(3).g(7);
      p.block(2, 2).luecke(10).spike(2).g(6);
      p.pad().g(2).spike(3).g(10);
      p.fin();
    },
  },

  /* 8 — EXTREM: enges Fenster zweimal, Welle. */
  {
    name: 'SALZWERK', stufe: 'EXTREM', bpm: 168, thema: 'Kristall',
    farben: { grund: '#101820', boden: '#cfe6f2', akzent: '#6fb7d8', spieler: '#20303c' },
    body(p) {
      p.g(8); p.spd('fast').g(3);
      folge(p, 9, 2, stacheln(2)); p.g(9);
      p.coin(3).g(6);
      folge(p, 9, 2, stacheln(2)); p.g(8);
      p.portal(WELLE).g(4);
      folge(p, 7, 4, i => i % 2 ? p.pillar(4, 0) : p.pillar(4, 1)); p.g(6);
      p.portal(WUERFEL).g(4); p.spd('normal').g(3);
      folge(p, 8, 2, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 9 — EXTREM: Roehren mit gleichem Muster verboten, variierte Gassen. */
  {
    name: 'SPIEGELHALL', stufe: 'EXTREM', bpm: 172, thema: 'Wiederschein',
    farben: { grund: '#141026', boden: '#5b4bc4', akzent: '#c9b8ff', spieler: '#f1ecff' },
    body(p) {
      p.g(8); p.spd('fast').g(3);
      folge(p, 9, 3, mauern(2, 2)); p.g(9); p.coin(3).g(6);
      p.portal(SCHIFF).g(3);
      folge(p, 5, 3, roehre(3, 4)); p.g(6);
      folge(p, 6, 3, roehre(4, 3)); p.g(5);
      folge(p, 5, 2, roehre(3, 3)); p.g(6);
      p.portal(WUERFEL).g(4); p.spd('normal').g(3);
      folge(p, 9, 2, stacheln(2)); p.g(9);
      p.fin();
    },
  },

  /* 10 — EXTREM: Ring-Ketten im Turbo. */
  {
    name: 'ZENIT', stufe: 'EXTREM', bpm: 176, thema: 'Hoechststand',
    farben: { grund: '#04121c', boden: '#0f7fa8', akzent: '#7fe3ff', spieler: '#e8fbff' },
    body(p) {
      p.g(8);
      folge(p, 8, 3, stacheln(2)); p.g(7); p.coin(3).g(5);
      p.spd('fast').g(3);
      p.orb(4).g(3).spike(2).g(6);
      p.orb(4).g(3).spike(2).g(7);
      folge(p, 9, 3, stacheln(2)); p.luecke(9);
      /* Einzelne Stellen ausserhalb von folge() waren die Fehlerquelle in ZENIT,
         HAMMWERK und KERNZONE: ein Hand-g(n) setzt den Baustrich hinter der
         Gruppe, das Fenster aber wird ab der Gruppengrenze gemessen. Bei einem
         Block von zwei Zellen differieren beide um genau zwei Zellen, und die
         Stelle kam bei 21 ms statt 184 heraus. */
      p.spike().block(1, 2); p.luecke(9).spike(2); p.luecke(9).spike(2); p.g(9);
      p.fin();
    },
  },

  /* 11 — WAHNSINN: blitz, engstes Fenster mehrfach. */
  {
    name: 'ABGRUND', stufe: 'WAHNSINN', bpm: 190, thema: 'Tiefstand',
    farben: { grund: '#05070d', boden: '#243447', akzent: '#5f8cb5', spieler: '#e9f1fb' },
    body(p) {
      p.g(9); p.spd('blitz').g(4);
      folge(p, 10, 2, stacheln(2)); p.g(9);
      p.portal(SCHIFF).g(3);
      folge(p, 6, 4, roehre(3, 3)); p.g(6);
      p.portal(WUERFEL).g(5);
      folge(p, 10, 3, stacheln(2)); p.g(8); p.coin(3).g(8);
      p.fin();
    },
  },

  /* 12 — WAHNSINN: Haemmmer, also Wechsel aus Einzel und Front. */
  {
    name: 'HAMMWERK', stufe: 'WAHNSINN', bpm: 196, thema: 'Schmiede',
    farben: { grund: '#1a0d08', boden: '#a8451f', akzent: '#ff9d5c', spieler: '#ffe8d6' },
    body(p) {
      p.g(9); p.spd('blitz').g(4);
      folge(p, 10, 2, stacheln(2)); p.luecke(10);
      p.spike(2); p.luecke(10).spike().block(1, 2); p.luecke(10).spike(2); p.g(9);
      p.coin(3).g(7);
      p.spd('fast').g(3);
      folge(p, 9, 3, stacheln(3)); p.g(8);
      p.fin();
    },
  },

  /* 13 — WAHNSINN: letztes Level, alle Modi. */
  {
    name: 'EREIGNISHORIZONT', stufe: 'WAHNSINN', bpm: 200, thema: 'Kein Zurueck',
    farben: { grund: '#000004', boden: '#3a1f6e', akzent: '#ff3d81', spieler: '#ffe9f2' },
    body(p) {
      p.g(9); p.spd('blitz').g(4);
      folge(p, 10, 3, stacheln(2)); p.g(8);
      p.portal(SCHIFF).g(3);
      folgeAnflug(5, 9, 3, roehre(4, 3), roehre(3, 3))(p); p.g(6);
      folge(p, 6, 3, roehre(3, 4)); p.g(6);
      p.portal(WUERFEL).g(5); p.spd('fast').g(3);
      p.orb(4).g(3).spike(2).g(6);
      p.pad().g(2).spike(3).g(6);
      folge(p, 9, 2, stacheln(3)); p.g(7); p.coin(3).g(6);
      p.fin();
    },
  },
];

function alleLevel(baue) {
  return LEVEL.map(def => baue(def));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVEL, STUFEN, folge, folgeAnflug, alleLevel, stacheln, mauern, roehre, dach };
}
