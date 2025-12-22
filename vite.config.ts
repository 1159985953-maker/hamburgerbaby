// vite.config.ts（最终修复版：去掉 require.resolve + 强制统一 React）
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // 新增：用 path 解决路径问题

export default defineConfig({
  base: '/', // 确保静态资源路径正确

  plugins: [react()],

  resolve: {
    alias: {
      // 强制统一 React（用相对路径或绝对路径，避免 require）
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      'react-dom/client': path.resolve('./node_modules/react-dom/client'),
      'react/jsx-runtime': path.resolve('./node_modules/react/jsx-runtime'),

      // 兼容 RN Web（如果你还有 Switch/Slider 等组件）
      'react-native': 'react-native-web',
    },
    dedupe: ['react', 'react-dom']  // 去重 React
  },

  optimizeDeps: {
    exclude: ['react-native'], // 排除 RN 原生模块
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },

  // 可选：如果还有 CommonJS 警告，加这个
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
});