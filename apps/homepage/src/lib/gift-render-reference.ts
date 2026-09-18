export const renderReferencePurposes = [
  { id: 'auto', zh: '自动识别', en: 'Auto detect', description: 'the visually relevant attributes described by the edit request' },
  { id: 'subject_identity', zh: '人物／主体外观', en: 'Person / subject', description: 'the identity and overall appearance of the person or main subject' },
  { id: 'facial_features', zh: '面部特征', en: 'Facial features', description: 'facial features and likeness' },
  { id: 'facial_expression', zh: '面部表情', en: 'Facial expression', description: 'facial expression' },
  { id: 'hairstyle', zh: '发型', en: 'Hairstyle', description: 'hairstyle and hair details' },
  { id: 'clothing_accessories', zh: '服装与配饰', en: 'Clothing & accessories', description: 'clothing and accessories' },
  { id: 'pose_composition', zh: '姿势与构图', en: 'Pose & composition', description: 'pose and composition' },
  { id: 'material_color', zh: '材质与颜色', en: 'Material & color', description: 'materials and colors' },
  { id: 'overall_style', zh: '整体风格', en: 'Overall style', description: 'overall visual style' },
  { id: 'background_scene', zh: '背景与场景', en: 'Background & scene', description: 'background and scene' },
  { id: 'text_logo', zh: '文字与标识', en: 'Text & logos', description: 'text and logos' },
] as const;

export type RenderReferencePurpose = (typeof renderReferencePurposes)[number]['id'];

const allowedPurposes = new Set<string>(renderReferencePurposes.map(({ id }) => id));

export function parseRenderReferencePurposes(value: unknown, count: number): RenderReferencePurpose[][] | null {
  if (!Array.isArray(value) || value.length !== count) return null;
  const purposes = value.map((entry) => typeof entry === 'string' ? [entry] : entry);
  if (purposes.some((entry) => !Array.isArray(entry) || entry.length < 1 || entry.length > renderReferencePurposes.length ||
    entry.some((purpose) => typeof purpose !== 'string' || !allowedPurposes.has(purpose)) ||
    new Set(entry).size !== entry.length || (entry.includes('auto') && entry.length !== 1))) return null;
  return purposes as RenderReferencePurpose[][];
}

export function toggleRenderReferencePurpose(current: RenderReferencePurpose[], purpose: RenderReferencePurpose): RenderReferencePurpose[] {
  if (purpose === 'auto') return ['auto'];
  const selected = current.filter((item) => item !== 'auto');
  const next = selected.includes(purpose) ? selected.filter((item) => item !== purpose) : [...selected, purpose];
  return next.length ? next : ['auto'];
}

export function isPersonRenderReference(purposes: RenderReferencePurpose[]) {
  return purposes.some((purpose) => ['subject_identity', 'facial_features', 'facial_expression', 'hairstyle'].includes(purpose));
}
