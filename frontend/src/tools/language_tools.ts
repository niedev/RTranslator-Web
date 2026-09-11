export function getLanguageName(languageCode: string | undefined | null): string | undefined {
    try {
        const browserLanguage = navigator.languages?.[0] || navigator.language || 'en';
        const languageNames = new Intl.DisplayNames([browserLanguage], { type: 'language' });
        let language = languageCode ? languageNames.of(languageCode) : undefined;
        if (language) {
        // Capitalize the first letter and keep the rest of the string intact
        return language.charAt(0).toUpperCase() + language.slice(1);
        } else {
        return undefined;
        }
    } catch (e) {
        return undefined;
    }
}