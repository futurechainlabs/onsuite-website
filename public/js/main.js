/* ============================================================
   OnSuite Main JavaScript v2.0 — PREMIUM EDITION
   Interactions, Animations, Micro-interactions
   ============================================================ */

(function () {
  'use strict';

  /* ----- UTILITIES ----- */
  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
    return n.toString();
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* =========================================================
     1. CURSOR GLOW — desktop mouse-following radial glow
     ========================================================= */
  var cursorGlow = document.getElementById('cursorGlow');
  var mouseX = 0, mouseY = 0, glowX = 0, glowY = 0;

  if (cursorGlow && window.matchMedia('(min-width: 1024px)').matches) {
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    (function animateGlow() {
      glowX = lerp(glowX, mouseX, 0.08);
      glowY = lerp(glowY, mouseY, 0.08);
      cursorGlow.style.left = glowX + 'px';
      cursorGlow.style.top = glowY + 'px';
      requestAnimationFrame(animateGlow);
    })();
  }

  /* =========================================================
     2. HEADER — scroll behaviour & glass effect
     ========================================================= */
  var header = document.getElementById('header');
  var lastScroll = 0;

  function handleHeaderScroll() {
    var y = window.scrollY;
    header.classList.toggle('header--scrolled', y > 60);
    lastScroll = y;
  }

  window.addEventListener('scroll', handleHeaderScroll, { passive: true });

  /* =========================================================
     3. MEGA MENU — hover / click toggle
     ========================================================= */
  document.querySelectorAll('.nav__item--dropdown').forEach(function (item) {
    var btn = item.querySelector('.nav__link');
    var menu = item.querySelector('.mega-menu');
    var closeTimer;

    function open() {
      clearTimeout(closeTimer);
      document.querySelectorAll('.nav__link[aria-expanded="true"]').forEach(function (b) {
        if (b !== btn) b.setAttribute('aria-expanded', 'false');
      });
      btn.setAttribute('aria-expanded', 'true');
    }

    function close() {
      closeTimer = setTimeout(function () {
        btn.setAttribute('aria-expanded', 'false');
      }, 150);
    }

    item.addEventListener('mouseenter', open);
    item.addEventListener('mouseleave', close);
    btn.addEventListener('click', function () {
      var expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    });

    if (menu) {
      menu.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
      menu.addEventListener('mouseleave', close);
    }
  });

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav__item--dropdown')) {
      document.querySelectorAll('.nav__link[aria-expanded="true"]').forEach(function (b) {
        b.setAttribute('aria-expanded', 'false');
      });
    }
  });

  /* =========================================================
     4. MOBILE MENU
     ========================================================= */
  var hamburger = document.querySelector('.header__hamburger');
  var mobileMenu = document.getElementById('mobileMenu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', !isOpen);
      mobileMenu.classList.toggle('mobile-menu--open', !isOpen);
      mobileMenu.setAttribute('aria-hidden', isOpen);
      document.body.style.overflow = isOpen ? '' : 'hidden';
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('mobile-menu--open');
        mobileMenu.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      });
    });
  }

  /* =========================================================
     5. SCROLL REVEAL — IntersectionObserver
     ========================================================= */
  var revealElements = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealElements.forEach(function (el) { el.classList.add('revealed'); });
  }

  /* =========================================================
     6. COUNTING ANIMATION — eased number counting
     ========================================================= */
  function animateCount(el, target, duration) {
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.floor(eased * target);

      if (el.dataset.count !== undefined) {
        el.textContent = current;
      } else if (el.dataset.target !== undefined) {
        el.textContent = current + '%';
      }

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        if (el.dataset.count !== undefined) {
          el.textContent = target;
        } else if (el.dataset.target !== undefined) {
          el.textContent = target + '%';
        }
      }
    }

    requestAnimationFrame(step);
  }

  // Observe counting elements
  var countElements = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          var target = parseInt(el.dataset.count, 10);
          animateCount(el, target, 2000);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    countElements.forEach(function (el) { countObserver.observe(el); });
  }

  /* =========================================================
     7. DASHBOARD HERO — animated gauge, chart, stats
     ========================================================= */
  function initDashboardAnimations() {
    // OEE Gauge fill
    var gaugeFill = document.querySelector('.gauge__fill');
    var gaugeValue = document.querySelector('.gauge__value');
    if (gaugeFill && gaugeValue) {
      var target = parseInt(gaugeFill.dataset.target, 10) || 85;
      var circumference = 2 * Math.PI * 50;
      var offset = circumference - (target / 100) * circumference;

      setTimeout(function () {
        gaugeFill.style.strokeDashoffset = offset;
        animateCount(gaugeValue, target, 2500);
      }, 500);
    }

    // Stat values
    document.querySelectorAll('.dash-mock__stat-value[data-target]').forEach(function (el) {
      var target = parseInt(el.dataset.target, 10);
      setTimeout(function () {
        animateCount(el, target, 2000);
      }, 800);
    });

    // Chart line animation
    var chartLine = document.querySelector('.mini-chart__line');
    if (chartLine) {
      setTimeout(function () {
        chartLine.classList.add('animated');
      }, 600);
    }
  }

  // Trigger when hero visual is visible
  var heroVisual = document.querySelector('.hero__visual');
  if (heroVisual && 'IntersectionObserver' in window) {
    var heroObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          initDashboardAnimations();
          heroObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });
    heroObserver.observe(heroVisual);
  } else {
    window.addEventListener('load', initDashboardAnimations);
  }

  /* =========================================================
     8. DASHBOARD TILT — subtle parallax on hover (desktop)
     ========================================================= */
  var dashScreen = document.querySelector('.dashboard-preview__screen');
  if (dashScreen && window.matchMedia('(min-width: 1024px)').matches) {
    var dashParent = dashScreen.parentElement;

    dashParent.addEventListener('mousemove', function (e) {
      var rect = dashParent.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top) / rect.height - 0.5;
      var rotY = -3 + x * 6;
      var rotX = 2 + y * -4;
      dashScreen.style.transform =
        'perspective(1200px) rotateY(' + rotY + 'deg) rotateX(' + rotX + 'deg)';
    });

    dashParent.addEventListener('mouseleave', function () {
      dashScreen.style.transform =
        'perspective(1200px) rotateY(-3deg) rotateX(2deg)';
    });
  }

  /* =========================================================
     9. TABS (Sectors)
     ========================================================= */
  var tabNav = document.querySelector('.tabs__nav');
  if (tabNav) {
    tabNav.addEventListener('click', function (e) {
      var tab = e.target.closest('.tabs__tab');
      if (!tab) return;

      var tabId = tab.dataset.tab;

      // Update active tab
      tabNav.querySelectorAll('.tabs__tab').forEach(function (t) {
        t.classList.toggle('tabs__tab--active', t === tab);
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });

      // Update panels
      document.querySelectorAll('.tabs__panel').forEach(function (panel) {
        var isTarget = panel.dataset.panel === tabId;
        panel.classList.toggle('tabs__panel--active', isTarget);
        panel.hidden = !isTarget;
      });
    });
  }

  /* =========================================================
     10. ROI CALCULATOR
     ========================================================= */
  var roiSliders = {
    lines: document.getElementById('roiLines'),
    oee: document.getElementById('roiOee'),
    downtime: document.getElementById('roiDowntime'),
    volume: document.getElementById('roiVolume'),
    sector: document.getElementById('roiSector')
  };

  var roiOutputs = {
    linesVal: document.getElementById('roiLinesVal'),
    oeeVal: document.getElementById('roiOeeVal'),
    downtimeVal: document.getElementById('roiDowntimeVal'),
    volumeVal: document.getElementById('roiVolumeVal'),
    amount: document.getElementById('roiAmount'),
    oeeGain: document.getElementById('roiOeeGain'),
    downtimeGain: document.getElementById('roiDowntimeGain'),
    scrapGain: document.getElementById('roiScrapGain'),
    payback: document.getElementById('roiPayback')
  };

  function calcROI() {
    if (!roiSliders.lines) return;

    var lines = parseInt(roiSliders.lines.value, 10);
    var oee = parseInt(roiSliders.oee.value, 10);
    var downtime = parseInt(roiSliders.downtime.value, 10);
    var volume = parseInt(roiSliders.volume.value, 10);
    var sector = roiSliders.sector ? roiSliders.sector.value : 'general';

    // Display values
    if (roiOutputs.linesVal) roiOutputs.linesVal.textContent = lines;
    if (roiOutputs.oeeVal) roiOutputs.oeeVal.textContent = oee + '%';
    if (roiOutputs.downtimeVal) roiOutputs.downtimeVal.textContent = downtime;
    if (roiOutputs.volumeVal) roiOutputs.volumeVal.textContent = formatNumber(volume);

    // Gradient slider fill
    Object.keys(roiSliders).forEach(function (key) {
      var slider = roiSliders[key];
      if (slider && slider.type === 'range') {
        var pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
        slider.style.background =
          'linear-gradient(to right, var(--blue-500) 0%, var(--cyan-300) ' + pct + '%, var(--gray-200) ' + pct + '%)';
      }
    });

    // Sector multipliers
    var sectorMultiplier = {
      automotive: 1.3,
      food: 1.1,
      pharma: 1.4,
      tobacco: 1.25,
      general: 1.0
    };
    var mult = sectorMultiplier[sector] || 1.0;

    // ROI model
    var oeeGain = Math.round(Math.min(15, (90 - oee) * 0.25) * mult);
    var downtimeReduction = Math.round(Math.min(40, downtime * 0.35));
    var scrapReduction = Math.round(Math.min(25, (100 - oee) * 0.5));

    var costPerHour = lines * 5000 * mult;
    var downtimeSaving = downtimeReduction * 0.01 * downtime * costPerHour * 12;
    var oeeSaving = oeeGain * 0.01 * volume * 2.5 * mult;
    var totalSaving = Math.round(downtimeSaving + oeeSaving);

    var implementationCost = lines * 80000 * mult;
    var paybackMonths = Math.max(4, Math.min(18, Math.round(implementationCost / (totalSaving / 12))));

    // Update outputs with animation
    if (roiOutputs.amount) roiOutputs.amount.textContent = formatNumber(totalSaving);
    if (roiOutputs.oeeGain) roiOutputs.oeeGain.textContent = '+' + oeeGain + '%';
    if (roiOutputs.downtimeGain) roiOutputs.downtimeGain.textContent = '-' + downtimeReduction + '%';
    if (roiOutputs.scrapGain) roiOutputs.scrapGain.textContent = '-' + scrapReduction + '%';
    if (roiOutputs.payback) roiOutputs.payback.textContent = paybackMonths + ' ay';
  }

  var calcDebounced = debounce(calcROI, 80);
  Object.keys(roiSliders).forEach(function (key) {
    if (roiSliders[key]) {
      roiSliders[key].addEventListener('input', calcDebounced);
    }
  });

  calcROI();

  /* =========================================================
     11. CHATBOT
     ========================================================= */
  var chatbotTrigger = document.getElementById('chatbotTrigger');
  var chatbotPanel = document.getElementById('chatbotPanel');
  var chatbotMinimize = document.getElementById('chatbotMinimize');
  var chatbotTeaser = document.getElementById('chatbotTeaser');
  var chatbotTeaserClose = chatbotTeaser ? chatbotTeaser.querySelector('.chatbot__teaser-close') : null;
  var chatbotMessages = document.getElementById('chatbotMessages');
  var chatbotInput = document.querySelector('.chatbot__input');
  var chatbotSend = document.querySelector('.chatbot__send');
  var chatbotOpen = false;

  function openChatbot() {
    chatbotOpen = true;
    chatbotTrigger.classList.add('chatbot__trigger--hidden');
    chatbotPanel.hidden = false;
    if (chatbotTeaser) chatbotTeaser.hidden = true;
    chatbotTrigger.style.animation = 'none';
    sessionStorage.setItem('chatbot_opened', '1');
    setTimeout(function () {
      if (chatbotInput) chatbotInput.focus();
    }, 300);
  }

  function closeChatbot() {
    chatbotOpen = false;
    chatbotTrigger.classList.remove('chatbot__trigger--hidden');
    chatbotPanel.hidden = true;
    chatbotTrigger.style.animation = 'none';
  }

  if (chatbotTrigger) {
    chatbotTrigger.addEventListener('click', openChatbot);
  }

  if (chatbotMinimize) {
    chatbotMinimize.addEventListener('click', closeChatbot);
  }

  // Teaser bubble
  if (chatbotTeaser && !sessionStorage.getItem('chatbot_opened')) {
    setTimeout(function () {
      if (!chatbotOpen) {
        chatbotTeaser.hidden = false;
      }
    }, 5000);
  }

  if (chatbotTeaserClose) {
    chatbotTeaserClose.addEventListener('click', function () {
      chatbotTeaser.hidden = true;
      sessionStorage.setItem('chatbot_opened', '1');
    });
  }

  // Chat history for AI context
  var chatHistory = [];

  function addBotMessage(text) {
    var quickReplies = chatbotMessages.querySelector('.chatbot__quick-replies');
    if (quickReplies) quickReplies.remove();

    var msg = document.createElement('div');
    msg.className = 'chatbot__msg chatbot__msg--bot';
    msg.innerHTML = '<p>' + text + '</p>';
    chatbotMessages.appendChild(msg);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function addUserMessage(text) {
    var quickReplies = chatbotMessages.querySelector('.chatbot__quick-replies');
    if (quickReplies) quickReplies.remove();

    var msg = document.createElement('div');
    msg.className = 'chatbot__msg chatbot__msg--user';
    msg.innerHTML = '<p>' + text + '</p>';
    chatbotMessages.appendChild(msg);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function addTypingIndicator() {
    var typing = document.createElement('div');
    typing.className = 'chatbot__msg chatbot__msg--bot chatbot__typing';
    typing.innerHTML = '<p><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span></p>';
    typing.id = 'typingIndicator';
    chatbotMessages.appendChild(typing);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function removeTypingIndicator() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  // Send to AI API
  function sendToAI(userMessage) {
    chatHistory.push({ role: 'user', content: userMessage });
    addTypingIndicator();

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMessage, history: chatHistory })
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      removeTypingIndicator();
      var reply = data.reply || 'Baglanti hatasi olustu.';
      chatHistory.push({ role: 'assistant', content: reply });
      addBotMessage(reply);
    })
    .catch(function () {
      removeTypingIndicator();
      addBotMessage('Baglanti hatasi. Bizi +90 (232) 245 00 76 numarasindan arayabilirsiniz.');
    });
  }

  // Quick reply chips
  document.querySelectorAll('.chatbot__chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var reply = chip.dataset.reply;
      var labels = { modules: 'OnSuite modullerini anlatir misin?', demo: 'Demo talep etmek istiyorum', tech: 'Teknik bir sorum var' };
      var userMsg = labels[reply] || reply;
      addUserMessage(userMsg);
      sendToAI(userMsg);
    });
  });

  // Send message
  function sendMessage() {
    if (!chatbotInput || !chatbotInput.value.trim()) return;
    var text = chatbotInput.value.trim();
    addUserMessage(text);
    chatbotInput.value = '';
    sendToAI(text);
  }

  if (chatbotSend) {
    chatbotSend.addEventListener('click', sendMessage);
  }

  if (chatbotInput) {
    chatbotInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  /* =========================================================
     12. SMOOTH SCROLL
     ========================================================= */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var headerHeight = header ? header.offsetHeight : 0;
        var y = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  /* =========================================================
     13. CARD TILT — subtle 3D hover on bento cards (desktop)
     ========================================================= */
  if (window.matchMedia('(min-width: 1024px)').matches) {
    document.querySelectorAll('.bento-grid .card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          'translateY(-6px) perspective(800px) rotateX(' + (y * -4) + 'deg) rotateY(' + (x * 4) + 'deg)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  /* =========================================================
     14. MAGNETIC BUTTONS — subtle attraction on hover
     ========================================================= */
  if (window.matchMedia('(min-width: 1024px)').matches) {
    document.querySelectorAll('.btn--primary, .btn--secondary').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform =
          'translateY(-2px) translate(' + (x * 0.15) + 'px, ' + (y * 0.15) + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

})();
