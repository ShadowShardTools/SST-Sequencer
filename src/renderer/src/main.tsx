import React from 'react';
import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';
import './styles.css';

let root: Root | null = null;
let fatalShown = false;

type FatalErrorDetails = {
  title: string;
  message: string;
  stack?: string;
};

function normalizeError(error: unknown): FatalErrorDetails {
  if (error instanceof Error) {
    return {
      title: error.name || 'Renderer Error',
      message: error.message || 'Unknown renderer error.',
      stack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      title: 'Renderer Error',
      message: error,
    };
  }

  return {
    title: 'Renderer Error',
    message: 'An unknown renderer error occurred.',
    stack: JSON.stringify(error, null, 2),
  };
}

function buildFatalErrorScreen(details: FatalErrorDetails) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#1a1a1f',
        color: '#f8fafc',
        padding: '24px',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          border: '1px solid rgba(248, 113, 113, 0.24)',
          borderRadius: '12px',
          background: '#141418',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(239, 68, 68, 0.08)',
          }}
        >
          <div style={{ fontSize: '12px', letterSpacing: '0.14em', color: '#fca5a5' }}>
            RENDERER STARTUP ERROR
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: '24px', fontWeight: 700 }}>{details.title}</h1>
        </div>

        <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Message</div>
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '12px 14px',
                fontSize: '14px',
                lineHeight: 1.5,
              }}
            >
              {details.message}
            </div>
          </div>

          {details.stack ? (
            <div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '6px' }}>Stack</div>
              <pre
                style={{
                  margin: 0,
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: '#0f1115',
                  padding: '14px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: '12px',
                  lineHeight: 1.55,
                  color: '#cbd5e1',
                }}
              >
                {details.stack}
              </pre>
            </div>
          ) : null}

          <div
            style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}
          >
            <div style={{ fontSize: '13px', color: '#94a3b8' }}>
              The renderer failed before the app UI could finish loading.
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: '1px solid rgba(37, 99, 235, 0.45)',
                background: '#2563eb',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ensureRoot() {
  const element = document.getElementById('root');
  if (!element) {
    throw new Error('Renderer root element "#root" was not found in index.html.');
  }

  root ??= ReactDOM.createRoot(element);
  return root;
}

function renderFatalError(error: unknown) {
  const details = normalizeError(error);
  console.error('Renderer fatal error:', error);

  if (fatalShown) {
    return;
  }

  fatalShown = true;
  ensureRoot().render(buildFatalErrorScreen(details));
}

window.addEventListener('error', (event) => {
  renderFatalError(event.error ?? new Error(event.message || 'Unknown window error.'));
});

window.addEventListener('unhandledrejection', (event) => {
  renderFatalError(event.reason);
});

async function bootstrap() {
  try {
    if (!window.mediaApi || typeof window.mediaApi.onJobEvent !== 'function') {
      throw new Error(
        'Preload bridge "window.mediaApi" is unavailable. The Electron preload script did not attach correctly.'
      );
    }

    const { default: App } = await import('./App');
    ensureRoot().render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    renderFatalError(error);
  }
}

void bootstrap();
