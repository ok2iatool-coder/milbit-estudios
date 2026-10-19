// La portada viva: la anomalia del nivel 1 de Boundland con el Sujeto 18 flotando en medio.
// El fondo y las piezas son fotos del PROPIO JUEGO (tools/anomalia.py): el fondo es la <img> de debajo y aqui
// se pinta lo que se mueve: la cascada de luz con sus hebras que caen y sus motas (las cuentas de `cascada()`
// de boundland/web/dibujo/decorado.js, en las mismas unidades del juego), las piezas que flotan, el 18 con su
// animacion `flotar` (32 fotogramas a 12 por segundo) y el polvo de delante.
// Al bajar la pagina cada capa se queda atras a su velocidad (parallax): el fondo y lo hondo, mas despacio.
// Con movimiento reducido se pinta un fotograma quieto y sin parallax.
(async () => {
  const arte = document.querySelector('.portada__arte');
  if (!arte) return;
  const fondo = arte.querySelector('.portada__fondo');
  const lienzo = arte.querySelector('.portada__vivo');
  const ctx = lienzo.getContext('2d');
  const QUIETO = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const RUTA = 'img/anomalia/';
  const AUMENTO = 1.3;             // el 18 algo mayor que en el juego: aqui es el protagonista del cuadro
  const PARALLAX = 0.42;           // lo que se queda atras el fondo al bajar (0 = nada, 1 = se queda quieto)

  let D;
  try { D = await (await fetch(RUTA + 'datos.json')).json(); } catch { return; }
  const cargar = (src) => new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = src; });
  let hoja, piezas;
  try {
    const nombres = Object.keys(D.piezas);
    const ims = await Promise.all([cargar(RUTA + 'sujeto18_flotar.webp'), ...nombres.map((n) => cargar(RUTA + n + '.webp'))]);
    hoja = ims[0];
    piezas = nombres.map((n, k) => ({ n, ...D.piezas[n], img: ims[k + 1], fase: k * 1.73 }));
  } catch { return; }
  const hondas = piezas.filter((p) => p.prof < 0.55), cerca = piezas.filter((p) => p.prof >= 0.55);

  // mota de luz prehorneada (pintar degradados nuevos por mota y fotograma sale caro)
  const mota = document.createElement('canvas');
  mota.width = mota.height = 48;
  {
    const g = mota.getContext('2d'), r = g.createRadialGradient(24, 24, 0, 24, 24, 24);
    r.addColorStop(0, 'rgba(240,248,255,1)'); r.addColorStop(0.18, 'rgba(214,234,255,.75)');
    r.addColorStop(0.45, 'rgba(170,210,255,.18)'); r.addColorStop(1, 'rgba(150,200,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 48, 48);
  }
  // el mismo hash en todas las capas: cada hebra y cada mota tiene su sitio fijo
  const hash = (k, s) => { const v = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };

  // ---------------------------------------------------------------- medidas
  // La foto entera se acerca y se corre para que el sitio donde flotaba el 18 caiga donde lo queremos, y
  // todo (piezas, cascada, el 18) va con las mismas cuentas: la composicion es la del juego.
  let W = 0, H = 0, dpr = 1, esc = 1, ox = 0, oy = 0, u = 1, sx = 0, sy = 0, cx = 0;
  const [P18x, P18y] = D.sujeto_en, FW = D.fondo.w, FH = D.fondo.h;
  const AJUSTE = { cadena: [150, 0] };             // la cadena un poco hacia el 18: en su sitio cruzaba el titular
  function medir() {
    const r = arte.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    dpr = Math.min(devicePixelRatio || 1, 2);
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    // el 18 en medio: del hueco que deja el texto (escritorio) o del cuadro (movil y tableta)
    const apilado = getComputedStyle(arte).position !== 'absolute';
    const texto = document.querySelector('.portada__texto')?.getBoundingClientRect();
    sx = apilado || !texto ? W * 0.5 : Math.max(W * 0.58, texto.right - r.left + 0.16 * W);
    sy = H * (apilado ? 0.47 : 0.45);
    // la escala: que cubra el cuadro, que se pueda correr hasta poner al 18 en (sx, sy) y que el 18 se lea
    const altoMin = H * (apilado ? 0.3 : 0.21);
    esc = Math.max(W / FW, H / FH, sx / P18x, (W - sx) / (FW - P18x), sy / P18y, (H - sy) / (FH - P18y),
      altoMin / (D.alto_18 * AUMENTO));
    ox = sx - P18x * esc; oy = sy - P18y * esc;
    u = D.px_por_u * esc;                          // px de pantalla por unidad del juego
    cx = Math.min(ox + D.cascada_x * esc, W * 0.82);   // la cascada a su derecha, como en el nivel, sin salirse
    Object.assign(fondo.style, { inset: 'auto', left: '0px', top: '0px', width: FW * esc + 'px', height: FH * esc + 'px', objectFit: 'fill' });
  }

  // ---------------------------------------------------------------- capas
  function cascada(t, dy) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const h0 = ctx.createLinearGradient(cx - 260 * u, 0, cx + 260 * u, 0);
    h0.addColorStop(0, 'rgba(110,170,240,0)'); h0.addColorStop(0.5, 'rgba(140,195,255,.2)'); h0.addColorStop(1, 'rgba(110,170,240,0)');
    ctx.fillStyle = h0; ctx.fillRect(cx - 260 * u, 0, 520 * u, H);
    const g = ctx.createLinearGradient(cx - 70 * u, 0, cx + 70 * u, 0);
    g.addColorStop(0, 'rgba(150,205,255,0)'); g.addColorStop(0.3, 'rgba(180,222,255,.22)'); g.addColorStop(0.5, 'rgba(240,250,255,.62)');
    g.addColorStop(0.7, 'rgba(180,222,255,.22)'); g.addColorStop(1, 'rgba(150,205,255,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 70 * u, 0, 140 * u, H);
    // las hebras que caen (las rayitas): cada una con su velocidad y su largo
    const alto = H / u + 40;
    for (let k = 0; k < 30; k++) {
      const xx = cx + (-38 + hash(k, 3) * 76) * u, v = 220 + hash(k, 4) * 320, L = 90 + hash(k, 6) * 170;
      const y0 = (((t * v + hash(k, 5) * alto) % (alto + L)) - L) * u + dy * 0.3;
      const gr = ctx.createLinearGradient(0, y0, 0, y0 + L * u);
      gr.addColorStop(0, 'rgba(235,248,255,0)'); gr.addColorStop(1, 'rgba(235,248,255,.72)');
      ctx.fillStyle = gr; ctx.fillRect(xx, y0, Math.max(1, (1.2 + hash(k, 7) * 1.8) * u * 0.8), L * u);
    }
    // las motas de la columna
    for (let k = 0; k < 64; k++) {
      const yy = ((t * (50 + hash(k, 7) * 140) + hash(k, 8) * alto) % alto) * u;
      const xx = cx + Math.sin(t * 0.7 + k) * (20 + hash(k, 9) * 100) * u;
      const s = (1.2 + hash(k, 11) * 1.8) * u * 2.4;
      ctx.globalAlpha = 0.55 + hash(k, 10) * 0.45;
      ctx.drawImage(mota, xx - s, yy - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    const gb = ctx.createRadialGradient(cx, H, 0, cx, H, 280 * u);
    gb.addColorStop(0, 'rgba(200,230,255,.34)'); gb.addColorStop(1, 'rgba(200,230,255,0)');
    ctx.fillStyle = gb; ctx.fillRect(cx - 280 * u, H - 280 * u, 560 * u, 280 * u);
    ctx.restore();
  }

  function pieza(p, t, dy) {
    const w = p.w * esc, h = p.h * esc, aj = AJUSTE[p.n] || [0, 0];
    let x = ox + (p.x + aj[0]) * esc, y = oy + (p.y + aj[1]) * esc + dy;
    ctx.save();
    if (p.n === 'cadena') {
      // cuelga del techo: se mece un poco sobre su punto de arriba
      ctx.translate(x + w / 2, y); ctx.rotate(Math.sin(t * 0.55) * 0.012); ctx.drawImage(p.img, -w / 2, 0, w, h);
    } else {
      // flota: sube y baja y se ladea, cada una a su ritmo
      y += Math.sin(t * 0.62 + p.fase) * (5 + 5 * p.prof) * u;
      ctx.translate(x + w / 2, y + h / 2); ctx.rotate(Math.sin(t * 0.41 + p.fase * 1.3) * 0.03);
      ctx.drawImage(p.img, -w / 2, -h / 2, w, h);
    }
    ctx.restore();
  }

  function sujeto(t, dy) {
    const S = D.sujeto;
    const alto = D.alto_18 * esc * AUMENTO, k = alto / S.alto_cuerpo;
    const f = Math.floor(t * S.fps) % S.n;
    const bx = (f % S.cols) * S.w, by = Math.floor(f / S.cols) * S.h;
    const x = sx + Math.sin(t * 0.37) * 6 * u, y = sy + Math.sin(t * 0.9) * 9 * u + dy;
    // la luz que da: un resplandor ancho por detras
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const r = alto * 1.3, g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(200,226,255,.42)'); g.addColorStop(0.35, 'rgba(160,205,255,.16)'); g.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y); ctx.rotate(Math.sin(t * 0.52) * 0.035);
    ctx.drawImage(hoja, bx, by, S.w, S.h, -S.w * k / 2, -S.h * k / 2, S.w * k, S.h * k);
    ctx.restore();
  }

  // el polvo de delante: motas que suben despacio, aparecen y se apagan en su celda (como motas() del juego)
  function polvo(t, dy) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const C = 120 * u;
    const nx = Math.ceil(W / C) + 1, ny = Math.ceil(H / C) + 1;
    for (let i = -1; i < nx; i++) for (let j = -1; j < ny; j++) {
      const h = hash(i * 7 + 3, j * 13 + 1); if (h > 0.55) continue;
      const h2 = hash(i, j + 40), h3 = hash(i + 90, j);
      const sube = (t * (6 + h3 * 10) * u + h2 * C) % C;
      const x = i * C + h2 * C + Math.sin(t * (0.3 + h3 * 0.4) + h * 20) * 18 * u;
      const y = j * C + C - sube + dy;
      const a = Math.sin((sube / C) * Math.PI) * (0.35 + 0.35 * Math.sin(t * 2 + h * 40));
      if (a < 0.03) continue;
      const s = (1 + h3 * 1.6) * u * 3;
      ctx.globalAlpha = a; ctx.drawImage(mota, x - s, y - s, 2 * s, 2 * s);
    }
    // unas pocas grandes y borrosas, muy cerca de la camara
    for (let k = 0; k < 7; k++) {
      const x = ((hash(k, 51) * W + t * (8 + hash(k, 52) * 10) * u) % (W + 200)) - 100;
      const y = (hash(k, 53) * H + Math.sin(t * 0.3 + k) * 20 * u) + dy;
      const s = (12 + hash(k, 54) * 16) * u;
      ctx.globalAlpha = 0.07 + hash(k, 55) * 0.08; ctx.drawImage(mota, x - s, y - s, 2 * s, 2 * s);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- bucle
  let visible = false, corriendo = false, inicio = performance.now();
  const barra = document.querySelector('.barra');
  const cabecera = () => (barra && getComputedStyle(barra).position === 'sticky' ? barra.offsetHeight : 0);
  function cuadro(ahora) {
    const t = (ahora - inicio) / 1000 + 4;
    // lo que ha subido la portada por debajo de la cabecera fija
    const bajado = QUIETO ? 0 : Math.max(0, cabecera() - arte.getBoundingClientRect().top);
    fondo.style.transform = `translate3d(${ox.toFixed(1)}px, ${(oy + bajado * PARALLAX).toFixed(1)}px, 0)`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // cada capa se queda atras segun lo honda que esta: lo de delante sube casi con la pagina
    const capa = (prof) => bajado * PARALLAX * (1 - prof);
    cascada(t, capa(0.1));
    for (const p of hondas) pieza(p, t, capa(p.prof));
    sujeto(t, capa(0.5));
    for (const p of cerca) pieza(p, t, capa(p.prof));
    polvo(t, capa(0.9));
  }
  function bucle(ahora) {
    if (!visible || document.hidden) { corriendo = false; return; }
    cuadro(ahora);
    requestAnimationFrame(bucle);
  }
  function arrancar() {
    if (QUIETO) { cuadro(inicio); return; }
    if (corriendo || !visible || document.hidden) return;
    corriendo = true; requestAnimationFrame(bucle);
  }

  medir();
  new ResizeObserver(() => { medir(); if (!corriendo) cuadro(performance.now()); }).observe(arte);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; arrancar(); }).observe(arte);
  document.addEventListener('visibilitychange', arrancar);
  arte.classList.add('viva');

  // para probar sin pantalla
  window.__portada = { cuadro: (s) => cuadro(inicio + (s - 4) * 1000), medidas: () => ({ W, H, esc, u, sx, sy, cx }) };
})();
