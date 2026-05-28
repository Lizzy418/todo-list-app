// 앱의 진입점입니다. React 앱을 브라우저의 #root 엘리먼트에 연결합니다.
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
