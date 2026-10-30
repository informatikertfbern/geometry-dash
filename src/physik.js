/* physik.js — Masse, Bauplan, Grundgeruest.
   Neu geschrieben am 2026-10-29 nach dem Verlust des Originals. Die Masse sind
   die geretteten Werte des alten Projekts, damit die Schwierigkeitsleiter auf
   dieselben Millisekunden kommt.

   Koordinatensystem: y zeigt nach unten (Canvas). Der Boden liegt auf GROUND,
   die Decke auf CEIL. Dazwischen sind es genau 10 Zellen.

   BAU-REGELN, die man kennen muss, bevor man Level schreibt:
     g(n)        schiebt den Baustrich um n+1 Zellen vor, nicht um n.
     spike(k)    k Stacheln nebeneinander, belegt k Zellen.
     block(h, w) erste Zahl = HOEHE in Zellen, zweite = BREITE.
     plat(h, w)    Plattform, Oberkante h Zellen ueber dem Boden.
     pillar(h, b) Schiff-Pfeiler; b=1 waechst vom Boden, b=0 haengt von der Decke.
     coin(s)     Münze in Höhe s Zellen; s=3 liegt auf der Sprungkuppe.
   Diese Regeln stehen hier und nicht im Prosakommentar eines Levels, weil das
   alte Projekt an genau so einer Unklarheit einen falschen Umbau gebaut hat. */

const CELL = 36;                 /* Kantenlaenge einer Zelle in px */
const SPD = 335;                 /* Grundgeschwindigkeit in px/s */
const GRAV = 2480;               /* Fallbeschleunigung */
const JUMP_V = 680;              /* Absprunggeschwindigkeit */
const PAD_V = 1146;              /* Absprunggeschwindigkeit eines Startpads */
const ORB_V = 1000;              /* Absprunggeschwindigkeit eines Rings */
const JUMP_AIR = 2 * JUMP_V / GRAV;              /* 0.548 s Flugzeit */
const JUMP_DIST = JUMP_AIR * SPD;                /* 183.7 px weit */
const JUMP_HOEHE = JUMP_V * JUMP_V / (2 * GRAV); /* 93.2 px hoch */

const SCHIFF_ACC = 2600, SCHIFF_MAX = 520, SCHIFF_GRAV = 1300, SCHIFF_KICK = 250;
const BALL_K = 900;              /* Ball: Absprung beim Druck an der Wand */
const WELLE_STEIG = 300;         /* Welle: 45 Grad, also px/s in beide Richtungen */

const FIXED_DT = 1 / 240;
const JBUF = 0.16;               /* Sprungvorwahl */
const COYOTE = 0.07;             /* Restzeit nach dem Bodenkontakt */
const DEATH_T = 0.34;            /* Pause nach dem Tod */

const BREITE = 960, HOEHE = 540;
const GROUND = 452;              /* Oberkante Boden */
const SPIELRAUM = 10 * CELL;     /* 360 px = 10 Zellen */
const CEIL = GROUND - SPIELRAUM; /* 92 */
const START_X = 260;             /* der Spieler startet hier, Kamera bleibt */
const P = 30;                    /* Spielerkante */

const TEMPO = { slow: 0.72, normal: 1, fast: 1.32, blitz: 1.5 };
const MODI = { WUERFEL: 'cube', SCHIFF: 'ship', BALL: 'ball', WELLE: 'wave' };

/* Objektarten */
const T = {
  SPIKE: 1, BLOCK: 2, PLAT: 3, COIN: 4, PAD: 5, ORB: 6, GRAV: 7,
  PORTAL: 8, SPD: 9, PILLAR: 10, FIN: 11,
};

/* Reaktionsfenster: die Zeit zwischen Landung und naechster Wand. Das ist die
   Groesse, die der Mensch spaet, und die einzige, die eine Stufe vergleichen
   kann. g = Abstand in Zellen, tm = Tempo-Faktor. */
function fensterSekunden(zellen, tm) {
  return (zellen * CELL - JUMP_DIST * tm) / (SPD * tm);
}

/* Der weiteste Sprung, den das Audit erlaubt: im Turbo traegt er kuerzer, weil
   die Zeit zwischen zwei Gruppen knapp wird. */
function tragweite(tm) {
  return JUMP_DIST * tm * (tm > 1 ? 0.42 : 0.55);
}

/* ---------------- Bauplan ---------------- */

/* Eine Hindernisgruppe: zusammenhängende Teile sind EIN Hindernis. Diese eine
   Definition benutzen sowohl der Builder (luecke) als auch das Audit (fenster).
   Zwei eigeneGruppendefinitionen waeren wieder zwei Ergebnisse — genau der
   Fehler, der im alten Projekt ein Fenster von -441 ms ergab. */
function istHindernis(t) {
  return t === T.SPIKE || t === T.PILLAR || t === T.BLOCK || t === T.PLAT;
}

/* Breite eines Teils in Zellen. */
function zellenBreite(teil) {
  if (teil.t === T.BLOCK || teil.t === T.PLAT) return teil.w;
  return 1;
}

function gruppenVon(teile) {
  const gruppen = [];
  for (const teil of teile) {
    if (!istHindernis(teil.t)) continue;
    const anfang = teil.z, ende = teil.z + zellenBreite(teil);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && anfang <= letzte.ende) {
      letzte.ende = Math.max(letzte.ende, ende);
      letzte.landung = letzte.landung || teil.t === T.BLOCK || teil.t === T.PLAT;
    } else {
      gruppen.push({ anfang, ende, landung: teil.t === T.BLOCK || teil.t === T.PLAT });
    }
  }
  return gruppen;
}

/* Zelle, ab der der Spieler wieder frei entscheiden kann. Ein Portal und ein
   Schwerkraft-Wechsel zaehlen mit: ab ihnen ist der Spieler neu ausgerichtet und
   kann fruehestens von dort neu handeln. Wird der Wechsel ignoriert, misst der
   Bauende den Anflug einer Gruppe vom letzten Hindernis VOR dem Portal — der
   Spieler faellt aber gerade um. NEONABSTURZ ist so durchgekommen: zwoelf Zellen
   Anflug gemessen, in Wahrheit stand der Spieler nach dem Kipp noch nicht. */
function istWechsel(t) { return t === T.PORTAL || t === T.GRAV; }

function kontaktZelle(teile) {
  let kontakt = 0;
  const gruppen = gruppenVon(teile);
  if (gruppen.length) {
    const letzte = gruppen[gruppen.length - 1];
    kontakt = letzte.landung ? letzte.anfang : letzte.ende;
  }
  for (const teil of teile) {
    if (istWechsel(teil.t)) kontakt = Math.max(kontakt, teil.z + 1);
  }
  return kontakt;
}

class Bauplan {
  constructor() {
    this.zelle = 0;
    this.teile = [];
  }

  /* Baustrich vorziehen. n+1 Zellen, siehe BAU-REGELN oben. */
  g(n) { this.zelle += n + 1; return this; }

  /* Setzt den Baustrich so, dass bis zum nächsten Hindernis exakt `zellen`
     Zellen frei bleiben — gemessen ab der Stelle, ab der der Spieler wieder frei
     ist. Damit baut ein Level sein Fenster, statt zu hoffen, dass g() es trifft. */
  luecke(zellen) {
    this.zelle = Math.max(this.zelle, kontaktZelle(this.teile) + zellen);
    return this;
  }

  spike(k = 1) {
    for (let i = 0; i < k; i++) this.teile.push({ t: T.SPIKE, z: this.zelle + i });
    this.zelle += k; return this;
  }

  spikeDown(k = 1) {
    for (let i = 0; i < k; i++) this.teile.push({ t: T.SPIKE, z: this.zelle + i, down: true });
    this.zelle += k; return this;
  }

  /*.block(h, w) — erste Zahl Hoehe, zweite Breite. */
  block(h, w) {
    this.teile.push({ t: T.BLOCK, z: this.zelle, h, w });
    this.zelle += w; return this;
  }

  blockTop(h, w) {
    this.teile.push({ t: T.BLOCK, z: this.zelle, h, w, down: true });
    this.zelle += w; return this;
  }

  /* Plattform mit Oberkante in h Zellen Hoehe. */
  plat(h, w) {
    this.teile.push({ t: T.PLAT, z: this.zelle, h, w });
    this.zelle += w; return this;
  }

  /* Stacheln von der Decke. */
  dach(k = 1) { return this.spikeDown(k); }

  /* Pad und Ring: Ausloesen beim Ueberqueren. */
  pad() { this.teile.push({ t: T.PAD, z: this.zelle }); this.zelle++; return this; }

  /* Ring in h Zellen Hoehe: muss in der Luft gedrueckt werden. */
  orb(h) { this.teile.push({ t: T.ORB, z: this.zelle, h }); this.zelle++; return this; }

  grav() { this.teile.push({ t: T.GRAV, z: this.zelle }); this.zelle++; return this; }

  portal(modus) { this.teile.push({ t: T.PORTAL, z: this.zelle, modus }); this.zelle++; return this; }

  /* Tempo-Portal. Ein unbekannter Name wirft: im alten Projekt fiel er still auf
     1 zurueck und ein Tippfehler haette einen Turboteil entschaerft, ohne dass
     es jemand gemerkt haette. */
  spd(name) {
    if (!(name in TEMPO)) throw new Error(`spd('${name}'): unbekanntes Tempo, es gibt nur ${Object.keys(TEMPO).join(', ')}`);
    this.teile.push({ t: T.SPD, z: this.zelle, name });
    this.zelle++; return this;
  }

  coin(slot) { this.teile.push({ t: T.COIN, z: this.zelle, slot }); this.zelle++; return this; }

  pillar(h, unten = 1) {
    this.teile.push({ t: T.PILLAR, z: this.zelle, h, unten });
    this.zelle++; return this;
  }

  fin() { this.teile.push({ t: T.FIN, z: this.zelle }); return this; }
}

/* Hoehe eines Münzslots in px (Oberkante des Spielerausschnitts). */
function muenzY(slot) { return GROUND - (slot + 0.5) * CELL; }

/* Bauplan -> echte Objekte mit Absolutkoordinaten. */
function baue(def) {
  const plan = new Bauplan();
  def.body(plan);

  const obje = [];
  for (const teil of plan.teile) {
    const x = START_X + teil.z * CELL;
    switch (teil.t) {
      case T.SPIKE:
        obje.push({ t: T.SPIKE, x, y: teil.down ? CEIL : GROUND, down: !!teil.down });
        break;
      case T.BLOCK: {
        const hoehe = teil.h * CELL, breite = teil.w * CELL;
        const y = teil.down ? CEIL : GROUND - hoehe;
        obje.push({ t: T.BLOCK, x, y, w: breite, h: hoehe, down: !!teil.down, z: teil.z });
        break;
      }
      case T.PLAT: {
        const hoehe = teil.h * CELL;
        obje.push({ t: T.PLAT, x, y: GROUND - hoehe, w: teil.w * CELL, h: 14, z: teil.z });
        break;
      }
      case T.COIN:
        obje.push({ t: T.COIN, x, y: muenzY(teil.slot), slot: teil.slot, z: teil.z });
        break;
      case T.PAD:
        obje.push({ t: T.PAD, x, y: GROUND - 10 });
        break;
      case T.ORB:
        obje.push({ t: T.ORB, x, y: GROUND - (teil.h + 0.5) * CELL });
        break;
      case T.GRAV:
      case T.PORTAL:
      case T.SPD:
        obje.push({ t: teil.t, x, y: (CEIL + GROUND) / 2, name: teil.name, modus: teil.modus });
        break;
      case T.PILLAR: {
        const h = teil.h * CELL;
        obje.push({
          t: T.PILLAR, x, w: CELL,
          y: teil.unten ? GROUND - h : CEIL,
          h, unten: teil.unten,
        });
        break;
      }
      case T.FIN:
        obje.push({ t: T.FIN, x, y: (CEIL + GROUND) / 2 });
        break;
    }
  }

  const fin = obje.find(o => o.t === T.FIN) || { x: START_X + plan.zelle * CELL };
  const level = {
    ...def,
    objs: obje.sort((a, b) => a.x - b.x),
    endX: fin.x,
    zellen: plan.zelle,
    laenge: fin.x - START_X,
  };
  level.modi = modusAbschnitte(level);
  return level;
}

/* Welche Modi gelten zwischen welchen x-Werten. Das Audit braucht das, um tote
   Objekte zu finden: ein Ring im Schiff ist ein Fehler, weil man dort nicht
   springen kann. */
function modusAbschnitte(level) {
  const portaale = level.objs.filter(o => o.t === T.PORTAL).sort((a, b) => a.x - b.x);
  const abschnitte = [];
  let von = 0, modus = MODI.WUERFEL;
  for (const p of portaale) {
    abschnitte.push({ modus, von, bis: p.x });
    modus = p.modus; von = p.x;
  }
  abschnitte.push({ modus, von, bis: level.endX });
  return abschnitte;
}

function modusBei(level, x) {
  let modus = MODI.WUERFEL;
  for (const s of level.modi) if (x >= s.von) modus = s.modus;
  return modus;
}

/* Umgekehrte Schwerkraft? Zahl der Schwerkraft-Portale vor x, mod 2. Das Fenster-
   Mass braucht das: ein Deckenstachel ist bei umgekehrter Schwerkraft ein
   Boden-Stachel und verlangt einen Sprung, waehrend er normal unterflogen wird. */
function gravBei(level, x) {
  let n = 0;
  for (const o of level.objs) if (o.t === T.GRAV && o.x <= x) n++;
  return n % 2 ? -1 : 1;
}

function tempoBei(level, x) {
  let tm = 1;
  for (const o of level.objs) if (o.t === T.SPD && o.x <= x) tm = TEMPO[o.name];
  return tm;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CELL, SPD, GRAV, JUMP_V, PAD_V, ORB_V, JUMP_AIR, JUMP_DIST, JUMP_HOEHE,
    SCHIFF_ACC, SCHIFF_MAX, SCHIFF_GRAV, SCHIFF_KICK, BALL_K, WELLE_STEIG,
    FIXED_DT, JBUF, COYOTE, DEATH_T, BREITE, HOEHE, GROUND, CEIL, SPIELRAUM,
    START_X, P, TEMPO, MODI, T, Bauplan, baue, modusAbschnitte, modusBei,
    tempoBei, fensterSekunden, tragweite, muenzY, gravBei, gruppenVon,
    kontaktZelle, istHindernis, istWechsel, zellenBreite,
  };
}
