(function () {
    try {
        let cachedTheme = localStorage.getItem('cm_theme_cache');
        
        if (cachedTheme !== 'dark' && cachedTheme !== 'light') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            cachedTheme = prefersDark ? 'dark' : 'light';
            localStorage.setItem('cm_theme_cache', cachedTheme);
            
            // Optionally sync with chrome storage if available
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({ sys_theme: cachedTheme });
            }
        }

        const root = document.documentElement;
        root.dataset.theme = cachedTheme;
        root.classList.toggle('dark-theme', cachedTheme === 'dark');

        if (cachedTheme === 'dark') {
            root.style.backgroundColor = '#2c3e50'; // Reverted to original color

            const preloadStyle = document.createElement('style');
            preloadStyle.id = 'cm-theme-preload-style';
            preloadStyle.textContent = 'body{background-color:#2c3e50 !important;}'; // Reverted to original color
            document.head.appendChild(preloadStyle);
        }
    } catch (error) {
        /* no-op */
    }
})();
