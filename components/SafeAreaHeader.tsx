import React from 'react';

interface SafeAreaHeaderProps {
  title: any; // 改成 any 或 ReactNode 以兼容之前的组件调用
  left?: React.ReactNode;
  right?: React.ReactNode;
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
        background: 'rgba(255, 255, 255, 0.95)',
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '40px' }}>
        {left}
      </div>
      <div style={{ fontWeight: '600', fontSize: '1.1rem', flexGrow: 1, textAlign: 'center' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: '40px' }}>
        {right}
      </div>
    </div>
  );
};

export default SafeAreaHeader;