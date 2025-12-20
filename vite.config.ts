// ==================== 【vite.config.ts 正确修复版】 ====================
// 这是一组完全修复白屏的配置
// 直接复制整个文件内容，覆盖你原来的 vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',  // ← 改成这个！根路径，不要加项目名
  plugins: [react()],
  resolve: {
    alias: {
      // 保留你原来的兼容配置
      'react-native': 'react-native-web',
    },
  },
  optimizeDeps: {
    exclude: ['react-native'],
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
});