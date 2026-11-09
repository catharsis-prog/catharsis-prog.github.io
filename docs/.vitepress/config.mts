import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ru-RU',
  title: 'Catharsis',
  description: 'Программирование с восторгом',
  cleanUrls: true,
  lastUpdated: true,

  // Временные исключения для ещё не написанных уроков.
  // Как только модуль появляется — уберите соответствующее правило,
  // иначе перестанете замечать настоящие опечатки в путях этого модуля.
  ignoreDeadLinks: [
    /\/07-advanced\//,
  ],

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

        // ============================================================
        // ООП
        // ============================================================

        {
          text: 'ООП',
          collapsed: false,
          items: [
            { text: 'Введение в раздел', link: '/java/oop/' },

            {
              text: 'Модуль 1. Классы и объекты',
              collapsed: true,
              items: [
                { text: '1. Зачем нужно ООП', link: '/java/oop/01-classes-and-objects/01-why-oop' },
                { text: '2. Класс как чертёж, объект как вещь', link: '/java/oop/01-classes-and-objects/02-class-vs-object' },
                { text: '3. Поля и методы', link: '/java/oop/01-classes-and-objects/03-fields-and-methods' },
                { text: '4. Конструкторы', link: '/java/oop/01-classes-and-objects/04-constructors' },
                { text: '5. Ссылки и null', link: '/java/oop/01-classes-and-objects/05-references-and-null' },
                { text: '6. static', link: '/java/oop/01-classes-and-objects/06-static' },
                { text: '7. Мусор и finalize', link: '/java/oop/01-classes-and-objects/07-garbage-and-finalize' },
                { text: 'Практикум', link: '/java/oop/01-classes-and-objects/practice' },
                { text: 'Разбор практикума', link: '/java/oop/01-classes-and-objects/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 2. Инкапсуляция',
              collapsed: true,
              items: [
                { text: '1. Зачем скрывать данные', link: '/java/oop/02-encapsulation/01-why-hide-data' },
                { text: '2. Модификаторы доступа', link: '/java/oop/02-encapsulation/02-access-modifiers' },
                { text: '3. Геттеры и сеттеры', link: '/java/oop/02-encapsulation/03-getters-and-setters' },
                { text: '4. Валидация в сеттерах', link: '/java/oop/02-encapsulation/04-validation' },
                { text: '5. Неизменяемые объекты', link: '/java/oop/02-encapsulation/05-immutable-objects' },
                { text: '6. Обёртки и record', link: '/java/oop/02-encapsulation/06-wrappers-and-record' },
                { text: 'Практикум', link: '/java/oop/02-encapsulation/practice' },
                { text: 'Разбор практикума', link: '/java/oop/02-encapsulation/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 3. Наследование',
              collapsed: true,
              items: [
                { text: '1. «Is-a»: когда наследование уместно', link: '/java/oop/03-inheritance/01-is-a' },
                { text: '2. extends', link: '/java/oop/03-inheritance/02-extends' },
                { text: '3. super', link: '/java/oop/03-inheritance/03-super' },
                { text: '4. Переопределение методов', link: '/java/oop/03-inheritance/04-overriding' },
                { text: '5. final в наследовании', link: '/java/oop/03-inheritance/05-final-in-inheritance' },
                { text: '6. Абстрактные классы', link: '/java/oop/03-inheritance/06-abstract-classes' },
                { text: '7. Когда наследование — плохая идея', link: '/java/oop/03-inheritance/07-when-inheritance-is-wrong' },
                { text: 'Практикум', link: '/java/oop/03-inheritance/practice' },
                { text: 'Разбор практикума', link: '/java/oop/03-inheritance/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 4. Полиморфизм',
              collapsed: true,
              items: [
                { text: '1. Один интерфейс — много поведений', link: '/java/oop/04-polymorphism/01-one-interface-many-behaviors' },
                { text: '2. Динамическое связывание', link: '/java/oop/04-polymorphism/02-dynamic-binding' },
                { text: '3. Интерфейсы', link: '/java/oop/04-polymorphism/03-interfaces' },
                { text: '4. default-методы', link: '/java/oop/04-polymorphism/04-default-methods' },
                { text: '5. Полиморфизм в коллекциях', link: '/java/oop/04-polymorphism/05-polymorphism-in-collections' },
                { text: '6. Приведение типов и instanceof', link: '/java/oop/04-polymorphism/06-type-casting' },
                { text: '7. Паттерн «Стратегия»', link: '/java/oop/04-polymorphism/07-strategy-pattern' },
                { text: 'Практикум', link: '/java/oop/04-polymorphism/practice' },
                { text: 'Разбор практикума', link: '/java/oop/04-polymorphism/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 5. Композиция и интерфейсы',
              collapsed: true,
              items: [
                { text: '1. Композиция vs наследование', link: '/java/oop/05-composition/01-composition-vs-inheritance' },
                { text: '2. Агрегация и композиция', link: '/java/oop/05-composition/02-aggregation-and-composition' },
                { text: '3. Делегирование', link: '/java/oop/05-composition/03-delegation' },
                { text: '4. Интерфейсы как способ развязать руки', link: '/java/oop/05-composition/04-interfaces-as-decoupling' },
                { text: '5. Dependency Injection на пальцах', link: '/java/oop/05-composition/05-dependency-injection' },
                { text: '6. Паттерн «Фасад»', link: '/java/oop/05-composition/06-facade-pattern' },
                { text: 'Практикум', link: '/java/oop/05-composition/practice' },
                { text: 'Разбор практикума', link: '/java/oop/05-composition/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 6. Проектирование и SOLID',
              collapsed: true,
              items: [
                { text: '1. Зачем нужны принципы', link: '/java/oop/06-design-and-solid/01-why-principles' },
                { text: '2. SRP', link: '/java/oop/06-design-and-solid/02-srp' },
                { text: '3. OCP', link: '/java/oop/06-design-and-solid/03-ocp' },
                { text: '4. LSP', link: '/java/oop/06-design-and-solid/04-lsp' },
                { text: '5. ISP', link: '/java/oop/06-design-and-solid/05-isp' },
                { text: '6. DIP', link: '/java/oop/06-design-and-solid/06-dip' },
                { text: '7. Собираем всё вместе', link: '/java/oop/06-design-and-solid/07-putting-it-all-together' },
                { text: 'Практикум', link: '/java/oop/06-design-and-solid/practice' },
                { text: 'Разбор практикума', link: '/java/oop/06-design-and-solid/practice-solutions' },
              ],
            },
          ],
        },

        // ============================================================
        // Многопоточность
        // ============================================================

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

            {
              text: 'Модуль 4. Пулы потоков',
              collapsed: true,
              items: [
                { text: '1. Зачем нужны пулы потоков', link: '/java/concurrency/04-pools/01-why-pools' },
                { text: '2. ExecutorService и Executors', link: '/java/concurrency/04-pools/02-executor-service' },
                { text: '3. ThreadPoolExecutor изнутри', link: '/java/concurrency/04-pools/03-thread-pool-executor' },
                { text: '4. ScheduledExecutorService', link: '/java/concurrency/04-pools/04-scheduled-executor' },
                { text: '5. Корректное завершение пула', link: '/java/concurrency/04-pools/05-shutdown' },
                { text: '6. ForkJoinPool и RecursiveTask', link: '/java/concurrency/04-pools/06-fork-join-pool' },
                { text: 'Практикум', link: '/java/concurrency/04-pools/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/04-pools/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 5. Потокобезопасные коллекции',
              collapsed: true,
              items: [
                { text: '1. Почему ArrayList и HashMap не потокобезопасны', link: '/java/concurrency/05-collections/01-why-not-thread-safe' },
                { text: '2. ConcurrentHashMap', link: '/java/concurrency/05-collections/02-concurrent-hash-map' },
                { text: '3. CopyOnWriteArrayList', link: '/java/concurrency/05-collections/03-copy-on-write' },
                { text: '4. BlockingQueue и producer-consumer', link: '/java/concurrency/05-collections/04-blocking-queue' },
                { text: '5. Неблокирующие очереди', link: '/java/concurrency/05-collections/05-concurrent-queues' },
                { text: '6. BlockingDeque и SynchronousQueue', link: '/java/concurrency/05-collections/06-blocking-deque' },
                { text: 'Практикум', link: '/java/concurrency/05-collections/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/05-collections/practice-solutions' },
              ],
            },

            {
              text: 'Модуль 6. Асинхронность',
              collapsed: true,
              items: [
                { text: '1. Future и Callable', link: '/java/concurrency/06-async/01-future-callable' },
                { text: '2. CompletableFuture: создание и цепочки', link: '/java/concurrency/06-async/02-completable-future-basics' },
                { text: '3. CompletableFuture: ошибки и таймауты', link: '/java/concurrency/06-async/03-completable-future-errors' },
                { text: '4. Параллельные стримы', link: '/java/concurrency/06-async/04-parallel-streams' },
                { text: 'Практикум', link: '/java/concurrency/06-async/practice' },
                { text: 'Разбор практикума', link: '/java/concurrency/06-async/practice-solutions' },
              ],
            },

            // ------------------------------------------------------
            // Модуль 7. Продвинутое (в разработке)
            // Когда уроки готовы: раскомментируйте блок и уберите
            // /\/07-advanced\// из ignoreDeadLinks выше.
            // ------------------------------------------------------
            // {
            //   text: 'Модуль 7. Продвинутое',
            //   collapsed: true,
            //   items: [
            //     { text: '1. ThreadLocal', link: '/java/concurrency/07-advanced/01-thread-local' },
            //     { text: '2. Виртуальные потоки', link: '/java/concurrency/07-advanced/02-virtual-threads' },
            //     { text: '3. Structured Concurrency', link: '/java/concurrency/07-advanced/03-structured-concurrency' },
            //     { text: '4. Неизменяемость как стратегия', link: '/java/concurrency/07-advanced/04-immutability' },
            //     { text: '5. Диагностика и отладка', link: '/java/concurrency/07-advanced/05-diagnostics' },
            //     { text: 'Практикум', link: '/java/concurrency/07-advanced/practice' },
            //     { text: 'Разбор практикума', link: '/java/concurrency/07-advanced/practice-solutions' },
            //   ],
            // },
          ],
        },
      ],
    },

    lastUpdated: {
      text: 'Обновлено',
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
    notFound: {
      title: 'Здесь пусто',
      quote: 'Кажется, этой страницы ещё нет. Или она была, но её унесли.',
      linkLabel: 'На главную',
      linkText: 'Вернуться на главную',
    },
  },
})