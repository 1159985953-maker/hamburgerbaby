// src/components/SafeAreaHeader.tsx
import React from 'react';

interface SafeAreaHeaderProps {
  title: string;
  left?: React.ReactNode;   // 左侧内容
  right?: React.ReactNode;  // 右侧内容
}

const SafeAreaHeader: React.FC<SafeAreaHeaderProps> = ({ title, left, right }) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.95)', // 稍微透一点点，更有质感
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: '0.5rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'calc(44px + env(safe-area-inset-top))',
        boxSizing: 'border-box',
      }}
    >
      {/* 左侧容器：保持不变 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '40px' }}>
        {left}
      </div>

      {/* 中间标题：保持居中 */}
      <div style={{ fontWeight: '600', fontSize: '1.1rem', flexGrow: 1, textAlign: 'center' }}>
        {title}
      </div>

      {/* ★★★ 核心修复在这里！★★★ */}
      {/* 以前是 width: '40px' (死宽度)，现在改成 flex 布局，自动适应内容宽度 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '40px' }}>
        {right}
      </div>
    </div>
  );
};

export default SafeAreaHeader;