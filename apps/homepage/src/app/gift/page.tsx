'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BadgeCheck,
  Box,
  Boxes,
  Building2,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Cpu,
  Download,
  Factory,
  FileText,
  Gift,
  ImagePlus,
  Landmark,
  Layers3,
  LoaderCircle,
  LogOut,
  Maximize2,
  Palette,
  PackageCheck,
  Pencil,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { ToolHeader } from '@unionam/shared-ui';
import { WeComQrLogin } from '@/components/gift/wecom-qr-login';
import { GiftModelModal, type GeneratedGiftModel } from '@/components/model-viewer/gift-model-modal';
import { useLanguage } from '@/lib/i18n/use-language';

type GiftLanguage = 'zh' | 'en';

const copy = {
  zh: {
    pageTitle: '联泰礼品与 3D 打印服务平台',
    pageSubtitle: '为客户送出独一无二的 3D 打印礼品，也让展会样品、业务样件和内部打印需求统一申请、统一管理。',
    loginTitle: '企业微信扫码登录',
    loginDescription: '登录后可为客户选择或生成专属礼品，也可提交展会样品、业务样件等公司业务打印需求。',
    loginButton: '企业微信扫码登录',
    loginHint: '仅限联泰科技在职员工使用',
    localLogin: '本地开发：模拟登录',
    localHint: '本地开发环境可跳过企业微信扫码，直接使用已审核的测试员工身份进入。',
    authLoading: '正在验证企业微信员工身份…',
    authConfigError: '企业微信应用尚未配置完成，请联系系统管理员。',
    authNotEmployee: '当前账号不是可用的联泰在职员工账号，无法进入礼品站。',
    authStateError: '登录请求已失效，请重新扫码登录。',
    authLoginError: '企业微信登录失败，请稍后重试或联系系统管理员。',
    loginStarting: '正在打开企业微信登录…',
    qrLoading: '正在加载企业微信登录二维码…',
    qrFailed: '二维码加载失败',
    qrFailedHint: '请检查网络后重新加载，或使用下方备用入口。',
    qrRetry: '重新加载',
    qrScanHint: '请使用手机企业微信“扫一扫”登录',
    qrSecureHint: '二维码由企业微信官方提供，扫码后将在手机端确认登录。',
    qrOpenOfficial: '在企业微信官方页面登录',
    mobileLoginTitle: '在当前设备继续登录',
    mobileLoginHint: '移动端无法扫描当前屏幕，请打开企业微信官方授权页完成身份确认。',
    secureTitle: '客户礼赠与业务打印，一站申请',
    secureDescription: '员工身份由企业微信统一认证，客户礼品、展会样品和业务样件在一个平台留痕管理。',
    hello: '你好',
    dashboardDescription: '根据客户行业、偏好和使用场景挑选礼品；展会样品、客户样件及其他业务打印，也可以在这里统一申请。',
    logout: '退出登录',
    adminPortal: '管理后台',
    chooseTitle: '让每一次打印都服务于业务',
    chooseDescription: '从成熟模型开始，或根据客户调性和业务场景生成新的方案。',
    libraryTitle: '选择客户礼品与业务样件',
    libraryDescription: '浏览已审核、可打印的模型，按客户行业、展会主题和使用场景选择合适的 3D 打印方案。',
    libraryButton: '浏览模型库',
    generateTitle: '按客户特征生成专属礼品',
    generateDescription: '上传参考图片，补充客户特征、品牌元素和礼品场景，生成真正与客户匹配的可打印模型。',
    generateButton: '开始生成',
    businessTitle: '展会与业务样件申请',
    businessDescription: '展会展示样品、客户打样件、销售演示件和其他公司业务打印需求，统一提交、统一排产、统一沉淀。',
    businessButton: '提交业务打印需求',
    businessRequestTitle: '提交展会 / 业务样件申请',
    businessRequestDescription: '把原本分散在聊天、表格和临时沟通中的打印需求，统一沉淀到平台，便于审核、排产和复用。',
    businessUseCase: '业务使用场景',
    businessSource: '模型来源',
    businessDeadline: '期望完成时间',
    businessSubmit: '提交业务打印申请',
    businessSubmitted: '业务打印申请已提交',
    businessRequestPlaceholder: '例如：用于 9 月展会展示，需要 3 个汽车内饰样件，要求在展会布展前完成。',
    orderTitle: '我的打印申请',
    orderEmpty: '暂无进行中的打印申请',
    orderEmptyHint: '提交客户礼品、展会样品或业务样件申请后，进度会显示在这里。',
    browseTitle: '客户礼品与业务样件模型库',
    browseDescription: '将经过审核的客户礼品、展会样品和业务样件统一沉淀，减少重复建模和临时沟通。',
    viewDetails: '查看并申请',
    modelA: '联泰科技品牌纪念摆件',
    modelADescription: '适合客户拜访、商务纪念和展会展示，让客户收到有联泰辨识度的独特礼品。',
    modelB: 'UnionAM 个性化铭牌',
    modelBDescription: '支持姓名、部门、客户名称和日期等文字个性化，适合定制客户礼赠。',
    modelC: '城市剪影桌面摆件',
    modelCDescription: '适合展会主题、城市文化和团队活动，也可作为客户场景化礼品。',
    readyToPrint: '可直接打印',
    printTime: '预计 3 小时',
    orderModalTitle: '提交打印申请',
    orderModalHint: '申请将提交到礼品后台审核，并进入统一的打印排产和交付流程。',
    quantity: '数量',
    pickup: '领取地点',
    pickupValue: '上海总部前台',
    note: '备注（选填）',
    notePlaceholder: '例如：用于客户拜访，希望在下周三前完成',
    submitOrder: '提交申请',
    cancel: '取消',
    orderSuccess: '申请已提交',
    orderSuccessHint: '礼品管理员审核后，你可以在“我的打印申请”中查看进度。',
    generationTitle: '根据客户调性生成专属 3D 礼品',
    generationDescription: '描述客户特征、品牌元素和送礼场景，上传参考图，生成结果会先经过可打印性检查。',
    uploadLabel: '参考图片',
    uploadHint: '支持 JPG、PNG，最多 5 张图片',
    uploadChoose: '选择图片',
    uploaded: '已选择',
    sceneLabel: '礼品使用场景',
    scenePlaceholder: '请选择使用场景',
    sceneCustomer: '客户拜访 / 商务纪念',
    sceneEvent: '展会 / 活动礼品',
    sceneEmployee: '员工生日 / 节日礼品',
    featureLabel: '客户特征、品牌元素与模型需求',
    featurePlaceholder: '例如：客户是汽车行业，希望体现速度、科技和品牌识别元素，尺寸适合放在办公桌上。',
    generateNow: '生成 3D 模型方案',
    generating: '正在生成模型方案…',
    generated: '已生成 3 个候选方案',
    generatedHint: '以下结果为本地交互演示，正式版本将接入模型生成服务。',
    useCandidate: '选择此方案',
    safetyTitle: '安全提示',
    safetyDescription: '客户图片、Logo 和特征信息可能包含敏感内容，请确认已获得使用授权。',
    statusPending: '待审核',
    statusPrinting: '打印中',
    statusReady: '待领取',
    aiPendingTitle: 'AI 生成功能正在等待审核',
    aiPendingDescription: '你已完成企业员工身份验证。运营管理员批准后，即可使用礼品渲染图、图片编辑和 3D 模型生成服务；礼品库仍可正常浏览和申请。',
    aiRejectedTitle: 'AI 生成权限申请未通过',
    aiRejectedDescription: '你仍可浏览礼品库和提交已有模型的打印申请。如需重新开通，请联系礼品站运营管理员。',
    aiSuspendedTitle: 'AI 生成权限已暂停',
    aiSuspendedDescription: '生成接口暂不可用，礼品库浏览不受影响。请联系礼品站运营管理员了解原因。',
    aiApplicationLabel: '申请用途',
    aiApplicationPlaceholder: '例如：用于销售团队客户礼赠，需要根据客户行业生成专属摆件。',
    aiApplicationButton: '提交 AI 使用申请',
    aiApplicationSaving: '正在提交…',
    aiApplicationSubmitted: '申请用途已提交，运营管理员将在后台审核。',
    quotaToday: '今日额度',
    allLocal: '平台仅对企业内部开放，客户礼品、展会样品、业务样件等打印申请统一留痕管理。',
  },
  en: {
    pageTitle: 'UnionTech Gifts & 3D Print Services',
    pageSubtitle: 'Unique 3D printed gifts for customers, plus one workflow for exhibitions, samples, and internal business printing.',
    loginTitle: 'Sign in with WeCom',
    loginDescription: 'Sign in to choose or generate a customer gift, or submit an exhibition sample, business prototype, or other internal print request.',
    loginButton: 'Sign in with WeCom',
    loginHint: 'For active UnionTech employees only',
    localLogin: 'Local development: simulate sign-in',
    localHint: 'In local development, skip WeCom and enter with an approved test employee.',
    authLoading: 'Verifying your UnionTech employee identity…',
    authConfigError: 'WeCom sign-in has not been configured. Contact the system administrator.',
    authNotEmployee: 'This account is not an active UnionTech employee account and cannot access the gift station.',
    authStateError: 'This sign-in request has expired. Please scan again.',
    authLoginError: 'WeCom sign-in failed. Try again later or contact the system administrator.',
    loginStarting: 'Opening WeCom sign-in…',
    qrLoading: 'Loading the official WeCom QR code…',
    qrFailed: 'QR code failed to load',
    qrFailedHint: 'Check your connection and reload, or use the fallback link below.',
    qrRetry: 'Reload',
    qrScanHint: 'Scan with WeCom on your phone to sign in',
    qrSecureHint: 'This QR code is provided by WeCom. Confirm the sign-in on your phone after scanning.',
    qrOpenOfficial: 'Open official WeCom sign-in',
    mobileLoginTitle: 'Continue on this device',
    mobileLoginHint: 'A phone cannot scan its own screen. Open the official WeCom authorization page to continue.',
    secureTitle: 'One workflow for gifts and business printing',
    secureDescription: 'WeCom verifies employees while customer gifts, exhibition samples, and business parts are tracked in one place.',
    hello: 'Welcome',
    dashboardDescription: 'Choose a gift that matches your customer, or submit exhibition samples, customer prototypes, and other business printing needs here.',
    logout: 'Sign out',
    adminPortal: 'Admin console',
    chooseTitle: 'Make every print serve the business',
    chooseDescription: 'Start from a proven model or generate a new concept from the customer and business context.',
    libraryTitle: 'Choose customer gifts and business samples',
    libraryDescription: 'Browse reviewed models by customer industry, exhibition theme, and use case.',
    libraryButton: 'Browse model library',
    generateTitle: 'Generate a gift that matches the customer',
    generateDescription: 'Upload references and describe customer traits, brand elements, and the gifting context for a printable model.',
    generateButton: 'Start generating',
    businessTitle: 'Exhibition and business sample requests',
    businessDescription: 'Submit exhibition displays, customer prototypes, sales demonstration parts, and other internal printing needs in one workflow.',
    businessButton: 'Submit a business print request',
    businessRequestTitle: 'Exhibition / business sample request',
    businessRequestDescription: 'Capture requests that used to live in chats, spreadsheets, and one-off conversations so they can be reviewed, scheduled, and reused.',
    businessUseCase: 'Business use case',
    businessSource: 'Model source',
    businessDeadline: 'Requested completion date',
    businessSubmit: 'Submit business print request',
    businessSubmitted: 'Business print request submitted',
    businessRequestPlaceholder: 'For example: three automotive interior samples for a September exhibition, needed before booth setup.',
    orderTitle: 'My print requests',
    orderEmpty: 'No active print requests',
    orderEmptyHint: 'Progress appears here after you request a customer gift, exhibition sample, or business part.',
    browseTitle: 'Customer gifts and business sample library',
    browseDescription: 'Keep reviewed gifts, exhibition samples, and business parts in one place to reduce duplicate modeling and ad hoc coordination.',
    viewDetails: 'View and request',
    modelA: 'UnionTech brand keepsake',
    modelADescription: 'A distinctive UnionTech keepsake for customer visits, business gifts, and exhibition display.',
    modelB: 'UnionAM personalized nameplate',
    modelBDescription: 'Personalize it with a name, department, customer, date, or short message.',
    modelC: 'City silhouette desk ornament',
    modelCDescription: 'For exhibition themes, city culture, customer gifting, and team events.',
    readyToPrint: 'Ready to print',
    printTime: 'About 3 hours',
    orderModalTitle: 'Submit a print request',
    orderModalHint: 'Requests go to the operations team for review, scheduling, production, and delivery.',
    quantity: 'Quantity',
    pickup: 'Pickup location',
    pickupValue: 'Shanghai HQ reception',
    note: 'Note (optional)',
    notePlaceholder: 'For example: customer visit, needed before next Wednesday',
    submitOrder: 'Submit request',
    cancel: 'Cancel',
    orderSuccess: 'Request submitted',
    orderSuccessHint: 'Track progress in My print requests after the gift team reviews it.',
    generationTitle: 'Generate a customer-aligned 3D gift',
    generationDescription: 'Describe customer traits, brand elements, and the gifting context. Results are checked for printability first.',
    uploadLabel: 'Reference images',
    uploadHint: 'JPG or PNG, up to 5 images',
    uploadChoose: 'Choose images',
    uploaded: 'Selected',
    sceneLabel: 'Gift use case',
    scenePlaceholder: 'Choose a use case',
    sceneCustomer: 'Customer visit / business keepsake',
    sceneEvent: 'Exhibition / event gift',
    sceneEmployee: 'Employee birthday / holiday gift',
    featureLabel: 'Customer traits, brand elements, and model request',
    featurePlaceholder: 'For example: combine speed, technology, and automotive elements in a desk-sized customer gift.',
    generateNow: 'Generate 3D model concepts',
    generating: 'Generating model concepts…',
    generated: '3 candidate concepts generated',
    generatedHint: 'These are local interaction demos. The production version will connect to the model service.',
    useCandidate: 'Use this concept',
    safetyTitle: 'Safety reminder',
    safetyDescription: 'Customer images, logos, and attributes may be sensitive. Confirm that you have permission to use them.',
    statusPending: 'Pending review',
    statusPrinting: 'Printing',
    statusReady: 'Ready for pickup',
    aiPendingTitle: 'AI generation is awaiting approval',
    aiPendingDescription: 'Your employee identity is verified. Once an operator approves access, you can generate renders, edit images, and create 3D models. The gift library remains available.',
    aiRejectedTitle: 'AI access was not approved',
    aiRejectedDescription: 'You can still browse the gift library and submit print requests for existing models. Contact a gift station operator to request access again.',
    aiSuspendedTitle: 'AI generation access is suspended',
    aiSuspendedDescription: 'Generation services are currently unavailable, while library browsing remains available. Contact a gift station operator for details.',
    aiApplicationLabel: 'Application reason',
    aiApplicationPlaceholder: 'Example: customer gifting for the sales team, requiring customer-specific desk sculptures.',
    aiApplicationButton: 'Submit AI access request',
    aiApplicationSaving: 'Submitting…',
    aiApplicationSubmitted: 'Your application has been submitted for operator review.',
    quotaToday: 'Today’s quota',
    allLocal: 'For internal employees only. Customer gifts, exhibition samples, and business print requests are tracked with access control.',
  },
} as const;

type GiftCopy = (typeof copy)[GiftLanguage];

type GiftModel = {
  id: string | number;
  name: string;
  description: string;
  category: string;
  categoryLabel: string;
  useCase: string;
  finishLabel: string;
  finish: 'paint' | 'bronze' | 'both';
  color: string;
  accent: string;
  modelAssetId?: number | null;
  previewModelAssetId?: number | null;
  previewAssetId?: number | null;
  previewUrls?: string[];
  modelUrl?: string;
  modelType?: GeneratedGiftModel['modelType'];
  previewModelUrl?: string;
  previewModelType?: GeneratedGiftModel['previewModelType'];
  generatedModelUrl?: string;
  generatedModelAssetId?: number;
  draftRequestId?: number;
};

function featuredGiftModels(language: GiftLanguage): GiftModel[] {
  const uphillTigerModelVersion = '20260806-1';
  return [{
    id: 'uphill-tiger',
    name: language === 'zh' ? '上山猛虎桌面摆件' : 'Uphill Tiger Desk Sculpture',
    description: language === 'zh'
      ? '猛虎昂首登山，寓意勇毅进取、事业攀升，适合商务祝贺、签约纪念与高端客户礼赠。'
      : 'A rising tiger symbolizing courage, progress, and business success—ideal for executive gifting and milestone celebrations.',
    category: 'culture',
    categoryLabel: language === 'zh' ? '文化礼赠' : 'Cultural gift',
    useCase: language === 'zh' ? '商务祝贺 · 签约纪念' : 'Business milestone · Signing',
    finishLabel: language === 'zh' ? '单色喷漆 / 铜做旧' : 'Paint / antique bronze',
    finish: 'both',
    color: 'from-[#111827] to-[#92400e]',
    accent: '虎',
    previewUrls: [
      '/gift-models/uphill-tiger/tiger-black.png',
      '/gift-models/uphill-tiger/tiger-bronze.png',
    ],
    modelUrl: `/gift-models/uphill-tiger/uphill-tiger.stl?v=${uphillTigerModelVersion}`,
    previewModelUrl: `/gift-models/uphill-tiger/uphill-tiger-preview.glb?v=${uphillTigerModelVersion}`,
    previewModelType: 'glb',
  }];
}

const modelCatalog: Record<GiftLanguage, GiftModel[]> = {
  zh: [
    { id: 'light-cube', name: '光立方科技纪念摆件', description: '以光固化成形层纹与联泰品牌基因为灵感，适合客户拜访和签约纪念。', category: 'business', categoryLabel: '商务礼赠', useCase: '客户拜访 · 签约纪念', finishLabel: '单色喷漆', finish: 'paint', color: 'from-[#083f7e] to-[#22d3ee]', accent: 'LT' },
    { id: 'mechanical-lion', name: '机械醒狮桌面摆件', description: '传统醒狮与精密机械结构结合，兼具中国文化寓意和工业科技感。', category: 'culture', categoryLabel: '文化创意', useCase: '节日礼赠 · 海外客户', finishLabel: '铜做旧', finish: 'bronze', color: 'from-[#7c3f15] to-[#d6a15f]', accent: '醒狮' },
    { id: 'city', name: '城市天际线纪念摆件', description: '可按客户所在城市定制地标轮廓，适合作为独特、有地域记忆的商务礼品。', category: 'culture', categoryLabel: '城市文化', useCase: '异地客户 · 城市活动', finishLabel: '单色喷漆 / 铜做旧', finish: 'both', color: 'from-[#164e63] to-[#38bdf8]', accent: 'CITY' },
    { id: 'turbine', name: '未来涡轮结构摆件', description: '用参数化叶片与流线结构表达速度和精密制造，适合汽车与工业客户。', category: 'technology', categoryLabel: '工业科技', useCase: '汽车 · 装备制造', finishLabel: '单色喷漆', finish: 'paint', color: 'from-[#1e3a8a] to-[#60a5fa]', accent: '360°' },
    { id: 'aerospace', name: '航天发动机剖面模型', description: '以复杂内流道和结构细节体现增材制造能力，适合技术交流和展会展示。', category: 'technology', categoryLabel: '行业模型', useCase: '航空航天 · 技术交流', finishLabel: '铜做旧', finish: 'bronze', color: 'from-[#334155] to-[#a16207]', accent: 'AM' },
    { id: 'nameplate', name: '客户专属品牌铭牌', description: '支持客户名称、纪念日期与品牌元素个性化，快速形成一客一礼。', category: 'custom', categoryLabel: '个性定制', useCase: '周年纪念 · 重要客户', finishLabel: '单色喷漆 / 铜做旧', finish: 'both', color: 'from-[#075985] to-[#67e8f9]', accent: 'VIP' },
  ],
  en: [
    { id: 'light-cube', name: 'Light Cube Technology Keepsake', description: 'Inspired by photopolymer layer lines and UnionTech brand DNA for customer visits and signing milestones.', category: 'business', categoryLabel: 'Business gift', useCase: 'Customer visit · Signing', finishLabel: 'Monochrome paint', finish: 'paint', color: 'from-[#083f7e] to-[#22d3ee]', accent: 'LT' },
    { id: 'mechanical-lion', name: 'Mechanical Lion Desk Sculpture', description: 'A fusion of the Chinese guardian lion and precision mechanics with cultural meaning and industrial character.', category: 'culture', categoryLabel: 'Cultural design', useCase: 'Festival · Overseas customer', finishLabel: 'Antique bronze', finish: 'bronze', color: 'from-[#7c3f15] to-[#d6a15f]', accent: 'LION' },
    { id: 'city', name: 'City Skyline Keepsake', description: 'Customize the landmark silhouette of a customer city for a memorable, location-specific business gift.', category: 'culture', categoryLabel: 'City culture', useCase: 'Regional customer · Event', finishLabel: 'Paint / antique bronze', finish: 'both', color: 'from-[#164e63] to-[#38bdf8]', accent: 'CITY' },
    { id: 'turbine', name: 'Future Turbine Sculpture', description: 'Parametric blades and flowing geometry express speed and precision manufacturing for industrial customers.', category: 'technology', categoryLabel: 'Industrial technology', useCase: 'Automotive · Manufacturing', finishLabel: 'Monochrome paint', finish: 'paint', color: 'from-[#1e3a8a] to-[#60a5fa]', accent: '360°' },
    { id: 'aerospace', name: 'Aerospace Engine Cutaway', description: 'Complex internal channels and structural detail showcase additive manufacturing for technical exchange.', category: 'technology', categoryLabel: 'Industry model', useCase: 'Aerospace · Technical exchange', finishLabel: 'Antique bronze', finish: 'bronze', color: 'from-[#334155] to-[#a16207]', accent: 'AM' },
    { id: 'nameplate', name: 'Customer-Branded Nameplate', description: 'Personalize customer names, dates, and brand motifs to create a truly one-to-one gift.', category: 'custom', categoryLabel: 'Personalized', useCase: 'Anniversary · Key account', finishLabel: 'Paint / antique bronze', finish: 'both', color: 'from-[#075985] to-[#67e8f9]', accent: 'VIP' },
  ],
};

const studioCopy = {
  zh: {
    eyebrow: '联泰内部客户礼赠平台',
    welcome: '为客户挑一件真正与众不同的 3D 打印礼品',
    welcomeDescription: '优先从已验证的礼品库直接选择；没有合适方案时，再用 AI 根据图片或客户画像快速定制。',
    libraryTitle: '礼品库',
    libraryDescription: '经过筛选的可打印礼品方案，可直接申请，也可基于现有模型进行客户化调整。',
    searchPlaceholder: '搜索礼品、行业或使用场景',
    all: '全部',
    business: '商务礼赠',
    culture: '文化创意',
    technology: '工业科技',
    custom: '个性定制',
    available: '可申请打印',
    finish: '推荐工艺',
    noResult: '没有找到匹配的礼品，可尝试调整筛选或使用 AI 定制。',
    aiTitle: '没有合适的？用 AI 定制客户专属礼品',
    aiDescription: '选择一种创作方式。所有 3D 模型统一生成白膜，单色喷漆或铜做旧只用于效果预览和后续工艺。',
    imageMode: '上传图片生成 3D 模型',
    imageModeHint: '适合已有清晰物体、人物或礼品参考图',
    briefMode: '按客户画像设计礼品',
    briefModeHint: '先生成工艺渲染图，确认方案后再生成 3D 模型',
    oneImage: '上传一张参考图片',
    oneImageHint: '支持 JPG、PNG、WebP；建议主体完整、背景简洁',
    replaceImage: '更换图片',
    imageCompressing: '图片超过 5MB，正在自动压缩…',
    imagePreparingWhite: '正在识别主体并生成纯白背景建模图…',
    imagePrepared: '白底建模图已生成，请确认主体与底座完整。',
    imagePreparationFailed: '白底处理失败，请重试或更换背景更简洁的图片。',
    imageOriginal: '原图',
    imagePreparedView: '白底建模图',
    imagePaintView: '喷漆效果',
    imageRetryPreparation: '重新处理白底',
    imagePaintPreviewTitle: '单色喷漆效果预览',
    imagePaintPreviewHint: '颜色只用于效果预览和生产工艺，不会写入白模 STL。',
    generatePaintPreview: '生成单色喷漆预览',
    generatingPaintPreview: '正在生成喷漆预览…',
    paintPreviewReady: '喷漆效果已生成，可切换左侧查看。',
    imageCompressed: '图片已自动压缩。',
    imageCompressionFailed: '图片压缩失败，请选择小于 5MB 的 JPG、PNG 或 WebP 图片。',
    imageTooLarge: '图片超过 5MB，无法提交，请更换图片。',
    imageModelRule: '系统将提取主体造型并生成可打印白膜模型，不会把图片颜色写入模型。',
    generateWhiteModel: '生成白膜 3D 模型',
    generatingWhiteModel: '正在生成白膜模型…',
    whiteModelReady: '白膜 3D 模型已生成',
    whiteModelReadyHint: '下一步可检查模型、确定尺寸并提交打印申请。',
    customerBrief: '描述礼品创意',
    customerBriefPlaceholder: '例如：为新能源汽车客户的十周年合作纪念设计桌面摆件，体现速度、绿色能源与双方长期合作，避免复杂悬空结构。',
    profileTags: '客户画像定位（下拉多选）',
    profileAutoHint: '选择后会自动生成礼品创意文案，也可继续手动修改。',
    renderFinish: '选择效果图工艺',
    paint: '单色喷漆',
    paintHint: '适合品牌色、现代感和科技类礼品',
    paintColor: '选择喷漆颜色',
    paintColorHint: '生成的摆件整体使用所选纯色，仅保留自然光影。',
    customPaintColor: '自定义颜色',
    paintColorRule: '单色喷漆效果不使用渐变、拼色或其他材质色。',
    bronze: '铜做旧',
    bronzeHint: '适合纪念性、文化类和高端桌面摆件',
    processRule: '工艺选择只影响渲染效果与后处理要求，交付给打印环节的 3D 模型始终为白膜。',
    generateRender: '生成礼品渲染图',
    generatingRender: '正在生成礼品创意…',
    renderReady: '选择一个满意的礼品方案',
    renderReadyHint: '确认造型与工艺效果后，再生成对应的白膜 3D 模型。',
    selectConcept: '选择此方案',
    selected: '已选择',
    editTitle: '继续编辑已生成图片',
    editDescription: '选择方案后可继续描述修改要求；如只想修改局部，可上传一张同尺寸透明蒙版。每次编辑都会保留上一版。',
    editPrompt: '修改要求',
    editPlaceholder: '例如：保留整体造型，把底座改得更稳重，减少顶部细长结构，铜做旧效果更克制。',
    optionalMask: '局部编辑蒙版（选填）',
    maskHint: 'PNG，需与效果图尺寸一致并包含透明通道',
    chooseMask: '选择蒙版',
    editImage: '生成修改版本',
    editingImage: '正在编辑图片…',
    editedVersion: '已生成新的修改版本并自动选中',
    generateFromRender: '根据选中方案生成白膜 3D 模型',
    modelQueued: '白膜模型任务已提交，正在生成…',
    modelProgressPreparing: '正在压缩并校验建模图片',
    modelProgressUploading: '正在上传建模图片并创建任务',
    modelProgressQueued: '任务已提交，正在等待 Tripo 处理',
    modelProgressGenerating: 'Tripo 正在生成 150 万面高精度模型',
    modelProgressConverting: '模型已生成，服务器正在转换并校验 STL',
    downloadModel: '下载 STL 模型',
    aiConfigError: 'AI 服务密钥尚未配置，请联系管理员完成环境变量配置。',
    aiApprovalError: '你的 AI 使用权限尚未通过审核或已暂停。',
    aiQuotaError: '当前额度已用完或已有生成任务正在运行，请稍后再试。',
    aiRequestError: 'AI 服务暂时不可用，请稍后重试。',
    orders: '我的申请',
    newRequest: '已有自己的模型？提交展会或业务样件申请',
    newRequestButton: '提交其他打印需求',
    modelPreview: '白膜模型预览',
    openModelPreview: '点击查看并解析 3D 模型',
    submitPrint: '提交打印申请',
  },
  en: {
    eyebrow: 'UnionTech internal customer gifting',
    welcome: 'Choose a distinctive 3D printed gift for your customer',
    welcomeDescription: 'Start with a proven gift from the library. If nothing fits, use AI to customize from an image or customer profile.',
    libraryTitle: 'Gift library',
    libraryDescription: 'Reviewed, printable gift concepts ready to request or adapt for a specific customer.',
    searchPlaceholder: 'Search gifts, industries, or use cases',
    all: 'All',
    business: 'Business gifts',
    culture: 'Cultural design',
    technology: 'Industrial tech',
    custom: 'Personalized',
    available: 'Ready to request',
    finish: 'Recommended finish',
    noResult: 'No matching gift. Adjust the filters or create a custom design with AI.',
    aiTitle: 'Nothing fits? Create a customer-specific gift with AI',
    aiDescription: 'Choose a creation path. Every 3D model is generated as a white base; paint and antique bronze apply only to visual preview and finishing.',
    imageMode: 'Image to 3D model',
    imageModeHint: 'Best for a clear object, person, or gift reference image',
    briefMode: 'Design from customer profile',
    briefModeHint: 'Generate a finish render first, then turn the approved concept into 3D',
    oneImage: 'Upload one reference image',
    oneImageHint: 'JPG, PNG, or WebP; use a complete subject and simple background',
    replaceImage: 'Replace image',
    imageCompressing: 'This image exceeds 5MB and is being compressed…',
    imagePreparingWhite: 'Isolating the subject and creating a pure-white 3D input…',
    imagePrepared: 'The white-background input is ready. Confirm the complete subject and base.',
    imagePreparationFailed: 'White-background preparation failed. Retry or use an image with a simpler background.',
    imageOriginal: 'Original',
    imagePreparedView: 'White 3D input',
    imagePaintView: 'Paint preview',
    imageRetryPreparation: 'Retry background cleanup',
    imagePaintPreviewTitle: 'Monochrome paint preview',
    imagePaintPreviewHint: 'Paint is for preview and production instructions only. It is never embedded in the white STL.',
    generatePaintPreview: 'Generate paint preview',
    generatingPaintPreview: 'Generating paint preview…',
    paintPreviewReady: 'The paint preview is ready. Switch the image view on the left.',
    imageCompressed: 'The image was compressed.',
    imageCompressionFailed: 'Image compression failed. Choose a JPG, PNG, or WebP image smaller than 5MB.',
    imageTooLarge: 'This image still exceeds 5MB and cannot be submitted.',
    imageModelRule: 'The subject shape becomes a printable white model. Image colors are not embedded in the model.',
    generateWhiteModel: 'Generate white 3D model',
    generatingWhiteModel: 'Generating white model…',
    whiteModelReady: 'White 3D model generated',
    whiteModelReadyHint: 'Review the model, confirm dimensions, and submit a print request.',
    customerBrief: 'Describe the gift idea',
    customerBriefPlaceholder: 'Example: a desk sculpture for an EV customer’s 10-year partnership, expressing speed, green energy, and long-term collaboration without fragile overhangs.',
    profileTags: 'Customer profile (multi-select)',
    profileAutoHint: 'Selections automatically create the gift brief, which remains fully editable.',
    renderFinish: 'Choose preview finish',
    paint: 'Monochrome paint',
    paintHint: 'For brand colors, modern styling, and technology gifts',
    paintColor: 'Choose paint color',
    paintColorHint: 'The entire gift uses the selected solid color, with natural light and shadow only.',
    customPaintColor: 'Custom color',
    paintColorRule: 'The monochrome render uses no gradients, accent colors, or secondary material colors.',
    bronze: 'Antique bronze',
    bronzeHint: 'For commemorative, cultural, and premium desk pieces',
    processRule: 'Finish selection affects the render and post-processing brief only. The production 3D model always remains a white base.',
    generateRender: 'Generate gift renders',
    generatingRender: 'Generating gift concepts…',
    renderReady: 'Choose your preferred gift concept',
    renderReadyHint: 'Approve the form and finish before generating its white 3D model.',
    selectConcept: 'Choose concept',
    selected: 'Selected',
    editTitle: 'Continue editing the generated image',
    editDescription: 'Describe the next change after selecting a concept. Upload an optional same-size transparent mask for local edits. Each edit keeps the previous version.',
    editPrompt: 'Edit instructions',
    editPlaceholder: 'For example: keep the overall form, make the base more stable, reduce thin top structures, and use a subtler antique bronze finish.',
    optionalMask: 'Local edit mask (optional)',
    maskHint: 'PNG with the same dimensions and an alpha channel',
    chooseMask: 'Choose mask',
    editImage: 'Generate edited version',
    editingImage: 'Editing image…',
    editedVersion: 'A new edited version was generated and selected',
    generateFromRender: 'Generate white 3D model from selected concept',
    modelQueued: 'White model job submitted and generating…',
    modelProgressPreparing: 'Compressing and validating the model input',
    modelProgressUploading: 'Uploading the model input and creating the task',
    modelProgressQueued: 'Task submitted and waiting for Tripo',
    modelProgressGenerating: 'Tripo is generating the 1.5M-face high-detail model',
    modelProgressConverting: 'Model generated; converting and validating STL on the server',
    downloadModel: 'Download STL model',
    aiConfigError: 'AI service credentials are not configured. Contact the administrator.',
    aiApprovalError: 'Your AI access is awaiting approval or has been suspended.',
    aiQuotaError: 'Your quota is exhausted or another generation job is already running.',
    aiRequestError: 'The AI service is temporarily unavailable. Try again later.',
    orders: 'My requests',
    newRequest: 'Already have a model? Submit an exhibition or business sample request',
    newRequestButton: 'Submit another print request',
    modelPreview: 'White model preview',
    openModelPreview: 'Open and inspect the 3D model',
    submitPrint: 'Submit print request',
  },
} as const;

function LoginGate({
  t,
  language,
  onLogin,
  onDevLogin,
  showDevLogin,
  loginPending,
  errorCode,
}: {
  t: GiftCopy;
  language: GiftLanguage;
  onLogin: () => void;
  onDevLogin: () => void;
  showDevLogin: boolean;
  loginPending: boolean;
  errorCode: string | null;
}) {
  const errorMessage = errorCode === 'configuration'
    ? t.authConfigError
    : errorCode === 'not_employee'
      ? t.authNotEmployee
      : errorCode === 'invalid_state'
        ? t.authStateError
        : errorCode
          ? t.authLoginError
          : null;

  return (
    <section className="mx-auto max-w-[1120px] px-5 py-10 md:py-14">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0b4f9c,#0891b2)] p-7 text-white md:p-10">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[24px] border-white/10" />
            <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full border-[20px] border-white/10" />
            <div className="relative max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-xs font-black">
                <Gift className="h-4 w-4" />
                {t.pageTitle}
              </div>
              <h1 className="mt-7 text-4xl font-black leading-tight md:text-5xl">{t.pageTitle}</h1>
              <p className="mt-4 max-w-lg text-lg font-bold leading-8 text-cyan-50">{t.pageSubtitle}</p>
              <div className="mt-10 grid gap-3 text-sm font-bold text-cyan-50 md:grid-cols-3 lg:grid-cols-1">
                <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 shrink-0" />{t.secureTitle}</div>
                <div className="flex items-center gap-3"><Box className="h-5 w-5 shrink-0" />{t.libraryTitle}</div>
                <div className="flex items-center gap-3"><WandSparkles className="h-5 w-5 shrink-0" />{t.generateTitle}</div>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-md bg-cyan-50 text-[#0b4f9c]"><QrCode className="h-6 w-6" /></div>
              <div>
                <h2 className="text-xl font-black text-slate-950">{t.loginTitle}</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">{t.loginHint}</p>
              </div>
            </div>
            <p className="mt-6 text-sm font-medium leading-6 text-slate-500">{t.loginDescription}</p>

            {errorMessage ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-5 text-red-700">{errorMessage}</div> : null}
            {showDevLogin ? (
              <div className="mt-4 rounded-lg border border-cyan-200 bg-cyan-50 p-3">
                <p className="text-xs font-medium leading-5 text-cyan-900">{t.localHint}</p>
                <button
                  type="button"
                  onClick={onDevLogin}
                  disabled={loginPending}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-[#0b4f9c] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#083f7e] disabled:cursor-wait disabled:opacity-70"
                  data-umami-event="gift_local_login_click"
                >
                  {loginPending ? t.authLoading : t.localLogin}
                </button>
              </div>
            ) : null}
            <WeComQrLogin
              language={language}
              loginPending={loginPending}
              onOpenOfficial={onLogin}
              labels={{
                loading: t.qrLoading,
                failed: t.qrFailed,
                failedHint: t.qrFailedHint,
                retry: t.qrRetry,
                scanHint: t.qrScanHint,
                secureHint: t.qrSecureHint,
                openOfficial: loginPending ? t.loginStarting : t.qrOpenOfficial,
                mobileTitle: t.mobileLoginTitle,
                mobileHint: t.mobileLoginHint,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function GiftModelVisual({ model, onPreview }: { model: GiftModel; onPreview?: () => void }) {
  const previewSources = model.previewUrls?.length
    ? model.previewUrls
    : model.previewAssetId ? [`/api/gift/assets/${model.previewAssetId}`] : [];
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    setPreviewIndex(0);
    if (previewSources.length < 2) return;
    const interval = window.setInterval(() => setPreviewIndex((current) => (current + 1) % previewSources.length), 4500);
    return () => window.clearInterval(interval);
  }, [model.id, previewSources.length]);

  if (previewSources.length > 0) {
    const movePreview = (direction: number) => setPreviewIndex((current) => (current + direction + previewSources.length) % previewSources.length);
    return (
      <div className="relative grid h-52 place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#ffffff_0%,#f0f7fa_60%,#dce9ef_100%)] p-3">
        <button type="button" onClick={onPreview} disabled={!onPreview} aria-label={`${model.name} 3D 模型预览`} className="group/preview absolute inset-0 grid place-items-center p-3 disabled:cursor-default">
          {previewSources.map((source, index) => <img key={source} src={source} alt={`${model.name} ${index + 1}`} className={`absolute inset-3 h-[calc(100%-1.5rem)] w-[calc(100%-1.5rem)] object-contain drop-shadow-[0_18px_20px_rgba(15,23,42,0.2)] transition duration-500 ${index === previewIndex ? 'scale-100 opacity-100' : 'pointer-events-none scale-[0.97] opacity-0'}`} />)}
          {onPreview ? <span className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-slate-950/65 text-white opacity-0 shadow-sm backdrop-blur transition group-hover/preview:opacity-100 group-focus-visible/preview:opacity-100"><Maximize2 className="h-4 w-4" /></span> : null}
        </button>
        <span className="absolute left-4 top-4 rounded-md border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-black text-[#0b4f9c] shadow-sm">{model.categoryLabel}</span>
        {previewSources.length > 1 ? <>
          <button type="button" onClick={(event) => { event.stopPropagation(); movePreview(-1); }} aria-label="上一张礼品图片" className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 focus:opacity-100"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={(event) => { event.stopPropagation(); movePreview(1); }} aria-label="下一张礼品图片" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100 focus:opacity-100"><ChevronRight className="h-4 w-4" /></button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">{previewSources.map((source, index) => <button key={source} type="button" onClick={(event) => { event.stopPropagation(); setPreviewIndex(index); }} aria-label={`切换到第 ${index + 1} 张礼品图片`} className={`h-1.5 rounded-full shadow-sm transition-all ${index === previewIndex ? 'w-5 bg-[#0b4f9c]' : 'w-1.5 bg-slate-400/70 hover:bg-slate-600'}`} />)}</div>
        </> : null}
      </div>
    );
  }
  const Icon = model.category === 'business'
    ? Building2
    : model.category === 'culture'
      ? Landmark
      : model.category === 'technology'
        ? model.id === 'turbine' ? Car : Cpu
        : CircleUserRound;

  return (
    <div className={`relative h-52 overflow-hidden bg-gradient-to-br ${model.color} p-5 text-white`}>
      <div className="absolute -right-12 -top-14 h-44 w-44 rounded-full border-[20px] border-white/10" />
      <div className="absolute -bottom-24 left-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <span className="rounded-md border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-black tracking-wide backdrop-blur">{model.categoryLabel}</span>
        <span className="text-[10px] font-bold text-white/70">UnionTech 3D Print</span>
      </div>
      <div className="absolute inset-x-0 bottom-6 flex items-end justify-center">
        <div className="relative grid h-28 w-36 place-items-center rounded-[50%_50%_42%_42%] border border-white/25 bg-white/15 shadow-[0_20px_45px_rgba(2,23,52,0.28)] backdrop-blur-sm">
          <div className="absolute inset-x-5 bottom-2 h-3 rounded-full bg-slate-950/20 blur-sm" />
          <Icon className="relative h-14 w-14 text-white/90" strokeWidth={1.45} />
          <div className="absolute -right-6 -top-5 text-2xl font-black tracking-tight text-white/45">{model.accent}</div>
        </div>
      </div>
    </div>
  );
}

function ModelCard({
  model,
  t,
  labels,
  onOrder,
  onPreview,
}: {
  model: GiftModel;
  t: GiftCopy;
  labels: (typeof studioCopy)[GiftLanguage];
  onOrder: (model: GiftModel) => void;
  onPreview: (model: GiftModel) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-cyan-300 hover:shadow-lg">
      <GiftModelVisual model={model} onPreview={model.modelUrl ? () => onPreview(model) : undefined} />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-black text-slate-950">{model.name}</h3>
          <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">{labels.available}</span>
        </div>
        <p className="mt-2 min-h-[72px] text-sm font-medium leading-6 text-slate-500">{model.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-slate-600"><Tag className="h-3.5 w-3.5" />{model.useCase}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 ${model.finish === 'bronze' ? 'bg-amber-50 text-amber-800' : 'bg-cyan-50 text-cyan-800'}`}><Palette className="h-3.5 w-3.5" />{model.finishLabel}</span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4 text-cyan-600" />{t.printTime}</span>
          <button type="button" onClick={() => onOrder(model)} className="inline-flex items-center gap-1 rounded-md bg-[#0b4f9c] px-3 py-2 font-black text-white transition hover:bg-[#083f7e]" data-umami-event="gift_existing_model_order_click">
            {t.viewDetails}<ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function OrderModal({ model, t, onClose, onSubmitted }: { model: GiftModel; t: GiftCopy; onClose: () => void; onSubmitted: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [customerCompany, setCustomerCompany] = useState('');
  const [deadline, setDeadline] = useState('');
  const [finishType, setFinishType] = useState<'white' | 'paint' | 'bronze'>(model.finish === 'bronze' ? 'bronze' : 'paint');
  const [paintColor, setPaintColor] = useState('#0B77B7');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requestNo, setRequestNo] = useState('');

  async function submit() {
    setSaving(true); setError('');
    try {
      const requestType = typeof model.id === 'number' ? 'catalog_gift' : 'ai_gift';
      const requestPayload = {
        requestType, modelId: typeof model.id === 'number' ? model.id : null, title: model.name,
        customerCompany, businessScene: model.useCase, quantity, finishType,
        paintColor: finishType === 'paint' ? paintColor : null, requestedCompletionDate: deadline || null,
        pickupLocation: t.pickupValue, requestNotes: notes,
        specifications: { source: requestType, generatedModelAssetId: model.generatedModelAssetId || null, sourceModelUrl: model.modelUrl || model.generatedModelUrl || null },
      };
      const response = await fetch(model.draftRequestId ? `/api/gift/requests/${model.draftRequestId}` : '/api/gift/requests', {
        method: model.draftRequestId ? 'PATCH' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(model.draftRequestId ? { action: 'submit', ...requestPayload } : requestPayload),
      });
      const result = await response.json() as { id?: number; requestNo?: string; message?: string };
      if (!response.ok || !result.id) throw new Error(result.message || '申请提交失败');
      if (model.generatedModelUrl && !model.generatedModelAssetId && !model.draftRequestId) {
        const modelResponse = await fetch(model.generatedModelUrl);
        if (!modelResponse.ok) throw new Error('申请已创建，但生成模型附件读取失败，请在“我的申请”中补充上传。');
        const formData = new FormData();
        formData.set('file', new File([await modelResponse.blob()], `${String(model.id)}.glb`, { type: 'model/gltf-binary' }));
        formData.set('role', 'source_model');
        const uploadResponse = await fetch(`/api/gift/requests/${result.id}/attachments`, { method: 'POST', credentials: 'same-origin', body: formData });
        if (!uploadResponse.ok) throw new Error('申请已创建，但模型附件上传失败，请在“我的申请”中补充上传。');
      }
      setRequestNo(result.requestNo || ''); setSubmitted(true); onSubmitted();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '申请提交失败');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/45 p-5" role="dialog" aria-modal="true" aria-label={t.orderModalTitle}>
      <div className="max-h-[calc(100vh-40px)] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">UnionAM Gifts</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{t.orderModalTitle}</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-500">{model.name}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={t.cancel}><X className="h-5 w-5" /></button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-7 w-7" /></div>
            <h3 className="mt-5 text-xl font-black text-slate-950">{t.orderSuccess}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500">{t.orderSuccessHint}{requestNo ? `（${requestNo}）` : ''}</p>
            <button type="button" onClick={onClose} className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#0b4f9c] px-5 text-sm font-black text-white">{t.cancel}</button>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <p className="rounded-md border border-cyan-100 bg-cyan-50 px-4 py-3 text-xs font-bold leading-5 text-cyan-900">{t.orderModalHint}</p>
            <label className="block text-sm font-black text-slate-700">{t.quantity}<input type="number" min="1" max="10000" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>
            <label className="block text-sm font-black text-slate-700">客户或业务项目<input value={customerCompany} onChange={(event) => setCustomerCompany(event.target.value)} maxLength={255} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-medium outline-none focus:border-cyan-500" placeholder="选填，便于运营人员识别用途" /></label>
            <div className="grid gap-3 sm:grid-cols-2"><label className="block text-sm font-black text-slate-700">成品工艺<select value={finishType} onChange={(event) => setFinishType(event.target.value as 'white' | 'paint' | 'bronze')} className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="white">白膜</option>{model.finish !== 'bronze' ? <option value="paint">单色喷漆</option> : null}{model.finish !== 'paint' ? <option value="bronze">铜做旧</option> : null}</select></label>{finishType === 'paint' ? <label className="block text-sm font-black text-slate-700">喷漆颜色<div className="mt-2 flex h-11 items-center gap-3 rounded-md border border-slate-200 px-3"><input type="color" value={paintColor} onChange={(event) => setPaintColor(event.target.value.toUpperCase())} /><span className="font-mono text-xs">{paintColor}</span></div></label> : <label className="block text-sm font-black text-slate-700">期望完成日期<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>}</div>
            {finishType === 'paint' ? <label className="block text-sm font-black text-slate-700">期望完成日期<input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" /></label> : null}
            <div className="rounded-md border border-slate-200 px-4 py-3"><div className="text-xs font-black text-slate-500">{t.pickup}</div><div className="mt-1 text-sm font-bold text-slate-900">{t.pickupValue}</div></div>
            <label className="block text-sm font-black text-slate-700">{t.note}<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={5000} placeholder={t.notePlaceholder} className="mt-2 w-full resize-none rounded-md border border-slate-200 px-3 py-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>
            {error ? <p className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
            <button type="button" disabled={saving || quantity < 1} onClick={() => void submit()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0b4f9c] text-sm font-black text-white shadow-sm transition hover:bg-[#083f7e] disabled:opacity-50" data-umami-event="gift_order_submit_click">{saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}{t.submitOrder}</button>
          </div>
        )}
      </div>
    </div>
  );
}

type AiCreationMode = 'image' | 'brief';
type FinishMode = 'paint' | 'bronze';
type ImageModelStatus = 'idle' | 'generating' | 'ready';
type ImageInputView = 'original' | 'prepared' | 'paint';
type BriefStatus = 'idle' | 'generating-render' | 'render-ready' | 'generating-model' | 'model-ready';
type ModelGenerationProgress = { percent: number; stage: string };

const paintColorPresets = [
  { hex: '#0B77B7', zh: '联泰蓝', en: 'UnionTech blue' },
  { hex: '#0B4F9C', zh: '深海蓝', en: 'Deep blue' },
  { hex: '#0891B2', zh: '科技青', en: 'Tech cyan' },
  { hex: '#C62828', zh: '经典红', en: 'Classic red' },
  { hex: '#EA580C', zh: '活力橙', en: 'Vibrant orange' },
  { hex: '#15803D', zh: '森林绿', en: 'Forest green' },
  { hex: '#E7E5E4', zh: '象牙白', en: 'Ivory' },
  { hex: '#334155', zh: '碳灰色', en: 'Charcoal' },
] as const;

type ProfileGroupId = 'industry' | 'tone' | 'occasion' | 'recipient' | 'constraint';
type ProfileSelections = Record<ProfileGroupId, string[]>;

const emptyProfileSelections: ProfileSelections = {
  industry: [],
  tone: [],
  occasion: [],
  recipient: [],
  constraint: [],
};

const profileGroups: { id: ProfileGroupId; zh: string; en: string; options: { id: string; zh: string; en: string }[] }[] = [
  {
    id: 'industry', zh: '客户所属行业', en: 'Customer industry', options: [
      { id: 'automotive', zh: '汽车', en: 'Automotive' }, { id: 'aerospace', zh: '航空航天', en: 'Aerospace' },
      { id: 'medical', zh: '医疗', en: 'Medical' }, { id: 'electronics', zh: '消费电子', en: 'Consumer electronics' },
      { id: 'education', zh: '教育科研', en: 'Education and research' }, { id: 'culture-tourism', zh: '文化文旅', en: 'Culture and tourism' },
      { id: 'finance', zh: '金融', en: 'Finance' }, { id: 'internet', zh: '互联网科技', en: 'Internet technology' },
      { id: 'manufacturing', zh: '制造工业', en: 'Industrial manufacturing' }, { id: 'real-estate', zh: '建筑地产', en: 'Architecture and real estate' },
      { id: 'retail', zh: '零售快消', en: 'Retail and FMCG' }, { id: 'government', zh: '政府事业单位', en: 'Government and public institutions' },
    ],
  },
  {
    id: 'tone', zh: '礼品风格调性', en: 'Gift style and tone', options: [
      { id: 'technology', zh: '科技感', en: 'Technological' }, { id: 'professional', zh: '稳重商务', en: 'Professional' },
      { id: 'youthful', zh: '年轻活力', en: 'Youthful' }, { id: 'premium', zh: '高端典雅', en: 'Premium and elegant' },
      { id: 'chinese-culture', zh: '中国文化', en: 'Chinese culture' }, { id: 'futuristic', zh: '未来感', en: 'Futuristic' },
      { id: 'minimal-modern', zh: '极简现代', en: 'Minimal and modern' }, { id: 'guochao', zh: '国潮国风', en: 'Modern Chinese style' },
      { id: 'light-luxury', zh: '轻奢质感', en: 'Light luxury' }, { id: 'natural', zh: '自然简约', en: 'Natural and simple' },
    ],
  },
  {
    id: 'occasion', zh: '赠礼业务场景', en: 'Gifting occasion', options: [
      { id: 'first-visit', zh: '首次拜访', en: 'First visit' }, { id: 'signing', zh: '签约纪念', en: 'Contract signing' },
      { id: 'anniversary', zh: '周年庆', en: 'Anniversary' }, { id: 'exhibition', zh: '展会活动', en: 'Exhibition' },
      { id: 'festival', zh: '节日礼赠', en: 'Festival gift' }, { id: 'key-account', zh: '重要客户', en: 'Key account' },
      { id: 'appreciation', zh: '客户答谢', en: 'Customer appreciation' }, { id: 'project-completion', zh: '项目竣工', en: 'Project completion' },
      { id: 'annual-meeting', zh: '年会纪念', en: 'Annual meeting' }, { id: 'product-launch', zh: '新品发布', en: 'Product launch' },
    ],
  },
  {
    id: 'recipient', zh: '收礼人画像', en: 'Recipient profile', options: [
      { id: 'executive', zh: '高层管理者', en: 'Senior executive' }, { id: 'middle-manager', zh: '中层管理者', en: 'Middle manager' },
      { id: 'employee', zh: '基层员工', en: 'Employee' }, { id: 'neutral', zh: '通用中性', en: 'Gender-neutral' },
      { id: 'male', zh: '男性偏好', en: 'Masculine preference' }, { id: 'female', zh: '女性偏好', en: 'Feminine preference' },
    ],
  },
  {
    id: 'constraint', zh: '礼品物理约束', en: 'Physical constraints', options: [
      { id: 'desk-object', zh: '桌面摆件', en: 'Desk ornament' }, { id: 'award', zh: '奖牌纪念', en: 'Commemorative award' },
      { id: 'logo-sculpture', zh: '立体 Logo 雕塑', en: '3D logo sculpture' }, { id: 'art-installation', zh: '小型艺术装置', en: 'Small art object' },
      { id: 'metal-look', zh: '金属质感', en: 'Metallic appearance' }, { id: 'matte-resin', zh: '哑光树脂', en: 'Matte resin' },
      { id: 'frosted', zh: '磨砂', en: 'Frosted finish' }, { id: 'glossy', zh: '亮光', en: 'Glossy finish' },
      { id: 'no-hollow', zh: '避免镂空', en: 'Avoid hollow structures' }, { id: 'no-overhang', zh: '避免悬空结构', en: 'Avoid unsupported overhangs' },
      { id: 'one-piece', zh: '一体成型', en: 'Single-piece construction' },
    ],
  },
];

function profileLabels(language: GiftLanguage, selections: ProfileSelections, groupId?: ProfileGroupId) {
  return profileGroups
    .filter((group) => !groupId || group.id === groupId)
    .flatMap((group) => group.options.filter((option) => selections[group.id].includes(option.id)).map((option) => option[language]));
}

function buildGiftBrief(language: GiftLanguage, selections: ProfileSelections) {
  const industries = profileLabels(language, selections, 'industry');
  const tones = profileLabels(language, selections, 'tone');
  const occasions = profileLabels(language, selections, 'occasion');
  const recipients = profileLabels(language, selections, 'recipient');
  const constraints = profileLabels(language, selections, 'constraint');
  if (![industries, tones, occasions, recipients, constraints].some((items) => items.length)) return '';
  if (language === 'zh') {
    return `为${industries.length ? industries.join('、') : '目标行业'}客户设计一件用于${occasions.length ? occasions.join('、') : '商务礼赠'}的专属 3D 打印礼品，主要面向${recipients.length ? recipients.join('、') : '通用商务人群'}。整体风格体现${tones.length ? tones.join('、') : '简洁、专业与高级感'}，结合客户行业特征与增材制造语言，形成独一无二、具有纪念意义的礼品造型。${constraints.length ? `物理形态与制作要求：${constraints.join('、')}。` : '造型需结构完整、底座稳定，适合树脂 3D 打印和后续表面处理。'}`;
  }
  return `Design a customer-specific 3D printed gift for ${industries.length ? industries.join(', ') : 'the target industry'}, intended for ${occasions.length ? occasions.join(', ') : 'business gifting'} and primarily suited to ${recipients.length ? recipients.join(', ') : 'a general business audience'}. The design should feel ${tones.length ? tones.join(', ') : 'clean, professional, and premium'}, combining recognizable industry characteristics with an additive-manufacturing design language to create a distinctive commemorative object. ${constraints.length ? `Physical form and production requirements: ${constraints.join(', ')}.` : 'Use a complete form, stable base, and geometry suitable for resin 3D printing and post-processing.'}`;
}

function ProfileDropdown({ group, language, selected, open, onToggleOpen, onToggleOption }: {
  group: (typeof profileGroups)[number];
  language: GiftLanguage;
  selected: string[];
  open: boolean;
  onToggleOpen: () => void;
  onToggleOption: (optionId: string) => void;
}) {
  const selectedLabels = group.options.filter((option) => selected.includes(option.id)).map((option) => option[language]);
  const summary = selectedLabels.length
    ? `${selectedLabels.slice(0, 2).join(language === 'zh' ? '、' : ', ')}${selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ''}`
    : language === 'zh' ? '请选择，可多选' : 'Select multiple';
  return (
    <div className={`relative ${open ? 'z-20' : ''}`}>
      <button type="button" onClick={onToggleOpen} aria-expanded={open} className={`flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-left transition ${open || selected.length ? 'border-cyan-400 shadow-sm' : 'border-slate-200 hover:border-cyan-300'}`}>
        <span className="min-w-0"><span className="block text-xs font-black text-slate-800">{group[language]}</span><span className={`mt-1 block truncate text-[11px] font-bold ${selected.length ? 'text-[#0b4f9c]' : 'text-slate-400'}`}>{summary}</span></span>
        <span className="flex shrink-0 items-center gap-1.5">{selected.length ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#0b4f9c] px-1 text-[10px] font-black text-white">{selected.length}</span> : null}<ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      {open ? <div className="absolute left-0 top-[calc(100%+0.4rem)] w-full min-w-[300px] rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,0.16)]"><div className="max-h-64 overflow-y-auto pr-1"><div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{group.options.map((option) => { const active = selected.includes(option.id); return <button key={option.id} type="button" onClick={() => onToggleOption(option.id)} className={`flex min-h-9 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-bold transition ${active ? 'border-cyan-300 bg-cyan-50 text-[#0b4f9c]' : 'border-transparent bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white'}`}><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${active ? 'border-[#0b4f9c] bg-[#0b4f9c] text-white' : 'border-slate-300 bg-white text-transparent'}`}><Check className="h-3 w-3" strokeWidth={3} /></span><span>{option[language]}</span></button>; })}</div></div></div> : null}
    </div>
  );
}

function WhiteModelResult({ labels, onOrder, model, onPreview }: { labels: (typeof studioCopy)[GiftLanguage]; onOrder: () => void; model?: GeneratedGiftModel; onPreview: () => void }) {
  return (
    <div className="mt-6 grid gap-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <button type="button" onClick={onPreview} disabled={!model} className="group relative grid min-h-44 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-[radial-gradient(circle_at_50%_30%,#ffffff_0%,#f8fafc_38%,#dbe4ee_100%)] text-left transition hover:border-cyan-400 hover:shadow-md disabled:cursor-default">
        {model?.previewImageUrl ? <img src={model.previewImageUrl} alt={labels.modelPreview} className="absolute inset-0 h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]" /> : <><div className="absolute bottom-7 h-6 w-32 rounded-full bg-slate-400/25 blur-md" /><div className="relative grid h-28 w-28 place-items-center rounded-[42%_58%_46%_54%] border border-white bg-white shadow-[0_20px_45px_rgba(71,85,105,0.2)]"><Layers3 className="h-14 w-14 text-slate-300" strokeWidth={1.3} /></div></>}
        <span className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-slate-500">{labels.modelPreview}</span>
        {model ? <span className="absolute bottom-3 left-3 right-3 inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-950/70 px-3 py-2 text-[11px] font-black text-white opacity-0 backdrop-blur transition group-hover:opacity-100 group-focus-visible:opacity-100"><Maximize2 className="h-3.5 w-3.5" />{labels.openModelPreview}</span> : null}
      </button>
      <div className="self-center">
        <div className="flex items-center gap-2 text-emerald-800"><CheckCircle2 className="h-5 w-5" /><h3 className="text-base font-black">{labels.whiteModelReady}</h3></div>
        <p className="mt-2 text-sm font-medium leading-6 text-emerald-900/70">{labels.whiteModelReadyHint}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">White base</span>
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">Printable geometry</span>
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5">STL / GLB</span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {model ? <a href={model.modelUrl} download={`unionam-gift.${model.modelType}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-white px-5 text-sm font-black text-[#0b4f9c] transition hover:bg-cyan-50" data-umami-event="gift_ai_model_download_click"><Layers3 className="h-4 w-4" />{labels.downloadModel}</a> : null}
          <button type="button" onClick={onOrder} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-5 text-sm font-black text-white transition hover:bg-[#083f7e]" data-umami-event="gift_ai_model_order_click"><PackageCheck className="h-4 w-4" />{labels.submitPrint}</button>
        </div>
      </div>
    </div>
  );
}

function ModelGenerationProgressBar({ progress }: { progress: ModelGenerationProgress }) {
  return <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 shadow-sm" role="status" aria-live="polite">
    <div className="flex items-center justify-between gap-4 text-xs font-black text-[#0b4f9c]"><span className="flex min-w-0 items-center gap-2"><LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /><span className="truncate">{progress.stage}</span></span><span className="shrink-0 font-mono text-sm">{progress.percent}%</span></div>
    <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-gradient-to-r from-[#0b4f9c] to-cyan-500 transition-[width] duration-500 ease-out" style={{ width: `${progress.percent}%` }} /></div>
  </div>;
}

function RenderConcept({ finish, index, source, selected, onSelect, labels }: { finish: FinishMode; index: number; source?: string; selected: boolean; onSelect: () => void; labels: (typeof studioCopy)[GiftLanguage] }) {
  const bronze = finish === 'bronze';
  return (
    <button type="button" onClick={onSelect} className={`overflow-hidden rounded-xl border bg-white p-3 text-left transition ${selected ? 'border-[#0b4f9c] ring-2 ring-blue-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md'}`} data-umami-event="gift_ai_render_select_click">
      <div className={`relative grid aspect-[4/3] place-items-center overflow-hidden rounded-lg ${source ? 'bg-slate-50' : bronze ? 'bg-[radial-gradient(circle_at_40%_25%,#f4d29e_0%,#9a5a27_46%,#3f2519_100%)]' : 'bg-[radial-gradient(circle_at_40%_25%,#dff8ff_0%,#3f9fd1_48%,#073763_100%)]'}`}>
        {source ? <img src={source} alt={`${labels.selectConcept} ${index + 1}`} className="absolute inset-0 h-full w-full object-contain" /> : null}
        {!source ? <><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border-[12px] border-white/10" /><div className="absolute bottom-5 h-5 w-28 rounded-full bg-slate-950/25 blur-md" /></> : null}
        {!source ? <div className={`relative grid place-items-center border shadow-2xl ${index === 0 ? 'h-24 w-28 rounded-[44%_56%_38%_62%]' : index === 1 ? 'h-28 w-24 rounded-[58%_42%_52%_48%]' : 'h-24 w-32 rounded-[35%_65%_54%_46%]'} ${bronze ? 'border-amber-200/50 bg-gradient-to-br from-[#e2b978] via-[#9a5a27] to-[#54331f] text-amber-100' : 'border-white/40 bg-gradient-to-br from-white via-[#3bc2e8] to-[#0b4f9c] text-white'}`}>
          {index === 0 ? <Sparkles className="h-10 w-10" /> : index === 1 ? <Building2 className="h-10 w-10" /> : <Boxes className="h-10 w-10" />}
        </div> : null}
        <span className="absolute left-3 top-3 rounded bg-slate-950/25 px-2 py-1 text-[10px] font-black text-white backdrop-blur">0{index + 1}</span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-black text-slate-800">{selected ? labels.selected : labels.selectConcept}</span>
        <span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? 'border-[#0b4f9c] bg-[#0b4f9c] text-white' : 'border-slate-300 text-transparent'}`}><Check className="h-3.5 w-3.5" /></span>
      </div>
    </button>
  );
}

type GiftImageResult = { assetId?: number; dataUrl?: string; url?: string };
type GiftAiClientError = { configuration: boolean; reason?: string; message?: string };

const MODEL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const MODEL_IMAGE_TARGET_BYTES = Math.floor(4.5 * 1024 * 1024);

function canvasBlob(canvas: HTMLCanvasElement, type: 'image/webp' | 'image/jpeg', quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function compressModelImage(file: File) {
  if (file.size <= MODEL_IMAGE_MAX_BYTES && ['image/jpeg', 'image/png'].includes(file.type)) return { file, compressed: false };

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  const maxEdges = [2048, 1600, 1280, 1024, 768];
  const qualities = [0.9, 0.82, 0.74, 0.66, 0.58];
  let smallest: Blob | null = null;

  try {
    for (const maxEdge of maxEdges) {
      const scale = Math.min(1, maxEdge / longestEdge);
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable.');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await canvasBlob(canvas, 'image/jpeg', quality);
        if (!blob) continue;
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= MODEL_IMAGE_TARGET_BYTES) {
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'gift-reference';
          return { file: new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }), compressed: true };
        }
      }
    }
  } finally {
    bitmap.close();
  }

  if (smallest && smallest.size <= MODEL_IMAGE_MAX_BYTES) {
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'gift-reference';
    return { file: new File([smallest], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }), compressed: true };
  }
  throw new Error('Image compression could not reach the upload limit.');
}

function giftImageSource(image: GiftImageResult | undefined) {
  return image?.dataUrl || image?.url || '';
}

async function imageSourceToFile(source: string, name: string) {
  const response = await fetch(source);
  if (!response.ok) throw new Error('Unable to read generated image.');
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'image/png' });
}

async function apiErrorMessage(response: Response) {
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
  return { configuration: payload.error === 'configuration', reason: payload.error, message: payload.message } satisfies GiftAiClientError;
}

function editClientErrorMessage(error: unknown, language: GiftLanguage) {
  const message = typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
    ? error.message
    : '';
  if (message === 'fetch failed' || message.toLowerCase().includes('timed out') || message.toLowerCase().includes('timeout')) {
    return language === 'zh' ? '图片编辑服务连接超时，本次未生成新图片，请稍后重试。' : 'The image editing service timed out. No new image was created; please try again.';
  }
  return message || (language === 'zh' ? '图片编辑失败，本次未生成新图片，请稍后重试。' : 'Image editing failed. No new image was created; please try again.');
}

function renderPrompt(language: GiftLanguage, brief: string, tags: string[], finish: FinishMode, paintColor: string) {
  const finishText = finish === 'paint'
    ? `single-color matte spray paint finish in exactly ${paintColor}. The entire object must use this one uniform solid paint color; no gradients, no color blocking, no accent colors, no metallic parts, and no secondary material colors. Natural lighting and shadows may change brightness only`
    : 'restrained antique bronze finish, subtle patina, premium commemorative appearance';
  const request = brief.trim() || (language === 'zh' ? '根据客户画像设计一件商务礼品' : 'Design a business gift from the customer profile');
  return `${request}\nCustomer profile: ${tags.join(', ') || 'professional business customer'}\nCreate one complete, premium, 3D-printable desk gift as a product render. ${finishText}. Plain white or light-gray background. One centered object occupying more than 70% of the image. Stable base, closed solid form, clear silhouette, manufacturable thickness, no thin floating structures, no packaging, no hands, no text, no logo, no watermark. Three-quarter front view. The shape must be suitable for image-to-3D generation and resin 3D printing.`;
}

function whiteBackgroundPrompt() {
  return 'Remove the entire background, background text, watermark-like marks, props, and unrelated elements. Preserve the exact subject geometry, pose, silhouette, proportions, camera angle, and complete supporting base. Keep every part that physically belongs to the sculpture or gift. Center the complete isolated subject on a pure white #FFFFFF background. Use clean, sharp edges and a subtle natural contact shadow only. Do not add, remove, redesign, crop, or recolor any part of the subject.';
}

function monochromePaintPrompt(paintColor: string) {
  return `Re-render the complete isolated subject in exactly one uniform matte spray paint color ${paintColor}. Preserve the exact geometry, pose, silhouette, proportions, camera angle, complete supporting base, and framing. Remove original surface colors, patterns, text, and material variation while preserving only natural light and form-defining shadows. No gradients, color blocking, accent colors, metallic parts, or secondary materials. Keep the pure white #FFFFFF background. Do not add, remove, crop, or redesign any geometry.`;
}

function AiGiftStudio({ language, onOrder, onDraftUpdated, resumeDraft, onResumeConsumed }: { language: GiftLanguage; onOrder: (model: GiftModel) => void; onDraftUpdated: () => void; resumeDraft?: GiftDraftResume | null; onResumeConsumed?: () => void }) {
  const labels = studioCopy[language];
  const [mode, setMode] = useState<AiCreationMode>('image');
  const [imageOriginalFile, setImageOriginalFile] = useState<File | null>(null);
  const [imageOriginalUrl, setImageOriginalUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDraftRequestId, setImageDraftRequestId] = useState<number | null>(null);
  const [imagePreparedAssetId, setImagePreparedAssetId] = useState<number | null>(null);
  const [imagePaintAssetId, setImagePaintAssetId] = useState<number | null>(null);
  const [imageView, setImageView] = useState<ImageInputView>('original');
  const [imagePreparationFailed, setImagePreparationFailed] = useState(false);
  const [imagePaintPreview, setImagePaintPreview] = useState<string | null>(null);
  const [imagePaintGenerating, setImagePaintGenerating] = useState(false);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [imagePreparationNotice, setImagePreparationNotice] = useState<string | null>(null);
  const imagePreparationIdRef = useRef(0);
  const imagePaintIdRef = useRef(0);
  const [imageStatus, setImageStatus] = useState<ImageModelStatus>('idle');
  const [imageModel, setImageModel] = useState<GeneratedGiftModel>();
  const [modelProgress, setModelProgress] = useState<ModelGenerationProgress | null>(null);
  const [brief, setBrief] = useState('');
  const [briefAutoGenerated, setBriefAutoGenerated] = useState(false);
  const [profileSelections, setProfileSelections] = useState<ProfileSelections>(() => ({ ...emptyProfileSelections }));
  const [openProfileGroup, setOpenProfileGroup] = useState<ProfileGroupId | null>(null);
  const profileMenusRef = useRef<HTMLDivElement>(null);
  const [finish, setFinish] = useState<FinishMode>('paint');
  const [paintColor, setPaintColor] = useState('#0B77B7');
  const [paintColorInput, setPaintColorInput] = useState('#0B77B7');
  const [paintMenuOpen, setPaintMenuOpen] = useState(false);
  const paintMenuRef = useRef<HTMLDivElement>(null);
  const [briefStatus, setBriefStatus] = useState<BriefStatus>('idle');
  const [renderImages, setRenderImages] = useState<GiftImageResult[]>([]);
  const [briefDraftRequestId, setBriefDraftRequestId] = useState<number | null>(null);
  const [selectedRender, setSelectedRender] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editMask, setEditMask] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNotice, setEditNotice] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [briefModel, setBriefModel] = useState<GeneratedGiftModel>();
  const [previewModel, setPreviewModel] = useState<GeneratedGiftModel | null>(null);
  const [aiError, setAiError] = useState<GiftAiClientError | null>(null);
  const [pendingResumeModel, setPendingResumeModel] = useState(false);
  const notifiedDraftIdsRef = useRef(new Set<number>());
  const selectedProfileTags = profileLabels(language, profileSelections);

  useEffect(() => {
    let hasNewDraft = false;
    for (const draftId of [imageDraftRequestId, briefDraftRequestId]) {
      if (draftId && !notifiedDraftIdsRef.current.has(draftId)) {
        notifiedDraftIdsRef.current.add(draftId);
        hasNewDraft = true;
      }
    }
    if (hasNewDraft) onDraftUpdated();
  }, [briefDraftRequestId, imageDraftRequestId, onDraftUpdated]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  useEffect(() => () => {
    if (imageOriginalUrl) URL.revokeObjectURL(imageOriginalUrl);
  }, [imageOriginalUrl]);

  useEffect(() => {
    if (!paintMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!paintMenuRef.current?.contains(event.target as Node)) setPaintMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPaintMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [paintMenuOpen]);

  useEffect(() => {
    if (!openProfileGroup) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profileMenusRef.current?.contains(event.target as Node)) setOpenProfileGroup(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenProfileGroup(null);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openProfileGroup]);

  useEffect(() => {
    if (briefAutoGenerated) setBrief(buildGiftBrief(language, profileSelections));
  }, [language]);

  useEffect(() => {
    if (!resumeDraft) return;
    let cancelled = false;
    const request = resumeDraft.request;
    const resumeAction = resumeDraft.action;
    const savedProfileTags = request.specifications && Array.isArray(request.specifications.profileTags)
      ? request.specifications.profileTags.filter((tag): tag is string => typeof tag === 'string')
      : [];
    const restoredProfileSelections: ProfileSelections = { ...emptyProfileSelections, industry: [], tone: [], occasion: [], recipient: [], constraint: [] };
    for (const group of profileGroups) {
      restoredProfileSelections[group.id] = group.options
        .filter((option) => savedProfileTags.includes(option.id) || savedProfileTags.includes(option.zh) || savedProfileTags.includes(option.en))
        .map((option) => option.id);
    }
    setProfileSelections(restoredProfileSelections);
    setBrief(request.requestNotes || buildGiftBrief(language, restoredProfileSelections));
    const imageAsset = [...resumeDraft.attachments].reverse().find((file) => file.contentType?.startsWith('image/') && ['render_image', 'reference_image', 'model_preview'].includes(file.assetKind));
    const modelAsset = [...resumeDraft.attachments].reverse().find((file) => file.assetKind === 'model_file');
    const modelPreviewAsset = [...resumeDraft.attachments].reverse().find((file) => file.assetKind === 'model_preview');
    const modelPreview3dAsset = [...resumeDraft.attachments].reverse().find((file) => file.assetKind === 'model_preview_3d');
    const restoredModel = modelAsset ? {
      jobId: `draft:${request.id}`,
      modelUrl: `/api/gift/assets/${modelAsset.assetId}`,
      modelType: (['stl', 'glb', 'gltf'].includes(modelAsset.extension || '') ? modelAsset.extension : 'stl') as GeneratedGiftModel['modelType'],
      fileName: modelAsset.filename,
      draftRequestId: request.id,
      modelAssetId: modelAsset.assetId,
      previewAssetId: modelPreviewAsset?.assetId,
      previewImageUrl: modelPreviewAsset ? `/api/gift/assets/${modelPreviewAsset.assetId}` : undefined,
      previewModelAssetId: modelPreview3dAsset?.assetId,
      previewModelUrl: modelPreview3dAsset ? `/api/gift/assets/${modelPreview3dAsset.assetId}` : undefined,
      previewModelType: modelPreview3dAsset ? 'glb' : undefined,
    } satisfies GeneratedGiftModel : null;

    setFinish(request.finishType === 'bronze' ? 'bronze' : 'paint');
    if (request.paintColor) { setPaintColor(request.paintColor); setPaintColorInput(request.paintColor); }
    setAiError(null);
    setModelProgress(null);
    setPendingResumeModel(false);
    if (restoredModel) {
      setBriefModel(restoredModel);
      setImageModel(restoredModel);
      setBriefStatus('model-ready');
      setImageStatus('ready');
    }

    async function restoreImage() {
      if (!imageAsset) {
        onResumeConsumed?.();
        return;
      }
      try {
        const file = await imageSourceToFile(`/api/gift/assets/${imageAsset.assetId}`, imageAsset.filename || 'gift-draft.png');
        if (cancelled) return;
        const originalUrl = URL.createObjectURL(file);
        const preparedUrl = URL.createObjectURL(file);
        setImageDraftRequestId(request.id);
        setImageOriginalFile(file);
        setImageOriginalUrl(originalUrl);
        setImageFile(file);
        setImageUrl(preparedUrl);
        setImagePreparedAssetId(imageAsset.assetId);
        setImageView('prepared');
        setImagePreparationFailed(false);
        setImagePreparing(false);
        setImagePreparationNotice(labels.imagePrepared);
        if (resumeAction === 'model') {
          setMode('image');
          setPendingResumeModel(true);
        } else if (imageAsset.assetKind === 'reference_image') {
          setMode('image');
        } else {
          setMode('brief');
          setBriefDraftRequestId(request.id);
          setRenderImages([{ assetId: imageAsset.assetId, url: `/api/gift/assets/${imageAsset.assetId}` }]);
          setSelectedRender(0);
          setBriefStatus(restoredModel ? 'model-ready' : 'render-ready');
          setBrief(request.requestNotes || buildGiftBrief(language, restoredProfileSelections));
        }
        onResumeConsumed?.();
      } catch (error) {
        if (!cancelled) setAiError({ configuration: false, reason: 'validation', message: error instanceof Error ? error.message : 'Unable to restore the draft image.' });
      }
    }
    void restoreImage();
    return () => { cancelled = true; };
  }, [resumeDraft]);

  function clearAiError() {
    setAiError(null);
    setEditNotice(false);
  }

  async function requestImageEdit(file: File, prompt: string, outputName: string, options: {
    draftRequestId?: number | null;
    sourceAssetId?: number | null;
    stage: string;
    title: string;
  }) {
    const formData = new FormData();
    formData.set('image', file, file.name || 'gift-reference.png');
    formData.set('prompt', prompt);
    formData.set('stage', options.stage);
    formData.set('draftTitle', options.title);
    formData.set('finishType', finish);
    if (finish === 'paint') formData.set('paintColor', paintColor);
    if (options.draftRequestId) formData.set('draftRequestId', String(options.draftRequestId));
    if (options.sourceAssetId) formData.set('sourceAssetId', String(options.sourceAssetId));
    const response = await fetch('/api/gift/ai/edit', {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    if (!response.ok) throw await apiErrorMessage(response);
    const payload = await response.json() as { draft?: { id?: number }; image?: GiftImageResult; sourceAssetId?: number };
    const source = giftImageSource(payload.image);
    if (!source) throw { configuration: false, message: 'Image service did not return an edited image.' } satisfies GiftAiClientError;
    if (!payload.draft?.id || !payload.image?.assetId) throw { configuration: false, message: 'Generated image was not saved to the gift draft.' } satisfies GiftAiClientError;
    return { source, file: await imageSourceToFile(source, outputName), assetId: payload.image.assetId, sourceAssetId: payload.sourceAssetId, draftRequestId: payload.draft.id };
  }

  async function prepareImageForModel(sourceFile: File, preparationId: number) {
    imagePaintIdRef.current += 1;
    setImagePaintPreview(null);
    setImagePaintGenerating(false);
    setImagePreparing(true);
    setImagePreparationFailed(false);
    setImagePreparationNotice(labels.imagePreparingWhite);
    try {
      const compressedSource = await compressModelImage(sourceFile);
      if (imagePreparationIdRef.current !== preparationId) return;
      setImageOriginalFile(compressedSource.file);
      const edited = await requestImageEdit(compressedSource.file, whiteBackgroundPrompt(), 'gift-white-background.png', {
        draftRequestId: imageDraftRequestId,
        stage: 'white_background',
        title: language === 'zh' ? '图片生成 3D 礼品草稿' : 'Image-to-3D gift draft',
      });
      if (imagePreparationIdRef.current !== preparationId) return;
      setImageDraftRequestId(edited.draftRequestId);
      const prepared = await compressModelImage(edited.file);
      if (imagePreparationIdRef.current !== preparationId) return;
      setImagePreparedAssetId(prepared.compressed ? null : edited.assetId);
      setImageFile(prepared.file);
      setImageUrl(prepared.compressed ? URL.createObjectURL(prepared.file) : edited.source);
      setImageView('prepared');
      setImagePreparationNotice(labels.imagePrepared);
    } catch (error) {
      if (imagePreparationIdRef.current !== preparationId) return;
      setImageFile(null);
      setImageUrl(null);
      setImageView('original');
      setImagePreparationFailed(true);
      setImagePreparationNotice(labels.imagePreparationFailed);
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    } finally {
      if (imagePreparationIdRef.current === preparationId) setImagePreparing(false);
    }
  }

  async function chooseImage(file: File | undefined) {
    const preparationId = imagePreparationIdRef.current + 1;
    imagePreparationIdRef.current = preparationId;
    setImageOriginalFile(file || null);
    setImageOriginalUrl(file ? URL.createObjectURL(file) : null);
    setImageFile(null);
    setImageUrl(null);
    setImageView('original');
    setImagePreparationFailed(false);
    setImagePaintPreview(null);
    setImagePreparedAssetId(null);
    setImagePaintAssetId(null);
    setImagePaintGenerating(false);
    setImagePreparing(Boolean(file));
    setImagePreparationNotice(file ? labels.imagePreparingWhite : null);
    setImageStatus('idle');
    setImageModel(undefined);
    setModelProgress(null);
    clearAiError();
    if (!file) return;
    await prepareImageForModel(file, preparationId);
  }

  async function retryImagePreparation() {
    if (!imageOriginalFile || imagePreparing) return;
    const preparationId = imagePreparationIdRef.current + 1;
    imagePreparationIdRef.current = preparationId;
    clearAiError();
    await prepareImageForModel(imageOriginalFile, preparationId);
  }

  async function generateImagePaintPreview() {
    if (!imageFile || imagePreparing || imagePaintGenerating) return;
    const paintId = imagePaintIdRef.current + 1;
    imagePaintIdRef.current = paintId;
    clearAiError();
    setImagePaintGenerating(true);
    try {
      const edited = await requestImageEdit(imageFile, monochromePaintPrompt(paintColor), 'gift-paint-preview.png', {
        draftRequestId: imageDraftRequestId,
        sourceAssetId: imagePreparedAssetId,
        stage: 'paint_preview',
        title: language === 'zh' ? '图片生成 3D 礼品草稿' : 'Image-to-3D gift draft',
      });
      if (imagePaintIdRef.current !== paintId) return;
      setImageDraftRequestId(edited.draftRequestId);
      setImagePaintAssetId(edited.assetId);
      setImagePaintPreview(edited.source);
      setImageView('paint');
      setImagePreparationNotice(labels.paintPreviewReady);
    } catch (error) {
      if (imagePaintIdRef.current !== paintId) return;
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    } finally {
      if (imagePaintIdRef.current === paintId) setImagePaintGenerating(false);
    }
  }

  async function waitForWhiteModel(file: File, options: { draftRequestId?: number | null; sourceAssetId?: number | null; title: string }) {
    setModelProgress({ percent: 0, stage: labels.modelProgressPreparing });
    let prepared: Awaited<ReturnType<typeof compressModelImage>>;
    try {
      prepared = await compressModelImage(file);
    } catch {
      throw { configuration: false, reason: 'validation', message: labels.imageCompressionFailed } satisfies GiftAiClientError;
    }
    if (prepared.file.size > MODEL_IMAGE_MAX_BYTES) throw { configuration: false, reason: 'validation', message: labels.imageTooLarge } satisfies GiftAiClientError;
    setModelProgress({ percent: 0, stage: labels.modelProgressUploading });
    const formData = new FormData();
    formData.set('image', prepared.file, prepared.file.name || 'gift-reference.webp');
    formData.set('draftTitle', options.title);
    formData.set('finishType', finish);
    formData.set('businessScene', selectedProfileTags.slice(0, 4).join(' · '));
    formData.set('brief', brief);
    if (finish === 'paint') formData.set('paintColor', paintColor);
    if (options.draftRequestId) formData.set('draftRequestId', String(options.draftRequestId));
    if (options.sourceAssetId && !prepared.compressed) formData.set('sourceAssetId', String(options.sourceAssetId));
    const submitResponse = await fetch('/api/gift/ai/3d/submit', { method: 'POST', body: formData, credentials: 'same-origin', headers: { 'Idempotency-Key': crypto.randomUUID() } });
    if (!submitResponse.ok) {
      const error = await apiErrorMessage(submitResponse);
      if (error.reason === 'validation' && error.message?.includes('5MB')) error.message = labels.imageTooLarge;
      throw error;
    }
    const submitPayload = await submitResponse.json() as { draft?: { id?: number }; job?: { id?: string } };
    if (!submitPayload.job?.id || !submitPayload.draft?.id) throw { configuration: false, message: 'Model service did not return a saved draft job.' };
    let jobId = submitPayload.job.id;
    const draftRequestId = submitPayload.draft.id;
    setModelProgress({ percent: 0, stage: labels.modelProgressQueued });

    for (let attempt = 0; attempt < 120; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
      const queryResponse = await fetch(`/api/gift/ai/3d/query?id=${encodeURIComponent(jobId)}&draftRequestId=${draftRequestId}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!queryResponse.ok) throw await apiErrorMessage(queryResponse);
      const queryPayload = await queryResponse.json() as { job?: { id?: string; status?: string; progress?: number; models?: { type: string; url: string; assetId?: number; previewImageUrl?: string; previewAssetId?: number; previewModelUrl?: string; previewModelAssetId?: number }[] } };
      if (queryPayload.job?.id) jobId = queryPayload.job.id;
      const providerProgress = Number(queryPayload.job?.progress);
      if (queryPayload.job?.status === 'queued') {
        setModelProgress({ percent: 0, stage: labels.modelProgressQueued });
      } else if (queryPayload.job?.status === 'in_progress') {
        const normalizedProviderProgress = Number.isFinite(providerProgress) ? Math.min(99, Math.max(0, providerProgress)) : 0;
        setModelProgress({ percent: Math.round(normalizedProviderProgress), stage: labels.modelProgressGenerating });
      }
      if (queryPayload.job?.status === 'completed') {
        setModelProgress({ percent: 100, stage: labels.modelProgressConverting });
        const models = queryPayload.job.models || [];
        const preferred = models.find((model) => model.type.toLowerCase() === 'stl') || models.find((model) => ['glb', 'gltf'].includes(model.type.toLowerCase()));
        if (!preferred) throw { configuration: false, message: 'Model service did not return a supported model.' };
        const modelType = preferred.type.toLowerCase();
        if (modelType !== 'stl' && modelType !== 'glb' && modelType !== 'gltf') throw { configuration: false, message: 'Unsupported generated model format.' };
        if (!preferred.assetId || !preferred.url) throw { configuration: false, message: 'Generated model was not saved to the gift draft.' };
        return {
          jobId,
          modelType,
          modelUrl: preferred.url,
          previewImageUrl: preferred.previewImageUrl,
          draftRequestId,
          modelAssetId: preferred.assetId,
          previewAssetId: preferred.previewAssetId,
          previewModelUrl: preferred.previewModelUrl,
          previewModelAssetId: preferred.previewModelAssetId,
          previewModelType: preferred.previewModelUrl ? 'glb' : undefined,
        } satisfies GeneratedGiftModel;
      }
      if (queryPayload.job?.status === 'failed') throw { configuration: false, message: 'Model generation failed.' };
    }
    throw { configuration: false, message: 'Model generation timed out.' };
  }

  async function generateImageModel() {
    if (!imageFile) return;
    clearAiError();
    setImageStatus('generating');
    try {
      const model = await waitForWhiteModel(imageFile, {
        draftRequestId: imageDraftRequestId,
        sourceAssetId: imagePreparedAssetId,
        title: language === 'zh' ? '图片生成 3D 礼品草稿' : 'Image-to-3D gift draft',
      });
      setImageDraftRequestId(model.draftRequestId || imageDraftRequestId);
      setImageModel(model);
      setModelProgress({ percent: 100, stage: labels.modelProgressConverting });
      setImageStatus('ready');
    } catch (error) {
      setImageStatus('idle');
      setModelProgress(null);
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    }
  }

  useEffect(() => {
    if (!pendingResumeModel || !imageFile || !imageDraftRequestId || imageStatus === 'generating') return;
    setPendingResumeModel(false);
    void generateImageModel();
  }, [pendingResumeModel, imageFile, imageDraftRequestId, imageStatus]);

  function resetBriefResults() {
    setBriefStatus('idle');
    setRenderImages([]);
    setSelectedRender(null);
    setBriefModel(undefined);
    setModelProgress(null);
    clearAiError();
  }

  function toggleProfileOption(groupId: ProfileGroupId, optionId: string) {
    const currentGroup = profileSelections[groupId];
    const nextSelections = {
      ...profileSelections,
      [groupId]: currentGroup.includes(optionId) ? currentGroup.filter((item) => item !== optionId) : [...currentGroup, optionId],
    };
    setProfileSelections(nextSelections);
    setBrief(buildGiftBrief(language, nextSelections));
    setBriefAutoGenerated(true);
    resetBriefResults();
  }

  function choosePaintColor(value: string) {
    const normalized = value.toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) return;
    setPaintColor(normalized);
    setPaintColorInput(normalized);
    imagePaintIdRef.current += 1;
    setImagePaintGenerating(false);
    setImagePaintPreview(null);
    setImagePaintAssetId(null);
    if (imageView === 'paint') setImageView(imageUrl ? 'prepared' : 'original');
    if (imageFile) setImagePreparationNotice(labels.imagePrepared);
    if (mode === 'brief') resetBriefResults();
    else clearAiError();
  }

  async function generateRenders() {
    if (!brief.trim() && selectedProfileTags.length === 0) return;
    clearAiError();
    setBriefStatus('generating-render');
    setRenderImages([]);
    setSelectedRender(null);
    try {
      const response = await fetch('/api/gift/ai/render', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          prompt: renderPrompt(language, brief, selectedProfileTags, finish, paintColor),
          draftRequestId: briefDraftRequestId,
          draftTitle: language === 'zh' ? '客户专属 AI 礼品草稿' : 'Customer-specific AI gift draft',
          businessScene: selectedProfileTags.slice(0, 4).join(' · '),
          finishType: finish,
          paintColor: finish === 'paint' ? paintColor : null,
          brief,
          specifications: { source: 'ai_brief', profileTags: selectedProfileTags },
        }),
      });
      if (!response.ok) throw await apiErrorMessage(response);
      const payload = await response.json() as { draft?: { id?: number }; images?: GiftImageResult[] };
      if (!payload.draft?.id || !payload.images?.length || payload.images.some((image) => !image.assetId)) throw { configuration: false, message: 'Generated images were not saved to the gift draft.' };
      setBriefDraftRequestId(payload.draft.id);
      setRenderImages(payload.images);
      setBriefStatus('render-ready');
    } catch (error) {
      setBriefStatus('idle');
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    }
  }

  async function editSelectedImage() {
    const selectedImage = selectedRender === null ? undefined : renderImages[selectedRender];
    const source = giftImageSource(selectedImage);
    if (!source || !editPrompt.trim()) return;
    clearAiError();
    setEditNotice(false);
    setEditError(null);
    setEditing(true);
    try {
      const sourceFile = await imageSourceToFile(source, 'gift-render.png');
      const formData = new FormData();
      formData.set('image', sourceFile);
      formData.set('stage', 'render_edit');
      formData.set('draftTitle', language === 'zh' ? '客户专属 AI 礼品草稿' : 'Customer-specific AI gift draft');
      formData.set('finishType', finish);
      formData.set('businessScene', selectedProfileTags.slice(0, 4).join(' · '));
      formData.set('brief', brief);
      if (finish === 'paint') formData.set('paintColor', paintColor);
      if (briefDraftRequestId) formData.set('draftRequestId', String(briefDraftRequestId));
      const selectedAssetId = selectedImage?.assetId;
      if (selectedAssetId) formData.set('sourceAssetId', String(selectedAssetId));
      const finishConstraint = finish === 'paint'
        ? `Keep the entire gift in exactly one uniform solid paint color ${paintColor}. Do not introduce gradients, color blocking, accent colors, metallic parts, or secondary material colors.`
        : 'Keep the restrained antique bronze material and subtle patina consistent across the gift.';
      formData.set('prompt', `${editPrompt.trim()}\n${finishConstraint}`);
      if (editMask) formData.set('mask', editMask);
      const response = await fetch('/api/gift/ai/edit', { method: 'POST', body: formData, credentials: 'same-origin', headers: { 'Idempotency-Key': crypto.randomUUID() } });
      if (!response.ok) throw await apiErrorMessage(response);
      const payload = await response.json() as { draft?: { id?: number }; image?: GiftImageResult };
      if (!payload.draft?.id || !payload.image?.assetId || !giftImageSource(payload.image)) throw { configuration: false, message: 'Edited image was not saved to the gift draft.' };
      setBriefDraftRequestId(payload.draft.id);
      setRenderImages((current) => [...current, payload.image!]);
      setSelectedRender(renderImages.length);
      setEditPrompt('');
      setEditMask(null);
      setEditNotice(true);
    } catch (error) {
      setEditError(editClientErrorMessage(error, language));
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    } finally {
      setEditing(false);
    }
  }

  async function generateBriefModel() {
    const selectedImage = selectedRender === null ? undefined : renderImages[selectedRender];
    const source = giftImageSource(selectedImage);
    if (!source) return;
    clearAiError();
    setBriefStatus('generating-model');
    try {
      const file = await imageSourceToFile(source, 'selected-gift-render.png');
      const model = await waitForWhiteModel(file, {
        draftRequestId: briefDraftRequestId,
        sourceAssetId: selectedImage?.assetId,
        title: language === 'zh' ? '客户专属 AI 礼品草稿' : 'Customer-specific AI gift draft',
      });
      setBriefDraftRequestId(model.draftRequestId || briefDraftRequestId);
      setBriefModel(model);
      setModelProgress({ percent: 100, stage: labels.modelProgressConverting });
      setBriefStatus('model-ready');
    } catch (error) {
      setBriefStatus('render-ready');
      setModelProgress(null);
      setAiError(typeof error === 'object' && error ? error as GiftAiClientError : { configuration: false });
    }
  }

  const generatedModel: GiftModel = {
    id: 'ai-generated',
    name: language === 'zh' ? 'AI 客户专属礼品' : 'AI customer-specific gift',
    description: brief || (language === 'zh' ? '根据参考图片生成的客户专属白膜模型。' : 'A customer-specific white model generated from the reference.'),
    category: 'custom',
    categoryLabel: labels.custom,
    useCase: selectedProfileTags.slice(0, 2).join(' · ') || labels.custom,
    finishLabel: finish === 'paint' ? `${labels.paint} · ${paintColor}` : labels.bronze,
    finish,
    color: finish === 'paint' ? 'from-[#075985] to-[#67e8f9]' : 'from-[#6b3518] to-[#d6a15f]',
    accent: 'AI',
  };

  const displayedImageSource = imageView === 'paint'
    ? imagePaintPreview
    : imageView === 'prepared'
      ? imageUrl
      : imageOriginalUrl;

  return (
    <section id="ai-generate" className="relative z-10 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="rounded-t-2xl border-b border-slate-100 bg-[linear-gradient(135deg,#f0fbff_0%,#ffffff_54%,#eff6ff_100%)] p-6 md:p-8"><div className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-black text-cyan-800 shadow-sm"><WandSparkles className="h-4 w-4" />AI Gift Studio</div><h2 className="mt-4 text-2xl font-black text-slate-950 md:text-3xl">{labels.aiTitle}</h2><p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">{labels.aiDescription}</p></div>
      <div className="grid border-b border-slate-200 md:grid-cols-2"><button type="button" onClick={() => setMode('image')} className={`flex items-start gap-4 p-5 text-left transition md:p-6 ${mode === 'image' ? 'bg-cyan-50/70 shadow-[inset_0_-3px_0_#0891b2]' : 'bg-white hover:bg-slate-50'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${mode === 'image' ? 'bg-[#0b4f9c] text-white' : 'bg-slate-100 text-slate-500'}`}><ImagePlus className="h-5 w-5" /></span><span><strong className="block text-sm font-black text-slate-950">{labels.imageMode}</strong><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{labels.imageModeHint}</span></span></button><button type="button" onClick={() => setMode('brief')} className={`flex items-start gap-4 border-t border-slate-200 p-5 text-left transition md:border-l md:border-t-0 md:p-6 ${mode === 'brief' ? 'bg-blue-50/70 shadow-[inset_0_-3px_0_#2563eb]' : 'bg-white hover:bg-slate-50'}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-md ${mode === 'brief' ? 'bg-[#0b4f9c] text-white' : 'bg-slate-100 text-slate-500'}`}><Sparkles className="h-5 w-5" /></span><span><strong className="block text-sm font-black text-slate-950">{labels.briefMode}</strong><span className="mt-1 block text-xs font-medium leading-5 text-slate-500">{labels.briefModeHint}</span></span></button></div>

      {aiError ? <div className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 md:mx-8">{aiError.configuration ? labels.aiConfigError : aiError.reason === 'approval' ? labels.aiApprovalError : aiError.reason === 'quota' ? labels.aiQuotaError : aiError.reason === 'validation' && aiError.message ? aiError.message : labels.aiRequestError}{!['validation', 'approval', 'quota'].includes(aiError.reason || '') && aiError.message ? <span className="mt-1 block text-xs font-medium opacity-75">{aiError.message}</span> : null}</div> : null}

      {mode === 'image' ? (
        <div className="p-6 md:p-8">
          <div className="grid gap-7 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
            <div>
              {imageOriginalUrl ? <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setImageView('original')} className={`rounded-md px-3 py-2 text-xs font-black transition ${imageView === 'original' ? 'bg-[#0b4f9c] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{labels.imageOriginal}</button>
                <button type="button" disabled={!imageUrl} onClick={() => setImageView('prepared')} className={`rounded-md px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${imageView === 'prepared' ? 'bg-[#0b4f9c] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{labels.imagePreparedView}</button>
                <button type="button" disabled={!imagePaintPreview} onClick={() => setImageView('paint')} className={`rounded-md px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${imageView === 'paint' ? 'bg-[#0b4f9c] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{labels.imagePaintView}</button>
              </div> : null}
              <label className="group relative flex min-h-[380px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-cyan-300 bg-cyan-50/40 p-5 text-center transition hover:border-cyan-500 hover:bg-cyan-50">
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; void chooseImage(file); }} />
                {displayedImageSource ? <img src={displayedImageSource} alt={labels.oneImage} className="absolute inset-0 h-full w-full bg-white object-contain" /> : null}
                <div className={displayedImageSource ? 'absolute bottom-4 left-4 rounded-md bg-slate-950/70 px-4 py-2 text-white backdrop-blur' : 'relative'}>
                  {!displayedImageSource ? <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-white text-[#0b4f9c] shadow-sm"><UploadCloud className="h-7 w-7" /></div> : null}
                  <span className={`block text-sm font-black ${displayedImageSource ? 'text-white' : 'mt-4 text-slate-800'}`}>{displayedImageSource ? labels.replaceImage : labels.oneImage}</span>
                  {!displayedImageSource ? <span className="mt-2 block max-w-xs text-xs font-medium leading-5 text-slate-500">{labels.oneImageHint}</span> : null}
                </div>
                {imagePreparing ? <div className="absolute inset-0 grid place-items-center bg-white/85 backdrop-blur-sm"><div className="flex flex-col items-center gap-3 text-sm font-black text-cyan-800"><LoaderCircle className="h-8 w-8 animate-spin" />{labels.imagePreparingWhite}</div></div> : null}
              </label>
            </div>

            <div className="self-center">
              {imagePreparationNotice ? <div className={`mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-bold ${imagePreparing ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : imagePreparationFailed ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                <span className="flex items-center gap-2">{imagePreparing ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" /> : imagePreparationFailed ? <X className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}{imagePreparationNotice}</span>
                {imagePreparationFailed ? <button type="button" onClick={() => void retryImagePreparation()} className="shrink-0 underline underline-offset-2">{labels.imageRetryPreparation}</button> : null}
              </div> : null}

              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
                <div className="flex items-start gap-3"><Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4f9c]" /><div><h3 className="text-sm font-black text-slate-900">Image → White 3D Model</h3><p className="mt-1 text-sm font-medium leading-6 text-slate-600">{labels.imageModelRule}</p></div></div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start gap-3"><Palette className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4f9c]" /><div><h3 className="text-sm font-black text-slate-900">{labels.imagePaintPreviewTitle}</h3><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{labels.imagePaintPreviewHint}</p></div></div>
                <div className="mt-4 grid grid-cols-8 gap-2">{paintColorPresets.map((preset) => { const active = paintColor === preset.hex; return <button key={preset.hex} type="button" onClick={() => choosePaintColor(preset.hex)} aria-label={`${language === 'zh' ? preset.zh : preset.en} ${preset.hex}`} title={language === 'zh' ? preset.zh : preset.en} className={`relative aspect-square min-h-8 rounded-md border-2 transition hover:-translate-y-0.5 ${active ? 'border-[#0b4f9c] ring-2 ring-blue-100' : 'border-white shadow-sm'}`} style={{ backgroundColor: preset.hex }}>{active ? <Check className={`absolute inset-0 m-auto h-3.5 w-3.5 ${preset.hex === '#E7E5E4' ? 'text-slate-700' : 'text-white'}`} strokeWidth={3} /> : null}</button>; })}</div>
                <div className="mt-3 flex items-center gap-2"><label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700"><input type="color" value={paintColor} onChange={(event) => choosePaintColor(event.target.value)} className="h-5 w-7 cursor-pointer border-0 bg-transparent p-0" aria-label={labels.customPaintColor} />{labels.customPaintColor}</label><input value={paintColorInput} maxLength={7} onChange={(event) => { const value = event.target.value.toUpperCase(); setPaintColorInput(value); if (/^#[0-9A-F]{6}$/.test(value)) choosePaintColor(value); }} onBlur={() => { if (!/^#[0-9A-F]{6}$/.test(paintColorInput)) setPaintColorInput(paintColor); }} aria-label={labels.customPaintColor} className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 font-mono text-xs font-bold uppercase text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></div>
                <button type="button" onClick={() => void generateImagePaintPreview()} disabled={!imageFile || imagePreparing || imagePaintGenerating} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#0b4f9c] bg-white px-5 text-sm font-black text-[#0b4f9c] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-45">{imagePaintGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}{imagePaintGenerating ? labels.generatingPaintPreview : labels.generatePaintPreview}</button>
              </div>

              {imageStatus === 'generating' && modelProgress ? <ModelGenerationProgressBar progress={modelProgress} /> : <button type="button" onClick={generateImageModel} disabled={!imageFile || imagePreparing} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-6 text-sm font-black text-white shadow-sm transition hover:bg-[#083f7e] disabled:cursor-not-allowed disabled:opacity-45" data-umami-event="gift_image_to_3d_click">{imagePreparing ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Boxes className="h-5 w-5" />}{imagePreparing ? labels.imagePreparingWhite : labels.generateWhiteModel}</button>}
            </div>
          </div>
          {imageStatus === 'ready' ? <WhiteModelResult labels={labels} model={imageModel} onPreview={() => imageModel && setPreviewModel(imageModel)} onOrder={() => onOrder({ ...generatedModel, id: `ai-image-${Date.now()}`, generatedModelUrl: imageModel?.modelUrl, generatedModelAssetId: imageModel?.modelAssetId, previewAssetId: imageModel?.previewAssetId, draftRequestId: imageModel?.draftRequestId })} /> : null}
        </div>
      ) : (
        <div className="p-6 md:p-8">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.12fr)_minmax(360px,0.88fr)]"><div><label className="block text-sm font-black text-slate-700">{labels.customerBrief}<textarea value={brief} onChange={(event) => { setBrief(event.target.value); setBriefAutoGenerated(false); resetBriefResults(); }} rows={5} placeholder={labels.customerBriefPlaceholder} className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium leading-6 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label><div className="mt-6 flex flex-wrap items-end justify-between gap-2"><div className="text-sm font-black text-slate-700">{labels.profileTags}</div><div className="text-[11px] font-bold text-slate-400">{labels.profileAutoHint}</div></div><div ref={profileMenusRef} className="mt-3 grid gap-2 sm:grid-cols-2">{profileGroups.map((group) => <ProfileDropdown key={group.id} group={group} language={language} selected={profileSelections[group.id]} open={openProfileGroup === group.id} onToggleOpen={() => { setPaintMenuOpen(false); setOpenProfileGroup((current) => current === group.id ? null : group.id); }} onToggleOption={(optionId) => toggleProfileOption(group.id, optionId)} />)}</div></div><div><div className="text-sm font-black text-slate-700">{labels.renderFinish}</div><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><div ref={paintMenuRef} className={`relative ${paintMenuOpen ? 'z-30' : ''}`}><button type="button" aria-expanded={paintMenuOpen} aria-haspopup="dialog" onClick={() => { const switchingToPaint = finish !== 'paint'; setFinish('paint'); setOpenProfileGroup(null); setPaintMenuOpen((current) => switchingToPaint || !current); if (switchingToPaint) resetBriefResults(); }} className={`h-full w-full rounded-xl border p-4 text-left transition ${finish === 'paint' ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100' : 'border-slate-200 bg-white hover:border-cyan-300'}`}><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="h-5 w-5 rounded-full shadow-inner" style={{ backgroundColor: paintColor }} />{labels.paint}</div><div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-500"><span>{paintColor}</span><ChevronDown className={`h-4 w-4 transition ${paintMenuOpen ? 'rotate-180' : ''}`} /></div></div><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{labels.paintHint}</p></button>{finish === 'paint' && paintMenuOpen ? <div role="dialog" aria-label={labels.paintColor} className="absolute left-0 top-[calc(100%+0.5rem)] w-full min-w-[280px] rounded-xl border border-cyan-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)]"><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black text-slate-900">{labels.paintColor}</div><p className="mt-1 text-[11px] font-medium leading-4 text-slate-500">{labels.paintColorHint}</p></div><span className="h-8 w-8 shrink-0 rounded-full border-4 border-white shadow" style={{ backgroundColor: paintColor }} /></div><div className="mt-3 grid grid-cols-8 gap-1.5">{paintColorPresets.map((preset) => { const active = paintColor === preset.hex; return <button key={preset.hex} type="button" onClick={() => { choosePaintColor(preset.hex); setPaintMenuOpen(false); }} aria-label={`${language === 'zh' ? preset.zh : preset.en} ${preset.hex}`} title={language === 'zh' ? preset.zh : preset.en} className={`relative aspect-square min-h-7 rounded-md border-2 transition hover:-translate-y-0.5 ${active ? 'border-[#0b4f9c] ring-2 ring-blue-100' : 'border-white shadow-sm'}`} style={{ backgroundColor: preset.hex }}>{active ? <Check className={`absolute inset-0 m-auto h-3.5 w-3.5 ${preset.hex === '#E7E5E4' ? 'text-slate-700' : 'text-white'}`} strokeWidth={3} /> : null}</button>; })}</div><div className="mt-3 flex items-center gap-2"><label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-700"><input type="color" value={paintColor} onChange={(event) => choosePaintColor(event.target.value)} className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0" aria-label={labels.customPaintColor} />{labels.customPaintColor}</label><input value={paintColorInput} maxLength={7} onChange={(event) => { const value = event.target.value.toUpperCase(); setPaintColorInput(value); if (/^#[0-9A-F]{6}$/.test(value)) choosePaintColor(value); }} onBlur={() => { if (!/^#[0-9A-F]{6}$/.test(paintColorInput)) setPaintColorInput(paintColor); }} aria-label={labels.customPaintColor} className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-[11px] font-bold uppercase text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></div><p className="mt-2 text-[10px] font-bold leading-4 text-slate-400">{labels.paintColorRule}</p></div> : null}</div><button type="button" onClick={() => { const switchingToBronze = finish !== 'bronze'; setFinish('bronze'); setPaintMenuOpen(false); if (switchingToBronze) resetBriefResults(); }} className={`rounded-xl border p-4 text-left transition ${finish === 'bronze' ? 'border-amber-600 bg-amber-50 ring-2 ring-amber-100' : 'border-slate-200 hover:border-amber-300'}`}><div className="flex items-center gap-2 text-sm font-black text-slate-900"><span className="h-5 w-5 rounded-full bg-gradient-to-br from-[#d9a963] to-[#6b3518] shadow-inner" />{labels.bronze}</div><p className="mt-2 text-xs font-medium leading-5 text-slate-500">{labels.bronzeHint}</p></button></div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-900"><div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>{labels.processRule}</span></div></div><button type="button" onClick={generateRenders} disabled={(!brief.trim() && selectedProfileTags.length === 0) || briefStatus === 'generating-render'} className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#083f7e] disabled:cursor-not-allowed disabled:opacity-45" data-umami-event="gift_render_generate_click">{briefStatus === 'generating-render' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <WandSparkles className="h-5 w-5" />}{briefStatus === 'generating-render' ? labels.generatingRender : labels.generateRender}</button></div></div>

          {['render-ready', 'generating-model', 'model-ready'].includes(briefStatus) ? <div className="mt-8 border-t border-slate-200 pt-7"><h3 className="text-lg font-black text-slate-950">{labels.renderReady}</h3><p className="mt-1 text-sm font-medium text-slate-500">{labels.renderReadyHint}</p><div className="mt-5 grid gap-4 md:grid-cols-3">{renderImages.map((image, index) => <RenderConcept key={`${index}-${giftImageSource(image).slice(-24)}`} finish={finish} index={index} source={giftImageSource(image)} selected={selectedRender === index} onSelect={() => { setSelectedRender(index); setEditNotice(false); }} labels={labels} />)}</div>

            {selectedRender !== null ? <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/40 p-5"><div className="flex items-start gap-3"><ImagePlus className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4f9c]" /><div><h4 className="text-sm font-black text-slate-900">{labels.editTitle}</h4><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{labels.editDescription}</p></div></div><div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]"><label className="text-xs font-black text-slate-700">{labels.editPrompt}<textarea value={editPrompt} onChange={(event) => { setEditPrompt(event.target.value); setEditError(null); }} rows={3} placeholder={labels.editPlaceholder} className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-3 text-sm font-medium leading-6 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label><label className="flex cursor-pointer flex-col justify-center rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-cyan-400"><input type="file" accept="image/png" className="sr-only" onChange={(event) => setEditMask(event.target.files?.[0] || null)} /><span className="text-xs font-black text-slate-700">{editMask?.name || labels.chooseMask}</span><span className="mt-1 text-[11px] font-medium leading-4 text-slate-400">{labels.optionalMask} · {labels.maskHint}</span></label></div><div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={editSelectedImage} disabled={!editPrompt.trim() || editing} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#0b4f9c] bg-white px-5 text-sm font-black text-[#0b4f9c] transition hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-45" data-umami-event="gift_ai_edit_image_click">{editing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{editing ? labels.editingImage : labels.editImage}</button>{editing ? <span className="text-xs font-bold text-[#0b4f9c]">{labels.editingImage}</span> : null}{editNotice ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />{labels.editedVersion}</span> : null}{editError ? <span role="alert" className="basis-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold leading-5 text-red-700">{editError}</span> : null}</div></div> : null}

            {briefStatus === 'generating-model' && modelProgress ? <ModelGenerationProgressBar progress={modelProgress} /> : <button type="button" onClick={generateBriefModel} disabled={selectedRender === null} className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-6 text-sm font-black text-white transition hover:bg-[#083f7e] disabled:cursor-not-allowed disabled:opacity-45" data-umami-event="gift_render_to_3d_click"><Boxes className="h-5 w-5" />{labels.generateFromRender}</button>}</div> : null}
          {briefStatus === 'model-ready' ? <WhiteModelResult labels={labels} model={briefModel} onPreview={() => briefModel && setPreviewModel(briefModel)} onOrder={() => onOrder({ ...generatedModel, id: `ai-brief-${Date.now()}`, generatedModelUrl: briefModel?.modelUrl, generatedModelAssetId: briefModel?.modelAssetId, previewAssetId: briefModel?.previewAssetId, draftRequestId: briefModel?.draftRequestId })} /> : null}
        </div>
      )}
      {previewModel ? <GiftModelModal language={language} model={previewModel} onClose={() => setPreviewModel(null)} /> : null}
    </section>
  );
}

function BusinessRequestPanel({ t, onSubmitted }: { t: GiftCopy; onSubmitted: () => void }) {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requestNo, setRequestNo] = useState('');
  const [files, setFiles] = useState<File[]>([]);

  async function submitBusinessRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/gift/requests', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestType: 'business_sample', title: String(data.get('title') || '公司业务打印申请'),
          customerCompany: String(data.get('customerCompany') || ''), businessScene: String(data.get('businessScene') || ''),
          quantity: Number(data.get('quantity') || 1), finishType: String(data.get('finishType') || 'white'),
          paintColor: data.get('finishType') === 'paint' ? String(data.get('paintColor') || '#0B77B7') : null,
          requestedCompletionDate: String(data.get('deadline') || '') || null, pickupLocation: t.pickupValue,
          requestNotes: String(data.get('notes') || ''), specifications: { source: String(data.get('source') || '') },
        }),
      });
      const result = await response.json() as { id?: number; requestNo?: string; message?: string };
      if (!response.ok || !result.id) throw new Error(result.message || '申请提交失败');
      for (const file of files) {
        const form = new FormData(); form.set('file', file);
        form.set('role', /\.(stl|obj|3mf|glb|gltf)$/i.test(file.name) ? 'source_model' : 'reference');
        const upload = await fetch(`/api/gift/requests/${result.id}/attachments`, { method: 'POST', credentials: 'same-origin', body: form });
        if (!upload.ok) throw new Error('申请已创建，但部分附件上传失败，请联系运营人员补充。');
      }
      setRequestNo(result.requestNo || ''); setSubmitted(true); onSubmitted();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : '申请提交失败'); }
    finally { setSaving(false); }
  }

  return (
    <section id="business-request" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"><Factory className="h-4 w-4 text-[#0b4f9c]" />Business Print Workflow</div>
          <h2 className="mt-4 text-2xl font-black text-slate-950">{t.businessRequestTitle}</h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">{t.businessRequestDescription}</p>
        </div>
        <div className="max-w-xs rounded-md border border-cyan-100 bg-cyan-50 p-3 text-xs font-bold leading-5 text-cyan-900"><div className="flex items-center gap-2"><PackageCheck className="h-4 w-4" />{t.businessTitle}</div><p className="mt-1">{t.businessDescription}</p></div>
      </div>
      {submitted ? (
        <div className="mt-7 flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /><div><h3 className="text-sm font-black">{t.businessSubmitted}</h3><p className="mt-1 text-xs font-medium leading-5">{t.orderSuccessHint}{requestNo ? `（${requestNo}）` : ''}</p></div></div>
      ) : (
        <form className="mt-7 grid gap-5 md:grid-cols-2" onSubmit={(event) => void submitBusinessRequest(event)}>
          <label className="block text-sm font-black text-slate-700">申请名称<input name="title" required maxLength={255} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" placeholder="例如：上海展会设备样件打印" /></label>
          <label className="block text-sm font-black text-slate-700">客户/业务项目<input name="customerCompany" maxLength={255} className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" placeholder="客户名称或内部项目" /></label>
          <label className="block text-sm font-black text-slate-700">{t.businessUseCase}<select name="businessScene" required className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"><option value="">{t.scenePlaceholder}</option><option value="customer-gift">{t.sceneCustomer}</option><option value="exhibition">{t.sceneEvent}</option><option value="business-sample">{t.businessTitle}</option></select></label>
          <label className="block text-sm font-black text-slate-700">{t.businessSource}<select name="source" required className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"><option value="">{t.scenePlaceholder}</option><option value="catalog">{t.libraryTitle}</option><option value="ai">{t.generateTitle}</option><option value="own-model">{t.businessTitle}</option></select></label>
          <label className="block text-sm font-black text-slate-700">数量<input name="quantity" type="number" min="1" max="10000" defaultValue="1" className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm" /></label>
          <label className="block text-sm font-black text-slate-700">成品工艺<select name="finishType" defaultValue="white" className="mt-2 h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="white">白膜</option><option value="paint">单色喷漆</option><option value="bronze">铜做旧</option><option value="other">其他</option></select></label>
          <label className="block text-sm font-black text-slate-700">喷漆颜色（选择喷漆时）<input name="paintColor" type="color" defaultValue="#0B77B7" className="mt-2 h-11 w-full rounded-md border border-slate-200 p-1" /></label>
          <label className="block text-sm font-black text-slate-700">{t.businessDeadline}<input name="deadline" type="date" className="mt-2 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-medium outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>
          <label className="block text-sm font-black text-slate-700 md:col-span-2">模型、图片或说明附件<input type="file" multiple accept=".stl,.obj,.3mf,.glb,.gltf,.png,.jpg,.jpeg,.webp,.pdf,.zip" onChange={(event) => setFiles(Array.from(event.target.files || []))} className="mt-2 block w-full rounded-md border border-slate-200 bg-white p-3 text-xs" /><span className="mt-1 block text-xs font-medium text-slate-400">已选择 {files.length} 个文件</span></label>
          <label className="block text-sm font-black text-slate-700 md:col-span-2">{t.note}<textarea name="notes" required rows={4} maxLength={5000} placeholder={t.businessRequestPlaceholder} className="mt-2 w-full resize-none rounded-md border border-slate-200 px-3 py-3 text-sm font-medium leading-6 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" /></label>
          {error ? <p className="rounded-md bg-red-50 p-3 text-xs font-bold text-red-700 md:col-span-2">{error}</p> : null}
          <div className="md:col-span-2"><button disabled={saving} type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#0b4f9c] px-5 text-sm font-black text-white shadow-sm transition hover:bg-[#083f7e] disabled:opacity-50" data-umami-event="gift_business_request_submit_click">{saving ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Factory className="h-5 w-5" />}{t.businessSubmit}</button></div>
        </form>
      )}
    </section>
  );
}

type MyGiftRequest = {
  id: number; requestNo: string; requestType: string; modelTitle: string | null; title: string; customerCompany: string | null;
  businessScene: string | null; quantity: number; finishType: string; paintColor: string | null; requestedCompletionDate: string | null;
  pickupLocation: string | null; requestNotes: string | null; status: string; assigneeName: string | null; productionBatchNo: string | null;
  scheduledCompleteAt: string | null; deliveryMethod: string | null; deliveryRecipient: string | null; deliveryNotes: string | null;
  specifications: Record<string, unknown> | null; createdAt: string; updatedAt: string; thumbnailAssetId: number | null; thumbnailContentType: string | null; modelAssetId: number | null; modelExtension: string | null; previewModelAssetId: number | null;
};

type MyGiftRequestDetail = {
  request: MyGiftRequest;
  events: { id: number; type: string; toStatus: string | null; comment: string | null; actorName: string; createdAt: string }[];
  attachments: { id: number; assetId: number; assetKind: string; role: string; filename: string; contentType: string | null; extension: string | null; size: number | null; uploaderName: string | null; createdAt: string }[];
};

type GiftDraftResume = {
  request: MyGiftRequest;
  attachments: MyGiftRequestDetail['attachments'];
  action: 'edit' | 'model';
};

const giftRequestStatus: Record<string, { zh: string; en: string }> = {
  draft: { zh: '设计草稿', en: 'Design draft' },
  submitted: { zh: '待审核', en: 'Submitted' }, reviewing: { zh: '审核中', en: 'In review' }, approved: { zh: '已批准', en: 'Approved' },
  rejected: { zh: '已拒绝', en: 'Rejected' }, queued: { zh: '已排产', en: 'Scheduled' }, printing: { zh: '打印中', en: 'Printing' },
  ready: { zh: '待领取', en: 'Ready' }, completed: { zh: '已完成', en: 'Completed' }, cancelled: { zh: '已取消', en: 'Cancelled' },
};

function MyRequestsPanel({ language, refreshKey, expanded: expandedProp, onExpandedChange, onPreviewModel, onPreviewImage, onResume }: { language: GiftLanguage; refreshKey: number; expanded?: boolean; onExpandedChange?: (expanded: boolean) => void; onPreviewModel: (model: GeneratedGiftModel) => void; onPreviewImage: (url: string) => void; onResume: (draft: GiftDraftResume) => void }) {
  const [requests, setRequests] = useState<MyGiftRequest[]>([]);
  const [detail, setDetail] = useState<MyGiftRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const expanded = expandedProp ?? internalExpanded;
  const label = (status: string) => giftRequestStatus[status]?.[language] || status;

  function setExpanded(next: boolean) {
    if (expandedProp === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  }

  async function loadRequests() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/gift/requests', { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json() as { requests?: MyGiftRequest[]; message?: string };
      if (!response.ok) throw new Error(result.message || '申请记录加载失败');
      setRequests(result.requests || []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '申请记录加载失败'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void loadRequests(); }, [refreshKey]);

  async function fetchRequestDetail(id: number) {
    const response = await fetch(`/api/gift/requests/${id}`, { cache: 'no-store', credentials: 'same-origin' });
    const result = await response.json() as MyGiftRequestDetail & { message?: string };
    if (!response.ok) throw new Error(result.message || '申请详情加载失败');
    return result;
  }

  async function openRequest(id: number) {
    setError(''); setDetailLoading(true);
    try {
      setDetail(await fetchRequestDetail(id));
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : '申请详情加载失败'); }
    finally { setDetailLoading(false); }
  }

  async function cancelRequest(request: MyGiftRequest) {
    if (!window.confirm(language === 'zh' ? '确认取消这条打印申请？' : 'Cancel this print request?')) return;
    setBusyAction(`${request.id}:cancel`); setError('');
    try {
      const response = await fetch(`/api/gift/requests/${request.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel', reason: language === 'zh' ? '员工主动取消' : 'Cancelled by requester' }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || '取消失败');
      if (detail?.request.id === request.id) setDetail(null);
      await loadRequests();
    } catch (cancelError) { setError(cancelError instanceof Error ? cancelError.message : '取消失败'); }
    finally { setBusyAction(null); }
  }

  function resumeDraft(target: MyGiftRequestDetail, action: GiftDraftResume['action']) {
    if (target.request.status !== 'draft') return;
    const hasImage = target.attachments.some((file) => file.contentType?.startsWith('image/'));
    if (action === 'model' && !hasImage) {
      setError(language === 'zh' ? '这条草稿还没有可用于生成模型的图片。' : 'This draft has no image available for model generation.');
      return;
    }
    onResume({ request: target.request, attachments: target.attachments, action });
    setDetail(null);
  }

  async function draftAction(request: MyGiftRequest, action: GiftDraftResume['action']) {
    setBusyAction(`${request.id}:${action}`); setError('');
    try {
      resumeDraft(await fetchRequestDetail(request.id), action);
    } catch (actionError) { setError(actionError instanceof Error ? actionError.message : '草稿加载失败'); }
    finally { setBusyAction(null); }
  }

  async function deleteDraft(request: MyGiftRequest) {
    if (request.status !== 'draft') return;
    if (!window.confirm(language === 'zh' ? '确认删除这条设计草稿？关联的图片和模型文件也会从 OSS 清理，删除后无法恢复。' : 'Delete this design draft? Its images and model files will also be removed from OSS. This cannot be undone.')) return;
    setBusyAction(`${request.id}:delete`); setError('');
    try {
      const response = await fetch(`/api/gift/requests/${request.id}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete' }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || (language === 'zh' ? '草稿删除失败' : 'Unable to delete the draft.'));
      if (detail?.request.id === request.id) setDetail(null);
      await loadRequests();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : (language === 'zh' ? '草稿删除失败' : 'Unable to delete the draft.')); }
    finally { setBusyAction(null); }
  }

  async function uploadAttachment(request: MyGiftRequest, file?: File) {
    if (!file) return;
    setBusyAction(`${request.id}:upload`); setError('');
    try {
      const data = new FormData(); data.set('file', file); data.set('role', /\.(stl|obj|3mf|glb|gltf)$/i.test(file.name) ? 'source_model' : 'reference');
      const response = await fetch(`/api/gift/requests/${request.id}/attachments`, { method: 'POST', credentials: 'same-origin', body: data });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || '附件上传失败');
      await loadRequests();
      if (detail?.request.id === request.id) setDetail(await fetchRequestDetail(request.id));
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : '附件上传失败'); }
    finally { setBusyAction(null); }
  }

  return (
    <>
      <section id="my-requests" className="mx-auto max-w-[1480px] scroll-mt-28 px-5 pt-6">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between gap-4 p-5 text-left">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-blue-50 text-[#0b4f9c]"><FileText className="h-5 w-5" /></span><div><h2 className="text-sm font-black text-slate-900">{language === 'zh' ? '我的打印申请' : 'My print requests'}</h2><p className="mt-1 text-xs font-medium text-slate-500">{language === 'zh' ? `${requests.length} 条申请，查看审核、排产和交付进度` : `${requests.length} requests · review production and delivery progress`}</p></div></div>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded ? <div className="border-t border-slate-100 p-5"><div className="mb-4 flex justify-end"><button onClick={() => void loadRequests()} className="inline-flex items-center gap-2 text-xs font-black text-[#0b4f9c]"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{language === 'zh' ? '刷新' : 'Refresh'}</button></div>{error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}{!loading && requests.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs font-bold text-slate-400">{language === 'zh' ? '还没有提交打印申请' : 'No print requests yet'}</div> : <div className="space-y-2">{requests.map((request) => <div key={request.id} role="button" tabIndex={0} aria-busy={detailLoading || Boolean(busyAction?.startsWith(`${request.id}:`))} aria-label={`${language === 'zh' ? '查看申请详情' : 'View request details'} ${request.requestNo}`} onClick={() => void openRequest(request.id)} onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openRequest(request.id); } }} className="grid w-full cursor-pointer items-center gap-3 rounded-lg border border-slate-100 p-3 text-left transition hover:border-cyan-200 hover:bg-cyan-50/30 focus:outline-none focus:ring-2 focus:ring-cyan-200 md:grid-cols-[285px_minmax(220px,1fr)_110px_120px_minmax(250px,auto)]"><div className="flex min-w-0 items-center gap-3"><span className="shrink-0 font-mono text-xs font-black text-[#0b4f9c]">{request.requestNo}</span><RequestAssetThumbnail request={request} language={language} onPreviewModel={onPreviewModel} onPreviewImage={onPreviewImage} /></div><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{request.title}</strong><small className="text-slate-500">{request.quantity} {language === 'zh' ? '件' : 'pcs'} · {request.modelTitle || request.businessScene || request.requestType}</small></div><span className="text-xs font-black text-slate-600">{label(request.status)}</span><span className="text-xs text-slate-400">{new Date(request.createdAt).toLocaleDateString()}</span><RequestActionButtons request={request} language={language} busyAction={busyAction} onDraftAction={(action) => void draftAction(request, action)} onDelete={() => void deleteDraft(request)} onCancel={() => void cancelRequest(request)} onUpload={(file) => void uploadAttachment(request, file)} /> </div>)}</div>}</div> : null}
      </div>
      {detail ? <div role="presentation" className="fixed inset-0 z-[80] flex justify-end bg-slate-950/45" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}><div role="dialog" aria-modal="true" aria-label={detail.request.title} onMouseDown={(event) => event.stopPropagation()} className="h-full w-full max-w-2xl overflow-y-auto bg-slate-100 p-6 shadow-2xl"><div className="sticky -top-6 z-10 -mx-6 -mt-6 mb-5 flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-100/95 px-6 pb-4 pt-6 backdrop-blur"><div className="min-w-0"><div className="font-mono text-xs font-black text-cyan-700">{detail.request.requestNo}</div><h2 className="mt-1 truncate text-xl font-black">{detail.request.title}</h2><p className="mt-1 text-sm font-bold text-slate-500">{label(detail.request.status)}</p></div><button type="button" onClick={() => setDetail(null)} className="sticky top-0 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-cyan-300 hover:text-[#0b4f9c]" title={language === 'zh' ? '关闭详情' : 'Close details'} aria-label={language === 'zh' ? '关闭详情' : 'Close details'}><X className="h-5 w-5" /></button></div><div className="grid gap-4 rounded-xl bg-white p-5 sm:grid-cols-2"><RequestInfo label={language === 'zh' ? '数量与工艺' : 'Quantity & finish'} value={`${detail.request.quantity} · ${detail.request.finishType}${detail.request.paintColor ? ` ${detail.request.paintColor}` : ''}`} /><RequestInfo label={language === 'zh' ? '期望完成' : 'Requested date'} value={detail.request.requestedCompletionDate || '-'} /><RequestInfo label={language === 'zh' ? '生产批次' : 'Batch'} value={detail.request.productionBatchNo || '-'} /><RequestInfo label={language === 'zh' ? '计划完成' : 'Scheduled completion'} value={detail.request.scheduledCompleteAt ? new Date(detail.request.scheduledCompleteAt).toLocaleString() : '-'} /><RequestInfo label={language === 'zh' ? '负责人' : 'Operator'} value={detail.request.assigneeName || '-'} /><RequestInfo label={language === 'zh' ? '交付信息' : 'Delivery'} value={[detail.request.deliveryRecipient, detail.request.deliveryNotes].filter(Boolean).join(' · ') || '-'} /></div><div className="mt-5 rounded-xl bg-white p-5"><h3 className="font-black">{language === 'zh' ? '申请资产' : 'Request assets'}</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{detail.attachments.map((file) => <a key={file.id} href={`/api/gift/assets/${file.assetId}?download=1`} className="overflow-hidden rounded-md border border-slate-100 bg-slate-50 text-xs font-bold text-slate-700">{file.contentType?.startsWith('image/') ? <img src={`/api/gift/assets/${file.assetId}`} alt={file.filename} className="aspect-[4/3] w-full bg-white object-contain" /> : <div className="grid aspect-[4/3] place-items-center bg-slate-100"><Layers3 className="h-10 w-10 text-slate-300" /></div>}<span className="flex items-center justify-between gap-2 p-3"><span className="truncate">{file.filename}</span><Download className="h-4 w-4 shrink-0 text-[#0b4f9c]" /></span></a>)}</div></div><div className="mt-5 rounded-xl bg-white p-5"><h3 className="font-black">{language === 'zh' ? '处理进度' : 'Timeline'}</h3><div className="mt-4 space-y-4">{detail.events.map((event) => <div key={event.id} className="border-l-2 border-cyan-200 pl-4"><div className="text-sm font-black">{event.toStatus ? label(event.toStatus) : event.type}</div><div className="mt-1 text-xs text-slate-400">{event.actorName} · {new Date(event.createdAt).toLocaleString()}</div>{event.comment ? <p className="mt-1 text-xs text-slate-600">{event.comment}</p> : null}</div>)}</div></div></div></div> : null}
      </section>

    </>
  );
}

function RequestActionButtons({ request, language, busyAction, onDraftAction, onDelete, onCancel, onUpload }: { request: MyGiftRequest; language: GiftLanguage; busyAction: string | null; onDraftAction: (action: GiftDraftResume['action']) => void; onDelete: () => void; onCancel: () => void; onUpload: (file?: File) => void }) {
  const actionBusy = busyAction?.startsWith(`${request.id}:`) || false;
  const cancellable = ['submitted', 'reviewing', 'approved', 'queued'].includes(request.status);
  const uploadable = !['rejected', 'completed', 'cancelled'].includes(request.status);
  const actionLabel = language === 'zh' ? '操作' : 'Actions';
  return <div className="flex flex-wrap items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()} aria-label={actionLabel}>{request.status === 'draft' ? <><button type="button" disabled={actionBusy} onClick={() => onDraftAction('edit')} className="inline-flex items-center gap-1 rounded-md bg-[#0b4f9c] px-2.5 py-1.5 text-[11px] font-black text-white disabled:opacity-50"><Pencil className="h-3.5 w-3.5" />{language === 'zh' ? '继续编辑' : 'Edit'}</button><button type="button" disabled={actionBusy} onClick={() => onDraftAction('model')} className="inline-flex items-center gap-1 rounded-md border border-cyan-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-[#0b4f9c] disabled:opacity-50"><Layers3 className="h-3.5 w-3.5" />{language === 'zh' ? '生成模型' : 'Generate model'}</button><button type="button" disabled={actionBusy} onClick={onDelete} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />{language === 'zh' ? '删除草稿' : 'Delete'}</button></> : null}{cancellable ? <button type="button" disabled={actionBusy} onClick={onCancel} className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-red-700 disabled:opacity-50"><X className="h-3.5 w-3.5" />{language === 'zh' ? '取消申请' : 'Cancel'}</button> : null}{uploadable ? <label onClick={(event) => event.stopPropagation()} className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-600 ${actionBusy ? 'pointer-events-none opacity-50' : 'hover:border-cyan-300 hover:text-[#0b4f9c]'}`}><UploadCloud className="h-3.5 w-3.5" />{language === 'zh' ? '补充附件' : 'Add file'}<input disabled={actionBusy} type="file" className="sr-only" onChange={(event) => { onUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} /></label> : null}{actionBusy ? <LoaderCircle className="h-4 w-4 animate-spin text-[#0b4f9c]" /> : null}</div>;
}

function RequestInfo({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] font-black text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>;
}

function RequestAssetThumbnail({ request, language, onPreviewModel, onPreviewImage }: { request: MyGiftRequest; language: GiftLanguage; onPreviewModel: (model: GeneratedGiftModel) => void; onPreviewImage: (url: string) => void }) {
  const hasModel = Boolean(request.modelAssetId);
  const thumbnailUrl = request.thumbnailAssetId ? `/api/gift/assets/${request.thumbnailAssetId}` : null;
  const extension = ['stl', 'glb', 'gltf'].includes(request.modelExtension || '') ? request.modelExtension as GeneratedGiftModel['modelType'] : 'stl';
  const openAsset = () => {
    if (hasModel) {
      onPreviewModel({ jobId: `request:${request.id}`, modelUrl: `/api/gift/assets/${request.modelAssetId}`, modelType: extension, fileName: `${request.requestNo}.${extension}`, modelAssetId: request.modelAssetId || undefined, previewAssetId: request.thumbnailAssetId || undefined, previewModelAssetId: request.previewModelAssetId || undefined, previewModelUrl: request.previewModelAssetId ? `/api/gift/assets/${request.previewModelAssetId}` : undefined, previewModelType: request.previewModelAssetId ? 'glb' : undefined, previewImageUrl: thumbnailUrl || undefined });
    } else if (thumbnailUrl) {
      onPreviewImage(thumbnailUrl);
    }
  };
  return <div className="flex min-w-0 items-center gap-2"><button type="button" disabled={!hasModel && !thumbnailUrl} onClick={(event) => { event.stopPropagation(); openAsset(); }} className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-slate-50 ${hasModel || thumbnailUrl ? 'cursor-pointer border-cyan-200 hover:border-cyan-500' : 'cursor-default border-slate-100'}`} title={hasModel ? (language === 'zh' ? '点击解析 3D 模型' : 'Click to inspect 3D model') : thumbnailUrl ? (language === 'zh' ? '点击查看大图' : 'Click to view image') : undefined}>{thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center"><Layers3 className="h-6 w-6 text-slate-300" /></div>}{hasModel ? <span className="absolute bottom-0 left-0 right-0 bg-[#0b4f9c]/90 py-0.5 text-center text-[9px] font-black text-white">3D</span> : null}</button><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-black ${hasModel ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{hasModel ? (language === 'zh' ? '模型已生成' : 'Model ready') : (language === 'zh' ? '模型未生成' : 'Model not generated')}</span></div>;
}

function GiftImagePreviewModal({ url, language, onClose }: { url: string; language: GiftLanguage; onClose: () => void }) {
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/70 p-5 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={language === 'zh' ? '图片预览' : 'Image preview'} className="relative max-h-[90vh] max-w-[92vw] overflow-hidden rounded-xl bg-white p-3 shadow-2xl"><button type="button" onClick={onClose} className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:bg-white" title={language === 'zh' ? '关闭' : 'Close'}><X className="h-5 w-5" /></button><img src={url} alt={language === 'zh' ? '申请图片预览' : 'Request image preview'} className="max-h-[84vh] max-w-[88vw] rounded-lg object-contain" /></div></div>;
}

function AiAccessNotice({ employee, t, onUpdated }: { employee: GiftEmployee; t: GiftCopy; onUpdated: (employee: GiftEmployee) => void }) {
  const [reason, setReason] = useState(employee.applicationReason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const content = employee.approvalStatus === 'rejected'
    ? { title: t.aiRejectedTitle, description: t.aiRejectedDescription, tone: 'border-red-200 bg-red-50 text-red-900' }
    : employee.approvalStatus === 'suspended'
      ? { title: t.aiSuspendedTitle, description: t.aiSuspendedDescription, tone: 'border-slate-300 bg-slate-50 text-slate-800' }
      : { title: t.aiPendingTitle, description: t.aiPendingDescription, tone: 'border-amber-200 bg-amber-50 text-amber-900' };
  async function submitApplication() {
    if (reason.trim().length < 5) return;
    setSaving(true); setError(null);
    try {
      const response = await fetch('/api/gift/auth/application', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      const payload = await response.json() as { employee?: GiftEmployee; message?: string };
      if (!response.ok || !payload.employee) throw new Error(payload.message || 'Unable to submit application.');
      onUpdated(payload.employee);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : 'Unable to submit application.'); } finally { setSaving(false); }
  }
  return (
    <section id="ai-generate" className={`rounded-2xl border p-6 shadow-sm md:p-8 ${content.tone}`}>
      <div className="flex items-start gap-4"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/80"><Clock3 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><h2 className="text-xl font-black">{content.title}</h2><p className="mt-2 max-w-3xl text-sm font-medium leading-6 opacity-80">{content.description}</p>{employee.approvalNote ? <p className="mt-3 text-xs font-bold opacity-70">{employee.approvalNote}</p> : null}{employee.applicationReason && employee.approvalStatus === 'pending' ? <p className="mt-4 rounded-lg bg-white/70 p-3 text-xs font-bold">{t.aiApplicationSubmitted}<span className="mt-1 block font-medium opacity-75">{employee.applicationReason}</span></p> : null}{employee.approvalStatus !== 'suspended' && (!employee.applicationReason || employee.approvalStatus === 'rejected') ? <div className="mt-5 max-w-2xl"><label className="text-xs font-black">{t.aiApplicationLabel}<textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} placeholder={t.aiApplicationPlaceholder} className="mt-2 w-full rounded-lg border border-current/15 bg-white p-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-cyan-200" /></label>{error ? <p className="mt-2 text-xs font-bold text-red-700">{error}</p> : null}<button type="button" disabled={saving || reason.trim().length < 5} onClick={() => void submitApplication()} className="mt-3 h-10 rounded-md bg-[#0b4f9c] px-4 text-xs font-black text-white disabled:opacity-50">{saving ? t.aiApplicationSaving : t.aiApplicationButton}</button></div> : null}</div></div>
    </section>
  );
}

function GiftDashboard({ language, t, employee, onLogout, onEmployeeUpdated }: { language: GiftLanguage; t: GiftCopy; employee: GiftEmployee; onLogout: () => void; onEmployeeUpdated: (employee: GiftEmployee) => void }) {
  const [selectedModel, setSelectedModel] = useState<GiftModel | null>(null);
  const [catalogPreviewModel, setCatalogPreviewModel] = useState<GeneratedGiftModel | null>(null);
  const [requestPreviewModel, setRequestPreviewModel] = useState<GeneratedGiftModel | null>(null);
  const [requestPreviewImage, setRequestPreviewImage] = useState<string | null>(null);
  const [requestRefreshKey, setRequestRefreshKey] = useState(0);
  const [myRequestsExpanded, setMyRequestsExpanded] = useState(false);
  const [draftResume, setDraftResume] = useState<GiftDraftResume | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showBusinessRequest, setShowBusinessRequest] = useState(false);
  const [models, setModels] = useState<GiftModel[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<{ slug: string; nameZh: string; nameEn: string | null }[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const labels = studioCopy[language];

  useEffect(() => {
    let active = true;
    setCatalogLoading(true); setCatalogError('');
    fetch('/api/gift/catalog', { cache: 'no-store', credentials: 'same-origin' }).then(async (response) => {
      const result = await response.json() as { models?: { id: number; slug: string; titleZh: string; titleEn: string | null; descriptionZh: string | null; descriptionEn: string | null; category: string; categoryNameZh: string; categoryNameEn: string | null; useCase: string | null; supportedFinishes: string[]; previewAssetId: number | null; previewModelAssetId: number | null; modelAssetId: number | null; modelFormat: string | null }[]; categories?: { slug: string; nameZh: string; nameEn: string | null }[]; message?: string };
      if (!response.ok) throw new Error(result.message || '礼品库加载失败');
      if (!active) return;
      const categories = result.categories || [];
      setCatalogCategories(categories.some((item) => item.slug === 'culture') ? categories : [{ slug: 'culture', nameZh: '文化礼赠', nameEn: 'Cultural gift' }, ...categories]);
      const catalogModels: GiftModel[] = (result.models || []).filter((model) => model.slug !== 'uphill-tiger').map((model, index) => {
        const paint = model.supportedFinishes.includes('paint');
        const bronze = model.supportedFinishes.includes('bronze');
        return {
          id: model.id, name: language === 'zh' ? model.titleZh : model.titleEn || model.titleZh,
          description: language === 'zh' ? model.descriptionZh || '' : model.descriptionEn || model.descriptionZh || '',
          category: model.category, categoryLabel: language === 'zh' ? model.categoryNameZh : model.categoryNameEn || model.categoryNameZh,
          useCase: model.useCase || (language === 'zh' ? '公司业务打印' : 'Business print'),
          finishLabel: paint && bronze ? (language === 'zh' ? '单色喷漆 / 铜做旧' : 'Paint / antique bronze') : bronze ? (language === 'zh' ? '铜做旧' : 'Antique bronze') : (language === 'zh' ? '单色喷漆' : 'Monochrome paint'),
          finish: paint && bronze ? 'both' : bronze ? 'bronze' : 'paint',
          color: ['from-[#083f7e] to-[#22d3ee]', 'from-[#7c3f15] to-[#d6a15f]', 'from-[#164e63] to-[#38bdf8]'][index % 3],
          accent: model.slug.slice(0, 4).toUpperCase(), previewAssetId: model.previewAssetId, previewModelAssetId: model.previewModelAssetId, modelAssetId: model.modelAssetId,
          modelUrl: model.modelAssetId ? `/api/gift/assets/${model.modelAssetId}` : undefined,
          previewModelUrl: model.previewModelAssetId ? `/api/gift/assets/${model.previewModelAssetId}` : undefined,
          previewModelType: model.previewModelAssetId ? 'glb' : undefined,
          modelType: ['stl', 'glb', 'gltf'].includes(model.modelFormat || '') ? model.modelFormat as GeneratedGiftModel['modelType'] : 'stl',
        };
      });
      setModels([...featuredGiftModels(language), ...catalogModels]);
    }).catch((loadError) => { if (active) setCatalogError(loadError instanceof Error ? loadError.message : '礼品库加载失败'); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [language]);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleModels = models.filter((model) => {
    const matchesCategory = category === 'all' || model.category === category;
    const matchesSearch = !normalizedSearch || `${model.name} ${model.description} ${model.useCase} ${model.categoryLabel}`.toLocaleLowerCase().includes(normalizedSearch);
    return matchesCategory && matchesSearch;
  });
  const categories = [{ id: 'all', label: labels.all }, ...catalogCategories.map((item) => ({ id: item.slug, label: language === 'zh' ? item.nameZh : item.nameEn || item.nameZh }))];

  function resumeDraft(draft: GiftDraftResume) {
    setDraftResume(draft);
    setMyRequestsExpanded(false);
    window.setTimeout(() => document.getElementById('ai-generate')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  return (
    <>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black text-cyan-700"><BadgeCheck className="h-4 w-4" />{labels.eyebrow}</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-sm font-bold text-slate-500">{t.hello}{language === 'zh' ? '，' : ', '}{employee.name}</span><span className="text-xs text-slate-300">·</span><a href="#my-requests" onClick={(event) => { event.preventDefault(); setMyRequestsExpanded(true); window.history.replaceState(null, '', '#my-requests'); window.setTimeout(() => document.getElementById('my-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className="text-xs font-medium text-[#0b4f9c]">{labels.orders}</a>{employee.approvalStatus === 'approved' ? <><span className="text-xs text-slate-300">·</span><span className="text-xs font-medium text-slate-500">{t.quotaToday}：{employee.quota.renderUsed}/{employee.quota.renderDailyLimit} · 3D {employee.quota.modelUsed}/{employee.quota.modelDailyLimit}</span></> : null}</div>
          </div>
          <div className="flex items-center gap-2">
            {employee.role === 'admin' ? <Link href={process.env.NODE_ENV === 'production' ? 'https://ops.unionam.com' : '/ops'} className="inline-flex h-9 items-center gap-2 rounded-md border-2 border-red-400 px-3 text-xs font-black text-red-500 transition hover:bg-red-50" data-umami-event="gift_admin_portal_click"><ShieldCheck className="h-4 w-4" />{t.adminPortal}<ChevronRight className="h-4 w-4" /></Link> : null}
            <button type="button" onClick={onLogout} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-500 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-[#0b4f9c]" data-umami-event="gift_logout_click"><LogOut className="h-4 w-4" />{t.logout}</button>
          </div>
        </div>
      </section>

      <section id="gift-library" className="mx-auto max-w-[1480px] px-5 pb-8 pt-8 md:pt-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">UnionAM Gift Library</div>
              <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 md:text-4xl">{labels.welcome}</h1>
              <p className="mt-3 text-sm font-medium leading-6 text-slate-500 md:text-base">{labels.welcomeDescription}</p>
            </div>
            <a href="#ai-generate" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-4 text-sm font-black text-[#0b4f9c] transition hover:border-cyan-400 hover:bg-cyan-100" data-umami-event="gift_ai_entry_click"><WandSparkles className="h-4 w-4" />{labels.aiTitle}<ChevronRight className="h-4 w-4" /></a>
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-slate-100 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-2xl font-black text-[#0b4f9c]">{labels.libraryTitle}</h2><p className="mt-1 text-sm font-medium text-slate-500">{labels.libraryDescription}</p></div>
            <label className="relative block w-full lg:w-80"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={labels.searchPlaceholder} className="h-11 w-full rounded-md border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100" /></label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">{categories.map((item) => <button key={item.id} type="button" onClick={() => setCategory(item.id)} className={`rounded-full border px-4 py-2 text-xs font-black transition ${category === item.id ? 'border-[#0b4f9c] bg-[#0b4f9c] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 hover:text-[#0b4f9c]'}`}>{item.label}</button>)}</div>

          {catalogError ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-sm font-bold text-red-700">{catalogError}</div> : null}
          {catalogLoading ? <div className="mt-6 grid min-h-40 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-[#0b4f9c]" /></div> : visibleModels.length > 0 ? <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visibleModels.map((model) => <ModelCard key={model.id} model={model} t={t} labels={labels} onOrder={setSelectedModel} onPreview={(selected) => selected.modelUrl && setCatalogPreviewModel({ jobId: `catalog:${selected.id}`, modelUrl: selected.modelUrl, modelType: selected.modelType || 'stl', fileName: `${selected.name}.${selected.modelType || 'stl'}`, modelAssetId: selected.modelAssetId || undefined, previewAssetId: selected.previewAssetId || undefined, previewImageUrl: selected.previewUrls?.[0] || (selected.previewAssetId ? `/api/gift/assets/${selected.previewAssetId}` : undefined), previewModelAssetId: selected.previewModelAssetId || undefined, previewModelUrl: selected.previewModelUrl, previewModelType: selected.previewModelType })} />)}</div> : <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-sm font-bold text-slate-500">{labels.noResult}</div>}
        </div>
      </section>

      <MyRequestsPanel language={language} refreshKey={requestRefreshKey} expanded={myRequestsExpanded} onExpandedChange={setMyRequestsExpanded} onPreviewModel={setRequestPreviewModel} onPreviewImage={setRequestPreviewImage} onResume={resumeDraft} />

      <section className="mx-auto max-w-[1480px] px-5 py-4">{employee.approvalStatus === 'approved' ? <AiGiftStudio language={language} onOrder={setSelectedModel} onDraftUpdated={() => setRequestRefreshKey((value) => value + 1)} resumeDraft={draftResume} onResumeConsumed={() => setDraftResume(null)} /> : <AiAccessNotice employee={employee} t={t} onUpdated={onEmployeeUpdated} />}</section>

      <section className="mx-auto max-w-[1480px] px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-slate-100 text-[#0b4f9c]"><Factory className="h-5 w-5" /></div><div><h2 className="text-sm font-black text-slate-900">{labels.newRequest}</h2><p className="mt-1 text-xs font-medium leading-5 text-slate-500">{t.businessDescription}</p></div></div>
          <button type="button" onClick={() => setShowBusinessRequest((current) => !current)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-xs font-black text-slate-600 transition hover:border-cyan-300 hover:text-[#0b4f9c]" data-umami-event="gift_business_request_entry_click">{labels.newRequestButton}<ChevronRight className={`h-4 w-4 transition ${showBusinessRequest ? 'rotate-90' : ''}`} /></button>
        </div>
        {showBusinessRequest ? <div className="mt-4"><BusinessRequestPanel t={t} onSubmitted={() => setRequestRefreshKey((value) => value + 1)} /></div> : null}
      </section>

      <footer className="mt-5 border-t border-slate-200 bg-white px-5 py-5"><div className="mx-auto flex max-w-[1480px] flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-medium text-slate-500"><span>© UnionAM</span><span className="text-slate-300">|</span><span>{t.allLocal}</span><span className="text-slate-300">|</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="transition hover:text-[#0b4f9c]">沪ICP备17023219号-18</a><span className="text-slate-300">|</span><a href="https://beian.mps.gov.cn/" target="_blank" rel="noreferrer" className="transition hover:text-[#0b4f9c]">沪公网安备31011702891863号</a></div></footer>

      {selectedModel ? <OrderModal model={selectedModel} t={t} onClose={() => setSelectedModel(null)} onSubmitted={() => setRequestRefreshKey((value) => value + 1)} /> : null}
      {catalogPreviewModel ? <GiftModelModal language={language} model={catalogPreviewModel} onClose={() => setCatalogPreviewModel(null)} /> : null}
      {requestPreviewModel ? <GiftModelModal language={language} model={requestPreviewModel} onClose={() => setRequestPreviewModel(null)} /> : null}
      {requestPreviewImage ? <GiftImagePreviewModal url={requestPreviewImage} language={language} onClose={() => setRequestPreviewImage(null)} /> : null}
    </>
  );
}

type GiftEmployee = {
  id: number;
  userId: string;
  name: string;
  departments: number[];
  departmentNames: string[];
  position: string | null;
  role: 'employee' | 'operator' | 'admin';
  employmentStatus: 'active' | 'inactive';
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'suspended';
  appliedAt: string | null;
  reviewedAt: string | null;
  approvalNote: string | null;
  applicationReason: string | null;
  quota: {
    renderDailyLimit: number;
    editDailyLimit: number;
    modelDailyLimit: number;
    maxConcurrentJobs: number;
    renderUsed: number;
    editUsed: number;
    modelUsed: number;
  };
};

function AuthenticationLoading({ t }: { t: GiftCopy }) {
  return (
    <section className="mx-auto grid min-h-[520px] max-w-[1480px] place-items-center px-5 py-10">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-cyan-100 border-t-[#0b4f9c]" />
        <p className="mt-5 text-sm font-black text-slate-700">{t.authLoading}</p>
      </div>
    </section>
  );
}

export default function GiftPage() {
  const { language, setLanguage, t: headerLabels } = useLanguage();
  const giftLanguage = language as GiftLanguage;
  const t = copy[giftLanguage];
  const [authStatus, setAuthStatus] = useState<'loading' | 'guest' | 'authenticated'>('loading');
  const [employee, setEmployee] = useState<GiftEmployee | null>(null);
  const [loginPending, setLoginPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const navItems = [
    { label: headerLabels.navQuote, href: '/quote' },
    { label: headerLabels.navConverter, href: '/converter' },
    { label: headerLabels.navGift, href: '/gift', active: true, eventName: 'header_gift_click' },
  ];

  useEffect(() => {
    let cancelled = false;
    const queryError = new URLSearchParams(window.location.search).get('auth_error');
    if (queryError) setAuthError(queryError);

    fetch('/api/gift/auth/session', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const payload = (await response.json()) as { authenticated?: boolean; user?: GiftEmployee };
        if (cancelled) return;

        if (response.ok && payload.authenticated && payload.user) {
          setEmployee(payload.user);
          setAuthStatus('authenticated');
        } else {
          setEmployee(null);
          setAuthStatus('guest');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setEmployee(null);
        setAuthStatus('guest');
        setAuthError('login_failed');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function startWeComLogin() {
    setLoginPending(true);
    setAuthError(null);
    window.location.assign('/api/gift/auth/wecom/start');
  }

  async function startDevelopmentLogin() {
    setLoginPending(true);
    setAuthError(null);

    try {
      const loginResponse = await fetch('/api/gift/auth/dev-login', { method: 'POST', credentials: 'same-origin' });
      if (!loginResponse.ok) throw new Error('Development login failed.');

      const sessionResponse = await fetch('/api/gift/auth/session', { cache: 'no-store', credentials: 'same-origin' });
      const payload = (await sessionResponse.json()) as { authenticated?: boolean; user?: GiftEmployee };
      if (!sessionResponse.ok || !payload.authenticated || !payload.user) throw new Error('Development session was not created.');

      setEmployee(payload.user);
      setAuthStatus('authenticated');
    } catch {
      setEmployee(null);
      setAuthStatus('guest');
      setAuthError('login_failed');
    } finally {
      setLoginPending(false);
    }
  }

  async function logout() {
    await fetch('/api/gift/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setEmployee(null);
    setAuthStatus('guest');
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <ToolHeader language={language} labels={headerLabels} logoSrc="/brand/unionam-logo.png" navItems={navItems} onLanguageChange={setLanguage} />
      {authStatus === 'loading' ? <AuthenticationLoading t={t} /> : null}
      {authStatus === 'guest' ? (
        <LoginGate
          t={t}
          language={giftLanguage}
          onLogin={startWeComLogin}
          onDevLogin={startDevelopmentLogin}
          showDevLogin={process.env.NODE_ENV !== 'production'}
          loginPending={loginPending}
          errorCode={authError}
        />
      ) : null}
      {authStatus === 'authenticated' && employee ? <GiftDashboard language={giftLanguage} t={t} employee={employee} onLogout={logout} onEmployeeUpdated={setEmployee} /> : null}
    </main>
  );
}
