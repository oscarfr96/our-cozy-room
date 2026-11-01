import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './visual.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="welcome"><section className="welcome-card"><h1>Un pequeño tropiezo.</h1><p>No hemos podido abrir la sala. Prueba a recargar; no borraremos tus datos guardados.</p><button className="button primary" onClick={() => location.reload()}>Volver a intentarlo</button></section></main> : this.props.children; }
}
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
