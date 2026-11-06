// Una sola entrega por etapa para evitar reintentos con credenciales rechazadas.
export function createLoginHandler(email, password) {
  if (Boolean(email) !== Boolean(password)) {
    throw new Error('Configura PARKALOT_EMAIL y PARKALOT_PASSWORD juntos en .env.');
  }
  let emailSubmitted = false;
  let passwordSubmitted = false;

  return async page => {
    if (!email || passwordSubmitted) return;
    if (new URL(page.url()).origin !== 'https://app.parkalot.io') return;
    const passwordInput = page.locator('input[type="password"]:visible').first();
    const emailInput = page.locator(
      'input[type="email"]:visible, input[autocomplete="username"]:visible, input[name="email" i]:visible',
    ).first();
    const hasEmail = await emailInput.isVisible();
    const hasPassword = await passwordInput.isVisible();
    if (!hasPassword && (!hasEmail || emailSubmitted)) return;

    const anchor = hasPassword ? passwordInput : emailInput;
    const form = anchor.locator('xpath=ancestor::form[1]');
    const scope = await form.count() ? form : page;
    const submit = scope.getByRole('button', {
      name: hasPassword
        ? /^(log\s*in|sign\s*in|iniciar sesi[oó]n|ingresar|entrar|acceder)$/i
        : /^(next|continue|continuar|siguiente|log\s*in|sign\s*in|iniciar sesi[oó]n)$/i,
    }).or(scope.locator('button[type="submit"], input[type="submit"]')).filter({ visible: true });
    if (await submit.count() !== 1) return;

    if (hasEmail) await emailInput.fill(email);
    if (hasPassword) {
      await passwordInput.fill(password);
      // Marcar antes del clic: incluso ante una navegación fallida no reenvía.
      passwordSubmitted = true;
    }
    emailSubmitted = true;
    await submit.click({ timeout: 5000 });
    console.log(hasPassword ? 'Credenciales enviadas. Esperando acceso a Parkalot.' : 'Correo enviado. Esperando el campo de contraseña.');
  };
}
