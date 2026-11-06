import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="stage">
      <App />
      <p className="stage-caption">今天吃什么 · 首版交互原型（模拟数据）</p>
    </div>
  </StrictMode>,
);
