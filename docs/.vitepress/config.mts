import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Catharsis Prog",
  description: "Учебники по программированию",

  appearance: true, // переключатель темы остаётся; светлая — инвертированная

  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Java', link: '/java/' },
      { text: 'О проекте', link: '/about' }
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
                { text: '1.3. start() vs run()', link: '/java/concurrency/01-basics/03-start-vs-run' },
                { text: '1.4. Жизненный цикл потока', link: '/java/concurrency/01-basics/04-lifecycle' },
                { text: '1.5. sleep(), join(), yield()', link: '/java/concurrency/01-basics/05-sleep-join-yield' },
                { text: '1.6. Прерывание потоков', link: '/java/concurrency/01-basics/06-interrupt' },
                { text: '1.7. Имена, приоритеты, currentThread()', link: '/java/concurrency/01-basics/07-name-priority-current' },
                { text: '1.8. Демон-потоки', link: '/java/concurrency/01-basics/08-daemon' },
                { text: 'Практикум', link: '/java/concurrency/01-basics/practice' },
                { text: 'Разборы практикума', link: '/java/concurrency/01-basics/practice-solutions' }
              ]
            },
            {
              text: 'Модуль 2. Синхронизация',
              collapsed: false,
              items: [
                { text: '2.1. Гонка данных', link: '/java/concurrency/02-synchronization/01-race-condition' },
                { text: '2.2. Критическая секция и synchronized', link: '/java/concurrency/02-synchronization/02-synchronized' },
                { text: '2.3. synchronized на уровне класса и объекта', link: '/java/concurrency/02-synchronization/03-synchronized-class-vs-object' },
                { text: '2.4. volatile', link: '/java/concurrency/02-synchronization/04-volatile' },
                { text: '2.5. Модель памяти Java и happens-before', link: '/java/concurrency/02-synchronization/05-jmm-happens-before' },
                { text: '2.6. Атомарные классы', link: '/java/concurrency/02-synchronization/06-atomic-classes' },
                { text: '2.7. Deadlock', link: '/java/concurrency/02-synchronization/07-deadlock' },
                { text: '2.8. Livelock и starvation', link: '/java/concurrency/02-synchronization/08-livelock-starvation' },
                { text: '2.9. wait(), notify(), notifyAll()', link: '/java/concurrency/02-synchronization/09-wait-notify' },
                { text: 'Практикум', link: '/java/concurrency/02-synchronization/practice' },
                { text: 'Разборы практикума', link: '/java/concurrency/02-synchronization/practice-solutions' }
              ]
            },
            {
              text: 'Модуль 3. Высокоуровневая координация',
              collapsed: false,
              items: [
                { text: '3.1. CountDownLatch', link: '/java/concurrency/03-coordination/01-countdown-latch' }
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