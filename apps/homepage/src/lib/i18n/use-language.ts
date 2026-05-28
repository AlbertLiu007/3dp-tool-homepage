'use client';

import { useEffect, useState } from 'react';
import { dictionaries, type Language } from './dictionaries';

const STORAGE_KEY = 'unionam-tool-homepage.language';

export function useLanguage() {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(STORAGE_KEY);
    if (savedLanguage === 'zh' || savedLanguage === 'en') setLanguageState(savedLanguage);
  }, []);

  function setLanguage(nextLanguage: Language) {
    setLanguageState(nextLanguage);
    window.localStorage.setItem(STORAGE_KEY, nextLanguage);
  }

  return {
    language,
    setLanguage,
    t: dictionaries[language],
  };
}
