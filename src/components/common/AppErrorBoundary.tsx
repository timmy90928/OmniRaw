import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '../../i18n';

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('OmniRaw render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <h1>{i18n.t('fatal.title')}</h1>
        <p>{i18n.t('fatal.message')}</p>
        <pre>{this.state.error.message}</pre>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          {i18n.t('fatal.reload')}
        </button>
      </main>
    );
  }
}
