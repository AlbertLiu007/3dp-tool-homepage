import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'UnionAM 礼品站运营后台',
  robots: { index: false, follow: false, nocache: true },
};

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
