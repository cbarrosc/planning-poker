import { test, expect } from '@playwright/test';
test('dos personas estiman, repiten, guardan y recuperan su sesión', async ({ browser }) => {
  const mod = await browser.newContext(),
    guest = await browser.newContext();
  const a = await mod.newPage(),
    b = await guest.newPage();
  await a.goto('/');
  await a.getByLabel('Tu nombre').fill('Ana');
  await a.getByLabel('Nombre de la sesión').fill('Sprint del equipo');
  await a.getByRole('button', { name: 'Crear sesión', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Sprint del equipo' })).toBeVisible();
  const url = a.url();
  if (!new URL(url).hostname.includes('localhost') && new URL(url).protocol === 'http:') {
    expect(await a.evaluate(() => window.isSecureContext)).toBe(false);
    expect(await a.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
    await a.getByRole('button', { name: 'Copiar enlace' }).click();
    await expect(a.getByLabel('Copia este enlace para invitar al equipo')).toHaveValue(url);
    await a.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
  await b.goto(url);
  await b.getByLabel('Tu nombre').fill('Luis');
  await b.getByRole('button', { name: 'Unirme a la sesión' }).click();
  await expect(b.getByText('Luis (tú)', { exact: true }).first()).toBeVisible();
  await a.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
  await a.getByLabel('Título de la tarea').fill('Mejorar el buscador');
  await a.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await a.getByRole('button', { name: 'Seleccionar Mejorar el buscador', exact: true }).click();
  await a.getByRole('button', { name: 'Iniciar votación', exact: true }).click();
  await b.getByRole('button', { name: 'Votar 8', exact: true }).click();
  await a.getByRole('button', { name: 'Votar 3', exact: true }).click();
  await expect(a.getByText('2 de 2 han votado', { exact: true })).toBeVisible();
  await a.getByRole('button', { name: 'Revelar cartas', exact: true }).click();
  await expect(a.getByTestId('average')).toHaveText('5,5');
  await a.getByRole('button', { name: 'Repetir ronda', exact: true }).click();
  await b.getByRole('button', { name: 'Votar 5', exact: true }).click();
  await a.getByRole('button', { name: 'Revelar cartas', exact: true }).click();
  await a.getByLabel('Estimación final').selectOption('5');
  await a.getByRole('button', { name: 'Guardar estimación', exact: true }).click();
  await expect(a.getByText('Estimación guardada: 5', { exact: true })).toBeVisible();
  await a.reload();
  await expect(a.getByText('Estimación guardada: 5', { exact: true })).toBeVisible();
  await a.getByRole('button', { name: 'Siguiente tarea', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Todo listo por ahora' })).toBeVisible();
  await mod.close();
  await guest.close();
});

test('tallas, facilitador, transferencia y contenido largo funcionan en móvil', async ({
  browser,
}) => {
  const mod = await browser.newContext({ viewport: { width: 1440, height: 1000 } }),
    guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const a = await mod.newPage(),
    b = await guest.newPage();
  await a.goto('/');
  await a.getByLabel('Tu nombre').fill('Ana');
  await a.getByLabel('Nombre de la sesión').fill('Nuestro próximo sprint');
  await a.getByLabel('Escala', { exact: true }).selectOption('tshirt');
  await a.getByRole('button', { name: 'Crear sesión', exact: true }).click();
  await expect(a.getByRole('heading', { name: 'Nuestro próximo sprint' })).toBeVisible();
  await b.goto(a.url());
  await b.getByLabel('Tu nombre').fill('<script>');
  await b.getByRole('button', { name: 'Unirme a la sesión' }).click();
  await expect(b.getByText('<script> (tú)', { exact: true })).toBeVisible();
  await a.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
  await a.getByLabel('Título de la tarea').fill('Mejorar el buscador');
  await a.getByLabel('Descripción', { exact: true }).fill('Descripción larga. '.repeat(250));
  await a.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await a.getByRole('button', { name: 'Seleccionar Mejorar el buscador', exact: true }).click();
  await a.getByText('Opciones del moderador', { exact: true }).click();
  await a.getByLabel('También quiero votar').uncheck();
  await a.getByRole('button', { name: 'Iniciar votación', exact: true }).click();
  await expect(a.getByRole('button', { name: 'Votar M', exact: true })).toBeDisabled();
  await b.getByRole('button', { name: 'Votar M', exact: true }).click();
  await expect(a.getByText('1 de 1 han votado', { exact: true })).toBeVisible();
  await a.screenshot({ path: 'data/session-desktop.png', fullPage: true });
  await b.screenshot({ path: 'data/session-mobile.png', fullPage: true });
  expect(await b.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await b.getByRole('button', { name: 'Abrir tareas' }).click();
  await expect(b.getByRole('heading', { name: 'Tareas', exact: true })).toBeVisible();
  await b.getByRole('button', { name: 'Cerrar tareas', exact: true }).click();
  await a.getByRole('button', { name: 'Revelar cartas', exact: true }).click();
  await expect(a.getByText('Más votadas', { exact: true })).toBeVisible();
  await expect(a.getByTestId('average')).toHaveCount(0);
  await a.getByLabel('Estimación final').selectOption('M');
  await a.getByRole('button', { name: 'Guardar estimación', exact: true }).click();
  await a.getByText('Opciones del moderador', { exact: true }).click();
  const select = a.getByLabel('Transferir moderación');
  await select.selectOption({ label: '<script>' });
  a.once('dialog', (dialog) => dialog.accept());
  await a.getByRole('button', { name: 'Transferir rol', exact: true }).click();
  await b.getByRole('button', { name: 'Abrir tareas' }).click();
  await expect(b.getByRole('button', { name: 'Agregar tarea', exact: true })).toBeVisible();
  await mod.close();
  await guest.close();
});

test('reintentar una respuesta perdida no duplica sesiones ni tareas', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Tu nombre').fill('Ana');
  await page.getByLabel('Nombre de la sesión').fill('Una sola sesión');
  let createCount = 0;
  const codes: string[] = [];
  await page.route('**/api/sessions', async (route) => {
    const res = await route.fetch();
    codes.push((await res.json()).session.code);
    if (createCount++ === 0) await route.abort('failed');
    else await route.fulfill({ response: res });
  });
  await page.getByRole('button', { name: 'Crear sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Crear sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Una sola sesión' })).toBeVisible();
  expect(codes[0]).toBe(codes[1]);
  await page.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
  await page.getByLabel('Título de la tarea').fill('Una sola tarea');
  let dropped = false;
  await page.route('**/commands', async (route) => {
    if (!dropped && route.request().postDataJSON().type === 'task.add') {
      dropped = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Seleccionar Una sola tarea', exact: true }),
  ).toHaveCount(1);
});
