import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from 'firebase/auth';
import { remoteClient } from '../src/lib/room-client';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('Un acceso rechazado no queda fingiendo que conecta', () => {
  it.each([401, 403])('conserva el rechazo %s y no reintenta ni abre WebSocket', async status => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: 'Esta cuenta no está autorizada.' }, { status }));
    const WebSocket = vi.fn(); vi.stubGlobal('fetch', fetch); vi.stubGlobal('WebSocket', WebSocket);
    const user = { getIdToken: vi.fn().mockResolvedValue('test-token') } as unknown as User;
    const onStatus = vi.fn(), onError = vi.fn(), onSnapshot = vi.fn();
    const client = remoteClient(user, onSnapshot, onStatus, onError);
    try {
      await vi.advanceTimersByTimeAsync(60000);
      expect(onStatus.mock.calls.map(call => call[0])).toEqual(['connecting', 'denied']);
      expect(onError).toHaveBeenCalledWith('Esta cuenta no está autorizada.');
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(WebSocket).not.toHaveBeenCalled(); expect(onSnapshot).not.toHaveBeenCalled();
    } finally { client.close(); }
  });
});
