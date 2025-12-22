// 这是一组新代码，请复制并粘贴到新文件 src/components/FullScreenPage.tsx 中
// 这是一个“页面布局”组件，专门用来解决全屏适配问题。
// 它可以自动处理顶部安全区（刘海）和底部安全区（横线），并防止内容遮挡。

import React from 'react';
import SafeAreaHeader from './SafeAreaHeader'; // 引用我们现有的 Header

interface FullScreenPageProps {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode; // 这个代表页面的所有内容
  // 我们给 content div 加一个 className 属性，让它更灵活，比如可以改背景色
  contentClassName?: string;
}

// 关键：把 Header 的高度定义成一个常量，方便复用
const HEADER_BASE_HEIGHT = '44px';
const HEADER_TOTAL_HEIGHT = `calc(${HEADER_BASE_HEIGHT} + env(safe-area-inset-top))`;

const FullScreenPage: React.FC<FullScreenPageProps> = ({ title, left, right, children, contentClassName }) => {
  return (
    // 整体容器，用 flex 布局让内容区自动填满剩余空间
    <div className="h-full w-full flex flex-col">
      
      {/* 1. 顶部 Header (保持不变，依然是悬浮的) */}
      <SafeAreaHeader title={title} left={left} right={right} />

      {/* 2. 核心：页面内容容器 */}
      <div
        // 这里用 contentClassName 来接收外面传进来的样式，比如 bg-gray-900
        className={`flex-1 overflow-y-auto ${contentClassName || 'bg-gray-100'}`}
        style={{
          // 关键修复：让内容区的顶部内边距 (padding-top) 等于 Header 的总高度
          // 这样内容就会被精确地推到 Header 下方，不再被遮挡
          paddingTop: HEADER_TOTAL_HEIGHT,

          // 新增：也为底部安全区（iPhone小横条）留出空间
          // 这样滚动到底部时，最后的内容不会被小横条挡住
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default FullScreenPage;