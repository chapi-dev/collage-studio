import { useEffect } from 'react';
import { useStudio } from './state/store';
import { filesFromDataTransfer } from './lib/images';
import { CanvasStage } from './components/CanvasStage';
import { PhotoTray } from './components/PhotoTray';
import { FormatPanel } from './components/FormatPanel';
import { LayoutPicker } from './components/LayoutPicker';
import { CellInspector, StylePanel } from './components/StylePanel';
import { ExportPanel } from './components/ExportPanel';

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT ?? 'local';

export default function App() {
  const error = useStudio((state) => state.error);
  const setError = useStudio((state) => state.setError);
  const addFiles = useStudio((state) => state.addFiles);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = filesFromDataTransfer(event.clipboardData);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error, setError]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true" />
          <span className="brand__name">Collage Studio</span>
        </div>
        <p className="topbar__tagline">
          Any number of photos, any aspect ratio, processed entirely on your device.
        </p>
        <span className="topbar__env" title={`Environment: ${ENVIRONMENT}`}>
          {ENVIRONMENT} · {APP_VERSION}
        </span>
      </header>

      <main className="layout">
        <div className="layout__stage">
          <CanvasStage />
        </div>

        <aside className="layout__panel" aria-label="Collage settings">
          <PhotoTray />
          <FormatPanel />
          <LayoutPicker />
          <StylePanel />
          <CellInspector />
          <ExportPanel />
        </aside>
      </main>

      {error ? (
        <div className="toast" role="status">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}
