/* TRE SPOR – tastaturstyring (Mac). Alt kan spilles uten mus.
   Tastene er valgt så de ligger direkte på et norsk tastatur (ingen Alt-kombinasjoner). */
(function (root) {
  'use strict';
  var TS = root.TS, A = TS.app, U = TS.ui;
  var K = TS.keys = {};
  var help = null;

  var SECTIONS = [
    ['Spill', [
      ['Mellomrom', 'spill / stopp'],
      ['R', 'opptak av / på (starter på neste takt)'],
      ['S', 'lagre snapshot'],
      ['⇧1 – ⇧9', 'hent snapshot 1–9 (på neste takt)'],
      ['⌘Z  ⇧⌘Z', 'angre / gjør om']
    ]],
    ['Spor', [
      ['1  2  3', 'velg trommer / bass / synth – hovedkontrollene styrer da bare det sporet'],
      ['0', 'hovedkontrollene styrer alle spor'],
      ['L', 'lås valgt spor'],
      ['M', 'demp valgt spor'],
      ['N', 'ny idé (bass / synth)']
    ]],
    ['Steg', [
      ['←  →', 'flytt markøren (⇧ = fire steg)'],
      ['↑  ↓', 'tone opp / ned (i andre felt: verdien) · trommer: velg lyd'],
      ['Enter', 'slag av / på (trommer i Aksent / Sjanse: endre)'],
      [',  .', 'forrige / neste felt: Slag, Tone, Oktav, Lengde, Sjanse']
    ]],
    ['Lyd', [
      ['−  +', 'tempo ned / opp'],
      ['T  ⇧T', 'tetthet opp / ned'],
      ['B  ⇧B', 'bevegelse opp / ned'],
      ['I  ⇧I', 'intensitet opp / ned'],
      ['U', 'utvikling av / på'],
      ['F', 'frys tilfeldighet av / på']
    ]],
    ['Fil', [
      ['⌘S', 'lagre prosjektfil'],
      ['⌘E', 'fil og eksport'],
      ['H  ?', 'vis / skjul denne oversikten'],
      ['Esc', 'lukk']
    ]]
  ];

  function buildHelp() {
    var h = U.h;
    var cols = SECTIONS.map(function (sec) {
      return h('div.kh-sec', {}, [h('h3', { text: sec[0] })].concat(sec[1].map(function (r) {
        return h('div.kh-row', {}, [h('kbd', { text: r[0] }), h('span', { text: r[1] })]);
      })));
    });
    help = h('div.sheet.keyhelp', { hidden: true, role: 'dialog', 'aria-label': 'Tastatursnarveier', onclick: function (e) { if (e.target === help) K.toggleHelp(false); } }, [
      h('div.sheet-in.kh-in', {}, [
        h('div.sheet-h', {}, [h('h2', { text: 'Spill med tastaturet' }), h('button.icon', { type: 'button', 'aria-label': 'Lukk', onclick: function () { K.toggleHelp(false); } }, ['×'])]),
        h('p.small', { text: 'Velg et spor med 1, 2 eller 3. Piltastene flytter markøren og endrer tonen, Enter slår slag av og på. Valgt spor har hvit ramme.' }),
        h('div.kh-grid', {}, cols)
      ])
    ]);
    document.getElementById('app').appendChild(help);
  }
  K.toggleHelp = function (show) {
    if (!help) buildHelp();
    help.hidden = show == null ? !help.hidden : !show;
  };

  function focusTrack(id) {
    U.focus = id;
    U.macroTarget = id;
    U.refresh();
    var c = document.getElementById('track-' + id);
    if (c && c.scrollIntoView) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    U.toast(TS.TRACK_NAMES[id] + ' valgt · hovedkontrollene styrer bare ' + TS.TRACK_NAMES[id].toLowerCase());
  }

  /* returnerer true hvis tasten ble brukt */
  K.handle = function (e) {
    var tag = (e.target && e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return false;
    var mod = e.metaKey || e.ctrlKey, key = e.key, low = key.length === 1 ? key.toLowerCase() : key;
    var ctl = U.ctl[U.focus];
    var onSlider = e.target && e.target.classList && e.target.classList.contains('sl-track');

    if (key === 'Escape') { K.toggleHelp(false); U.closeSheet(); return true; }
    if (mod) {
      if (low === 'z') { e.shiftKey ? A.redo() : A.undo(); return true; }
      if (low === 'y') { A.redo(); return true; }
      if (low === 's') { U.saveProject(true); return true; }
      if (low === 'e') { U.openSheet(); return true; }
      return false;
    }
    if (e.altKey) return false;
    if (U.sheetOpen() && key !== ' ') return false;

    if (e.code === 'Space') { A.togglePlay(); return true; }
    if (e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
      var i = +e.code.slice(5) - 1;
      if (!A.snapshots[i]) { U.toast('Snapshot ' + (i + 1) + ' finnes ikke ennå (lagre med S).'); return true; }
      A.recallSnapshot(i);
      U.toast(A.playing ? 'Snapshot ' + A.snapshots[i].name + ' kommer på neste takt.' : 'Snapshot ' + A.snapshots[i].name + ' hentet.');
      return true;
    }
    if (key === '1' || key === '2' || key === '3') { focusTrack(TS.TRACKS[+key - 1]); return true; }
    if (key === '0') { U.macroTarget = 'all'; U.refresh(); U.toast('Hovedkontrollene styrer alle spor.'); return true; }

    if (!onSlider) {
      if (key === 'ArrowLeft') { ctl.move(e.shiftKey ? -4 : -1); return true; }
      if (key === 'ArrowRight') { ctl.move(e.shiftKey ? 4 : 1); return true; }
      if (key === 'ArrowUp') { ctl.vert(1); return true; }
      if (key === 'ArrowDown') { ctl.vert(-1); return true; }
    }
    if (key === 'Enter') { ctl.enter(); return true; }
    if (key === ',') { ctl.lane(-1); return true; }
    if (key === '.') { ctl.lane(1); return true; }

    if (key === '+' || key === '=') { A.commit(['song', 'bpm'], Math.min(180, A.state.song.bpm + 1)); return true; }
    if (key === '-' || key === '_') { A.commit(['song', 'bpm'], Math.max(60, A.state.song.bpm - 1)); return true; }
    var step = e.shiftKey ? -0.05 : 0.05;
    if (low === 't') { U.nudgeMacro('density', step); return true; }
    if (low === 'b') { U.nudgeMacro('movement', step); return true; }
    if (low === 'i') { U.nudgeMacro('intensity', step); return true; }

    if (low === 'r') { A.toggleRec(); return true; }
    if (low === 's') { A.saveSnapshot(); U.toast('Snapshot ' + A.snapshots.length + ' lagret (hent med ⇧' + A.snapshots.length + ').'); return true; }
    if (low === 'l') {
      var lk = !A.state.tracks[U.focus].lock;
      A.commit(['tracks', U.focus, 'lock'], lk, { newGroup: true });
      U.toast(TS.TRACK_NAMES[U.focus] + (lk ? ' låst' : ' låst opp'));
      return true;
    }
    if (low === 'm') {
      var mu = !A.state.tracks[U.focus].mute;
      A.commit(['tracks', U.focus, 'mute'], mu, { newGroup: true });
      U.toast(TS.TRACK_NAMES[U.focus] + (mu ? ' dempet' : ' på igjen'));
      return true;
    }
    if (low === 'n') { if (ctl.idea) ctl.idea(); else U.toast('Ny idé finnes for bass og synth (velg med 2 eller 3).'); return true; }
    if (low === 'u') { var ev = !A.state.song.evolve; A.commit(['song', 'evolve'], ev, { newGroup: true }); U.toast('Utvikling ' + (ev ? 'på' : 'av')); return true; }
    if (low === 'f') { var fr = !A.state.song.freeze; A.commit(['song', 'freeze'], fr, { newGroup: true }); U.toast(fr ? 'Tilfeldighet fryst' : 'Tilfeldighet i gang igjen'); return true; }
    if (low === 'h' || key === '?') { K.toggleHelp(); return true; }
    return false;
  };

  K.init = function () {
    document.addEventListener('keydown', function (e) {
      if (K.handle(e)) e.preventDefault();
    });
    /* etter museklikk skal ikke knappen beholde fokus, ellers stjeler den mellomrom og Enter */
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button');
      if (b && e.detail > 0) b.blur();
    });
    document.addEventListener('change', function (e) {
      if (e.target.tagName === 'SELECT') e.target.blur();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
