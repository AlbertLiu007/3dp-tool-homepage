'use client';

import { ExternalLink, LoaderCircle, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { useEffect, useId, useState } from 'react';

const WECOM_LOGIN_SCRIPT_ID = 'unionam-wecom-login-script';
const WECOM_LOGIN_SCRIPT_URL = 'https://wwcdn.weixin.qq.com/node/wework/wwopen/js/wwLogin-1.2.4.js';

type WeComLoginOptions = {
  id: string;
  appid: string;
  agentid: string;
  redirect_uri: string;
  state: string;
  href?: string;
  lang?: 'zh' | 'en';
};

type WeComQrConfiguration = {
  appId: string;
  agentId: string;
  redirectUri: string;
  state: string;
};

type WeComQrLabels = {
  loading: string;
  failed: string;
  failedHint: string;
  retry: string;
  scanHint: string;
  secureHint: string;
  openOfficial: string;
  mobileTitle: string;
  mobileHint: string;
};

declare global {
  interface Window {
    WwLogin?: new (options: WeComLoginOptions) => unknown;
  }
}

let weComScriptPromise: Promise<void> | null = null;

function loadWeComLoginScript() {
  if (window.WwLogin) return Promise.resolve();
  if (weComScriptPromise) return weComScriptPromise;

  weComScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(WECOM_LOGIN_SCRIPT_ID) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement('script');
    const handleLoad = () => window.WwLogin
      ? resolve()
      : reject(new Error('The WeCom login component did not initialize.'));
    const handleError = () => reject(new Error('The WeCom login component failed to load.'));

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.id = WECOM_LOGIN_SCRIPT_ID;
      script.src = WECOM_LOGIN_SCRIPT_URL;
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    weComScriptPromise = null;
    throw error;
  });

  return weComScriptPromise;
}

export function WeComQrLogin({
  language,
  labels,
  loginPending,
  onOpenOfficial,
}: {
  language: 'zh' | 'en';
  labels: WeComQrLabels;
  loginPending: boolean;
  onOpenOfficial: () => void;
}) {
  const reactId = useId();
  const containerId = `wecom-login-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [deviceMode, setDeviceMode] = useState<'checking' | 'desktop' | 'mobile'>('checking');
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateDeviceMode = () => setDeviceMode(mediaQuery.matches ? 'mobile' : 'desktop');
    updateDeviceMode();
    mediaQuery.addEventListener('change', updateDeviceMode);
    return () => mediaQuery.removeEventListener('change', updateDeviceMode);
  }, []);

  useEffect(() => {
    if (deviceMode !== 'desktop') return;

    const controller = new AbortController();
    let cancelled = false;
    const target = document.getElementById(containerId);
    if (target) target.innerHTML = '';
    setStatus('loading');

    async function initializeQrLogin() {
      const response = await fetch(`/api/gift/auth/wecom/qr?lang=${language}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      });
      const payload = (await response.json()) as Partial<WeComQrConfiguration> & { error?: string };
      if (!response.ok || !payload.appId || !payload.agentId || !payload.redirectUri || !payload.state) {
        throw new Error(payload.error || 'The WeCom QR configuration is unavailable.');
      }

      await loadWeComLoginScript();
      if (cancelled || !window.WwLogin) return;

      new window.WwLogin({
        id: containerId,
        appid: payload.appId,
        agentid: payload.agentId,
        redirect_uri: encodeURIComponent(payload.redirectUri),
        state: payload.state,
        href: '',
        lang: language,
      });
      setStatus('ready');
    }

    initializeQrLogin().catch((error) => {
      if (cancelled || error instanceof DOMException && error.name === 'AbortError') return;
      setStatus('failed');
    });

    return () => {
      cancelled = true;
      controller.abort();
      const currentTarget = document.getElementById(containerId);
      if (currentTarget) currentTarget.innerHTML = '';
    };
  }, [attempt, containerId, deviceMode, language]);

  if (deviceMode === 'mobile') {
    return (
      <div className="mt-6 rounded-lg border border-cyan-100 bg-cyan-50/70 p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-[#0b4f9c] shadow-sm"><Smartphone className="h-7 w-7" /></div>
        <h3 className="mt-4 text-sm font-black text-slate-900">{labels.mobileTitle}</h3>
        <p className="mx-auto mt-2 max-w-xs text-xs font-medium leading-5 text-slate-500">{labels.mobileHint}</p>
        <button type="button" onClick={onOpenOfficial} disabled={loginPending} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-4 text-sm font-black text-white transition hover:bg-[#083f7e] disabled:cursor-wait disabled:opacity-70" data-umami-event="gift_wecom_login_click">
          {loginPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{labels.openOfficial}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-lg border border-cyan-100 bg-cyan-50/70 p-4 text-center">
        <div className="relative mx-auto min-h-[400px] w-full max-w-[300px] overflow-hidden rounded-md bg-white shadow-sm">
          <div id={containerId} className={`h-[400px] w-[300px] max-w-full transition-opacity ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`} aria-label={labels.scanHint} />
          {status === 'loading' || deviceMode === 'checking' ? (
            <div className="absolute inset-0 grid place-items-center px-6"><div><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0b4f9c]" /><p className="mt-4 text-xs font-bold text-slate-500">{labels.loading}</p></div></div>
          ) : null}
          {status === 'failed' ? (
            <div className="absolute inset-0 grid place-items-center px-6"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><QrCode className="h-6 w-6" /></div><h3 className="mt-4 text-sm font-black text-slate-900">{labels.failed}</h3><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{labels.failedHint}</p><button type="button" onClick={() => setAttempt((current) => current + 1)} className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-xs font-black text-[#0b4f9c] transition hover:bg-cyan-100"><RefreshCw className="h-3.5 w-3.5" />{labels.retry}</button></div></div>
          ) : null}
        </div>
        <p className="mt-3 text-xs font-bold text-slate-600">{labels.scanHint}</p>
        <p className="mt-1 text-[11px] font-medium leading-5 text-slate-400">{labels.secureHint}</p>
      </div>
      <button type="button" onClick={onOpenOfficial} disabled={loginPending} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#0b4f9c] disabled:cursor-wait disabled:opacity-70" data-umami-event="gift_wecom_login_fallback_click">
        {loginPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}{labels.openOfficial}
      </button>
    </div>
  );
}
