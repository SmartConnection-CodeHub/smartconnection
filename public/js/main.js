/* ========================================
   SmartConnection - Main JavaScript
   ======================================== */

document.addEventListener('DOMContentLoaded', function () {

  var isEnglish = document.documentElement.lang === 'en';

  // --- Navbar scroll effect ---
  var navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 50) {
        navbar.style.background = 'rgba(10,14,23,0.95)';
        navbar.style.backdropFilter = 'blur(20px)';
        navbar.style.boxShadow = '0 4px 30px rgba(0,0,0,0.3)';
        navbar.style.padding = '0.5rem 0';
      } else {
        navbar.style.background = 'transparent';
        navbar.style.backdropFilter = 'none';
        navbar.style.boxShadow = 'none';
        navbar.style.padding = '1rem 0';
      }
    });
  }

  // --- Mobile menu toggle ---
  var menuToggle = document.getElementById('menuToggle');
  var navUl = navbar ? navbar.querySelector('ul') : null;
  var mobileMenuOpen = false;

  if (menuToggle && navUl) {
    menuToggle.addEventListener('click', function () {
      mobileMenuOpen = !mobileMenuOpen;
      var spans = menuToggle.querySelectorAll('span');
      if (mobileMenuOpen) {
        navUl.classList.remove('hidden');
        navUl.classList.add('flex', 'flex-col', 'absolute', 'top-full', 'left-0', 'right-0', 'bg-dark-bg/95', 'backdrop-blur-xl', 'p-6', 'gap-4', 'border-t', 'border-white/5');
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        navUl.classList.add('hidden');
        navUl.classList.remove('flex', 'flex-col', 'absolute', 'top-full', 'left-0', 'right-0', 'bg-dark-bg/95', 'backdrop-blur-xl', 'p-6', 'gap-4', 'border-t', 'border-white/5');
        spans[0].style.transform = '';
        spans[1].style.opacity = '';
        spans[2].style.transform = '';
      }
    });

    // Close menu on link click
    navUl.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (mobileMenuOpen) {
          mobileMenuOpen = false;
          navUl.classList.add('hidden');
          navUl.classList.remove('flex', 'flex-col', 'absolute', 'top-full', 'left-0', 'right-0', 'bg-dark-bg/95', 'backdrop-blur-xl', 'p-6', 'gap-4', 'border-t', 'border-white/5');
          var spans = menuToggle.querySelectorAll('span');
          spans[0].style.transform = '';
          spans[1].style.opacity = '';
          spans[2].style.transform = '';
        }
      });
    });
  }

  // --- Scroll animations ---
  const animatedElements = document.querySelectorAll('.animate-on-scroll');
  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  animatedElements.forEach(function (el) { observer.observe(el); });

  // --- Counter animation ---
  const counters = document.querySelectorAll('.stat-number');
  const counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function (counter) { counterObserver.observe(counter); });

  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 2000;
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  // --- Contact form validation ---
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot check
      var hp = form.querySelector('.hp-field input');
      if (hp && hp.value) return;

      var valid = true;
      var fields = form.querySelectorAll('[required]');

      fields.forEach(function (field) {
        field.classList.remove('is-valid', 'is-invalid');
        if (!field.value.trim()) {
          field.classList.add('is-invalid');
          valid = false;
        } else if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
          field.classList.add('is-invalid');
          valid = false;
        } else {
          field.classList.add('is-valid');
        }
      });

      if (!valid) return;

      // Collect form data
      var data = {
        nombre: form.querySelector('#nombre').value,
        empresa: form.querySelector('#empresa').value,
        email: form.querySelector('#email').value,
        telefono: form.querySelector('#telefono').value,
        servicio: form.querySelector('#servicio').value,
        mensaje: form.querySelector('#mensaje').value,
        fecha: new Date().toISOString(),
        estado: 'Nuevo',
        fuente: 'Website'
      };

      // Send to Lambda (SES email) + Airtable
      sendContactForm(data);
    });

    // Real-time validation
    form.querySelectorAll('.form-control').forEach(function (input) {
      input.addEventListener('blur', function () {
        if (!this.value.trim() && this.hasAttribute('required')) {
          this.classList.add('is-invalid');
          this.classList.remove('is-valid');
        } else if (this.type === 'email' && this.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value)) {
          this.classList.add('is-invalid');
          this.classList.remove('is-valid');
        } else if (this.value.trim()) {
          this.classList.remove('is-invalid');
          this.classList.add('is-valid');
        }
      });
    });
  }

  // --- Contact form: Supabase API Backend ---
  var CONTACT_API = '/api/contact';

  function sendContactForm(data) {
    var submitBtn = form.querySelector('button[type="submit"]');
    var originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> ' + (isEnglish ? 'Sending...' : 'Enviando...');
    submitBtn.disabled = true;

    // Single call to Lambda — handles email + Airtable CRM server-side
    data.action = 'contact';

    fetch(CONTACT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (r.status === 429) {
        showToast(isEnglish ? 'Too many messages. Try again in a few minutes.' : 'Demasiados mensajes. Intenta en unos minutos.', 'error');
        throw new Error('rate-limited');
      }
      if (!r.ok) throw new Error('Error: ' + r.status);
      return r.json();
    }).then(function () {
      showToast(isEnglish ? 'Message sent successfully. We will contact you soon.' : 'Mensaje enviado correctamente. Nos pondremos en contacto pronto.', 'success');
      resetForm();
    }).catch(function (error) {
      if (error.message !== 'rate-limited') {
        console.error('Error:', error);
        sendFallbackEmail(data);
      }
    }).finally(function () {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    });
  }

  function sendFallbackEmail(data) {
    var subject = encodeURIComponent('Nuevo contacto web: ' + data.servicio);
    var body = encodeURIComponent(
      'Nombre: ' + data.nombre + '\n' +
      'Empresa: ' + data.empresa + '\n' +
      'Email: ' + data.email + '\n' +
      'Teléfono: ' + data.telefono + '\n' +
      'Servicio: ' + data.servicio + '\n' +
      'Mensaje: ' + data.mensaje
    );
    window.open('mailto:contacto@smconnection.cl?subject=' + subject + '&body=' + body, '_blank');
    showToast(isEnglish ? 'Your email client will open to send the message.' : 'Se abrirá tu cliente de correo para enviar el mensaje.', 'success');
    resetForm();
  }

  function resetForm() {
    form.reset();
    form.querySelectorAll('.form-control').forEach(function (f) {
      f.classList.remove('is-valid', 'is-invalid');
    });
  }

  // --- Toast notification ---
  function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + (type === 'error' ? 'error' : '');
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 5000);
  }

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // --- Typewriter effect for hero badge ---
  var badge = document.querySelector('.hero-badge');
  if (badge) {
    var phrases = isEnglish ? [
      'Certified SAP Consultants · AI Specialists',
      'SAP BTP · S/4HANA · FIORI · ABAP · PI/PO',
      'Apps with Claude · AWS · Airtable · GitHub',
      'Solutions for Enterprises and SMBs in Chile'
    ] : [
      'Consultores SAP Certificados · Especialistas en IA',
      'SAP BTP · S/4HANA · FIORI · ABAP · PI/PO',
      'Apps con Claude · AWS · Airtable · GitHub',
      'Soluciones para Empresas y PYMES en Chile'
    ];
    var phraseIndex = 0;
    var charIndex = 0;
    var isDeleting = false;
    var textEl = badge.childNodes[badge.childNodes.length - 1];
    var originalText = textEl.textContent.trim();

    function typewrite() {
      var current = phrases[phraseIndex];
      if (!isDeleting) {
        textEl.textContent = ' ' + current.substring(0, charIndex + 1);
        charIndex++;
        if (charIndex === current.length) {
          setTimeout(function () { isDeleting = true; typewrite(); }, 2500);
          return;
        }
        setTimeout(typewrite, 60);
      } else {
        textEl.textContent = ' ' + current.substring(0, charIndex - 1);
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          setTimeout(typewrite, 400);
          return;
        }
        setTimeout(typewrite, 30);
      }
    }

    // Start after 3 seconds
    setTimeout(function () {
      charIndex = 0;
      typewrite();
    }, 3000);
  }

});

// --- Scheduler Modal (Google Calendar) ---
function openScheduler() {
  var modal = document.getElementById('schedulerModal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Set min date to tomorrow
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var dateInput = document.getElementById('sched-fecha');
  if (dateInput) {
    dateInput.min = tomorrow.toISOString().split('T')[0];
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }
}

function closeScheduler() {
  var modal = document.getElementById('schedulerModal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'schedulerModal') closeScheduler();
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeScheduler();
});

function submitScheduler(e) {
  e.preventDefault();
  var nombre = document.getElementById('sched-nombre').value;
  var email = document.getElementById('sched-email').value;
  var fecha = document.getElementById('sched-fecha').value;
  var hora = document.getElementById('sched-hora').value;
  var tema = document.getElementById('sched-tema').value;

  if (!nombre || !email || !fecha || !hora) return;

  var startDate = fecha.replace(/-/g, '') + 'T' + hora.replace(':', '') + '00';
  var h = parseInt(hora.split(':')[0]);
  var m = parseInt(hora.split(':')[1]) + 30;
  if (m >= 60) { h++; m -= 60; }
  var endDate = fecha.replace(/-/g, '') + 'T' + String(h).padStart(2, '0') + String(m).padStart(2, '0') + '00';

  var details = 'Reunión con Smart Connection\n\n' +
    'Tema: ' + tema + '\n' +
    'Contacto: ' + nombre + ' (' + email + ')\n\n' +
    'www.smconnection.cl';

  var calUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    '&text=' + encodeURIComponent('Reunión Smart Connection — ' + tema) +
    '&dates=' + startDate + '/' + endDate +
    '&ctz=America/Santiago' +
    '&details=' + encodeURIComponent(details) +
    '&location=' + encodeURIComponent('Google Meet (se generará link automáticamente)') +
    '&add=contacto@smconnection.cl';

  window.open(calUrl, '_blank');
  closeScheduler();

  // Save meeting via Supabase API
  fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'scheduler',
      nombre: nombre,
      email: email,
      fecha: fecha,
      hora: hora,
      tema: tema
    })
  }).catch(function () {});
}

// --- AI Section Particles ---
(function () {
  var canvas = document.getElementById('aiParticles');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var particles = [];
  var isMobile = window.innerWidth < 768;
  var numParticles = isMobile ? 30 : 80;
  var connectDist = isMobile ? 100 : 150;
  var running = false;
  var rafId = null;

  function resize() {
    var section = canvas.parentElement;
    canvas.width = section.offsetWidth;
    canvas.height = section.offsetHeight;
  }

  function createParticles() {
    particles = [];
    for (var i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        r: Math.random() * 2.5 + 1.5,
        color: Math.random() > 0.5 ? 'rgba(0,193,193,' : 'rgba(240,171,0,'
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (var i = 0; i < particles.length; i++) {
      for (var j = i + 1; j < particles.length; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < connectDist) {
          var alpha = (1 - dist / connectDist) * 0.35;
          ctx.strokeStyle = 'rgba(0,193,193,' + alpha + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw and update particles
    for (var k = 0; k < particles.length; k++) {
      var p = particles[k];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + '0.8)';
      ctx.fill();

      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    }

    if (running) rafId = requestAnimationFrame(draw);
  }

  // Only animate when section is in view
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        if (!running) {
          running = true;
          resize();
          if (particles.length === 0) createParticles();
          draw();
        }
      } else {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
      }
    });
  }, { threshold: 0.05 });

  observer.observe(canvas.parentElement);

  window.addEventListener('resize', function () {
    resize();
    if (particles.length === 0) createParticles();
  });
})();

// --- Mouse-tracking glow effect (@creativecoder_ style) ---
(function () {
  var glowCards = document.querySelectorAll('.service-card, .ai-card');
  glowCards.forEach(function (card) {
    // Create glow div
    var glow = document.createElement('div');
    glow.className = 'card-glow';
    card.appendChild(glow);

    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      card.style.setProperty('--glow-x', x + 'px');
      card.style.setProperty('--glow-y', y + 'px');
    });
  });
})();

// --- Service Card Hover Particles (desktop only) ---
(function () {
  if (window.innerWidth < 768) return; // No hover particles on mobile/touch
  var cards = document.querySelectorAll('.service-card');
  if (!cards.length) return;

  var COLORS = ['#00dcb4', '#00aaff'];
  var CONNECT_DIST = 100;
  var FADE_SPEED = 0.012;
  var MAX_PARTICLES = 150;

  cards.forEach(function (card) {
    var cvs = document.createElement('canvas');
    cvs.className = 'card-particles';
    card.insertBefore(cvs, card.firstChild);
    var ctx = cvs.getContext('2d');
    var particles = [];
    var mouseX = -999, mouseY = -999;
    var hovering = false;
    var rafId = null;

    function sizeCanvas() {
      cvs.width = card.offsetWidth;
      cvs.height = card.offsetHeight;
    }

    function spawn(x, y) {
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * 2.5 + 1.5;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: Math.random() * 3 + 2,
        life: 1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]
      });
    }

    function draw() {
      ctx.clearRect(0, 0, cvs.width, cvs.height);

      // Spawn particles near cursor
      if (hovering && particles.length < MAX_PARTICLES) {
        for (var s = 0; s < 4; s++) {
          spawn(mouseX + (Math.random() - 0.5) * 30, mouseY + (Math.random() - 0.5) * 30);
        }
      }

      // Draw connections
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            var alpha = (1 - dist / CONNECT_DIST) * Math.min(particles[i].life, particles[j].life) * 0.6;
            ctx.strokeStyle = 'rgba(0,220,180,' + alpha + ')';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Update and draw particles
      for (var k = particles.length - 1; k >= 0; k--) {
        var p = particles[k];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= FADE_SPEED;

        if (p.life <= 0) {
          particles.splice(k, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        var rgb = p.color === '#00dcb4' ? '0,220,180' : '0,170,255';
        ctx.fillStyle = 'rgba(' + rgb + ',' + p.life + ')';
        ctx.fill();
      }

      if (particles.length > 0 || hovering) {
        rafId = requestAnimationFrame(draw);
      } else {
        rafId = null;
      }
    }

    card.addEventListener('mouseenter', function () {
      hovering = true;
      sizeCanvas();
      if (!rafId) draw();
    });

    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    });

    card.addEventListener('mouseleave', function () {
      hovering = false;
      mouseX = -999;
      mouseY = -999;
    });
  });

  window.addEventListener('resize', function () {
    cards.forEach(function (card) {
      var cvs = card.querySelector('.card-particles');
      if (cvs) {
        cvs.width = card.offsetWidth;
        cvs.height = card.offsetHeight;
      }
    });
  });
})();

// ========================================
// Jett Labs-inspired Effects
// ========================================

// --- Cursor Glow Trail (desktop only) ---
(function () {
  if (window.innerWidth < 768) return;

  var glow = document.createElement('div');
  glow.className = 'cursor-glow';
  document.body.appendChild(glow);

  var mouseX = 0, mouseY = 0;
  var glowX = 0, glowY = 0;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    glow.classList.add('visible');
  });

  document.addEventListener('mouseleave', function () {
    glow.classList.remove('visible');
  });

  // Check if hovering interactive elements
  document.addEventListener('mouseover', function (e) {
    var target = e.target.closest('.btn, .service-card, .ai-card, .trust-item, .nav-cta, a');
    if (target) {
      glow.classList.add('hover-expand');
    } else {
      glow.classList.remove('hover-expand');
    }
  });

  function animateGlow() {
    glowX += (mouseX - glowX) * 0.15;
    glowY += (mouseY - glowY) * 0.15;
    glow.style.left = glowX + 'px';
    glow.style.top = glowY + 'px';
    requestAnimationFrame(animateGlow);
  }
  animateGlow();
})();

// --- Magnetic Button Effect ---
(function () {
  if (window.innerWidth < 768) return;

  var buttons = document.querySelectorAll('.btn, .nav-cta, .nav-cta-calendar');
  buttons.forEach(function (btn) {
    btn.classList.add('btn-magnetic');

    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var x = e.clientX - rect.left - rect.width / 2;
      var y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = 'translate(' + (x * 0.2) + 'px, ' + (y * 0.2) + 'px)';
    });

    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
    });
  });
})();

// --- Card 3D Tilt Effect ---
(function () {
  if (window.innerWidth < 768) return;

  var cards = document.querySelectorAll('.service-card, .ai-card, .pillar');
  cards.forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      var tiltX = y * -8; // degrees
      var tiltY = x * 8;
      card.style.transform = 'perspective(1000px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg) translateY(-8px)';
    });

    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });
})();

// --- Parallax on scroll for blobs/glows ---
(function () {
  var parallaxEls = document.querySelectorAll('.blob, .hero-glow');
  if (!parallaxEls.length) return;

  window.addEventListener('scroll', function () {
    var scrollY = window.pageYOffset;
    parallaxEls.forEach(function (el, i) {
      var speed = 0.1 + (i % 3) * 0.05;
      el.style.transform = 'translateY(' + (scrollY * speed) + 'px)';
    });
  }, { passive: true });
})();

// --- Floating Dots Generator ---
(function () {
  var sections = document.querySelectorAll('.services-section, .why-section');
  sections.forEach(function (section) {
    var container = document.createElement('div');
    container.className = 'floating-dots';

    for (var i = 0; i < 15; i++) {
      var dot = document.createElement('span');
      dot.style.left = Math.random() * 100 + '%';
      dot.style.top = (80 + Math.random() * 20) + '%';
      dot.style.animationDuration = (8 + Math.random() * 12) + 's';
      dot.style.animationDelay = Math.random() * 8 + 's';
      dot.style.width = (2 + Math.random() * 4) + 'px';
      dot.style.height = dot.style.width;
      container.appendChild(dot);
    }

    section.appendChild(container);
  });
})();

// --- Section Dividers ---
(function () {
  var sections = document.querySelectorAll('section');
  sections.forEach(function (section, i) {
    if (i > 0 && i < sections.length - 1) {
      var divider = document.createElement('hr');
      divider.className = 'section-divider';
      section.parentNode.insertBefore(divider, section);
    }
  });
})();

// --- Holographic background for hero ---
(function () {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  var holo = document.createElement('div');
  holo.className = 'holo-bg';
  hero.insertBefore(holo, hero.firstChild);
})();
