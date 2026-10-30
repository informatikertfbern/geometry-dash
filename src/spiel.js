/* spiel.js — Bewegung, Kollision, Bot, Audit, Fenster-Messung.
   Alles hier laeuft ohne Canvas und ohne WebAudio, damit der Bot denselben
   Schritt benutzt wie das Spiel. Ein Test, der eine zweite Physik nachbaut,
   prueft nichts. */

const PH = (typeof require !== 'undefined') ? require('./physik.js') : window;
const { CELL, SPD, GRAV, JUMP_V, JUMP_DIST, PAD_V, ORB_V, SCHIFF_ACC, SCHIFF_MAX, SCHIFF_GRAV,
  SCHIFF_KICK, BALL_K, WELLE_STEIG, FIXED_DT, JBUF, COYOTE, GROUND, CEIL, START_X, P,
  TEMPO, MODI, T, modusBei, tempoBei, fensterSekunden, gravBei } = PH;

function zustandNeu(level) {
  return praepariere({
    x: START_X, y: GROUND - P, vy: 0,
    modus: MODI.WUERFEL, tm: 1,
    anBoden: true, coyote: 0, vorwahl: 0, plan: null,
    planTempo: null, planGrav: null, planModus: null,
    flugBis: undefined, flugVerhandeltBis: 0,
    grav: 1, tot: false, durch: false, zeit: 0,
    muenzen: 0, genommen: new Set(), todBei: null,
    level,
  });
}

function praepariere(z) {
  z.tod = function () { if (!this.tot) { this.tot = true; this.todBei = this.x; } };
  return z;
}

function kopie(z) {
  return praepariere({
    x: z.x, y: z.y, vy: z.vy, modus: z.modus, tm: z.tm,
    anBoden: z.anBoden, coyote: z.coyote, vorwahl: z.vorwahl, grav: z.grav,
    tot: false, durch: false, zeit: z.zeit, muenzen: 0, plan: null,
    planTempo: z.planTempo, planGrav: z.planGrav, planModus: z.planModus,
    flugBis: undefined, flugVerhandeltBis: 0,
    genommen: new Set(z.genommen), level: z.level,
  });
}

function erreichbare(z, bisX) {
  const out = [];
  for (const o of z.level.objs) {
    if (o.x + (o.w || CELL) < z.x) continue;
    if (o.x > bisX + CELL) break;
    out.push(o);
  }
  return out;
}

/* Ein Klick, ausgewertet am Zustand. */
function sprungAusloesen(z) {
  if (z.modus === MODI.WUERFEL && (z.anBoden || z.coyote > 0)) {
    z.vy = -JUMP_V * z.grav;
    z.anBoden = false; z.coyote = 0;
    return true;
  }
  if (z.modus === MODI.BALL && z.anBoden) {
    z.vy = -BALL_K * z.grav; z.anBoden = false;
    return true;
  }
  return false;
}

/* Ein fester Schritt. klick = 1 nur in dem Schritt, in dem gedrueckt wird;
   halten = der gedruckte Zustand ueber den Schritt. */
function schritt(z, klick, halten) {
  if (z.tot || z.durch) return z;
  const level = z.level;
  z.zeit += FIXED_DT;

  z.tm = tempoBei(level, z.x);
  const mod = modusBei(level, z.x);
  if (mod !== z.modus) { z.modus = mod; z.vy = 0; }

  const altX = z.x;
  z.x += SPD * z.tm * FIXED_DT;
  const rechts = z.x + P;

  for (const o of erreichbare(z, rechts)) {
    if (o.x < altX || o.x > rechts) continue;
    if (o.t === T.PORTAL) { z.modus = o.modus; z.vy = 0; }
    else if (o.t === T.GRAV) { z.grav *= -1; z.vy = 0; }
    else if (o.t === T.COIN && !z.genommen.has(o)) { z.genommen.add(o); z.muenzen++; }
    else if (o.t === T.FIN) { z.durch = true; }
  }

  /* Sprung vor der Bewegung: Vorwahl und Bodenkontakt des letzten Schritts
     zaehlen, sonst verliert der Sprung einen Schritt. */
  if (klick) {
    if (!sprungAusloesen(z)) {
      if (z.modus === MODI.WUERFEL) z.vorwahl = JBUF;
    } else z.vorwahl = 0;
  } else if (z.modus === MODI.WUERFEL && halten) z.vorwahl = JBUF;

  if (z.modus === MODI.SCHIFF) {
    /* Halten drueckt GEGEN die Schwerkraft. Beide Zweige waren zuerst positiv,
       das Schiff fiel also in jedem Modus, und kein Steuersignal konnte es
       aufsteigen lassen: der Bot starb im ersten Roehrenabschnitt bei 42 %. */
    const beschl = (halten ? -SCHIFF_ACC : SCHIFF_GRAV) * z.grav;
    z.vy += beschl * FIXED_DT;
    z.vy = Math.max(-SCHIFF_MAX, Math.min(SCHIFF_MAX, z.vy));
  } else if (z.modus === MODI.WELLE) {
    z.vy = (halten ? -WELLE_STEIG : WELLE_STEIG) * z.grav;
  } else {
    z.vy += GRAV * z.grav * FIXED_DT;
  }

  if (!z.anBoden) z.coyote = Math.max(0, z.coyote - FIXED_DT);
  else z.coyote = COYOTE;
  z.vorwahl = Math.max(0, z.vorwahl - FIXED_DT);

  const altY = z.y;
  z.y += z.vy * FIXED_DT;
  z.anBoden = false;

  /* Spielfeldbegrenzung. */
  if (z.modus === MODI.WUERFEL) {
    if (z.grav > 0) {
      if (z.y + P >= GROUND) { z.y = GROUND - P; z.vy = 0; z.anBoden = true; }
      else if (z.y <= CEIL) { z.tod(z); return z; }
    } else {
      if (z.y <= CEIL) { z.y = CEIL; z.vy = 0; z.anBoden = true; }
      else if (z.y + P >= GROUND) { z.tod(z); return z; }
    }
  } else {
    if (z.y + P >= GROUND) { z.y = GROUND - P; z.vy = 0; if (z.modus === MODI.BALL) z.anBoden = true; }
    if (z.y <= CEIL) { z.y = CEIL; z.vy = 0; if (z.modus === MODI.BALL) z.anBoden = true; }
  }

  /* Blaue und Plattformen. */
  for (const o of erreichbare(z, rechts)) {
    if (o.t !== T.BLOCK && o.t !== T.PLAT) continue;
    if (rechts <= o.x + 1 || z.x >= o.x + o.w - 1) continue;
    const oben = o.y, unten = o.y + o.h;
    if (z.modus !== MODI.WUERFEL) {
      if (z.y + P > oben && z.y < unten) { z.tod(z); return z; }
      continue;
    }
    if (z.grav > 0) {
      if (z.vy >= 0 && altY + P <= oben + 4 && z.y + P >= oben) {
        z.y = oben - P; z.vy = 0; z.anBoden = true; z.coyote = COYOTE;
      } else if (z.y + P > oben + 4 && z.y < unten) { z.tod(z); return z; }
    } else {
      if (z.vy <= 0 && altY >= unten - 4 && z.y <= unten) {
        z.y = unten; z.vy = 0; z.anBoden = true; z.coyote = COYOTE;
      } else if (z.y + P > oben && z.y < unten - 4) { z.tod(z); return z; }
    }
  }

  /* Schiffsaeulen. */
  for (const o of erreichbare(z, rechts)) {
    if (o.t !== T.PILLAR) continue;
    if (rechts <= o.x + 1 || z.x >= o.x + o.w - 1) continue;
    if (z.y + P > o.y && z.y < o.y + o.h) { z.tod(z); return z; }
  }

  /* Pad und Ring vor den Stacheln: ein Pad am Boden muss feuern koennen, bevor
     der Stachel dahinter zaehlt. */
  for (const o of erreichbare(z, rechts)) {
    if (o.t === T.PAD && rechts > o.x + 4 && z.x < o.x + CELL - 4) {
      if (z.modus === MODI.WUERFEL && z.anBoden) { z.vy = -PAD_V * z.grav; z.anBoden = false; }
    }
    if (o.t === T.ORB && rechts > o.x + 4 && z.x < o.x + CELL - 4) {
      if (z.modus === MODI.WUERFEL && !z.anBoden && (klick || z.vorwahl > 0)) {
        z.vy = -ORB_V * z.grav; z.vorwahl = 0;
      }
    }
  }

  /* Stacheln: schmale Trefferflaeche, damit eine saubere Landung auf der
     Blockkante nicht als Stich zaehlt. */
  for (const o of erreichbare(z, rechts)) {
    if (o.t !== T.SPIKE) continue;
    const sx = o.x + 9, sw = 18;
    const sy = o.down ? CEIL : GROUND - 24, sh = 24;
    if (rechts - 7 > sx && z.x + 7 < sx + sw && z.y + P > sy + 6 && z.y < sy + sh) { z.tod(z); return z; }
  }

  if (z.x + P >= level.endX) z.durch = true;
  return z;
}

/* ---------------- Bot ----------------
   Der Bot plant nicht, er prueft: er laeuft den eigenen Schritt weiter, ohne zu
   druecken, und sobald diese Rolle in den Tod fuehrt, drueckt er. Der Horizont
   einer Rolle endet, sobald die naechste Gefahr hinter dem Spieler liegt — ein
   Erfolg ist das erst dann, und nicht schon nach einer festen Strecke. Das war
   der erste Bot-Fehler dieses Neuaufbaus: er meldete Erfolg nach 12 Zellen,
   noch vor der Gefahr. */

/* Rand der naechsten Stelle, an der der Spieler wieder frei stehen kann: die
   Linkskante des naechsten Hindernisses, das noch vor ihm liegt. */
function gefahrVor(z) {
  for (const o of z.level.objs) {
    if (o.x + (o.w || CELL) <= z.x + P) continue;
    if (o.t === T.SPIKE || o.t === T.PILLAR || o.t === T.BLOCK || o.t === T.PLAT) return o.x;
  }
  return -1;
}

/* Schritte, bis der Spieler diese Stelle hinter sich hat. Der Horizont war zuerst
   eine feste Zahl von 400 Schritten, und das ist der Grund, warum der erste Bot
   viel zu frueh sprang: er sah den Tod schon, als er noch 300 px davon entfernt
   war, und wählte den fruehesten statt den spaetesteten Befehl. */
function schritteBis(z, x) {
  const v = SPD * z.tm * FIXED_DT;
  return Math.max(4, Math.ceil((x - z.x) / v));
}

/* Rechtes Ende der Hindernisgruppe, die den Spieler noch beschaeftigt. Die
   Gruppierung selbst ist hindernisse(); sie hier zu wiederholen war ein Fehler,
   derselbe Gedanke an zwei Orten mit zwei verschiedenen Ergebnissen. */
function gruppen(level) {
  if (!level._gruppen) level._gruppen = hindernisse(level);
  return level._gruppen;
}

function aktuelleGruppe(z) {
  for (const gr of gruppen(z.level)) if (gr.ende > z.x + P) return gr;
  return null;
}

function zielHinterGruppe(z) {
  const gr = aktuelleGruppe(z);
  return gr ? gr.ende + CELL : z.level.endX;
}

/* Blick voraus ohne jede Eingabe, bis die aktuelle Gruppe hinter dem Spieler
   liegt. Der Horizont war zuerst eine feste Zahl Schritte, und darum sprang der
   erste Bot 250 px zu frueh. */
function rolle(z) {
  const ziel = zielHinterGruppe(z);
  const k = kopie(z);
  const grenze = schritteBis(z, ziel) + 40;
  for (let i = 0; i < grenze; i++) {
    schritt(k, 0, 0);
    if (k.tot) return { tot: true, k };
    if (k.durch) return { tot: false, durch: true, k };
    if (k.x + P >= ziel) return { tot: false, k, frei: true };
  }
  return { tot: true, k };
}

/* Tippt in genau einem Schritt. Geprueft wurde zuerst 'haelt ab Schritt s', und
   das war falsch: der Bot huepfte nach der Landung stur weiter und kam zu spaet
   an eine hohe Wand. Ein Tipp pro Entscheidung, die naechste faellt neu. */
/* Faehrt die Rolle mit einem Tipp bei Schritt `stufe` und liefert den ORT, an
   dem der Tipp passiert ist — oder null, wenn diese Variante stirbt. Der Ort
   kommt aus der Simulation, nicht aus einer Rechnung: TAKTWECHSEL hat den Sprung
   bei x=2086 geplant und ist bei 2082,5 gestorben, weil die Rechenweise
   `stufe * SPD * tm * DT` die ganze Strecke mit der JETZIGEN Geschwindigkeit
   umrechnete. Vierzig Schritte weiter liegt ein Tempo-Portal auf 0,72, und die
   Haelfte der Schritte war in Wahrheit gut halb so lang. */
function rolleMitSprung(z, stufe) {
  const ziel = zielHinterGruppe(z);
  const k = kopie(z);
  const grenze = schritteBis(z, ziel) + 80;
  let tippX = null;
  for (let i = 0; i < grenze; i++) {
    if (i === stufe) tippX = k.x;
    schritt(k, i === stufe ? 1 : 0, 0);
    if (k.tot) return null;
    if (k.durch) return tippX;
    if (k.x + P >= ziel) return tippX;
  }
  return null;
}

/* FRUEHESTE Tipp-Stufe, die die aktuelle Gruppe ueberquert. Die spaetest
   moegliche war zuerst gewaehlt, und die ist rechnerisch grenzwertig: der Bot
   stand fast an der Stachelkante, war dort noch ein paar Pixel hoch und starb
   13 px vor der Gruppe. Frueh springen heisst ueber die Gruppe in ihrer
   Sprunghoehe fliegen, das ist der robuste Rand.

   Das Suchfenster war zunaechst auf 40 Schritte (56 px) fest und damit war eine
   Wand in 250 px Entfernung unerreichbar; dann war es auf 150 gedeckelt, was
   eine weit entfernte Gruppe abschnitt. Es reicht jetzt bis zur Gruppe selbst. */
function planDesTips(z) {
  const v = SPD * z.tm * FIXED_DT;
  const gr = aktuelleGruppe(z);
  if (!gr) return null;
  const fenster = Math.max(1, Math.ceil((gr.anfang - z.x) / v) + 12);
  for (let s = 0; s <= fenster; s++) {
    const x = rolleMitSprung(z, s);
    if (x !== null) return x;
  }
  return null;
}

/* Schiff und Welle: der Bot steuert nicht nach einer Regel, er spielt beide
   Moeglichkeiten durch und nimmt die weiter tragende — dasselbe Prinzip wie im
   Wuerfel. Eine Heuristik ('schwimm zur Gassenmitte') hat hier sechs Level
   getoetet: sie kannte weder den Bremsweg bei 520 px/s noch den Zeitpunkt, ab
   dem der naechste Pfeiler die Gasse verschiebt. Der Horizont ist kurz, weil das
   Schiff traege ist und eine lange Vorausschau die Manöver nicht mehr aufloest. */
const FLUG_HORIZONT = 120;
const FLUG_ENTSCHEID = 10;

function flugRolliere(z, halten, schritte) {
  const k = kopie(z);
  for (let i = 0; i < schritte; i++) {
    schritt(k, halten ? 1 : 0, halten ? 1 : 0);
    if (k.tot || k.durch) break;
  }
  return k;
}

/* Der eine Freiheitsgrad: halten oder nicht, und wann. */
const FLUG_BLICK = 0.15;   /* Basis-Vorausschau in Sekunden */

function flugVorhersage(z, halten, sekunden) {
  const g = z.grav;
  if (z.modus === MODI.WELLE) {
    return z.y + (halten ? -WELLE_STEIG : WELLE_STEIG) * g * sekunden;
  }
  const b = (halten ? -SCHIFF_ACC : SCHIFF_GRAV) * g;
  return z.y + z.vy * sekunden + 0.5 * b * sekunden * sekunden;
}

/* Prädiktiver Regler. Drei Anlaeufe sind hier gescheitert, alle mit derselben
   Wurzel: eine Regel, die den eigenen Gleitweg nicht kennt. Erst 'schwimm zur
   Mitte' (schoss bei 520 px/s ueber die Gasse), dann 'immer vs. nie halten'
   (stirbt in jeder Roehre, die beides verlangt), dann 'beste Haltdauer' (eine
   Haltdauer ohne erneute Entscheidung laesst das Schiff danach fallen). Alle
   drei waren korrekt formuliert und trotzdem blind fuer die Trägheit.

   Der Regler fragt jetzt: wuerde ich in FLUG_BLICK Sekunden ohne Halten unter
   die Gasse fallen? Dann halte. Wuerde ich mit Halten ueber die Gasse steigen?
   Dann lasse los. Sonst halte weiter, was ich gerade tue. */
function botFlug(z) {
  const g = gasseBei(z);
  const rand = 10;                     /* Sicherheitsabstand zur Kante, px */
  /* Die Vorausschau skaliert mit der eigenen Geschwindigkeit. Ein fester Blick
     von 0,17 s reicht bei 300 px/s, aber nicht bei 520: dort traegt das Schiff in
     derselben Zeit 90 px, und der Bot sieht die Kante erst, nachdem er sie
     ueberquert hat. EREIGNISHORIZONT starb mit 6 px Ueberstand — genau dieses
     Muster. Der Bremsweg bei 2600 px/s^2 ist v^2 / 2a, durch v geteilt bleibt
     v / 2a als Zusatzzeit. */
  const blick = FLUG_BLICK + Math.abs(z.vy) / (2 * SCHIFF_ACC);
  const gefahrTief = flugVorhersage(z, false, blick) > g.unten - P - rand;
  const gefahrHoch = flugVorhersage(z, true, blick) < g.oben + rand;
  let halten;
  if (gefahrTief && !gefahrHoch) halten = 1;
  else if (gefahrHoch && !gefahrTief) halten = 0;
  else {
    /* Keine akute Kante: halte die Mitte, aber auch hier mit dem Bremsweg, sonst
       schießt das Schiff bei 520 px/s ueber die Mitte hinaus. */
    const gleit = z.vy * (Math.abs(z.vy) / (2 * SCHIFF_ACC));
    halten = (z.y + gleit) > g.ziel ? 1 : 0;
  }
  return { klick: halten, halten };
}

/* Ein Plan gilt bis zur Ausfuehrung, nicht nur einen Schritt. Wuerde der Bot
   jede Runde neu verhandeln, wechselt er zwischen Moeglichkeiten hin und her,
   je nachdem wo er gerade steht. */
function bot(z) {
  if (z.tot || z.durch) return { klick: 0, halten: 0 };

  if (z.modus === MODI.SCHIFF || z.modus === MODI.WELLE) return botFlug(z);

  if (!z.anBoden) return { klick: 0, halten: 0 };

  if (!rolle(z).tot) { z.plan = null; return { klick: 0, halten: 0 }; }

  /* Ein Plan gilt, aber nur solange die Umstaende gelten, unter denen er
     gerechnet wurde: Tempo, Schwerkraft und Modus verschieben den Sprungort. */
  if (z.plan !== null && (z.planTempo !== z.tm || z.planGrav !== z.grav || z.planModus !== z.modus)) {
    z.plan = null;
  }

  if (z.plan === null || z.plan < z.x) {
    const stufe = planDesTips(z);
    if (stufe === null) {
      /* Kein Tipp ueberquert die Gruppe. Lieber frueh als nie: ein Tipp jetzt
        bringt weiter als stehenbleiben, und der Fall bleibt im Bot-Test sichtbar.
        Ein Level, das der Bot so nicht schafft, soll rot werden, nicht still
        durchkommen. */
      z.plan = null;
      return { klick: 1, halten: 0 };
    }
    z.plan = stufe;
    z.planTempo = z.tm; z.planGrav = z.grav; z.planModus = z.modus;
  }

  if (z.x < z.plan) return { klick: 0, halten: 0 };
  z.plan = null;
  return { klick: 1, halten: 0 };
}

/* Die Gasse, durch die der Spieler als Naechstes muss. Zwei Fehler sind hier
   drin gewesen und beide haben Schiffslevel getoetet:
   - Ein `break` vor der Pruefung liess den Deckenpfeiler einer Roehre unberueck-
     sichtigt, wenn er eine Zelle hinter dem Bodenpfeiler sass. Der Bot steuerte
     die Mitte des Bodenpfeilers an und flog in den Deckenpfeiler.
   - Einzelne Hindernisse statt der Engstelle: ein Bodenpfeiler mit Gasse 92..308
     und direkt danach ein Deckenpfeiler mit Gasse 200..452 erlauben zusammen nur
     200..308. Wer beide getrennt anfliegt, erwischt eines davon.
   Darum: Schnitt aller Kanten, die den Spieler gerade beruehren oder in den
   naechsten drei Zellen vor ihm liegen. */
function gasseBei(z) {
  const von = z.x, bis = z.x + P + 5 * CELL;
  let oben = CEIL, unten = GROUND;
  for (const o of z.level.objs) {
    const anfang = o.x, ende = o.x + (o.w || CELL);
    if (ende < von + 1) continue;
    if (anfang > bis) break;
    let kanteOben = null, kanteUnten = null;
    if (o.t === T.PILLAR) {
      if (o.unten) kanteUnten = o.y; else kanteOben = o.y + o.h;
    } else if (o.t === T.BLOCK || o.t === T.PLAT) {
      if (o.down) kanteOben = o.y + o.h; else kanteUnten = o.y;
    } else if (o.t === T.SPIKE) {
      if (o.down) kanteOben = CEIL + 26; else kanteUnten = GROUND - 26;
    } else continue;
    if (kanteOben !== null) oben = Math.max(oben, kanteOben);
    if (kanteUnten !== null) unten = Math.min(unten, kanteUnten);
  }
  return { oben, unten, ziel: (oben + unten) / 2 - P / 2 };
}

/* Schiffsregelung MIT Gleitweg. Ein reines An/Aus am Ziel war zu hart: das
   Schiff fliegt bis 520 px/s und schoss bei der ersten Roehre ueber die Mitte
   hinaus und in den Deckenpfeiler, der Bot starb bei 42 %. Getestet wird jetzt,
   ob das Schiff auch nach dem Loslassen durch die eigene Steigung ueber das Ziel
   hinauskame — dann wird der Schub frueher weggenommen. */
function steuerungFliegen(z) {
  const g = gasseBei(z);
  if (z.modus === MODI.WELLE) return z.y > g.ziel;
  if (z.y <= g.ziel) return false;
  const gleitweg = z.vy < 0 ? (z.vy * z.vy) / (2 * SCHIFF_GRAV) : 0;
  return z.y - gleitweg > g.ziel;
}

function fahre(level) {
  const z = zustandNeu(level);
  let n = 0;
  while (!z.tot && !z.durch && n < 400000) {
    const e = bot(z);
    schritt(z, e.klick, e.halten);
    n++;
  }
  const prozent = Math.max(0, Math.min(100, (z.x - START_X) / (level.endX - START_X) * 100));
  return { z, prozent, schritte: n, fehler: z.tot ? `Tod bei ${prozent.toFixed(1)} % (x=${Math.round(z.todBei)})` : null };
}

/* ---------------- Fenster-Messung ----------------
   Ein Fenster ist die Zeitspanne zwischen zwei Stellen, an denen der Spieler
   wieder frei entscheiden kann. Stacheln einer Gruppe sind KEINE solchen
   Stellen: eine Gruppe von drei Stacheln ist ein Hindernis, nicht drei. Sie
   einzeln zu zaehlen ergab hier zuerst ein Fenster von -441 ms.

   Landepunkte sind die Oberkanten von Blaue und Plattformen: dort endet ein
   Fenster und das naechste beginnt. Ein Block teilt ein Fenster also, er
   verkuerzt es nicht nur. */

function hindernisse(level) {
  const roh = level.objs.filter(o =>
    o.t === T.SPIKE || o.t === T.PILLAR || o.t === T.BLOCK || o.t === T.PLAT);
  const gruppen = [];
  for (const o of roh) {
    const anfang = o.x, ende = o.x + (o.w || CELL);
    const letzte = gruppen[gruppen.length - 1];
    const zusammenhang = letzte && anfang <= letzte.ende + 1;
    const landung = o.t === T.BLOCK || o.t === T.PLAT;
    if (zusammenhang) {
      letzte.ende = Math.max(letzte.ende, ende);
      letzte.landung = letzte.landung || landung;
      letzte.objekte.push(o);
    } else {
      gruppen.push({ anfang, ende, landung, objekte: [o] });
    }
  }
  return gruppen;
}

/* Das Reaktionsfenster haengt am Modus, und das ist kein Detail: die Sprung-
   Distanz darf nur im Wuerfel abgezogen werden. Im Schiff, Ball und in der Welle
   gibt es keinen Sprung, dort ist die Reaktionszeit schlicht die Fahrzeit von
   einem Hindernis zum naechsten. Mit der Wuerfel-Formel gemessen ergaben sich für
   eine Schiffsroehre mit vier Zellen Abstand -30 ms, und die Roehre ist spielbar.
   Ein Test, der das nicht trennt, erklaert eine halbe Leiter für unspielbar. */
/* Ein Sprung kostet Reaktionszeit, ein Durchfliegen nicht. Die Sprung-Distanz
   darf nur abgezogen werden, wenn die Gruppe wirklich einen Sprung verlangt:
   einen Stachel am Boden oder ein Bauteil, das den Weg blockiert, im Wuerfel.
   Ein Deckenstachel, unter dem der Spieler laeuft, verlangt keinen Sprung, und
   eine Schiffsroehre erst recht nicht. Beides wurde zuerst mit der Wuerfel-
   Formel gemessen und ergab -30 ms fuer eine spielbare Roehre und -11 ms fuer
   eine Durchfahrt unter einem Deckenstachel. */
/* Wie weit der Spieler festgelegt ist, in px. Hier wurde eine feinere Rechnung
   versucht (Flugzeit bis zur Oberkante eines Blocks statt volle Sprungweite) und
   wieder zurueckgenommen: sie haette DELTA und KERNZONE freigesprochen, aber ihre
   Voraussetzung — wo genau der Spieler auf einem Block wieder frei ist — ist
   nicht gemessen, sondern angenommen. Konservativ heisst hier: immer die volle
   Sprungweite abziehen. Ein Level, das diese Grenze nicht erfuellt, kriegt mehr
   Platz, statt dass die Grenze weicher gemacht wird. */
function festgelegteStrecke(tm) { return JUMP_DIST * tm; }

function brauchtSprung(gruppe, modus, grav) {
  if (modus !== MODI.WUERFEL) return false;
  return gruppe.objekte.some(o => {
    if (o.t === T.PILLAR || o.t === T.BLOCK || o.t === T.PLAT) return true;
    if (o.t !== T.SPIKE) return false;
    /* Stachel steht dort, wo der Spieler laeuft. Bei normaler Schwerkraft ist das
       der Boden, bei umgekehrter die Decke. */
    return grav > 0 ? !o.down : !!o.down;
  });
}

function fensterMs(zellen, tm, festgelegt) {
  const fahrt = zellen * CELL / (SPD * tm);
  if (festgelegt === null) return -1;      /* unspielbar: Hoehe nicht erreichbar */
  if (festgelegt === 0) return fahrt * 1000;
  return (zellen * CELL - festgelegt) / (SPD * tm) * 1000;
}

function fenster(level) {
  const gruppen = hindernisse(level);
  /* Wechsel-Orte: Portal und Schwerkraft-Kipp. Ab dort ist der Spieler neu
     ausgerichtet, das Fenster der naechsten Gruppe darf nicht rueber gemessen
     werden. Derselbe Grundsatz und dieselbe Zelle wie kontaktZelle() im Builder:
     der Builder setzt den Kontakt EINE ZELLE hinter den Wechsel, weil der Spieler
     das Portal erst an seiner Rechtseite verlaesst. Ein `o.x` allein war eine
     Zelle zu frueh, und eine Zelle ist hier ein Fenster von 81 ms. */
  const wechsel = level.objs.filter(o => PH.istWechsel(o.t))
    .map(o => o.x + CELL).sort((a, b) => a - b);
  const out = [];
  let kontakt = START_X, w = 0;
  let hoehe = 0;                     /* Zellen, auf denen der Spieler steht */
  for (const gr of gruppen) {
    while (w < wechsel.length && wechsel[w] < gr.anfang) { kontakt = Math.max(kontakt, wechsel[w]); w++; }
    const zellen = (gr.anfang - kontakt) / CELL;
    const tm = tempoBei(level, gr.anfang);
    const modus = modusBei(level, gr.anfang);
    const grav = gravBei(level, gr.anfang);
    const sprung = brauchtSprung(gr, modus, grav);
    const festgelegt = sprung ? festgelegteStrecke(tm) : 0;
    if (zellen > 0.5) {
      out.push({ zellen, ms: fensterMs(zellen, tm, festgelegt), bei: gr.anfang, tm, modus,
        sprung, festgelegt });
    }
    /* Eine Landes-Gruppe zaehlt ab ihrer LINKSKANTE: der Spieler landet links
       oben auf dem Block und entscheidet dort weiter, nicht erst an der
       Rechtseite. Ueber den rechten Rand gerechnet ergab eine Treppe -11 ms.
       Ohne Landflaeche bleibt der rechte Rand richtig, dort wird er frei. */
    kontakt = gr.landung ? gr.anfang : Math.max(kontakt, gr.ende);
    hoehe = 0;
  }
  return out.sort((a, b) => a.ms - b.ms);
}

function audit(level) {
  const fehler = [];
  const f = fenster(level);
  const engstes = f.length ? f[0].ms : Infinity;

  if (engstes < 150) {
    fehler.push(`Reaktionsfenster ${engstes.toFixed(0)} ms unter der Schmerzgrenze von 150 ms`
      + ` (zuerst bei x=${Math.round(f[0].bei)}, ${f[0].zellen.toFixed(1)} Zellen bei Tempo ${f[0].tm})`);
  }

  for (const o of level.objs) {
    const mod = modusBei(level, o.x);
    if (o.t === T.ORB && mod !== MODI.WUERFEL) {
      fehler.push(`Orb bei x=${Math.round(o.x)} liegt im ${mod}-Abschnitt und ist dort nicht ausloesbar`);
    }
    if (o.t === T.PAD && mod !== MODI.WUERFEL) {
      fehler.push(`Pad bei x=${Math.round(o.x)} liegt im ${mod}-Abschnitt und feuert dort nicht`);
    }
    if (o.t === T.GRAV && mod === MODI.WELLE) {
      fehler.push(`Schwerkraft-Portal bei x=${Math.round(o.x)} im Wellen-Abschnitt kippt nur die Flugrichtung`);
    }
  }

  const pfeiler = level.objs.filter(o => o.t === T.PILLAR);
  for (let i = 0; i < pfeiler.length; i++) {
    for (let j = i + 1; j < pfeiler.length; j++) {
      const a = pfeiler[i], b = pfeiler[j];
      if (b.x - a.x > 3 * CELL) break;
      if (a.unten === b.unten) continue;
      /* Ein Bodenpfeiler endet bei y+h, ein Deckenpfeiler bei y+h; der Durchlass
         ist der Streifen dazwischen. Die Zuordnung war zuerst vertauscht und
         lieferte -360 px fuer jede Roehre, also eine Meldung fuer jede Roehre. */
      const durchlass = a.unten ? a.y - (b.y + b.h) : b.y - (a.y + a.h);
      if (durchlass < P + 8) {
        fehler.push(`Schiff-Durchlass bei x=${Math.round(b.x)} nur ${durchlass.toFixed(0)} px, Spieler ist ${P} px`);
      }
    }
  }

  for (const abschnitt of level.modi) {
    if (abschnitt.modus !== MODI.WELLE) continue;
    const dauer = (abschnitt.bis - abschnitt.von) / (SPD * tempoBei(level, abschnitt.von));
    const steig = dauer * WELLE_STEIG;
    if (steig < CELL * 1.5) {
      fehler.push(`Wellen-Abschnitt bei x=${Math.round(abschnitt.von)} erlaubt nur ${(steig / CELL).toFixed(1)} Zellen Hoehenunterschied`);
    }
  }

  if (level.endX - START_X < 40 * CELL) fehler.push('Level kuerzer als 40 Zellen');

  return { fehler, fenster: f, engstes, objekte: level.objs.length, laenge: level.endX - START_X };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { zustandNeu, praepariere, schritt, bot, fahre, kopie, fenster,
    hindernisse, audit, steuerungFliegen, rolle, rolleMitSprung, gruppen,
    aktuelleGruppe, fensterMs };
}
