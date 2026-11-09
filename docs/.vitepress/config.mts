import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ru-RU',
  title: 'Catharsis',
  description: 'Программирование с восторгом',
  cleanUrls: true,
  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: 'Главная', link: '/' },
      { text: 'Java', link: '/java/' },
      {
        text: 'GitHub',
        link: 'https://github.com/catharsis-prog/catharsis-prog.github.io',
      },
    ],

    sidebar: {
      '/java/': [
        {
          text: 'Java',
          items: [
            { text: 'О курсе', link: '/java/' },
          ],
        },

        {
          text: 'ООП',
          collapsed: false,
          items: [
            { text: 'Введение в раздел', link: '/java/oop/' },

            {
              text: 'Модуль 1. Классы и объекты',
              collapsed: true,
              items: [
                { text: '1. Зачем нужно ООП', link: '/java/oop/01-classes-and-objects/01-zachem-nuzhno-oop' },
                { text: '2. Класс как чертёж, объект как вещь', link: '/java/oop/01-classes-and-objects/02-klass-i-obekt' },
                { text: '3. Поля и методы', link: '/java/oop/01-classes-and-objects/03-polya-i-metody' },
                { text: '4. Конструкторы', link: '/java/oop/01-classes-and-objects/04-konstruktory' },
                { text: '5. Ссылки и null', link: '/java/oop/01-classes-and-objects/05-ssylki-i-null' },
                { text: '6. static', link: '/java/oop/01-classes-and-objects/06-static' },
                { text: '7. Мусор и finalize', link: '/java/oop/01-classes-and-objects/07-musor-i-finalize' },
                { text: 'Практикум', link: '/java/oop/01-classes-and-objects/practice' },
                { text: 'Разбор практикума', link: '/java/oop/01-classes-and-objects/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 2. Инкапсуляция',
              collapsed: true,
              items: [
                { text: '8. Зачем скрывать данные', link: '/java/oop/02-encapsulation/01-zachem-skryvat-dannye' },
                { text: '9. Модификаторы доступа', link: '/java/oop/02-encapsulation/02-modifikatory-dostupa' },
                { text: '10. Геттеры и сеттеры', link: '/java/oop/02-encapsulation/03-gettery-i-settery' },
                { text: '11. Валидация в сеттерах', link: '/java/oop/02-encapsulation/04-validaciya' },
                { text: '12. Неизменяемые объекты', link: '/java/oop/02-encapsulation/05-neizmenyaemye-obekty' },
                { text: '13. Обёртки и record', link: '/java/oop/02-encapsulation/06-obolochki-i-record' },
                { text: 'Практикум', link: '/java/oop/02-encapsulation/practice' },
                { text: 'Разбор практикума', link: '/java/oop/02-encapsulation/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 3. Наследование',
              collapsed: true,
              items: [
                { text: '14. «Is-a»: когда наследование уместно', link: '/java/oop/03-inheritance/01-is-a' },
                { text: '15. extends', link: '/java/oop/03-inheritance/02-extends' },
                { text: '16. super', link: '/java/oop/03-inheritance/03-super' },
                { text: '17. Переопределение методов', link: '/java/oop/03-inheritance/04-pereopredelenie' },
                { text: '18. final в наследовании', link: '/java/oop/03-inheritance/05-final' },
                { text: '19. Абстрактные классы', link: '/java/oop/03-inheritance/06-abstraktnye-klassy' },
                { text: '20. Когда наследование — плохая идея', link: '/java/oop/03-inheritance/07-kogda-nasledovanie-ploho' },
                { text: 'Практикум', link: '/java/oop/03-inheritance/practice' },
                { text: 'Разбор практикума', link: '/java/oop/03-inheritance/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 4. Полиморфизм',
              collapsed: true,
              items: [
                { text: '21. Один интерфейс — много поведений', link: '/java/oop/04-polymorphism/01-odin-interfeys-mnogo-povedeniy' },
                { text: '22. Динамическое связывание', link: '/java/oop/04-polymorphism/02-dinamicheskoe-svyazyvanie' },
                { text: '23. Интерфейсы', link: '/java/oop/04-polymorphism/03-interfeysy' },
                { text: '24. default-методы', link: '/java/oop/04-polymorphism/04-default-metody' },
                { text: '25. Полиморфизм в коллекциях', link: '/java/oop/04-polymorphism/05-polimorfizm-v-kollekciyah' },
                { text: '26. Приведение типов и instanceof', link: '/java/oop/04-polymorphism/06-privedenie-tipov' },
                { text: '27. Паттерн «Стратегия»', link: '/java/oop/04-polymorphism/07-strategiya' },
                { text: 'Практикум', link: '/java/oop/04-polymorphism/practice' },
                { text: 'Разбор практикума', link: '/java/oop/04-polymorphism/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 5. Композиция и интерфейсы',
              collapsed: true,
              items: [
                { text: '28. Композиция vs наследование', link: '/java/oop/05-composition/01-kompoziciya-vs-nasledovanie' },
                { text: '29. Агрегация и композиция', link: '/java/oop/05-composition/02-agregaciya-i-kompoziciya' },
                { text: '30. Делегирование', link: '/java/oop/05-composition/03-delegirovanie' },
                { text: '31. Интерфейсы как способ развязать руки', link: '/java/oop/05-composition/04-interfeysy-kak-sposob-razvyazat-ruki' },
                { text: '32. Dependency Injection на пальцах', link: '/java/oop/05-composition/05-dependency-injection' },
                { text: '33. Паттерн «Фасад»', link: '/java/oop/05-composition/06-fasad' },
                { text: 'Практикум', link: '/java/oop/05-composition/practice' },
                { text: 'Разбор практикума', link: '/java/oop/05-composition/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 6. Проектирование и SOLID',
              collapsed: true,
              items: [
                { text: '34. Зачем нужны принципы', link: '/java/oop/06-design-and-solid/01-zachem-nuzhny-principy' },
                { text: '35. SRP', link: '/java/oop/06-design-and-solid/02-srp' },
                { text: '36. OCP', link: '/java/oop/06-design-and-solid/03-ocp' },
                { text: '37. LSP', link: '/java/oop/06-design-and-solid/04-lsp' },
                { text: '38. ISP', link: '/java/oop/06-design-and-solid/05-isp' },
                { text: '39. DIP', link: '/java/oop/06-design-and-solid/06-dip' },
                { text: '40. Собираем всё вместе', link: '/java/oop/06-design-and-solid/07-sobiraem-vse-vmeste' },
                { text: 'Практикум', link: '/java/oop/06-design-and-solid/practice' },
                { text: 'Разбор практикума', link: '/java/oop/06-design-and-solid/practice-solutions' },
              ],
            },
          ],
        },

        {
          text: 'Многопоточность',
          collapsed: false,
          items: [
            { text: 'Введение в раздел', link: '/java/concurrency/' },

            {
              text: 'Модуль 1. Основы потоков',
              collapsed: true,
              items: [
                { text: '1. Что такое поток', link: '/java/concurrency/01-basics/01-what-is-thread' },
                { text: '2. Thread и Runnable', link: '/java/concurrency/01-basics/02-thread-vs-runnable' },
                { text: '3. start() и run()', link: '/java/concurrency/01-basics/03-start-vs-run' },
                { text: '4. Жизненный цикл потока', link: '/java/concurrency/01-basics/04-lifecycle' },
                { text: '5. sleep, join, yield', link: '/java/concurrency/01-basics/05-sleep-join-yield' },
                { text: '6. Прерывания', link: '/java/concurrency/01-basics/06-interrupt' },
                { text: '7. Имя, приоритет, currentThread', link: '/java/concurrency/01-basics/07-name-priority-current' },
                { text: '8. Демон-потоки', link: '/java/concurrency/01-basics/08-daemon' },
                { text: 'Практикум', link: '/java/concurrency/01-basics/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/01-basics/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 2. Синхронизация',
              collapsed: true,
              items: [
                { text: '1. Состояние гонки', link: '/java/concurrency/02-synchronization/01-race-condition' },
                { text: '2. synchronized', link: '/java/concurrency/02-synchronization/02-synchronized' },
                { text: '3. synchronized на классе и объекте', link: '/java/concurrency/02-synchronization/03-synchronized-class-vs-object' },
                { text: '4. volatile', link: '/java/concurrency/02-synchronization/04-volatile' },
                { text: '5. JMM и happens-before', link: '/java/concurrency/02-synchronization/05-jmm-happens-before' },
                { text: '6. Атомарные классы', link: '/java/concurrency/02-synchronization/06-atomic-classes' },
                { text: '7. Дедлок', link: '/java/concurrency/02-synchronization/07-deadlock' },
                { text: '8. Лайвлок и голодание', link: '/java/concurrency/02-synchronization/08-livelock-starvation' },
                { text: '9. wait и notify', link: '/java/concurrency/02-synchronization/09-wait-notify' },
                { text: 'Практикум', link: '/java/concurrency/02-synchronization/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/02-synchronization/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 3. Координация',
              collapsed: true,
              items: [
                { text: '1. CountDownLatch', link: '/java/concurrency/03-coordination/01-countdown-latch' },
                { text: '2. CyclicBarrier', link: '/java/concurrency/03-coordination/02-cyclic-barrier' },
                { text: '3. Semaphore', link: '/java/concurrency/03-coordination/03-semaphore' },
                { text: '4. Exchanger и Phaser', link: '/java/concurrency/03-coordination/04-exchanger-phaser' },
                { text: '5. Lock и Condition', link: '/java/concurrency/03-coordination/05-lock-condition' },
                { text: 'Практикум', link: '/java/concurrency/03-coordination/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/03-coordination/practice-solutions' },
              ],
            },
          ],
        },
      ],
    },

    outline: {
      label: 'Содержание',
      level: [2, 3],
    },
    docFooter: {
      prev: 'Назад',
      next: 'Вперёд',
    },
    returnToTopLabel: 'Наверх',
    sidebarMenuLabel: 'Меню',
    darkModeSwitchLabel: 'Тема',
    //lastUpdatedText: 'Обновлено',
    notFound: {
      title: 'Здесь пусто',
      quote: 'Кажется, этой страницы ещё нет. Или она была, но её унесли.',
      linkLabel: 'На главную',
      linkText: 'Вернуться на главную',
    },
  },
})