// Lo pequeno de la pagina: correo de contacto, ano del pie y modo claro/oscuro.
(() => {
  // data-correo va en el <body>; en la copia de Artifacts, en el envoltorio que hace sus veces
  const correo = (document.querySelector('[data-correo]') || document.body).dataset.correo.trim();
  for (const a of document.querySelectorAll('[data-correo-enlace]')) {
    if (correo) {
      a.href = 'mailto:' + correo;
      a.textContent = correo;
    } else {
      a.classList.add('pendiente');
      a.removeAttribute('href');
    }
  }
  // copiar el correo: dentro de un visor (Artifacts) un mailto puede no abrir nada, asi que la direccion
  // se ve siempre y se copia con un clic; si el portapapeles no deja, se selecciona para copiarla a mano
  const copiar = document.querySelector('[data-copiar]');
  const enlace = document.querySelector('[data-correo-enlace]');
  if (copiar && enlace && correo) {
    copiar.hidden = false;
    copiar.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(correo);
        copiar.textContent = 'Copiado';
      } catch {
        const sel = getSelection(), r = document.createRange();
        r.selectNodeContents(enlace); sel.removeAllRanges(); sel.addRange(r);
        copiar.textContent = 'Seleccionado';
      }
      setTimeout(() => { copiar.textContent = 'Copiar'; }, 2000);
    });
  }
  document.querySelector('[data-anio]').textContent = new Date().getFullYear();

  // Tema: el guion del <head> ya lo puso. Aqui el boton, guardarlo y seguir al sistema
  // mientras la persona no haya elegido. Cada cambio avisa con el evento "tema" (bit.js repinta).
  const raiz = document.documentElement;
  const boton = document.querySelector('.tema');
  const meta = document.querySelector('meta[name="theme-color"]');
  const sistema = matchMedia('(prefers-color-scheme: dark)');
  const guardado = () => { try { return localStorage.getItem('milbit-tema'); } catch { return null; } };

  function poner(tema) {
    raiz.dataset.tema = tema;
    const oscuro = tema === 'oscuro';
    boton.setAttribute('aria-label', oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    boton.setAttribute('aria-pressed', String(oscuro));
    meta.content = '#0d0d0c';   // la cabecera es oscura en los dos temas
    dispatchEvent(new CustomEvent('tema', { detail: tema }));
  }

  // Fundido entre modos con View Transitions: la pagina entera, lienzo incluido, cambia a la vez.
  // Sin soporte, o con movimiento reducido, cambia de golpe.
  const quieto = matchMedia('(prefers-reduced-motion: reduce)');
  function cambiar(tema) {
    if (tema === raiz.dataset.tema) return;
    if (document.startViewTransition && !quieto.matches) document.startViewTransition(() => poner(tema));
    else poner(tema);
  }

  // Sin eleccion guardada manda el visor que aloja la pagina (data-theme en <html>, lo pone el de
  // los Artifacts) y, si no dice nada, el sistema.
  function deFuera() {
    const h = raiz.getAttribute('data-theme');
    if (h === 'dark' || h === 'light') return h === 'dark' ? 'oscuro' : 'claro';
    return sistema.matches ? 'oscuro' : 'claro';
  }

  boton.addEventListener('click', () => {
    const nuevo = raiz.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    try { localStorage.setItem('milbit-tema', nuevo); } catch {}
    cambiar(nuevo);
  });
  sistema.addEventListener('change', () => { if (!guardado()) cambiar(deFuera()); });
  new MutationObserver(() => { if (!guardado()) cambiar(deFuera()); })
    .observe(raiz, { attributes: true, attributeFilter: ['data-theme'] });
  poner(raiz.dataset.tema || deFuera());

  // La tira de imagenes: las flechas pasan de una pantalla en una y se apagan en los extremos.
  const tira = document.querySelector('.tira');
  const flechas = [...document.querySelectorAll('[data-tira]')];
  if (tira) {
    const repasar = () => {
      const max = tira.scrollWidth - tira.clientWidth - 2;
      for (const b of flechas) b.disabled = b.dataset.tira < 0 ? tira.scrollLeft <= 2 : tira.scrollLeft >= max;
    };
    for (const b of flechas) {
      b.addEventListener('click', () => tira.scrollBy({ left: Number(b.dataset.tira) * tira.clientWidth * 0.8 }));
    }
    tira.addEventListener('scroll', repasar, { passive: true });
    addEventListener('resize', repasar);
    repasar();
  }
})();
