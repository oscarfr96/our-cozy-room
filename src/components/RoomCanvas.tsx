import { useCallback, useEffect, useRef } from 'react';
import type { Action, RoomState } from '../../shared/model';
import type { RoomScene } from '../game/RoomScene';
import { TV_SCREEN, TV_VIEWPORT } from '../game/television-layout';
export default function RoomCanvas({ room, selfId, online, send, announce, visualHour = null, onTelevision, onScreenHost, serverOffset }: { serverOffset: number; room: RoomState; selfId: string; online: string[]; send: (action: Action) => void; announce: (text: string) => void; visualHour?: number | null; onTelevision: () => void; onScreenHost: (host: HTMLDivElement | null) => void }) {
  const host = useRef<HTMLDivElement>(null), scene = useRef<RoomScene | null>(null);
  const screen = useRef<HTMLDivElement | null>(null);
  const attachScreen = useCallback((node: HTMLDivElement | null) => { screen.current = node; onScreenHost(node); }, [onScreenHost]);
  const latest = useRef({ room, selfId, online, send, announce, visualHour, onTelevision, serverOffset }); latest.current = { room, selfId, online, send, announce, visualHour, onTelevision, serverOffset };
  useEffect(() => {
    let disposed = false; let game: import('phaser').Game | null = null;
    let resize: ResizeObserver | null = null;
    let layoutFrame = 0;
    const alignScreen = () => {
      if (!host.current || !game?.canvas || !screen.current) return;
      const canvas = game.canvas.getBoundingClientRect(), parent = host.current.getBoundingClientRect();
      const scale = canvas.width / 1040;
      screen.current.style.transform = `matrix(${TV_SCREEN.width / TV_VIEWPORT.width * scale},${TV_SCREEN.slope / TV_VIEWPORT.width * scale},0,${TV_SCREEN.height / TV_VIEWPORT.height * scale},${canvas.left - parent.left + TV_SCREEN.x * scale},${canvas.top - parent.top + TV_SCREEN.y * scale})`;
      screen.current.style.visibility = 'visible';
    };
    void Promise.all([import('phaser'), import('../game/RoomScene')]).then(([{ default: Phaser }, { RoomScene }]) => {
      if (disposed || !host.current) return;
      scene.current = new RoomScene(action => latest.current.send(action), message => latest.current.announce(message), () => latest.current.onTelevision());
      scene.current.setVisualHour(latest.current.visualHour);
      scene.current.setServerOffset(latest.current.serverOffset);
      game = new Phaser.Game({ type: Phaser.AUTO, parent: host.current, width: 1040, height: 650, transparent: true, pixelArt: true, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, fps: { target: 30, forceSetTimeOut: false }, scene: scene.current, input: { keyboard: false }, audio: { noAudio: true }, banner: false });
      scene.current.sync(latest.current.room, latest.current.selfId, latest.current.online);
      game.scale.on('resize', alignScreen);
      resize = new ResizeObserver(() => { game?.scale.refresh(); cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(alignScreen); });
      resize.observe(host.current);
      layoutFrame = requestAnimationFrame(alignScreen);
    }).catch(() => latest.current.announce('No se ha podido dibujar la sala. Prueba a recargar la página.'));
    return () => { disposed = true; resize?.disconnect(); cancelAnimationFrame(layoutFrame); game?.scale.off('resize', alignScreen); game?.destroy(true); scene.current = null; };
  }, []);
  useEffect(() => { scene.current?.sync(room, selfId, online); }, [room, selfId, online]);
  useEffect(() => { scene.current?.setServerOffset(serverOffset); }, [serverOffset]);
  useEffect(() => { scene.current?.setVisualHour(visualHour); }, [visualHour]);
  return <div ref={host} className="room-canvas" aria-label="Habitación isométrica interactiva. Pulsa una baldosa para caminar o un asiento para sentarte."><div className="wall-tv-screen" ref={attachScreen} /></div>;
}
