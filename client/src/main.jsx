import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// StrictMode double-invokes effects in development to surface impure renders and missing
// cleanup. It is a development-only behaviour and does not ship in the production build.
// If a fetch appears to fire twice in dev, this is why — it is not a bug.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
