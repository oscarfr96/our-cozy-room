import type { RoomState } from '../../shared/model';

export function createMessageNotifications(selfId: string, onMessage: () => void) {
  const originalTitle = document.title;
  const seen = new Set<string>();
  let initialized = false;
  let unread = 0;
  const isAway = () => document.hidden || !document.hasFocus();
  const clear = () => {
    if (isAway()) return;
    unread = 0;
    document.title = originalTitle;
  };
  document.addEventListener('visibilitychange', clear);
  window.addEventListener('focus', clear);

  return {
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
