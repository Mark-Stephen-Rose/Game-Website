/* Mark's Silly Games — script.js */

/* ── 3-D tilt on card hover ─────────────────────────────── */

document.querySelectorAll('.game-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect  = card.getBoundingClientRect();
    const cx    = rect.left + rect.width  / 2;
    const cy    = rect.top  + rect.height / 2;
    const dx    = (e.clientX - cx) / (rect.width  / 2);
    const dy    = (e.clientY - cy) / (rect.height / 2);
    const rotX  = -dy * 5;
    const rotY  =  dx * 5;
    card.style.transform = `translateY(-6px) scale(1.015) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    card.style.transition = 'transform 0.08s linear, border-color 0.3s, box-shadow 0.3s';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.3s, box-shadow 0.3s';
  });
});

/* ── Keyboard accessibility ──────────────────────────────── */

document.querySelectorAll('.game-card').forEach(card => {
  card.setAttribute('tabindex', '0');
  card.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.href = card.getAttribute('href');
    }
  });
});
