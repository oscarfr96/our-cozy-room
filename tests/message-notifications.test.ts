import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMessageNotifications } from '../src/lib/message-notifications';

class NotificationDocument extends EventTarget {
  title = 'Our Cozy Room · Un lugar para los dos';
  hidden = false;
  focused = true;
  hasFocus() { return this.focused; }
}

let page: NotificationDocument;
let browser: EventTarget;
const message = (id: string, memberId = 'partner') => ({ id, memberId, text: 'Un mensaje de prueba', at: 1000 });

beforeEach(() => {
  page = new NotificationDocument();
  browser = new EventTarget();
  vi.stubGlobal('document', page);
  vi.stubGlobal('window', browser);
});
afterEach(() => vi.unstubAllGlobals());

describe('Avisos de mensajes en la pestaña', () => {
  it('ignora el historial inicial y los mensajes propios', () => {
    const sound = vi.fn();
    const notices = createMessageNotifications('self', sound);
    page.hidden = true;
    notices.receive([message('old')]);
    notices.receive([message('old'), message('own', 'self')]);
    expect(sound).not.toHaveBeenCalled();
    expect(page.title).toBe('Our Cozy Room · Un lugar para los dos');
    notices.dispose();
  });

  it('avisa del primer mensaje tras un historial vacío y acumula sin duplicar snapshots', () => {
    const sound = vi.fn();
    const notices = createMessageNotifications('self', sound);
    page.hidden = true;
    notices.receive([]);
    notices.receive([message('one')]);
    expect(page.title).toBe('💌 Tienes un mensaje · Our Cozy Room');
    notices.receive([message('one')]);
    notices.receive([message('one'), message('two')]);
    expect(sound).toHaveBeenCalledTimes(2);
    expect(page.title).toBe('💌 2 mensajes nuevos · Our Cozy Room');
    notices.dispose();
  });

  it('detecta mensajes ajenos aunque el último del lote sea propio y suena una vez por lote', () => {
    const sound = vi.fn();
    const notices = createMessageNotifications('self', sound);
    page.focused = false;
    notices.receive([]);
    const batch = [message('one'), message('two'), message('own', 'self')];
    notices.receive(batch);
    notices.receive(batch);
    expect(sound).toHaveBeenCalledTimes(1);
    expect(page.title).toBe('💌 2 mensajes nuevos · Our Cozy Room');
    notices.dispose();
  });

  it('mantiene el título normal mientras se mira la habitación y limpia al volver', () => {
    const sound = vi.fn();
    const notices = createMessageNotifications('self', sound);
    notices.receive([]);
    notices.receive([message('one')]);
    expect(sound).toHaveBeenCalledTimes(1);
    expect(page.title).toBe('Our Cozy Room · Un lugar para los dos');
    page.hidden = true;
    notices.receive([message('one'), message('two')]);
    browser.dispatchEvent(new Event('focus'));
    expect(page.title).toContain('Tienes un mensaje');
    page.hidden = false;
    page.focused = false;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(page.title).toContain('Tienes un mensaje');
    page.focused = true;
    browser.dispatchEvent(new Event('focus'));
    expect(page.title).toBe('Our Cozy Room · Un lugar para los dos');
    page.hidden = true;
    notices.receive([message('one'), message('two'), message('three')]);
    expect(page.title).toBe('💌 Tienes un mensaje · Our Cozy Room');
    notices.dispose();
  });

  it('no vuelve a avisar del mismo historial tras un recorte o una reconexión', () => {
    const sound = vi.fn();
    const notices = createMessageNotifications('self', sound);
    page.hidden = true;
    notices.receive([message('old')]);
    notices.receive([]);
    notices.receive([message('old')]);
    expect(sound).not.toHaveBeenCalled();
    notices.dispose();
  });

  it('restaura el título y retira los listeners al salir de la casa', () => {
    const notices = createMessageNotifications('self', vi.fn());
    page.hidden = true;
    notices.receive([]);
    notices.receive([message('one')]);
    notices.dispose();
    expect(page.title).toBe('Our Cozy Room · Un lugar para los dos');
    page.title = 'Otra pantalla';
    page.hidden = false;
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    expect(page.title).toBe('Otra pantalla');
  });
});
