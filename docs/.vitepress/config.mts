import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Catharsis",
  description: "Учебники по программированию",
  base: '/',

  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Java', link: '/java/' }
    ],

    sidebar: {
      // Эта панель будет показана, когда пользователь находится в разделе /java/
      '/java/': [
        {
          text: 'Java',
          items: [
            { text: 'Введение', link: '/java/' },
            { text: 'Многопоточность', link: '/java/concurrency/' },
            { text: 'Основы потоков', link: '/java/concurrency/threads-basics' }
            // ... другие уроки
          ]
        }
      ]
      // Сюда можно добавить панель для Python в будущем:
      // '/python/': [ ... ]
    }
  },
  transformHead({ assets }) {
    const fontFile = assets.find(file =>
      /CascadiaCode-Regular.*\.(woff2|ttf)$/.test(file)
    )
    if (fontFile) {
      return [[
        'link',
        {
          rel: 'preload',
          href: fontFile,
          as: 'font',
          type: fontFile.endsWith('.woff2') ? 'font/woff2' : 'font/ttf',
          crossorigin: ''
        }
      ]]
    }
  }
})