// src/components/SafeAreaHeader.tsx
import React from 'react';

interface SafeAreaHeaderProps {
  title: string;
  left?: React.ReactNode;   // 左侧内容，如返回按钮
  right?: React.ReactNode;  // 右侧内容，如设置按钮
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
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    paddingTop: 'env(safe-area-inset-top)',  // 只在刘海区加 padding
    paddingBottom: '0.5rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 'calc(44px + env(safe-area-inset-top))',  // 高度包含刘海
    boxSizing: 'border-box',
  }}
>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {left}
      </div>
      <div style={{ fontWeight: '600', fontSize: '1.1rem', flexGrow: 1, textAlign: 'center' }}>
        {title}
      </div>
      <div style={{ width: '40px' }}> {/* 占位保持居中 */ }
        {right}
      </div>
    </div>
  );
};

export default SafeAreaHeader;