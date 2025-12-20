import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
// 如果你有全局样式文件（比如 index.css），记得留着下面这行，没有就删掉


// 获取网页上的根节点
const rootElement = document.getElementById('root');

if (rootElement) {
  // 只有在网页环境下，这里才能正常运行
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("找不到 root 节点，请检查 index.html");
}