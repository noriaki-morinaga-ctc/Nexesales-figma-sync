import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/index.css';
import { applyGridColorVariables } from './styles/gridStyles';

// グリッドの色（gridStyles.ts が正）を CSS 変数として登録し、grid.css から参照できるようにする
applyGridColorVariables();

createRoot(document.getElementById('root')!).render(<App />);
