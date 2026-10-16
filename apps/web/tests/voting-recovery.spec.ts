import { test, expect } from '@playwright/test';

for (const stallSnapshot of [false, true]) {
  test(`recupera sin recargar con diez usuarios (resincronización bloqueada: ${stallSnapshot})`, async ({
    browser,
  }) => {
    test.setTimeout(90000);
    const contexts = await Promise.all(Array.from({ length: 10 }, () => browser.newContext()));
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    let release = () => {};
    let disconnect: (() => void) | undefined;
    await pages[1].routeWebSocket(/\/ws$/, (route) => {
      route.connectToServer();
      disconnect = () => {
        void route.close({ code: 1012, reason: 'Corte simulado' });
      };
    });
    try {
      const mod = pages[0];
      await mod.goto('/');
      await mod.getByLabel('Tu nombre').fill('Moderador');
      await mod.getByLabel('Nombre de la sesión').fill('Diagnóstico diez usuarios');
      await mod.getByRole('button', { name: 'Crear sesión', exact: true }).click();
      await expect(mod.getByRole('heading', { name: 'Diagnóstico diez usuarios' })).toBeVisible();
      const url = mod.url();
      await Promise.all(
        pages.slice(1).map(async (page, index) => {
          await page.goto(url);
          await page.getByLabel('Tu nombre').fill(`Participante ${index + 1}`);
          await page.getByRole('button', { name: 'Unirme a la sesión' }).click();
          await expect(
            page.getByRole('heading', { name: 'Diagnóstico diez usuarios' }),
          ).toBeVisible();
        }),
      );
      await mod.getByRole('button', { name: 'Agregar tarea', exact: true }).click();
      await mod.getByLabel('Título de la tarea').fill('Prueba de sincronización');
      await mod.getByRole('button', { name: 'Guardar tarea', exact: true }).click();
      await mod
        .getByRole('button', { name: 'Seleccionar Prueba de sincronización', exact: true })
        .click();
      await mod.getByRole('button', { name: 'Iniciar votación', exact: true }).click();
      for (let round = 0; round < 5; round++) {
        await Promise.all(
          pages.map((page) => page.getByRole('button', { name: 'Votar 5', exact: true }).click()),
        );
        await expect(mod.getByText('10 de 10 han votado', { exact: true })).toBeVisible();
        await mod.getByRole('button', { name: 'Revelar cartas', exact: true }).click();
        await expect(mod.getByTestId('average')).toHaveText('5');
        await mod.getByRole('button', { name: 'Repetir ronda', exact: true }).click();
      }
      console.log('BASELINE: 50 votos en cinco rondas con diez usuarios, sin bloqueos.');
      const affected = pages[1];
      expect(disconnect).toBeDefined();
      disconnect!();
      await expect(affected.getByText(/Estamos reconectando/)).toBeVisible();
      await expect(affected.getByRole('button', { name: 'Votar 3', exact: true })).toBeEnabled({
        timeout: 15000,
      });
      console.log('RECONEXIÓN: recupera cartas sin refrescar tras cierre explícito de WebSocket.');
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let serverAccepted = false;
      const ids: string[] = [];
      await affected.route('**/commands', async (route) => {
        ids.push(route.request().postDataJSON().requestId);
        const response = await route.fetch();
        serverAccepted = response.ok();
        if (ids.length === 1) await held;
        await route.fulfill({ response }).catch(() => {});
      });
      if (stallSnapshot)
        await affected.route('**/api/sessions/*', async (route) => {
          const response = await route.fetch();
          await held;
          await route.fulfill({ response }).catch(() => {});
        });
      await affected.getByRole('button', { name: 'Votar 3', exact: true }).click();
      await expect.poll(() => serverAccepted).toBe(true);
      await expect(mod.getByText('1 de 10 han votado', { exact: true })).toBeVisible();
      const card = affected.getByRole('button', { name: 'Votar 8', exact: true });
      await expect(card).toBeDisabled();
      await expect(card).toBeEnabled({ timeout: 35000 });
      await affected.getByRole('button', { name: 'Votar 3', exact: true }).click();
      await expect(card).toBeEnabled();
      expect(ids).toHaveLength(2);
      expect(ids[1]).toBe(ids[0]);
      release();
      await affected.unrouteAll({ behavior: 'wait' });
      await card.click();
      await expect(card).toBeEnabled();
      console.log(
        'RECUPERADO: cartas habilitadas sin refrescar y reintento con el mismo identificador.',
      );
    } finally {
      release();
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
}
