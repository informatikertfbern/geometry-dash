/* render.js — die Zeichenseite. Sie kennt nur die Objektform aus physik.js und
   erfindet nichts eigenes: ein Feld, das baue() nicht setzt, wird hier nicht
   gelesen. Das ist dieselbe Regel wie im Kern — dieselbe Groesse an zwei Orten
   mit zwei Ergebnissen war hier der haufigste Fehler. */
(function (global) {
  'use strict';
  var PH = global.GD.PH;
  var CELL = PH.CELL, GROUND = PH.GROUND, CEIL = PH.CEIL, P = PH.P, T = PH.T;
  var MODI = PH.MODI, BREITE = PH.BREITE, HOEHE = PH.HOEHE;

  var FARBEN = {
    grund: '#0b0d1a', boden: '#1b2044', kante: '#4de2ff',
    hindernis: '#ff3d6e', hindernisKante: '#ff9db4',
    masse: '#2f7cff', masseKante: '#9dc4ff',
    muenze: '#ffd93d', pad: '#39ff88', orb: '#c77dff',
    portal: '#7cf0ff', tempo: '#ffb347', grav: '#ff7ad9',
    spieler: '#f5f7ff', spielerKern: '#4de2ff', fin: '#8ef7a0',
  };

  var STUFEN_FARBEN = {
    EASY: '#39ff88', NORMAL: '#7cf0ff', 'NORMAL+': '#4de2ff', HARD: '#ffb347',
    'HARD+': '#ff9047', EXTREM: '#ff5d5d', WAHNSINN: '#c77dff',
  };

  function zeichne(ctx, level, z, kamera, stufe) {
    ctx.save();
    ctx.fillStyle = FARBEN.grund;
    ctx.fillRect(0, 0, BREITE, HOEHE);
    ctx.translate(-kamera, 0);

    bahn(ctx, kamera);
    for (var i = 0; i < level.objs.length; i++) objekt(ctx, level.objs[i], z);
    spieler(ctx, z);
    ctx.restore();

    texte(ctx, level, z, stufe);
  }

  /* Boden, Decke und das laufende Raster: ohne Raster wirkt der Stillstand
     langsam, weil nichts mitzieht. */
  function bahn(ctx, kamera) {
    ctx.fillStyle = FARBEN.boden;
    ctx.fillRect(kamera, GROUND, BREITE, HOEHE - GROUND);
    ctx.fillRect(kamera, 0, BREITE, CEIL);
    ctx.strokeStyle = FARBEN.kante;
    ctx.globalAlpha = 0.75; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(kamera, GROUND); ctx.lineTo(kamera + BREITE, GROUND);
    ctx.moveTo(kamera, CEIL); ctx.lineTo(kamera + BREITE, CEIL); ctx.stroke();
    ctx.globalAlpha = 0.10;
    ctx.beginPath();
    var a = Math.floor(kamera / CELL) * CELL;
    for (var x = a; x < kamera + BREITE + CELL; x += CELL) {
      ctx.moveTo(x, CEIL); ctx.lineTo(x, GROUND);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function objekt(ctx, o, z) {
    switch (o.t) {
      case T.SPIKE: stachel(ctx, o); break;
      case T.BLOCK: flaeche(ctx, o.x, o.y, o.w, o.h); break;
      case T.PLAT: flaeche(ctx, o.x, o.y, o.w, o.h); break;
      case T.PILLAR: flaeche(ctx, o.x, o.y, o.w, o.h); break;
      case T.COIN: muenze(ctx, o, z); break;
      case T.PAD: pad(ctx, o); break;
      case T.ORB: orb(ctx, o); break;
      case T.PORTAL: portal(ctx, o); break;
      case T.SPD: tempo(ctx, o); break;
      case T.GRAV: grav(ctx, o); break;
      case T.FIN: fin(ctx, o); break;
    }
  }

  function stachel(ctx, o) {
    var hoch = 26;
    ctx.fillStyle = FARBEN.hindernis;
    ctx.beginPath();
    if (o.down) {
      ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + CELL, o.y);
      ctx.lineTo(o.x + CELL / 2, o.y + hoch);
    } else {
      ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + CELL, o.y);
      ctx.lineTo(o.x + CELL / 2, o.y - hoch);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = FARBEN.hindernisKante; ctx.lineWidth = 1; ctx.stroke();
  }

  function flaeche(ctx, x, y, w, h) {
    ctx.fillStyle = FARBEN.masse;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = FARBEN.masseKante; ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  }

  function muenze(ctx, o, z) {
    var genommen = z.genommen && z.genommen.has(o);
    ctx.globalAlpha = genommen ? 0.25 : 1;
    ctx.fillStyle = FARBEN.muenze;
    ctx.beginPath(); ctx.arc(o.x + 9, o.y, 8, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function pad(ctx, o) {
    ctx.fillStyle = FARBEN.pad;
    ctx.fillRect(o.x, o.y, CELL, 10);
  }

  function orb(ctx, o) {
    ctx.strokeStyle = FARBEN.orb; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(o.x + CELL / 2, o.y, 13, 0, 6.2832); ctx.stroke();
  }

  function portal(ctx, o) {
    ctx.strokeStyle = FARBEN.portal; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, 9, (GROUND - CEIL) / 2 - 6, 0, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = FARBEN.portal;
    ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(o.modus || '', o.x, CEIL + 16);
  }

  function tempo(ctx, o) {
    ctx.strokeStyle = FARBEN.tempo; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, 7, (GROUND - CEIL) / 2 - 6, 0, 0, 6.2832);
    ctx.stroke();
    ctx.fillStyle = FARBEN.tempo;
    ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText(o.name || '', o.x, GROUND - 8);
  }

  function grav(ctx, o) {
    ctx.strokeStyle = FARBEN.grav; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(o.x, o.y, 7, (GROUND - CEIL) / 2 - 6, 0, 0, 6.2832);
    ctx.stroke();
  }

  function fin(ctx, o) {
    ctx.strokeStyle = FARBEN.fin; ctx.lineWidth = 4;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(o.x, CEIL); ctx.lineTo(o.x, GROUND); ctx.stroke();
    ctx.setLineDash([]);
  }

  function spieler(ctx, z) {
    var x = z.x, y = z.y;
    ctx.save();
    ctx.translate(x + P / 2, y + P / 2);
    if (z.modus === MODI.SCHIFF) {
      ctx.rotate(Math.max(-0.5, Math.min(0.5, z.vy / 700)));
      ctx.fillStyle = FARBEN.spieler;
      ctx.beginPath();
      ctx.moveTo(P / 2, 0); ctx.lineTo(-P / 2, -P / 2 + 3);
      ctx.lineTo(-P / 2 + 6, 0); ctx.lineTo(-P / 2, P / 2 - 3);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.rotate(z.zeit * 7 * (z.modus === MODI.WUERFEL ? 1 : 0.4));
      ctx.fillStyle = FARBEN.spieler;
      ctx.fillRect(-P / 2, -P / 2, P, P);
      ctx.fillStyle = FARBEN.spielerKern;
      ctx.fillRect(-P / 6, -P / 6, P / 3, P / 3);
    }
    ctx.restore();
  }

  function texte(ctx, level, z, stufe) {
    var fort = Math.max(0, Math.min(1, (z.x - PH.START_X) / (level.endX - PH.START_X)));
    ctx.fillStyle = 'rgba(8,10,22,0.72)';
    ctx.fillRect(0, 0, BREITE, 34);
    ctx.fillStyle = STUFEN_FARBEN[stufe] || FARBEN.kante;
    ctx.fillRect(0, 30, BREITE * fort, 4);
    ctx.font = '13px monospace'; ctx.textAlign = 'left';
    ctx.fillStyle = FARBEN.spieler;
    ctx.fillText(level.name + '   ' + (stufe || ''), 12, 21);
    ctx.textAlign = 'center';
    ctx.fillText((fort * 100).toFixed(1) + ' %', BREITE / 2, 21);
    ctx.textAlign = 'right';
    ctx.fillStyle = FARBEN.muenze;
    ctx.fillText('Muenzen ' + z.muenzen, BREITE - 12, 21);
    ctx.textAlign = 'left';
  }

  global.GD.render = { zeichne: zeichne, STUFEN_FARBEN: STUFEN_FARBEN };
})(typeof window !== 'undefined' ? window : globalThis);
