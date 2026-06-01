import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { UnionAMLanguageProvider, type UnionAMLanguage } from '@unionam/shared-i18n';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://unionam.com'),
  title: 'UnionAM 联泰科技 3D 打印工具站',
  description: '免费、安全、专业的一站式 3D 打印全流程工具平台。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const language = cookies().get('unionam.language')?.value === 'en' ? 'en' : 'zh';

  return (
    <html lang={language === 'en' ? 'en' : 'zh-CN'}>
      <body>
        <Script defer src="https://cloud.umami.is/script.js" data-website-id="05e5f00c-82a3-4dcf-9d5a-b50f434eb92e" />
        <UnionAMLanguageProvider initialLanguage={language as UnionAMLanguage}>{children}</UnionAMLanguageProvider>
      </body>
    </html>
  );
}
