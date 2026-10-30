/* app.js — Schleife, Eingabe, Menue. Der Kern bleibt hier unangetastet: die
   Steuerung ruft nur schritt() mit denselben zwei Argumenten wie der Bot, damit
   das, was der Mensch spielt, dasselbe ist wie das, was die Suite geprueft hat.
   Eine zweite Bewegungsimplementierung fuer den Menschen waere der alte Fehler
   in neuer Verkleidung gewesen. */
(function (global) {
  'use strict';
  var GD = global.GD, PH = GD.PH, SP = GD.SP, LV = GD.LV;
  var FIXED_DT = PH.FIXED_DT, DEATH_T = PH.DEATH_T, BREITE = PH.BREITE;

  var canvas, ctx, lauf = null, taste = false, zeiger = false;
  var wahl = 0, turbo = false, bewiesen = null;

  function init() {
    canvas = document.getElementById('buehne');
    ctx = canvas.getContext('2d');
    canvas.width = BREITE; canvas.height = PH.HOEHE;
    waehle(0);
    batte('liste', LV.LEVEL);
    klemmen();
    requestAnimationFrame(rahmen);
  }

  function batte(id, level) {
    var feld = document.getElementById(id);
    feld.innerHTML = '';
    level.forEach(function (def, i) {
      var knopf = document.createElement('button');
      knopf.type = 'button';
      knopf.textContent = def.name;
      knopf.title = def.stufe + ', Ziel ' + LV.STUFEN[def.stufe].ms + ' ms';
      knopf.style.borderColor = GD.render.STUFEN_FARBEN[def.stufe] || '#555';
      knopf.addEventListener('click', function () { waehle(i); knopf.blur(); });
      feld.appendChild(knopf);
    });
  }

  function waehle(i) {
    wahl = i;
    var def = LV.LEVEL[i];
    lauf = { level: PH.baue(def), z: null, pause: 0, vorhin: false };
    lauf.z = SP.zustandNeu(lauf.level);
    bewiesen = null;
    var t = document.getElementById('titel');
    t.textContent = def.name + '  ·  ' + def.stufe + '  ·  Ziel ' + LV.STUFEN[def.stufe].ms + ' ms';
    t.style.color = GD.render.STUFEN_FARBEN[def.stufe] || '#fff';
  }

  function neuStart() {
    lauf.z = SP.zustandNeu(lauf.level);
    lauf.pause = 0; lauf.tot = false; lauf.durch = false;
  }

  var letzter = 0, hoffnung = 0;
  function rahmen(ms) {
    requestAnimationFrame(rahmen);
    if (!letzter) letzter = ms;
    var dt = Math.min(0.05, (ms - letzter) / 1000);
    letzter = ms;

    /* 240 Hz Kern, 60 Hz Bildschirm: der Nachlauf wird in ganzen Schritten
       abgearbeitet, nie mit einem geglaetteten dt. Ein geglaettetes dt macht aus
       einem praezisen Sprung einen, der zwei Pixel zu frueh oder zu spaet ist —
       und bei 168 ms Fenster sind zwei Pixel die Haelfte der Antwort. */
    hoffnung += dt;
    var n = 0;
    while (hoffnung >= FIXED_DT && n < 12) { schrittchen(); hoffnung -= FIXED_DT; n++; }
    if (n === 12) hoffnung = 0;

    var kamera = Math.max(0, lauf.z.x - BREITE * 0.32);
    GD.render.zeichne(ctx, lauf.level, lauf.z, kamera, LV.LEVEL[wahl].stufe);
    meldung();
  }

  function schrittchen() {
    var z = lauf.z;
    if (z.tot || z.durch) {
      lauf.pause += FIXED_DT;
      if (lauf.pause > DEATH_T && taste) neuStart();
      return;
    }
    var klick = 0, halten = 0;
    if (turbo) {
      var e = SP.bot(z);
      klick = e.klick; halten = e.halten;
    } else {
      halten = (taste || zeiger) ? 1 : 0;
      /* Klick = die Flanke, nicht der Zustand. Der Kern hat eine Vorwahl von
         0.16 s; ein durchgehendes Signal waere kein Sprung, sondern Dauerdruck. */
      klick = (taste || zeiger) && !lauf.vorhin ? 1 : 0;
    }
    SP.schritt(z, klick, halten);
    lauf.vorhin = (taste || zeiger);
  }

  function meldung() {
    var f = document.getElementById('fuss');
    var z = lauf.z;
    if (z.tot) { f.textContent = 'Tot bei ' + prozent() + ' %  —  Leertaste oder Klick startet neu'; return; }
    if (z.durch) {
      if (!bewiesen) bewiesen = fortgeschritten();
      f.textContent = 'Geschafft, ' + prozent() + ' %.' + bewiesen; return;
    }
    f.textContent = turbo ? 'Der Bot faehrt. Leertaste zurueck zum Menschen.'
      : (taste || zeiger ? 'Druck liegt an.' : 'Leertaste, Maustaste oder Touch fuer Sprung / Steigen.');
  }

  function prozent() {
    var z = lauf.z;
    return Math.max(0, Math.min(100, (z.x - PH.START_X) / (lauf.level.endX - PH.START_X) * 100)).toFixed(1);
  }

  /* Beim Durchfahren wird nachgesehen, ob das Level sein Stufenziel haelt —
     dieselbe Rechnung wie in der Suite, nicht eine vereinfachte. */
  function fortgeschritten() {
    var stufe = LV.LEVEL[wahl].stufe, ziel = LV.STUFEN[stufe].ms;
    var a = SP.audit(lauf.level);
    var treffer = a.fenster.filter(function (f) { return Math.abs(f.ms - ziel) <= 6; }).length;
    var braucht = (stufe === 'WAHNSINN' || stufe === 'EXTREM') ? 2 : 1;
    return ' Engstes Fenster ' + a.engstes.toFixed(0) + ' ms, Ziel ' + ziel
      + ' ms ' + treffer + '/' + braucht + (treffer >= braucht ? ' erfuellt.' : ' VERFEHLT.');
  }

  function klemmen() {
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        if (!e.repeat) taste = true;
        e.preventDefault();
      }
      if (e.code === 'KeyR') neuStart();
      if (e.code === 'KeyB') { turbo = !turbo; neuStart(); }
      if (e.code === 'BracketRight') waehle((wahl + 1) % LV.LEVEL.length);
      if (e.code === 'BracketLeft') waehle((wahl + LV.LEVEL.length - 1) % LV.LEVEL.length);
    });
    window.addEventListener('keyup', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') taste = false;
    });
    canvas.addEventListener('pointerdown', function (e) { zeiger = true; e.preventDefault(); });
    window.addEventListener('pointerup', function () { zeiger = false; });
    window.addEventListener('blur', function () { taste = false; zeiger = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
