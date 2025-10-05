import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './modules/App';
import { useToastStore } from './state/toastHost';
import { _registerNetErrorListener } from './api/base';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  // Bridge for global net error -> toast without causing hook misuse: create a small wrapper component.
  const Bridge: React.FC = () => {
    const push = useToastStore(s => s.push);
    React.useEffect(() => {
      _registerNetErrorListener((msg) => push({ type:'error', msg }));
    }, [push]);
    return <App />;
  };
  root.render(<React.StrictMode><Bridge /></React.StrictMode>);
}
