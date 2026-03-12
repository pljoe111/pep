import React from 'react';
import { Routes, Route } from 'react-router-dom';
import App from '../App';

function NotFoundPage(): React.ReactElement {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
      <h1>404 — Page Not Found</h1>
      <p>
        <a href="/">Go home</a>
      </p>
    </div>
  );
}

function AppRoutes(): React.ReactElement {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
