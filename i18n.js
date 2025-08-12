document.addEventListener('DOMContentLoaded', () => {
  const languageSelect = document.getElementById('language-select');

  const getPreferredLanguage = () => {
    const storedLang = localStorage.getItem('language');
    if (storedLang) {
      return storedLang;
    }
    return navigator.language.split('-')[0] || 'es';
  };

  const setLanguage = async (lang) => {
    const response = await fetch(`locales/${lang}.json`);
    const translations = await response.json();

    document.querySelectorAll('[data-i18n-key]').forEach(element => {
      const key = element.getAttribute('data-i18n-key');
      if (translations[key]) {
        const translation = translations[key];

        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          if(element.placeholder) {
            element.placeholder = translation;
          }
        } else if (element.hasAttribute('title')) {
            element.title = translation;
        } else if (element.hasAttribute('aria-label')) {
            element.setAttribute('aria-label', translation);
        } else {
            // Only update textContent if there are no child elements (like icons)
            if (element.children.length === 0) {
                element.textContent = translation;
            }
        }
      }
    });
    document.documentElement.lang = lang;
    localStorage.setItem('language', lang);
    languageSelect.value = lang;
  };

  languageSelect.addEventListener('change', (event) => {
    setLanguage(event.target.value);
  });

  setLanguage(getPreferredLanguage());
});
