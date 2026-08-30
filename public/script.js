/* ==========================================================================
   ETERNITY — shared front-end logic
   ========================================================================== */

// ЗАМЕНИ на имя из своей ссылки на странице доната DonationAlerts:
// https://www.donationalerts.com/r/ВОТ-ЭТО-ИМЯ
const DONATIONALERTS_USERNAME = "eternityprojectmine";

// Открывает страницу оплаты DonationAlerts с подставленной суммой и комментарием
// (тариф + игровой ник) — DonationAlerts не знает про тарифы сайта напрямую,
// поэтому ник и тариф передаются в комментарии к донату.
function openDonationAlerts(amount, comment) {
  const url = new URL(`https://www.donationalerts.com/r/${DONATIONALERTS_USERNAME}`);
  if (amount) url.searchParams.set('amount', amount);
  if (comment) url.searchParams.set('message', comment);
  window.open(url.toString(), '_blank', 'noopener');
}

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

  /* ---------- Donate: pick a privilege, enter nick, buy ---------- */
  const planEls = document.querySelectorAll('.plan[data-plan]');
  const orderPanel = document.getElementById('orderPanel');
  if (planEls.length && orderPanel) {
    const orderSelected = document.getElementById('orderSelected');
    const nickInput = document.getElementById('nickInput');
    const buyBtn = document.getElementById('buyBtn');
    let selectedPlan = null;

    const renderSelected = () => {
      if (!selectedPlan) {
        orderSelected.innerHTML = `<span class="order-empty">Выберите привилегию выше ↑</span>`;
        return;
      }
      const priceEl = selectedPlan.querySelector('[data-price]');
      const price = priceEl ? priceEl.textContent : '';
      const iconHtml = selectedPlan.querySelector('.plan-icon').innerHTML;
      const tint1 = selectedPlan.style.getPropertyValue('--tint1');
      const tint2 = selectedPlan.style.getPropertyValue('--tint2');
      orderSelected.innerHTML = `
        <span class="order-selected-icon" style="--tint1:${tint1};--tint2:${tint2}">${iconHtml}</span>
        <span class="order-selected-text"><b>${selectedPlan.dataset.planName}</b><span>${price}</span></span>`;
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
      const planName = selectedPlan.dataset.planName;
      const nick = nickInput.value.trim();
      const priceEl = selectedPlan.querySelector('[data-price]');
      const priceDigits = priceEl ? (priceEl.textContent.match(/\d+/) || [])[0] : '';
      window.clarityToast(`«${planName}» для ${nick} — переходим к оплате`);
      openDonationAlerts(priceDigits, `${planName} — ${nick}`);
    });
  }

  /* ---------- "Стать админом" — плавающая кнопка + модалка ---------- */
  (function initAdminFlow(){
    // ЗАМЕНИ на свою ссылку вебхука для заявок на админа (Настройки канала → Интеграции → Вебхуки)
    const ADMIN_WEBHOOK_URL = "https://discord.com/api/webhooks/1538248475676770374/GtdlMzflgE6ZOZEhaR1Mc5qk1q1nDPLrWJ7tAuZLUdBYz9BnE-xfD_ZECM1Oh1xvsE7I";
    const DISCORD_INVITE = "https://discord.gg/qHbn6qGrs";

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'admin-fab';
    fab.id = 'adminFab';
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
      <span class="admin-fab-text">Стать админом</span>`;
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.className = 'admin-modal-overlay';
    overlay.id = 'adminModalOverlay';
    overlay.innerHTML = `
      <div class="admin-modal" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">
        <button type="button" class="admin-modal-close" id="adminModalClose" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>

        <!-- ШАГ 1: проверка Discord -->
        <div class="admin-step active" id="adminStepDiscord">
          <div class="icon-tile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>
          </div>
          <h2 id="adminModalTitle">Заявка на админа</h2>
          <p class="lead">Перед тем как заполнить анкету, вы должны уже состоять в нашем Discord-сервере.</p>
          <div class="admin-discord-note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>
            <span>Вы должны быть в Discord. Если ещё не зашли — <a href="${DISCORD_INVITE}" target="_blank" rel="noopener" style="color:var(--sand-deep); font-weight:700; text-decoration:underline;">перейдите по ссылке</a>, а затем укажите ваш ник ниже.</span>
          </div>
          <div class="admin-field">
            <label for="adminDiscordNick">Ваш ник в Discord</label>
            <input type="text" id="adminDiscordNick" placeholder="username" required>
          </div>
          <div class="admin-step-actions">
            <button type="button" class="btn btn-primary btn-block" id="adminToForm">Продолжить</button>
          </div>
        </div>

        <!-- ШАГ 2: анкета -->
        <div class="admin-step" id="adminStepForm">
          <div class="icon-tile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h2>Хочу быть админом</h2>
          <p class="lead">Расскажите о себе — мы читаем каждую анкету.</p>
          <form id="adminApplyForm">

            <div class="admin-field">
              <label><span class="q-num">1.</span>Был ли у вас опыт в подобных проектах?</label>
              <select id="adminQ1" required>
                <option value="" disabled selected>Выбери вариант</option>
                <option value="Да">Да</option>
                <option value="Нет">Нет</option>
              </select>
            </div>

            <div class="admin-field">
              <label><span class="q-num">2.</span>Если да, то в каких проектах вы участвовали</label>
              <span class="hint">Если опыта не было — напишите «нет».</span>
              <textarea id="adminQ2" placeholder="Названия серверов/проектов и ваша роль" required></textarea>
            </div>

            <div class="admin-field">
              <label><span class="q-num">3.</span>Что вы умеете?</label>
              <textarea id="adminQ3" placeholder="Модерация, стройка, разработка, дизайн и т.д." required></textarea>
            </div>

            <div class="admin-field">
              <label><span class="q-num">4.</span>Какие у вас преимущества и направление?</label>
              <textarea id="adminQ4" required></textarea>
            </div>

            <div class="admin-field">
              <label><span class="q-num">5.</span>Почему мы должны взять именно вас?</label>
              <textarea id="adminQ5" required></textarea>
            </div>

            <div class="admin-field">
              <label><span class="q-num">6.</span>Насколько вы конфликтный человек? Тяжело ли работать вам в команде?</label>
              <textarea id="adminQ6" required></textarea>
            </div>

            <div class="admin-field">
              <label><span class="q-num">7.</span>Оставьте ваш ТГ или электронную почту, чтобы мы могли с вами связаться в дальнейшем</label>
              <input type="text" id="adminQ7" placeholder="@username или email" required>
            </div>

            <div class="admin-trial-note">Отправляя заявку, вы соглашаетесь на испытательный срок от 5 до 14 дней. С уважением, администрация Eternity!</div>

            <div class="admin-step-actions">
              <button type="button" class="btn btn-ghost" id="adminBackToDiscord">← Назад</button>
              <button type="submit" class="btn btn-primary" id="adminSubmitBtn">Отправить заявку</button>
            </div>
            <div class="admin-form-status ok" id="adminStatusOk">Заявка отправлена! Мы свяжемся с тобой в ближайшее время.</div>
            <div class="admin-form-status err" id="adminStatusErr">Не получилось отправить заявку. Попробуй ещё раз.</div>
          </form>
        </div>

      </div>`;
    document.body.appendChild(overlay);

    const modal = overlay.querySelector('.admin-modal');
    const stepDiscord = document.getElementById('adminStepDiscord');
    const stepForm = document.getElementById('adminStepForm');
    const discordNick = document.getElementById('adminDiscordNick');
    const toForm = document.getElementById('adminToForm');
    const backToDiscord = document.getElementById('adminBackToDiscord');
    const closeBtn = document.getElementById('adminModalClose');
    const adminForm = document.getElementById('adminApplyForm');
    const adminBtn = document.getElementById('adminSubmitBtn');
    const adminOk = document.getElementById('adminStatusOk');
    const adminErr = document.getElementById('adminStatusErr');

    const resetFlow = () => {
      stepForm.classList.remove('active');
      stepDiscord.classList.add('active');
      adminOk.style.display = 'none';
      adminErr.style.display = 'none';
    };

    const openModal = () => {
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    const closeModal = () => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
    };

    fab.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

    toForm.addEventListener('click', () => {
      if (!discordNick.value.trim()) { discordNick.focus(); return; }
      stepDiscord.classList.remove('active');
      stepForm.classList.add('active');
      modal.scrollTop = 0;
    });

    backToDiscord.addEventListener('click', () => {
      stepForm.classList.remove('active');
      stepDiscord.classList.add('active');
      modal.scrollTop = 0;
    });

    adminForm.addEventListener('submit', async function(e){
      e.preventDefault();
      adminOk.style.display = 'none';
      adminErr.style.display = 'none';
      adminBtn.disabled = true;
      adminBtn.textContent = 'Отправка...';

      const fields = [
        { name: "Discord ник", value: discordNick.value.trim() || "—", inline: true },
        { name: "7. ТГ / почта", value: document.getElementById('adminQ7').value.trim() || "—", inline: true },
        { name: "1. Был ли опыт", value: document.getElementById('adminQ1').value || "—" },
        { name: "2. В каких проектах", value: document.getElementById('adminQ2').value.trim().slice(0, 1000) || "—" },
        { name: "3. Что умеет", value: document.getElementById('adminQ3').value.trim().slice(0, 1000) || "—" },
        { name: "4. Преимущества и направление", value: document.getElementById('adminQ4').value.trim().slice(0, 1000) || "—" },
        { name: "5. Почему взять именно его/её", value: document.getElementById('adminQ5').value.trim().slice(0, 1000) || "—" },
        { name: "6. Конфликтность / командная работа", value: document.getElementById('adminQ6').value.trim().slice(0, 1000) || "—" }
      ];

      const payload = {
        username: "Заявки на админа Eternity",
        embeds: [{
          title: "Новая заявка на админа",
          description: "Отправляя заявку, пользователь согласился на испытательный срок 5–14 дней.",
          color: 4956392,
          fields: fields,
          timestamp: new Date().toISOString()
        }]
      };

      try {
        const res = await fetch(ADMIN_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (res.ok || res.status === 204) {
          adminOk.style.display = 'block';
          adminForm.reset();
          if (window.clarityToast) window.clarityToast('Заявка на админа отправлена!');
          setTimeout(() => { closeModal(); resetFlow(); }, 1800);
        } else {
          adminErr.style.display = 'block';
        }
      } catch (err) {
        adminErr.style.display = 'block';
      } finally {
        adminBtn.disabled = false;
        adminBtn.textContent = 'Отправить заявку';
      }
    });
  })();

});
