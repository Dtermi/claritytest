/* ==========================================================================
   CLARITY — shared front-end logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Navbar scroll state ---------- */
  const navbar = document.querySelector('.navbar');
  const onScroll = () => {
    if (!navbar) return;
    navbar.classList.toggle('scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive:true });

  /* ---------- Mobile menu ---------- */
  const burger = document.querySelector('.nav-burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      burger.classList.toggle('open');
      mobileMenu.classList.toggle('open');
      document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
    });
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    }));
  }

  /* ---------- Active nav link ---------- */
  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path) a.classList.add('active');
  });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:.15, rootMargin:'0px 0px -40px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------- Animated counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && counters.length) {
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const decimals = (el.dataset.count.split('.')[1] || '').length;
        const suffix = el.dataset.suffix || '';
        const dur = 1600;
        const start = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          const val = target * eased;
          el.textContent = val.toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        countIO.unobserve(el);
      });
    }, { threshold:.4 });
    counters.forEach(el => countIO.observe(el));
  }

  /* ---------- Toast helper ---------- */
  window.clarityToast = (msg) => {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span class="dot"></span><span class="msg"></span>`;
      document.body.appendChild(toast);
    }
    toast.querySelector('.msg').textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2400);
  };

  /* ---------- Copy IP buttons ---------- */
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const value = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(value);
      } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = value; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      window.clarityToast(`Скопировано: ${value}`);
    });
  });

  /* ---------- Donate period toggle ---------- */
  const periodButtons = document.querySelectorAll('.period-switch [data-period]');
  if (periodButtons.length) {
    const priceEls = document.querySelectorAll('[data-price]');
    const applyPeriod = (period) => {
      periodButtons.forEach(b => b.classList.toggle('active', b.dataset.period === period));
      priceEls.forEach(el => {
        const price = el.dataset[`price${period}`] || el.getAttribute(`data-price-${period}`);
        if (price) el.textContent = price;
      });
      document.querySelectorAll('[data-days-label]').forEach(el => {
        el.textContent = period + ' дней';
      });
    };
    periodButtons.forEach(b => b.addEventListener('click', () => applyPeriod(b.dataset.period)));
  }

  /* ---------- Donate: pick a privilege, enter nick, buy ---------- */
  const planEls = document.querySelectorAll('.plan[data-plan]');
  const orderPanel = document.getElementById('orderPanel');
  if (planEls.length && orderPanel) {
    const orderSelected = document.getElementById('orderSelected');
    const nickInput = document.getElementById('nickInput');
    const buyBtn = document.getElementById('buyBtn');
    let selectedPlan = null;

    const currentPeriod = () =>
      document.querySelector('.period-switch [data-period].active')?.dataset.period || '30';

    const renderSelected = () => {
      if (!selectedPlan) {
        orderSelected.innerHTML = `<span class="order-empty">Выберите привилегию выше ↑</span>`;
        return;
      }
      const period = currentPeriod();
      const priceEl = selectedPlan.querySelector('[data-price]');
      const price = priceEl ? (priceEl.dataset[`price${period}`] || priceEl.textContent) : '';
      const iconHtml = selectedPlan.querySelector('.plan-icon').innerHTML;
      const tint1 = selectedPlan.style.getPropertyValue('--tint1');
      const tint2 = selectedPlan.style.getPropertyValue('--tint2');
      orderSelected.innerHTML = `
        <span class="order-selected-icon" style="--tint1:${tint1};--tint2:${tint2}">${iconHtml}</span>
        <span class="order-selected-text"><b>${selectedPlan.dataset.planName}</b><span>${price} / ${period} дней</span></span>`;
    };

    const updateBuyState = () => {
      const nickOk = /^[A-Za-z0-9_]{3,16}$/.test(nickInput.value.trim());
      const ready = !!selectedPlan && nickOk;
      buyBtn.disabled = !ready;
      orderPanel.classList.toggle('ready', ready);
    };

    planEls.forEach(plan => {
      plan.addEventListener('click', () => {
        planEls.forEach(p => p.classList.remove('selected'));
        plan.classList.add('selected');
        selectedPlan = plan;
        renderSelected();
        updateBuyState();
        nickInput.focus();
      });
    });

    nickInput.addEventListener('input', updateBuyState);

    buyBtn.addEventListener('click', () => {
      if (buyBtn.disabled) return;
      window.clarityToast(`«${selectedPlan.dataset.planName}» для ${nickInput.value.trim()} — переходим к оплате`);
    });

    periodButtons.forEach(b => b.addEventListener('click', () => { if (selectedPlan) renderSelected(); }));
  }

});
