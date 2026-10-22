import { test, expect } from '@playwright/test';

test('una respuesta antigua no expulsa la membresía nueva después de volver a entrar', async ({
  browser,
}) => {
  const modContext = await browser.newContext(),
    guestContext = await browser.newContext();
  let release = () => {};
  try {
    const mod = await modContext.newPage(),
      guest = await guestContext.newPage();
    await mod.goto('/');
    await mod.getByLabel('Tu nombre').fill('Ana');
    await mod.getByLabel('Nombre de la sesión').fill('Reingreso');
    await mod.getByRole('button', { name: 'Crear sesión', exact: true }).click();
    await expect(mod.getByRole('heading', { name: 'Reingreso' })).toBeVisible();
    await guest.goto(mod.url());
    await guest.getByLabel('Tu nombre').fill('Luis');
    await guest.getByRole('button', { name: 'Unirme a la sesión' }).click();
    await expect(guest.getByRole('heading', { name: 'Reingreso' })).toBeVisible();
    await mod.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
    await mod.getByLabel('Título de la tarea').fill('Tarea');
    await mod.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await mod.getByRole('button', { name: 'Seleccionar Tarea', exact: true }).click();
    await mod.getByRole('button', { name: 'Iniciar votación', exact: true }).click();
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let refreshing = false;
    await guest.route(
      '**/commands',
      (route) =>
        route.fulfill({ status: 503, json: { error: { message: 'Interrupción simulada' } } }),
      { times: 1 },
    );
    await guest.route(
      '**/api/sessions/*',
      async (route) => {
        refreshing = true;
        await held;
        await route.fulfill({
          status: 403,
          json: { error: { message: 'No perteneces a esta sesión.' } },
        });
      },
      { times: 1 },
    );
    await guest.getByRole('button', { name: 'Votar 8', exact: true }).click();
    await expect.poll(() => refreshing).toBe(true);
    mod.once('dialog', (dialog) => void dialog.accept());
    await mod.getByRole('button', { name: 'Expulsar a Luis', exact: true }).click();
    await expect(guest.getByText(/El moderador te ha expulsado/)).toBeVisible();
    await guest.getByLabel('Tu nombre').fill('Luis nuevo');
    await guest.getByRole('button', { name: 'Unirme a la sesión' }).click();
    await expect(guest.getByRole('heading', { name: 'Reingreso' })).toBeVisible();
    const response = guest.waitForResponse((response) => response.status() === 403);
    release();
    await response;
    await guest.getByRole('button', { name: 'Votar 3', exact: true }).click();
    await expect(mod.getByText('1 de 2 han votado', { exact: true })).toBeVisible();
    await expect(guest.getByText(/El moderador te ha expulsado/)).toHaveCount(0);
  } finally {
    release();
    await Promise.all([modContext.close(), guestContext.close()]);
  }
});

test('tareas en vivo, confirmación de expulsión, todas las pestañas y reingreso voluntario', async ({
  browser,
}) => {
  const modContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const observerContext = await browser.newContext();
  try {
    const mod = await modContext.newPage(),
      guest = await guestContext.newPage(),
      observer = await observerContext.newPage();
    await mod.goto('/');
    await mod.getByLabel('Tu nombre').fill('Ana');
    await mod.getByLabel('Nombre de la sesión').fill('Mesa compartida');
    await mod.getByRole('button', { name: 'Crear sesión', exact: true }).click();
    await expect(mod.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    for (const [page, name] of [
      [guest, 'Luis'],
      [observer, 'Otro Luis'],
    ] as const) {
      await page.goto(mod.url());
      await page.getByLabel('Tu nombre').fill(name);
      await page.getByRole('button', { name: 'Unirme a la sesión' }).click();
      await expect(page.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    }
    const tab = await guestContext.newPage();
    await tab.goto(mod.url());
    await expect(tab.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    await expect(guest.getByRole('button', { name: /^Expulsar a/ })).toHaveCount(0);
    await expect(mod.getByRole('button', { name: 'Expulsar a Ana', exact: true })).toHaveCount(0);
    const addTask = async (title: string) => {
      await mod.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
      await mod.getByLabel('Título de la tarea').fill(title);
      await mod.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
      for (const page of [guest, observer, tab])
        await expect(page.getByText(title, { exact: true })).toBeVisible();
    };
    await addTask('Primera tarea');
    await mod.getByRole('button', { name: 'Seleccionar Primera tarea', exact: true }).click();
    await mod.getByRole('button', { name: 'Iniciar votación', exact: true }).click();
    await guest.getByRole('button', { name: 'Votar 8', exact: true }).click();
    await expect(mod.getByText('1 de 3 han votado', { exact: true })).toBeVisible();
    await addTask('Nueva durante la ronda');
    await expect(guest.getByRole('button', { name: 'Votar 3', exact: true })).toBeEnabled();
    mod.once('dialog', (dialog) => {
      expect(dialog.message()).toBe('¿Expulsar a Luis de esta sesión?');
      void dialog.dismiss();
    });
    await mod.getByRole('button', { name: 'Expulsar a Luis', exact: true }).click();
    await expect(guest.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    // Un 403 de una acción de moderador no significa que perdió la membresía.
    await mod.route(
      '**/commands',
      (route) =>
        route.fulfill({
          status: 403,
          json: { error: { message: 'Solo el moderador puede hacer esto.' } },
        }),
      { times: 1 },
    );
    mod.once('dialog', (dialog) => void dialog.accept());
    await mod.getByRole('button', { name: 'Expulsar a Luis', exact: true }).click();
    await expect(mod.getByRole('alert')).toContainText('Solo el moderador puede hacer esto.');
    await expect(mod.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    await expect(mod.getByText(/El moderador te ha expulsado/)).toHaveCount(0);
    mod.once('dialog', (dialog) => void dialog.accept());
    await mod.getByRole('button', { name: 'Expulsar a Luis', exact: true }).click();
    for (const page of [guest, tab]) {
      await expect(page.getByText(/El moderador te ha expulsado/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Unirme a la sesión' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Votar 3', exact: true })).toHaveCount(0);
    }
    await expect(mod.getByText('0 de 2 han votado', { exact: true })).toBeVisible();
    await expect(observer.locator('.participant-name').filter({ hasText: /^Luis$/ })).toHaveCount(
      0,
    );
    // Otra tarea debe llegar al observador, sin reabrir automáticamente las pestañas expulsadas.
    await mod.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
    await mod.getByLabel('Título de la tarea').fill('Después de expulsar');
    await mod.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
    await expect(observer.getByText('Después de expulsar', { exact: true })).toBeVisible();
    await expect(guest.getByText(/El moderador te ha expulsado/)).toBeVisible();
    await guest.getByLabel('Tu nombre').fill('Luis de vuelta');
    await guest.getByRole('button', { name: 'Unirme a la sesión' }).click();
    await expect(guest.getByRole('heading', { name: 'Mesa compartida' })).toBeVisible();
    await expect(guest.getByText('Después de expulsar', { exact: true })).toBeVisible();
    await guest.getByRole('button', { name: 'Votar 3', exact: true }).click();
    await expect(mod.getByText('1 de 3 han votado', { exact: true })).toBeVisible();
    // La segunda pestaña necesita también una acción voluntaria.
    await expect(tab.getByText(/El moderador te ha expulsado/)).toBeVisible();
    await mod.screenshot({ path: 'test-results/participant-removal-desktop.png', fullPage: true });
    await mod.setViewportSize({ width: 390, height: 844 });
    await expect(
      mod.getByRole('button', { name: 'Expulsar a Otro Luis', exact: true }),
    ).toBeVisible();
    expect(await mod.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await mod.screenshot({ path: 'test-results/participant-removal-mobile.png', fullPage: true });
  } finally {
    await Promise.all([modContext.close(), guestContext.close(), observerContext.close()]);
  }
});
