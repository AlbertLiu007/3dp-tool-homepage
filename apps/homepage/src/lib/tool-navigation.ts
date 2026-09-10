import type { ToolHeaderNavItem } from '@unionam/shared-ui';
import type { Dictionary } from '@/lib/i18n/dictionaries';

export type ToolNavigationKey = 'quote' | 'converter' | 'gift' | 'crm';

type ToolNavigationLabels = Pick<Dictionary, 'navQuote' | 'navConverter' | 'navGift' | 'navCrm'>;

export function createToolNavigation(labels: ToolNavigationLabels, active?: ToolNavigationKey): ToolHeaderNavItem[] {
  return [
    { label: labels.navQuote, href: '/quote', active: active === 'quote', eventName: 'header_quote_click' },
    { label: labels.navConverter, href: '/converter', active: active === 'converter', eventName: 'header_converter_click' },
    { label: labels.navGift, href: '/gift', active: active === 'gift', eventName: 'header_gift_click' },
    { label: labels.navCrm, href: '/crm/', active: active === 'crm', eventName: 'header_crm_click' },
  ];
}
