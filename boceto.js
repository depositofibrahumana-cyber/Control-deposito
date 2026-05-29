/* ============================================================
   FIBRA FITNESS GENESIS — BOCETO JS
   Scroll-driven Pulley Machine Assembly · Anatomical Selector Logic
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ─────────────────────────────────────────────
  // 1. REPRODUCCIÓN DE VIDEO POR SCROLL (SCROLL SCRUBBING CON SUAVIZADO)
  // ─────────────────────────────────────────────
  const video = document.getElementById('scroll-video');
  let targetTime = 0;
  let currentTime = 0;

  function onScrollVideo() {
    if (!video) return;

    // Rango de scroll dedicado al Hero (220vh total, 120vh de recorrido útil)
    const scrollRange = window.innerHeight * 1.2;
    const scrollY = window.scrollY;

    // Calcular progreso exacto entre 0.0 y 1.0
    const progress = Math.min(Math.max(scrollY / scrollRange, 0), 1);

    if (video.duration) {
      targetTime = progress * video.duration;
    }
  }

  // Loop de renderizado continuo para lograr un suavizado premium (Eased Scrubbing)
  function renderScrubLoop() {
    if (video && video.duration) {
      // Easing / Interpolación lineal de amortiguación (0.1 = 10% de la distancia por cuadro)
      currentTime += (targetTime - currentTime) * 0.1;

      // Solo asignamos si el cambio es sustancial, para evitar sobrecarga y jitter de GPU
      if (Math.abs(targetTime - currentTime) > 0.001) {
        video.currentTime = currentTime;
      }

      // Efecto estético de brillo de fondo neón cuando llega al final del armado (progress -> 1)
      const progress = currentTime / video.duration;
      if (progress >= 0.98) {
        video.style.filter = 'brightness(0.68) contrast(1.05)';
        video.style.transform = 'scale(1.01)';
        video.style.transition = 'filter 0.5s ease, transform 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)';
      } else {
        video.style.filter = 'brightness(0.55)';
        video.style.transform = 'scale(1)';
        video.style.transition = 'none';
      }
    }
    requestAnimationFrame(renderScrubLoop);
  }

  // Evento de scroll
  window.addEventListener('scroll', onScrollVideo, { passive: true });
  
  // Asegurar que cuando los metadatos estén cargados, se sincronice la primera toma
  if (video) {
    video.addEventListener('loadedmetadata', () => {
      onScrollVideo();
    });
    // Iniciar loop de suavizado
    requestAnimationFrame(renderScrubLoop);
  }


  // ─────────────────────────────────────────────
  // 2. NAVEGACIÓN DEL CARROUSEL DE PRODUCTOS
  // ─────────────────────────────────────────────
  const track = document.getElementById('carousel-track');
  const btnPrev = document.querySelector('.carousel-nav-btn.prev');
  const btnNext = document.querySelector('.carousel-nav-btn.next');

  if (track && btnPrev && btnNext) {
    const getCardWidth = () => {
      const card = track.firstElementChild;
      if (!card) return 300;
      return card.getBoundingClientRect().width + 24; // Ancho + GAP
    };

    btnNext.addEventListener('click', () => {
      const container = track.parentElement;
      container.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
    });

    btnPrev.addEventListener('click', () => {
      const container = track.parentElement;
      container.scrollBy({ left: -getCardWidth(), behavior: 'smooth' });
    });
  }


  // ─────────────────────────────────────────────
  // 3. SELECTOR DE GÉNERO Y MÚSCULOS INTERACTIVO
  // ─────────────────────────────────────────────
  
  // Base de datos de productos recomendados según músculo
  const productsDatabase = {
    chest: [
      {
        name: "Banco Inclinable Multi-Posición",
        category: "BANCOS Y RACKS",
        price: "$320.000",
        label: "BEST SELLER",
        svg: `
          <rect x="20" y="75" width="60" height="4" fill="#3A3E4E" />
          <path d="M 25,75 L 35,50 L 70,50 L 75,75" stroke="#3A3E4E" stroke-width="3" fill="none" />
          <rect x="30" y="42" width="45" height="8" rx="2" fill="#14151C" stroke="#FF5500" stroke-width="1.5" transform="rotate(-15, 30, 42)" />
        `
      },
      {
        name: "Mancuernas Regulables Hex",
        category: "PESO LIBRE",
        price: "$289.900",
        label: "PREMIUM",
        svg: `
          <rect x="45" y="20" width="10" height="60" fill="#8F909A" rx="2" />
          <polygon points="25,30 45,35 45,65 25,70" fill="#1C1D24" stroke="#FF5500" stroke-width="2" />
          <polygon points="75,30 55,35 55,65 75,70" fill="#1C1D24" stroke="#FF5500" stroke-width="2" />
          <rect x="15" y="35" width="10" height="30" fill="#20222B" rx="1" />
          <rect x="75" y="35" width="10" height="30" fill="#20222B" rx="1" />
        `
      },
      {
        name: "Soportes Flexiones Grip",
        category: "ACCESORIOS",
        price: "$18.500",
        label: "FUNCIONAL",
        svg: `
          <path d="M 20,70 L 40,30 L 60,30 L 80,70" fill="none" stroke="#FF5500" stroke-width="4" stroke-linecap="round" />
          <rect x="35" y="22" width="30" height="8" rx="2" fill="#1C1D24" stroke="#8F909A" stroke-width="1" />
        `
      }
    ],
    back: [
      {
        name: "Estación de Poleas Premium",
        category: "MÁQUINAS",
        price: "$1.490.000",
        label: "ÉLITE BIOMECÁNICA",
        svg: `
          <rect x="45" y="10" width="10" height="80" fill="#20222B" stroke="#3A3E4E" stroke-width="1" />
          <line x1="20" y1="15" x2="80" y2="15" stroke="#FF5500" stroke-width="3" />
          <circle cx="30" cy="30" r="10" fill="#14151C" stroke="#FF5500" stroke-width="1.5" />
          <line x1="30" y1="30" x2="30" y2="70" stroke="#8F909A" stroke-width="1.5" />
        `
      },
      {
        name: "Barra Multigrip Pared",
        category: "BANCOS Y RACKS",
        price: "$85.000",
        label: "CALISTENIA",
        svg: `
          <line x1="10" y1="30" x2="90" y2="30" stroke="#8F909A" stroke-width="4" />
          <line x1="25" y1="30" x2="25" y2="55" stroke="#3A3E4E" stroke-width="3" />
          <line x1="75" y1="30" x2="75" y2="55" stroke="#3A3E4E" stroke-width="3" />
          <path d="M 20,55 L 80,55" stroke="#FF5500" stroke-width="2.5" fill="none" />
        `
      },
      {
        name: "Bandas Power Loop Pack",
        category: "ACCESORIOS",
        price: "$24.900",
        label: "RESISTENCIA",
        svg: `
          <ellipse cx="50" cy="50" rx="35" ry="15" fill="none" stroke="#FF5500" stroke-width="5" />
          <ellipse cx="50" cy="53" rx="30" ry="12" fill="none" stroke="#00F0FF" stroke-width="2" />
        `
      }
    ],
    shoulders: [
      {
        name: "Shoulder Press Station",
        category: "MÁQUINAS",
        price: "$890.000",
        label: "MAQUINARIA",
        svg: `
          <rect x="40" y="30" width="20" height="50" fill="#1C1D24" stroke="#3A3E4E" stroke-width="2" />
          <path d="M 30,20 L 70,20 L 70,35 L 30,35 Z" fill="#FF5500" />
          <circle cx="50" cy="45" r="8" fill="#8F909A" />
        `
      },
      {
        name: "Kettlebell Acero Competición",
        category: "PESO LIBRE",
        price: "$62.000",
        label: "BEST SELLER",
        svg: `
          <path d="M 35,45 C 35,25 65,25 65,45" stroke="#8F909A" stroke-width="6" fill="none" />
          <circle cx="50" cy="62" r="24" fill="#1C1D24" stroke="#FF5500" stroke-width="2.5" />
          <text x="50" y="68" font-family="'Barlow Condensed', sans-serif" font-size="16" font-weight="700" fill="#FFFFFF" text-anchor="middle">16</text>
        `
      }
    ],
    arms: [
      {
        name: "Barra W Maciza Olímpica",
        category: "BARRAS Y DISCOS",
        price: "$69.500",
        label: "HIPERTROFIA",
        svg: `
          <path d="M 10,50 L 30,50 L 40,43 L 50,57 L 60,43 L 70,50 L 90,50" fill="none" stroke="#8F909A" stroke-width="3" stroke-linecap="round" />
          <rect x="15" y="45" width="5" height="10" fill="#FF5500" />
          <rect x="80" y="45" width="5" height="10" fill="#FF5500" />
        `
      },
      {
        name: "Soga de Tríceps Polea",
        category: "ACCESORIOS",
        price: "$19.800",
        label: "AGARRE",
        svg: `
          <path d="M 35,15 Q 50,30 50,60 L 40,80" fill="none" stroke="#8F909A" stroke-width="4" />
          <path d="M 65,15 Q 50,30 50,60 L 60,80" fill="none" stroke="#8F909A" stroke-width="4" />
          <circle cx="40" cy="80" r="6" fill="#14151C" stroke="#FF5500" stroke-width="1.5" />
          <circle cx="60" cy="80" r="6" fill="#14151C" stroke="#FF5500" stroke-width="1.5" />
          <rect x="44" y="10" width="12" height="12" rx="2" fill="#2D2F3C" />
        `
      }
    ],
    legs: [
      {
        name: "Squat Rack Profesional V2",
        category: "BANCOS Y RACKS",
        price: "$480.000",
        label: "FUERZA MÁXIMA",
        svg: `
          <line x1="20" y1="85" x2="80" y2="85" stroke="#3A3E4E" stroke-width="4" />
          <rect x="30" y="15" width="8" height="70" fill="#20222B" stroke="#3A3E4E" stroke-width="1.5" />
          <rect x="62" y="15" width="8" height="70" fill="#20222B" stroke="#3A3E4E" stroke-width="1.5" />
          <path d="M 24,35 L 34,35" stroke="#FF5500" stroke-width="3" />
          <path d="M 68,35 L 78,35" stroke="#FF5500" stroke-width="3" />
        `
      },
      {
        name: "Disco Bumper Hi-Temp 15kg",
        category: "BARRAS Y DISCOS",
        price: "$45.000",
        label: "100% CAUCHO",
        svg: `
          <circle cx="50" cy="50" r="38" fill="#14151C" stroke="#3A3E4E" stroke-width="3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#FF5500" stroke-width="2" />
          <circle cx="50" cy="50" r="10" fill="#8F909A" />
          <text x="50" y="55" font-family="'Barlow Condensed', sans-serif" font-size="14" font-weight="700" fill="#FFFFFF" text-anchor="middle">15 KG</text>
        `
      },
      {
        name: "Tobilleras de Polea Soft",
        category: "ACCESORIOS",
        price: "$14.500",
        label: "AISLAMIENTO",
        svg: `
          <rect x="25" y="35" width="50" height="30" rx="4" fill="#14151C" stroke="#FF5500" stroke-width="2" />
          <circle cx="50" cy="50" r="6" fill="#00F0FF" />
        `
      }
    ]
  };

  const muscleNames = {
    chest: "PECHO (PECTORALES)",
    back: "ESPALDA Y CORE",
    shoulders: "HOMBROS (DELTOIDES)",
    arms: "BRAZOS (BÍCEPS/TRÍCEPS)",
    legs: "PIERNAS (CUÁDRICEPS/GEMELOS)"
  };

  let activeGender = 'male';
  let activeMuscle = null;

  // Elementos DOM
  const genderBtns = document.querySelectorAll('.gender-toggle-btn');
  const maleSvg = document.getElementById('body-male-svg');
  const femaleSvg = document.getElementById('body-female-svg');
  const muscleChips = document.querySelectorAll('.muscle-chip');
  const recList = document.getElementById('recommendations-list');
  const recEmpty = document.getElementById('recommendations-empty');
  const recLabel = document.getElementById('active-muscle-label');

  // A) Toggle de Género
  genderBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const gender = btn.getAttribute('data-gender');
      if (gender === activeGender) return;

      activeGender = gender;

      // Actualizar botones activos
      genderBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Intercambiar visibilidad de silueta con animación fluida
      if (activeGender === 'male') {
        maleSvg.classList.add('active');
        femaleSvg.classList.remove('active');
      } else {
        femaleSvg.classList.add('active');
        maleSvg.classList.remove('active');
      }

      // Sincronizar el músculo activo en la nueva silueta
      syncActiveMuscleVisuals();
    });
  });

  // B) Clic en Zonas del SVG (Grupo de músculos)
  const setupSvgListeners = (svgElement) => {
    const muscleGroups = svgElement.querySelectorAll('.muscle-group');
    
    muscleGroups.forEach(group => {
      group.addEventListener('click', () => {
        const muscle = group.getAttribute('data-muscle');
        selectMuscle(muscle);
      });
    });
  };

  setupSvgListeners(maleSvg);
  setupSvgListeners(femaleSvg);

  // C) Clic en los Músculo Chips (Botones de abajo)
  muscleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const muscle = chip.getAttribute('data-muscle');
      selectMuscle(muscle);
    });
  });

  // Función Principal de Selección
  function selectMuscle(muscleKey) {
    if (!productsDatabase[muscleKey]) return;

    activeMuscle = muscleKey;

    // 1. Sincronizar visuales de chips y SVGs
    syncActiveMuscleVisuals();

    // 2. Actualizar etiquetas de recomendación
    recLabel.innerText = muscleNames[muscleKey];
    recLabel.style.display = 'inline-block';

    // 3. Renderizar listado de productos recomendados
    renderRecommendedProducts(muscleKey);
  }

  // Sincroniza las clases 'active' en el SVG y los Chips según el estado en memoria
  function syncActiveMuscleVisuals() {
    // Limpiar clases activas en chips
    muscleChips.forEach(c => c.classList.remove('active'));
    
    // Limpiar clases activas en ambos SVGs
    maleSvg.querySelectorAll('.muscle-group').forEach(g => g.classList.remove('active'));
    femaleSvg.querySelectorAll('.muscle-group').forEach(g => g.classList.remove('active'));

    if (activeMuscle) {
      // Activar chip correspondiente
      const targetChip = Array.from(muscleChips).find(c => c.getAttribute('data-muscle') === activeMuscle);
      if (targetChip) targetChip.classList.add('active');

      // Activar grupo muscular en silueta actual
      const activeSvg = activeGender === 'male' ? maleSvg : femaleSvg;
      const targetGroup = activeSvg.querySelector(`.muscle-group[data-muscle="${activeMuscle}"]`);
      if (targetGroup) targetGroup.classList.add('active');
    }
  }

  // Inyectar productos en la lista derecha con animación escalonada
  function renderRecommendedProducts(muscleKey) {
    const products = productsDatabase[muscleKey];

    // Ocultar estado vacío
    recEmpty.classList.add('hidden');
    recList.innerHTML = '';

    products.forEach((prod, index) => {
      const item = document.createElement('div');
      item.className = 'rec-product-item';
      
      // Delay escalonado de animación
      item.style.animationDelay = `${index * 0.1}s`;

      // Definir color de botón comprar basado en género
      const genderClass = activeGender === 'female' ? 'female-theme' : '';

      item.innerHTML = `
        <div class="rec-product-img">
          <svg viewBox="0 0 100 100">
            ${prod.svg}
          </svg>
        </div>
        <div class="rec-product-details">
          <div class="rec-product-category">${prod.category}</div>
          <h4 class="rec-product-name">${prod.name}</h4>
          <div class="rec-product-price">${prod.price}</div>
        </div>
        <button class="btn-rec-buy ${genderClass}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          Comprar
        </button>
      `;

      recList.appendChild(item);
    });
  }

  // Seleccionar "Pecho" por defecto al iniciar para que la pantalla no inicie vacía
  selectMuscle('chest');

});
