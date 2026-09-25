(() => {
  const dialog = document.querySelector('#booking');
  const form = document.querySelector('#booking-form');
  const feedback = document.querySelector('#booking-feedback');
  const submit = form.querySelector('[type=submit]');
  let key = crypto.randomUUID();
  let lastPayload = '';
  const date = form.elements.preferred_date;
  date.min = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date());
  date.max = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(Date.now()+89*86400000));
  document.querySelectorAll('[data-book],a[href="#contato"].button').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault(); dialog.showModal();
    submit.disabled = true;
    try {
      const response = await fetch('/api/health', { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('unavailable');
      submit.disabled = false;
      if (feedback.dataset.unavailable) { feedback.textContent = ''; delete feedback.dataset.unavailable; }
    } catch {
      feedback.dataset.unavailable = 'true'; feedback.className = 'error';
      feedback.textContent = 'O banco de dados está indisponível ou ainda aguarda configuração. O envio está desativado por enquanto. Você pode conhecer o fluxo no tour do projeto.';
    }
  }));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = {
      name: form.elements.name.value, phone: form.elements.phone.value,
      preferred_date: date.value, period: form.elements.period.value,
      website: form.elements.website.value, consent: form.elements.consent.checked
    };
    const serialized = JSON.stringify(payload);
    if (serialized !== lastPayload) { key = crypto.randomUUID(); lastPayload = serialized; }
    submit.disabled = true; submit.textContent = 'Salvando…'; feedback.textContent = '';
    try {
      const response = await fetch('/api/leads', {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:serialized,signal:AbortSignal.timeout(20000)});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      feedback.textContent = `${result.message} Protocolo: ${result.id}. Este é um projeto de portfólio: não haverá contato de uma clínica real.`;
      feedback.className = 'success'; form.reset(); key = crypto.randomUUID(); lastPayload = '';
    } catch(error) {
      feedback.className = 'error';
      feedback.textContent = error.name === 'TimeoutError' || error.name === 'TypeError' ? 'Conexão interrompida. Tente novamente com os mesmos dados; o envio não será duplicado.' : error.message;
    } finally { submit.disabled = false; submit.textContent = 'Enviar solicitação'; }
  });
})();
