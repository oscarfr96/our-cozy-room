import type { RoomState } from '../../shared/model';

export function createMessageNotifications(selfId: string, onMessage: () => void, onArrival: () => void = () => {}) {
  const originalTitle = document.title;
  const seen = new Set<string>();
  let initialized = false;
  let unread = 0;
  let previousOnline: Set<string> | null = null;
  const isAway = () => document.hidden || !document.hasFocus();
  const clear = () => {
    if (isAway()) return;
    unread = 0;
    document.title = originalTitle;
  };
  document.addEventListener('visibilitychange', clear);
  window.addEventListener('focus', clear);

  return {
    receivePresence(online: string[]) {
      const current = new Set(online.filter(id => id !== selfId));
      const arrived = previousOnline !== null && [...current].some(id => !previousOnline!.has(id));
      previousOnline = current;
      if (!arrived) return;
      if (isAway()) {
        if (!unread) document.title = '🏡 Tu persona ha llegado · Our Cozy Room';
      }
      onArrival();
    },
    resetPresence() { previousOnline = null; },
    receive(messages: RoomState['messages']) {
      const incoming = messages.filter(message => !seen.has(message.id) && message.memberId !== selfId);
      for (const message of messages) {
        seen.add(message.id);
        if (seen.size > 50) seen.delete(seen.values().next().value!);
      }
      if (initialized && incoming.length) {
        if (isAway()) {
          unread += incoming.length;
          document.title = unread === 1
            ? '💌 Tienes un mensaje · Our Cozy Room'
            : `💌 ${unread} mensajes nuevos · Our Cozy Room`;
        }
        onMessage();
      }
      initialized = true;
    },
    dispose() {
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('focus', clear);
      document.title = originalTitle;
    },
  };
}
