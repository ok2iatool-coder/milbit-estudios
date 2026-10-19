// La web se juega. Un personaje corre por encima de las palabras de la pagina: cada palabra es una
// plataforma a la altura REAL de su tinta (measureText con la misma letra que la pagina, asi que
// «pequeños» se pisa mas bajo que «Juegos»), las lineas de seccion son suelos y la meta esta en la
// linea del pie. Por el camino hay bits que coger y un cronometro.
// Tambien son plataformas los botones, las tarjetas de juego, el logo de Boundland, los datos, la
// foto del estudio y las capturas que se ven enteras en la tira. Se juega desde «Jugar esta web»
// (cabecera y pie) o con la J; sin jugar no se dibuja nada y la pagina va como siempre.
// Las plataformas se pisan por arriba y se atraviesan por abajo; las palabras altas hacen de pared
// salvo que el escalon sea pequeno (se sube andando).
(() => {
  const lienzo = document.getElementById('escena');
  if (!lienzo) return;
  const ctx = lienzo.getContext('2d');
  const medidor = document.createElement('canvas').getContext('2d');
  const raiz = document.documentElement;
  const QUIETO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TACTIL = matchMedia('(hover: none)').matches;
  const DEPURAR = /[?&]debug\b/.test(location.search);

  // Pixeles CSS y segundos. Salto de 155 px: llega de una linea del titular a la de encima.
  const ANCHO = 18, ALTO = 22;
  const G = 2600, SALTO = 900, CORTE = 0.42, VMAX = 330, ACEL = 2800, FRENO = 3200, AIRE = 0.7, CAIDA = 1500;
  const PASO = 1 / 120, ESCALON = 9, GRACIA = 0.09, MEMORIA = 0.12, N_BITS = 16;

  // la cabecera queda fuera: es fija y sus palabras no estan quietas en la pagina
  const TEXTO = 'main h1, main h2, main p, main dt, main dd, .tarjeta__nombre, .tarjeta__estado, .correo, .pie__nav a, .pie__nav button, .pie__abajo p, .pie__abajo a';
  const CAJAS = 'main .pastilla, .accion, .tarjeta, .dato, .estudio__foto, .portada__logo, .tira figure';
  const LINEAS = '.pie__arriba';
  const BLANCO = '#f7f6f3', NEGRO = '#0d0d0c';   // se ve igual sobre la portada, las bandas y el pie

  let cajas = [];          // { x0, x1, y, yb, linea, zona }: y es lo que se pisa, yb el fondo
  let bits = [];           // { x, y, cogido, fase }
  let meta = null;         // { x, y }
  let inicio = { x: 0, y: 0 };
  let fondo = 1e9, limites = { izq: 0, der: 1e9 };

  const j = { x: 0, y: -1e4, vx: 0, vy: 0, enSuelo: false, suelo: null, gracia: 0, memoria: 0, atraviesa: null, dir: 1, aplasta: 0, paso: 0 };
  const entrada = { izq: false, der: false, saltar: false, bajar: false, saltarPulsado: false, bajarPulsado: false };
  let jugando = false, terminado = false, arrancado = false, listo = false;
  let reloj = 0, recogidos = 0, particulas = [];

  // ------------------------------------------------------------------ el mundo, medido en la pagina

  function medir() {
    const sx = scrollX, sy = scrollY;
    const rango = document.createRange(), fuentes = new Map(), vistos = new Set(), nuevas = [];
    for (const el of document.querySelectorAll(TEXTO)) {
      if (!el.getClientRects().length) continue;
      const zona = el.closest('header') ? 'cabecera' : el.closest('h1') ? 'titular' : 'cuerpo';
      const paseo = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = paseo.nextNode());) {
        if (vistos.has(n)) continue;
        vistos.add(n);
        const padre = n.parentElement;
        let f = fuentes.get(padre);
        if (!f) {
          const cs = getComputedStyle(padre);
          f = { letra: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, tam: parseFloat(cs.fontSize) };
          medidor.font = f.letra;
          f.sube = medidor.measureText('Hg').fontBoundingBoxAscent;
          fuentes.set(padre, f);
        }
        medidor.font = f.letra;
        // la letra grande se pisa letra a letra (la «u» de «Juegos» esta 30 px por debajo de la «J»);
        // la pequena, palabra a palabra: sus diferencias caben en un escalon
        const trozo = f.tam >= 36 ? /\S/g : /\S+/g;
        for (const m of n.data.matchAll(trozo)) {
          rango.setStart(n, m.index);
          rango.setEnd(n, m.index + m[0].length);
          const r = rango.getClientRects()[0];
          if (!r || r.width < 1) continue;
          const base = r.top + f.sube;                       // linea base del texto
          const tope = medidor.measureText(m[0]).actualBoundingBoxAscent;
          if (tope <= 0) continue;
          nuevas.push({ x0: r.left + sx, x1: r.right + sx, y: base - tope + sy, yb: base + sy, zona });
        }
      }
    }
    const tira = document.querySelector('.tira')?.getBoundingClientRect();
    for (const el of document.querySelectorAll(CAJAS)) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      if (tira && el.closest('.tira') && (r.left < tira.left - 1 || r.right > tira.right + 1)) continue;  // medio fuera de la tira
      nuevas.push({ x0: r.left + sx, x1: r.right + sx, y: r.top + sy, yb: r.bottom + sy, zona: 'cuerpo' });
    }
    let pie = null;
    for (const el of document.querySelectorAll(LINEAS)) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      pie = { x0: r.left + parseFloat(cs.paddingLeft) + sx, x1: r.right - parseFloat(cs.paddingRight) + sx, y: r.top + sy, yb: r.top + sy, linea: true, zona: 'cuerpo' };
      nuevas.push(pie);
    }
    cajas = nuevas;
    // el mundo acaba en los margenes del contenido (los de la linea del pie): asi no se sale por un lado
    limites = pie ? { izq: pie.x0, der: pie.x1 } : { izq: 0, der: raiz.clientWidth };
    fondo = raiz.scrollHeight - 1;
    meta = pie ? { x: pie.x1 - 12, y: pie.y } : null;

    // salida: encima de la primera letra del titular de la portada
    const primera = cajas.find((c) => c.zona === 'titular');
    const portada = document.querySelector('.portada').getBoundingClientRect().top + sy;
    if (primera) inicio = { x: (primera.x0 + primera.x1) / 2, y: Math.max(portada + ALTO + 16, primera.y - 130), sobre: primera.y };
  }

  // Un bit por linea de texto, repartidos de arriba abajo; cada uno a 44 px sobre su palabra,
  // al alcance de un salto desde ella. Si cae encima de otra palabra se sube por encima.
  function ponerBits() {
    const lineas = [];
    for (const c of cajas) {
      if (c.linea || c.zona === 'cabecera' || c.x1 - c.x0 < 14) continue;
      const l = lineas.find((l) => Math.abs(l.yb - c.yb) < 2);
      if (l) l.p.push(c); else lineas.push({ yb: c.yb, p: [c] });
    }
    lineas.sort((a, b) => a.yb - b.yb);
    const n = Math.min(N_BITS, lineas.length), viejos = bits;
    bits = [];
    for (let i = 0; i < n; i++) {
      const l = lineas[Math.floor((i + 0.5) * lineas.length / n)];
      l.p.sort((a, b) => a.x0 - b.x0);
      const p = l.p[[0, Math.floor(l.p.length / 2), l.p.length - 1][i % 3]];
      const x = (p.x0 + p.x1) / 2;
      // a 44, 32 o 24 px sobre la palabra, lo primero que no pise texto ni una linea de seccion;
      // si todo pisa, por encima de lo que lo tapa
      const tapa = (y) => cajas.find((c) => x > c.x0 - 8 && x < c.x1 + 8 &&
        (c.linea ? Math.abs(y - c.y) < 10 : y > c.y - 10 && y < c.yb + 13));
      let y = [44, 32, 24].map((d) => p.y - d).find((y) => !tapa(y));
      if (y === undefined) {
        y = p.y - 44;
        for (let k = 0, c; k < 4 && (c = tapa(y)); k++) y = c.y - 16;
      }
      bits.push({ x, y, cogido: viejos[i]?.cogido || false, fase: i * 1.7 });
    }
  }

  function colocar(p) {
    Object.assign(j, { x: p.x, y: p.y, vx: 0, vy: 0, enSuelo: false, suelo: null, atraviesa: null, dir: 1 });
    if (QUIETO && p.sobre !== undefined) j.y = p.sobre;
  }

  // ------------------------------------------------------------------ fisica (paso fijo)

  function paso(dt) {
    const dir = (entrada.der ? 1 : 0) - (entrada.izq ? 1 : 0);
    const agarre = j.enSuelo ? 1 : AIRE;
    if (dir) {
      j.vx = Math.max(-VMAX, Math.min(VMAX, j.vx + dir * ACEL * agarre * dt));
      j.dir = dir;
    } else {
      const f = FRENO * agarre * dt;
      j.vx = Math.abs(j.vx) <= f ? 0 : j.vx - Math.sign(j.vx) * f;
    }
    if (entrada.saltarPulsado) { j.memoria = MEMORIA; entrada.saltarPulsado = false; }
    if (entrada.bajarPulsado) {
      entrada.bajarPulsado = false;
      if (j.enSuelo && !j.suelo?.firme) { j.atraviesa = j.suelo.y; j.enSuelo = false; j.gracia = 0; }
    }
    if (j.memoria > 0 && j.gracia > 0) {
      j.vy = -SALTO; j.memoria = 0; j.gracia = 0; j.enSuelo = false; j.aplasta = -0.28; j.atraviesa = null;
      sonar('salto');
    }
    if (!entrada.saltar && j.vy < -SALTO * CORTE) j.vy = -SALTO * CORTE;   // salto corto si se suelta
    j.memoria = Math.max(0, j.memoria - dt);
    j.gracia = Math.max(0, j.gracia - dt);
    j.vy = Math.min(CAIDA, j.vy + G * dt);

    // en horizontal las palabras son paredes, salvo un escalon pequeno que se sube andando
    const x0 = j.x;
    j.x += j.vx * dt;
    for (const c of cajas) {
      if (c.linea || j.y - c.y <= ESCALON || j.y - ALTO >= c.yb) continue;
      const antes = x0 + ANCHO / 2 > c.x0 && x0 - ANCHO / 2 < c.x1;
      const ahora = j.x + ANCHO / 2 > c.x0 && j.x - ANCHO / 2 < c.x1;
      if (!antes && ahora) { j.x = j.x > x0 ? c.x0 - ANCHO / 2 : c.x1 + ANCHO / 2; j.vx = 0; }
    }
    if (j.x < limites.izq + ANCHO / 2 || j.x > limites.der - ANCHO / 2) {
      j.x = Math.max(limites.izq + ANCHO / 2, Math.min(limites.der - ANCHO / 2, j.x));
      j.vx = 0;
    }

    // en vertical se pisa por arriba y se atraviesa por abajo
    const y0 = j.y, estaba = j.enSuelo;
    j.y += j.vy * dt;
    j.enSuelo = false;
    if (j.atraviesa !== null && j.y > j.atraviesa + 6) j.atraviesa = null;
    if (j.vy >= 0) {
      let pisa = null;
      for (const c of cajas) {
        if (j.x + ANCHO / 2 <= c.x0 || j.x - ANCHO / 2 >= c.x1) continue;
        if (j.atraviesa !== null && c.y <= j.atraviesa + 0.5) continue;
        if (y0 <= c.y + (estaba ? ESCALON : 0.5) && j.y >= c.y && (!pisa || c.y < pisa.y)) pisa = c;
      }
      if (!pisa && j.y >= fondo) pisa = { y: fondo, firme: true };
      if (pisa) {
        if (!estaba && j.vy > 520) { j.aplasta = Math.min(0.3, j.vy / 3200); polvo(); sonar('suelo'); }
        j.y = pisa.y; j.vy = 0; j.enSuelo = true; j.suelo = pisa; j.gracia = GRACIA;
      }
    }
    if (j.enSuelo && Math.abs(j.vx) > 20) j.paso += Math.abs(j.vx) * dt;

    if (jugando && !terminado) {
      for (const b of bits) {
        if (!b.cogido && Math.abs(b.x - j.x) < 17 && Math.abs(b.y - (j.y - ALTO / 2)) < 19) {
          b.cogido = true; recogidos++;
          particulas.push({ tipo: 'anillo', x: b.x, y: b.y, t: 0, vida: 0.45 });
          sonar('bit'); pintarMarcador();
        }
      }
      if (meta && j.enSuelo && Math.abs(j.y - meta.y) < 1 && Math.abs(j.x - meta.x) < 22) terminar();
    }
  }

  function polvo() {
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? -1 : 1;
      particulas.push({ tipo: 'mota', x: j.x + s * 6, y: j.y - 1, vx: s * (50 + (i % 3) * 45), vy: -40 - (i % 3) * 35, t: 0, vida: 0.35 });
    }
  }

  // ------------------------------------------------------------------ partida

  const hud = document.querySelector('.hud');
  const final = document.querySelector('.final');
  const mandos = document.querySelector('.mandos');
  const botonesJugar = [...document.querySelectorAll('[data-jugar]')];
  const marcadorBits = document.querySelector('[data-hud-bits]');
  const marcadorTiempo = document.querySelector('[data-hud-tiempo]');
  const botonMudo = document.querySelector('[data-mudo]');

  const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const reloj$ = (s) => { const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(1).padStart(4, '0').replace('.', ',')}`; };

  function pintarMarcador() {
    marcadorBits.textContent = `${recogidos}/${bits.length}`;
    marcadorTiempo.textContent = reloj$(reloj);
  }

  function rotular(jugandoYa) {
    for (const b of botonesJugar) {
      b.setAttribute('aria-pressed', String(jugandoYa));
      b.textContent = jugandoYa ? 'Salir del juego' : 'Jugar esta web';
    }
  }

  // siempre se sale de la portada, sobre la primera letra del titular; la camara sube hasta alli
  function empezar() {
    if (!listo) return;
    medir(); ponerBits();
    for (const b of bits) b.cogido = false;
    jugando = true; terminado = false; arrancado = false; reloj = 0; recogidos = 0; particulas = [];
    colocar(inicio);
    document.body.classList.add('jugando');
    hud.hidden = false; final.hidden = true; mandos.hidden = !TACTIL;
    rotular(true);
    pintarMarcador();
    arrancar();
  }

  function salir() {
    jugando = false; terminado = false;
    soltarTodo();
    document.body.classList.remove('jugando');
    hud.hidden = true; final.hidden = true; mandos.hidden = true;
    rotular(false);
    arrancar();
  }

  function terminar() {
    terminado = true;
    soltarTodo();
    sonar('meta');
    for (let i = 0; i < 18; i++) particulas.push({ tipo: 'mota', x: meta.x, y: meta.y - 40, vx: Math.cos(i * 0.35) * (120 + (i % 4) * 50), vy: -260 - (i % 5) * 50, t: 0, vida: 0.9, g: 900 });
    let record = null;
    try { record = JSON.parse(leer('milbit-record')); } catch {}
    const mejor = !record || recogidos > record.bits || (recogidos === record.bits && reloj < record.t);
    if (mejor) { record = { t: reloj, bits: recogidos }; guardar('milbit-record', JSON.stringify(record)); }
    document.querySelector('[data-final-tiempo]').textContent = reloj$(reloj);
    document.querySelector('[data-final-det]').textContent =
      `${recogidos} de ${bits.length} bits. ` + (mejor ? 'Tu mejor partida.' : `Tu mejor: ${reloj$(record.t)} con ${record.bits} bits.`);
    setTimeout(() => { if (terminado) { final.hidden = false; final.querySelector('[data-otra]').focus(); } }, 500);
  }

  function otraVez() { if (listo) empezar(); }

  function soltarTodo() {
    Object.assign(entrada, { izq: false, der: false, saltar: false, bajar: false, saltarPulsado: false, bajarPulsado: false });
    for (const b of mandos.querySelectorAll('.pulsado')) b.classList.remove('pulsado');
  }

  // ------------------------------------------------------------------ sonido sintetizado

  let audio = null, mudo = leer('milbit-mudo') === '1';
  botonMudo.setAttribute('aria-pressed', String(!mudo));
  botonMudo.textContent = mudo ? 'Sin sonido' : 'Sonido';
  botonMudo.addEventListener('click', () => {
    mudo = !mudo; guardar('milbit-mudo', mudo ? '1' : '0');
    botonMudo.setAttribute('aria-pressed', String(!mudo));
    botonMudo.textContent = mudo ? 'Sin sonido' : 'Sonido';
  });

  function sonar(que) {
    if (mudo || !jugando) return;
    try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    if (audio.state === 'suspended') audio.resume();
    const t = audio.currentTime;
    const nota = (f0, f1, dur, tipo, vol, luego = 0) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(f0, t + luego);
      o.frequency.exponentialRampToValueAtTime(f1, t + luego + dur);
      g.gain.setValueAtTime(vol, t + luego);
      g.gain.exponentialRampToValueAtTime(0.0001, t + luego + dur);
      o.connect(g).connect(audio.destination);
      o.start(t + luego); o.stop(t + luego + dur + 0.02);
    };
    if (que === 'salto') nota(330, 660, 0.09, 'square', 0.03);
    else if (que === 'suelo') nota(150, 70, 0.07, 'triangle', 0.08);
    else if (que === 'bit') { nota(988, 988, 0.06, 'square', 0.025); nota(1319, 1319, 0.12, 'square', 0.025, 0.06); }
    else if (que === 'meta') [523, 659, 784, 1047].forEach((f, i) => nota(f, f, 0.16, 'square', 0.03, i * 0.09));
  }

  // ------------------------------------------------------------------ dibujo

  let W = 0, H = 0, dpr = 1;
  function ajustarLienzo() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = lienzo.clientWidth; H = lienzo.clientHeight;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
  }
  const px = (v) => Math.round(v * dpr) / dpr;   // a pixel entero de la pantalla: bordes nitidos

  function dibujar(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ox = -scrollX, oy = -scrollY;

    if (DEPURAR) {
      ctx.strokeStyle = 'rgba(255,0,0,.5)'; ctx.lineWidth = 1;
      for (const c of cajas) ctx.strokeRect(c.x0 + ox, c.y + oy, c.x1 - c.x0, Math.max(1, c.yb - c.y));
    }

    if (!jugando && !particulas.length) return;
    // todo en blanco con un borde negro: se lee igual sobre la portada, las bandas claras y el pie
    ctx.lineWidth = 2; ctx.strokeStyle = NEGRO; ctx.fillStyle = BLANCO; ctx.lineJoin = 'miter';
    if (jugando) {
      for (const b of bits) {
        if (b.cogido) continue;
        ctx.beginPath();
        ctx.arc(b.x + ox, b.y + oy + Math.sin(t * 3 + b.fase) * 3, 5.5, 0, Math.PI * 2);
        ctx.stroke(); ctx.fill();
      }
      if (meta) {
        const mx = px(meta.x + ox), my = px(meta.y + oy), ola = Math.sin(t * 6) * 1.5;
        ctx.beginPath();
        ctx.rect(mx - 1, my - 48, 2, 48);
        ctx.moveTo(mx + 1, my - 48); ctx.lineTo(mx + 21, my - 44 + ola); ctx.lineTo(mx + 1, my - 36);
        ctx.stroke(); ctx.fill();
      }
    }

    for (const p of particulas) {
      const k = p.t / p.vida;
      ctx.globalAlpha = 1 - k;
      if (p.tipo === 'anillo') {
        ctx.lineWidth = 4; ctx.strokeStyle = NEGRO;
        ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, 5 + k * 20, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = BLANCO; ctx.stroke();
      } else {
        ctx.fillStyle = NEGRO; ctx.fillRect(px(p.x + ox - 2.5), px(p.y + oy - 2.5), 5, 5);
        ctx.fillStyle = BLANCO; ctx.fillRect(px(p.x + ox - 1.5), px(p.y + oy - 1.5), 3, 3);
      }
    }
    ctx.globalAlpha = 1;
    if (!jugando) return;

    // el personaje: un bloque con ojos y dos pies; se aplasta al caer y se estira al saltar
    const a = j.aplasta, w = ANCHO * (1 + a), h = (ALTO - 4) * (1 - a);
    const x = px(j.x + ox - w / 2), pie = px(j.y + oy), y = px(pie - 4 - h);
    const zancada = j.enSuelo && Math.abs(j.vx) > 20 ? Math.sin(j.paso / 9) : 0;
    const alzaI = j.enSuelo ? Math.max(0, zancada) * 3 : 2, alzaD = j.enSuelo ? Math.max(0, -zancada) * 3 : 2;
    ctx.beginPath();
    ctx.rect(x, y, px(w), px(h));
    ctx.rect(px(j.x + ox - 7), px(pie - 4 - alzaI), 4, px(4 - alzaI * 0.4));
    ctx.rect(px(j.x + ox + 3), px(pie - 4 - alzaD), 4, px(4 - alzaD * 0.4));
    ctx.lineWidth = 3; ctx.strokeStyle = NEGRO; ctx.stroke();
    ctx.fillStyle = BLANCO; ctx.fill();
    const cerrado = (t % 4.3) < 0.12;
    const ojoH = cerrado ? 1 : 5, mira = j.dir * 2.5 + (j.vx / VMAX) * 1.5;
    ctx.fillStyle = NEGRO;
    ctx.fillRect(px(x + w / 2 - 5 + mira), px(y + 5 + (5 - ojoH) / 2), 3, ojoH);
    ctx.fillRect(px(x + w / 2 + 2 + mira), px(y + 5 + (5 - ojoH) / 2), 3, ojoH);
  }

  // ------------------------------------------------------------------ bucle (solo cuando hace falta)

  let corriendo = false, antes = 0, sobra = 0;
  function bucle(ahora) {
    const dt = Math.min(0.05, (ahora - antes) / 1000 || 0);
    antes = ahora;
    if (jugando) {
      sobra += dt;
      while (sobra >= PASO) { paso(PASO); sobra -= PASO; }
      if (arrancado && !terminado) { reloj += dt; marcadorTiempo.textContent = reloj$(reloj); }
      // la cabecera es fija: el personaje va al 42 % de lo que queda debajo de ella
      const cab = document.querySelector('.barra').offsetHeight;
      const max = raiz.scrollHeight - innerHeight;
      const objetivo = Math.max(0, Math.min(max, j.y - ALTO - cab - (innerHeight - cab) * 0.42));
      const y = scrollY + (objetivo - scrollY) * (1 - Math.exp(-dt * 7));
      if (Math.abs(y - scrollY) > 0.5) scrollTo({ top: y, behavior: 'instant' });
    }
    j.aplasta *= Math.exp(-dt * 10);
    for (const p of particulas) {
      p.t += dt;
      if (p.tipo === 'mota') { p.vy += (p.g || 600) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    }
    particulas = particulas.filter((p) => p.t < p.vida);
    dibujar(ahora / 1000);
    if (jugando || particulas.length) requestAnimationFrame(bucle);
    else { corriendo = false; dibujar(0); }
  }
  function arrancar() {
    if (corriendo || !listo) return;
    corriendo = true;
    antes = performance.now();
    requestAnimationFrame(bucle);
  }

  // ------------------------------------------------------------------ entrada

  const TECLAS = {
    ArrowLeft: 'izq', a: 'izq', A: 'izq', ArrowRight: 'der', d: 'der', D: 'der',
    ArrowUp: 'saltar', w: 'saltar', W: 'saltar', ' ': 'saltar', ArrowDown: 'bajar', s: 'bajar', S: 'bajar',
  };
  function pulsar(que) {
    if (terminado) return;
    if (que === 'saltar' && !entrada.saltar) entrada.saltarPulsado = true;
    if (que === 'bajar' && !entrada.bajar) entrada.bajarPulsado = true;
    entrada[que] = true;
    arrancado = true;
  }
  addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !listo) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    const que = TECLAS[e.key];
    if (!jugando) {
      // sin jugar solo la J empieza; las flechas y el espacio mueven la pagina como siempre
      if (e.key !== 'j' && e.key !== 'J') return;
      e.preventDefault();
      empezar();
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); salir(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); otraVez(); return; }
    if (!que) return;
    e.preventDefault();
    if (!e.repeat) pulsar(que);
  });
  addEventListener('keyup', (e) => { const que = TECLAS[e.key]; if (que) entrada[que] = false; });
  addEventListener('blur', soltarTodo);
  // jugando, la camara manda: ni rueda ni arrastre mueven la pagina
  addEventListener('wheel', (e) => { if (jugando) e.preventDefault(); }, { passive: false });
  addEventListener('touchmove', (e) => { if (jugando && !e.target.closest('.final')) e.preventDefault(); }, { passive: false });

  for (const b of mandos.querySelectorAll('[data-mando]')) {
    const que = b.dataset.mando;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('pulsado'); pulsar(que); });
    const soltar = () => { b.classList.remove('pulsado'); entrada[que] = false; };
    b.addEventListener('pointerup', soltar);
    b.addEventListener('pointercancel', soltar);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  for (const b of botonesJugar) b.addEventListener('click', () => (jugando ? salir() : empezar()));
  for (const b of document.querySelectorAll('[data-salir]')) b.addEventListener('click', salir);
  document.querySelector('[data-otra]').addEventListener('click', otraVez);

  // ------------------------------------------------------------------ arranque

  let pendiente = false;
  function remedir() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      if (!listo || !jugando) return;      // sin jugar no hace falta el mundo; se mide al empezar
      medir();
      ponerBits();
      arrancar();
    });
  }
  new ResizeObserver(() => { ajustarLienzo(); remedir(); }).observe(document.body);
  addEventListener('resize', () => { ajustarLienzo(); remedir(); });
  addEventListener('scroll', arrancar, { passive: true });
  document.addEventListener('visibilitychange', arrancar);

  ajustarLienzo();
  document.fonts.ready.then(() => {
    medir();
    colocar(inicio);
    listo = true;
    arrancar();
  });

  // Para probar sin pantalla: __juego.simular(segundos, { der: true, saltar: true }) avanza la fisica.
  window.__juego = {
    estado: () => ({ x: +j.x.toFixed(1), y: +j.y.toFixed(1), vx: +j.vx.toFixed(0), enSuelo: j.enSuelo, jugando, terminado, recogidos, bits: bits.length, cajas: cajas.length, reloj: +reloj.toFixed(2) }),
    simular(seg, e = {}) {
      soltarTodo();
      for (const [k, v] of Object.entries(e)) if (v) pulsar(k);
      for (let t = 0; t < seg; t += PASO) paso(PASO);
      soltarTodo();
      return this.estado();
    },
    empezar, salir, otraVez, mundo: () => ({ cajas, bits, meta, inicio, fondo }),
  };
})();
