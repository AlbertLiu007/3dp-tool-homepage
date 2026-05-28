'use client';

import { Calculator, CheckCircle2, ChevronRight, FileSymlink, Gift, GraduationCap, Hammer, Layers3, Lightbulb, Puzzle, Rocket, ShieldCheck, SlidersHorizontal, Sparkles, UsersRound, Wrench } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { ToolHeader } from '@unionam/shared-ui';
import { useLanguage } from '@/lib/i18n/use-language';

function ToolCard({
  title,
  description,
  button,
  href,
  icon,
  disabled = false,
  tag,
  tagTone = 'online',
}: {
  title: string;
  description: string;
  button?: string;
  href?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  tag?: string;
  tagTone?: 'online' | 'soon';
}) {
  const content = (
    <div className={`h-full rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition ${disabled ? 'opacity-75' : 'hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-cyan-50 text-[#0b4f9c]">{icon}</div>
        {tag ? (
          <span className={`rounded border px-2 py-1 text-[11px] font-black ${tagTone === 'online' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
            {tag}
          </span>
        ) : null}
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 min-h-12 text-sm font-medium leading-6 text-slate-500">{description}</p>
      {button ? (
        <div className={`mt-5 inline-flex h-11 items-center gap-2 rounded-md px-4 text-sm font-black shadow-sm ${disabled ? 'bg-slate-200 text-slate-500' : 'bg-[#0b4f9c] text-white'}`}>
          {button}
          <ChevronRight className="h-4 w-4" />
        </div>
      ) : null}
    </div>
  );

  if (disabled || !href) return content;
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}

function AdvantageCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid h-12 w-12 place-items-center rounded-md bg-cyan-50 text-[#0b4f9c]">{icon}</div>
      <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm font-medium leading-6 text-slate-500">{description}</p>
    </article>
  );
}

function SceneCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-cyan-50 text-[#0b4f9c]">{icon}</div>
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-medium leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </article>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-3xl font-black text-[#0b4f9c]">{value}</div>
      <div className="mt-2 text-sm font-bold leading-5 text-slate-500">{label}</div>
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-2xl font-black text-[#0b4f9c]">{title}</h2>
      {description ? <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">{description}</p> : null}
    </div>
  );
}

export default function HomePage() {
  const { language, setLanguage, t } = useLanguage();
  const navItems = [
    { label: t.navQuote, href: '/quote' },
    { label: t.navConverter, href: '/converter' },
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <ToolHeader language={language} labels={t} logoSrc="/brand/unionam-logo.png" navItems={navItems} onLanguageChange={setLanguage} />

      <section className="mx-auto max-w-[1480px] px-5 py-5">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="grid items-stretch lg:grid-cols-[minmax(0,1fr)_430px]">
            <div className="p-6 md:p-8">
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-800">
                <ShieldCheck className="h-4 w-4" />
                UnionAM
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-slate-950 md:text-5xl">{t.heroTitle}</h1>
              <p className="mt-4 max-w-3xl text-lg font-bold leading-8 text-slate-600">{t.heroSubtitle}</p>
              <p className="mt-6 max-w-2xl text-sm font-medium leading-6 text-slate-500">{t.privacyNote}</p>
            </div>

            <aside className="border-t border-slate-200 bg-slate-50 p-5 lg:border-l lg:border-t-0 md:p-6">
              <div className="grid h-full content-center gap-3">
                {[t.valueLocal, t.valueIndustrial, t.valueFree].map((value) => (
                  <div key={value} className="flex items-start gap-3 rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-black leading-6 text-slate-700">{value}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-6">
        <SectionHeading title={t.whyTitle} />
        <div className="grid gap-4 md:grid-cols-3">
          <AdvantageCard icon={<ShieldCheck className="h-6 w-6" />} title={t.securityTitle} description={t.securityDescription} />
          <AdvantageCard icon={<SlidersHorizontal className="h-6 w-6" />} title={t.industrialTitle} description={t.industrialDescription} />
          <AdvantageCard icon={<Gift className="h-6 w-6" />} title={t.freeTitle} description={t.freeDescription} />
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-6">
        <SectionHeading title={t.toolsTitle} description={t.toolsDescription} />
        <div className="grid gap-4 md:grid-cols-2">
          <ToolCard title={t.quoteToolTitle} description={t.quoteToolDescription} button={t.quoteToolButton} href="/quote" icon={<Calculator className="h-6 w-6" />} tag={t.online} />
          <ToolCard title={t.converterToolTitle} description={t.converterToolDescription} button={t.converterToolButton} href="/converter" icon={<FileSymlink className="h-6 w-6" />} tag={t.online} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ToolCard title={t.repairTitle} description={t.repairDescription} icon={<Wrench className="h-6 w-6" />} disabled tag={t.comingSoon} tagTone="soon" />
          <ToolCard title={t.supportTitle} description={t.supportDescription} icon={<Layers3 className="h-6 w-6" />} disabled tag={t.comingSoon} tagTone="soon" />
          <ToolCard title={t.slicerTitle} description={t.slicerDescription} icon={<Puzzle className="h-6 w-6" />} disabled tag={t.comingSoon} tagTone="soon" />
          <ToolCard title={t.materialTitle} description={t.materialDescription} icon={<Sparkles className="h-6 w-6" />} disabled tag={t.comingSoon} tagTone="soon" />
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-6">
        <SectionHeading title={t.scenesTitle} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SceneCard icon={<Hammer className="h-5 w-5" />} title={t.engineerTitle} description={t.engineerDescription} />
          <SceneCard icon={<Lightbulb className="h-5 w-5" />} title={t.designerTitle} description={t.designerDescription} />
          <SceneCard icon={<GraduationCap className="h-5 w-5" />} title={t.educationTitle} description={t.educationDescription} />
          <SceneCard icon={<UsersRound className="h-5 w-5" />} title={t.makerTitle} description={t.makerDescription} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1480px] gap-5 px-5 py-6 lg:grid-cols-[minmax(0,1fr)_520px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeading title={t.trustTitle} />
          <Image src="/brand/unionam-logo.png" alt="UnionAM" width={186} height={56} className="h-10 w-auto" />
          <div className="mt-5 grid gap-3 text-sm font-medium leading-7 text-slate-600">
            <p>{t.companyIntro}</p>
            <p>{t.marketShare}</p>
            <p>{t.industries}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Stat value="20+" label={t.yearsLabel} />
          <Stat value="50%+" label={t.shareLabel} />
          <Stat value="10000+" label={t.customersLabel} />
          <Stat value="100+" label={t.patentsLabel} />
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-6">
        <SectionHeading title={t.faqTitle} />
        <div className="grid gap-3">
          {[
            [t.faqFreeQuestion, t.faqFreeAnswer],
            [t.faqUploadQuestion, t.faqUploadAnswer],
            [t.faqDeviceQuestion, t.faqDeviceAnswer],
            [t.faqFutureQuestion, t.faqFutureAnswer],
          ].map(([question, answer]) => (
            <article key={question} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-slate-950">{question}</h3>
              <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1480px] px-5 py-6 pb-10">
        <div className="rounded-lg bg-[linear-gradient(135deg,#0b4f9c,#0891b2)] p-6 text-white shadow-sm">
          <div className="grid items-center gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <h2 className="text-2xl font-black leading-9">{t.ctaTitle}</h2>
              <p className="mt-2 text-sm font-bold text-cyan-50">{t.ctaSubtitle}</p>
            </div>
            <Link href="/quote" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-black text-[#0b4f9c] shadow-sm transition hover:bg-cyan-50">
              <Rocket className="h-5 w-5" />
              {t.ctaButton}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
