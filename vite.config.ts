import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/hamburgerbaby/',   // <--- 必须加这行！！！
  plugins: [react()],

});