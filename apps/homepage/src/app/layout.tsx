import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://unionam.com'),
  title: 'UnionAM 联泰科技 3D 打印工具站',
  description: '免费、安全、专业的一站式 3D 打印全流程工具平台。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
