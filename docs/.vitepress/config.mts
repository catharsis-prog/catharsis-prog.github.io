import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Catharsis",
  description: "Учебники по программированию",

  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Java', link: '/java/' }
    ],

    sidebar: {
      '/java/': [
        {
          text: 'Java',
          items: [
            { text: 'Введение', link: '/java/' }
          ]
        },
        {
          text: 'Многопоточность',
          items: [
            { text: 'О разделе', link: '/java/concurrency/' },
            {
              text: 'Модуль 1. Основы потоков',
              collapsed: false,
              items: [
                { text: '1.1. Что такое поток и зачем он нужен', link: '/java/concurrency/01-basics/01-what-is-thread' },
                { text: '1.2. Создание потока: Thread vs Runnable', link: '/java/concurrency/01-basics/02-thread-vs-runnable' },
                { text: '1.3. start() vs run()', link: '/java/concurrency/01-basics/03-start-vs-run' }
              ]
            }
          ]
        }
      ]
    }
  },

  transformHead({ assets }) {
    const fontFile = assets.find(file => /CascadiaCode-Regular.*\.(woff2|ttf)$/.test(file))
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