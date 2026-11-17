import React from 'react';
import { createRoot } from 'react-dom/client';
import Game from '../app/game';
import '../app/globals.css';
import '../app/graphics-recovery.css';
import '../app/mission-records.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><Game portable/></React.StrictMode>);
