import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/tearable.css';
import './styles/tearable-decor.css';
import './styles/tearable-frame.css';
import './styles/tearable-rip.css';
import './styles/content.css';
import './styles/responsive.css';
import './styles/print.css';
import './styles/tearable-sheet.css';
import './styles/tearable-thoughts-overlay.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
