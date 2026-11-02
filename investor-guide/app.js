'use strict';

function calculateScenario(price, rent, months, fee) {
  if (![price, rent, months, fee].every(Number.isFinite) || price <= 0 || price > 100000000 || rent < 0 || rent > 1000000 || !Number.isInteger(months) || months < 0 || months > 12 || fee < 0 || fee > 100) return null;
  const revenue = rent * months;
  const cost = revenue * fee / 100;
  const income = revenue - cost;
  return { revenue, cost, income, yieldPercent: income / price * 100 };
}

(() => {
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const defaultMessage = 'Добрый день, интересует консультация по недвижимости в Камбодже.';
  const channelUrls = {
    whatsapp: 'https://wa.me/85511730787',
    telegram: 'https://t.me/platoestate',
    max: 'https://max.ru/u/f9LHodD0cOKUeSflT9MxcSbnPGYqZRN3BnHyX4T1QvqFaFTnD3XJnfz3XuY'
  };
  const currency = value => '$' + new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 0}).format(value);
  const percent = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(value) + '%';
  const setChannel = (anchor, message) => {
    const channel = anchor.dataset.channel;
    anchor.dataset.message = message;
    anchor.href = channelUrls[channel] + (channel === 'max' ? '' : '?text=' + encodeURIComponent(message));
  };
  $$('[data-channel]').forEach(a => setChannel(a, a.dataset.message || defaultMessage));

  const menu = $('#menu');
  const menuToggle = $('.menu-toggle');
  const closeMenu = () => { menu.hidden = true; menuToggle.setAttribute('aria-expanded', 'false'); };
  menuToggle.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
  });
  menu.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => { if (!e.target.closest('.header')) closeMenu(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { closeMenu(); menuToggle.focus(); }
  });

  $$('[data-tabs]').forEach(tablist => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const selectTab = tab => {
      tabs.forEach(item => {
        const active = item === tab;
        item.setAttribute('aria-selected', String(active));
        item.tabIndex = active ? 0 : -1;
        document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
      });
    };
    tabs.forEach(tab => {
      tab.addEventListener('click', () => selectTab(tab));
      tab.addEventListener('keydown', e => {
        const index = tabs.indexOf(tab);
        let next;
        if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { e.preventDefault(); selectTab(tabs[next]); tabs[next].focus(); }
      });
    });
  });

  const fields = ['price', 'rent', 'months', 'fee'].map(name => $('#calc-' + name));
  let scenario = null;
  const updateCalculator = () => {
    scenario = calculateScenario(...fields.map(field => field.value.trim() === '' ? NaN : Number(field.value)));
    $('#calc-error').hidden = !!scenario;
    $('.calc-action').disabled = !scenario;
    $('#calc-revenue').textContent = scenario ? currency(scenario.revenue) : '—';
    $('#calc-cost').textContent = scenario ? '−' + currency(scenario.cost) : '—';
    $('#calc-income').textContent = scenario ? currency(scenario.income) : '—';
    $('#calc-yield').textContent = scenario ? percent(scenario.yieldPercent) : '—';
  };
  fields.forEach(field => field.addEventListener('input', updateCalculator));
  updateCalculator();

  const syncDialogState = () => document.body.classList.toggle('dialog-open', !!$('dialog[open]'));
  const openDialog = dialog => { dialog.showModal(); syncDialogState(); };
  $$('dialog').forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', syncDialogState);
    dialog.addEventListener('click', e => {
      const bounds = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom)) dialog.close();
    });
  });

  const contact = $('#contact-dialog');
  const contexts = {
    consultation: {title:'Обсудим вашу задачу', copy:'Расскажите, что вас интересует. Поможем сориентироваться в городах, объектах и порядке покупки.', message:defaultMessage},
    purchase: {title:'Покупка с сопровождением', copy:'Поможем выбрать объект, проверить документы и организовать расчёты. Можно обсудить дистанционную покупку.', message:'Добрый день, интересует покупка недвижимости в Камбодже с сопровождением PLATO.'},
    calculation: {title:'Обсудим ваш расчёт', copy:'Проверим исходные данные, расходы и подходящие варианты под вашу задачу.', message:''},
    tour: {title:'Инвестиционный тур', copy:'Совместите отдых и знакомство с недвижимостью Камбоджи. Поможем организовать поездку и посмотреть проекты под ваши задачи.', message:'Добрый день, интересует информация по инвесттуру.'}
  };
  $$('[data-contact]').forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.contact;
    const context = contexts[key] || contexts.consultation;
    let message = context.message;
    if (key === 'calculation') {
      if (!scenario) return;
      message = 'Добрый день, хочу обсудить расчёт по недвижимости в Камбодже: стоимость ' + currency(Number(fields[0].value)) + ', аренда ' + currency(Number(fields[1].value)) + ' в месяц, ' + fields[2].value + ' месяцев в году, управление и сервис ' + fields[3].value + '%.';
    }
    $('#contact-title').textContent = context.title;
    $('#contact-copy').textContent = context.copy;
    $('#tour-services').hidden = key !== 'tour';
    contact.querySelectorAll('[data-channel]').forEach(a => setChannel(a, message));
    openDialog(contact);
  }));

  // MAX profile links have no supported text-prefill parameter.
  // Copy first; if clipboard access is unavailable, keep a visible manual path.
  $$('[data-channel="max"]').forEach(anchor => anchor.addEventListener('click', async e => {
    e.preventDefault();
    const message = anchor.dataset.message || defaultMessage;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(message);
      window.location.assign(channelUrls.max);
    } catch {
      if (contact.open) contact.close();
      $('#copy-message').value = message;
      openDialog($('#copy-dialog'));
      $('#copy-message').focus();
      $('#copy-message').select();
    }
  }));

  $$('[data-photo]').forEach(button => button.addEventListener('click', () => {
    $('#photo-image').src = button.dataset.photo;
    $('#photo-image').alt = button.dataset.caption;
    $('#photo-caption').textContent = button.dataset.caption;
    openDialog($('#photo-dialog'));
  }));
})();
