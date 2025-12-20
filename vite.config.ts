import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/hamburgerbaby/', // 你的基础路径，保留
  plugins: [react()],

  // 👇👇👇 新增下面这些配置来解决报错 👇👇👇
  resolve: {
    alias: {
      // 关键操作：把 'react-native' 指向 'react-native-web'
      // 这样 Vite 就不会去读那个报错的文件，而是去读网页兼容版
      'react-native': 'react-native-web',
    },
  },
  optimizeDeps: {
    // 告诉构建工具，不要去预处理 react-native，直接跳过
    exclude: ['react-native'],
    esbuildOptions: {
      // 处理一些 .js 文件里夹杂 jsx 的情况
      loader: {
        '.js': 'jsx',
      },
    },
  },
});