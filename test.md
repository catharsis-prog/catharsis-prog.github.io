Отлично, что установка прошла успешно! Сейчас мы создадим содержательные страницы, а затем настроим всё для публикации на GitHub Pages.

### 📝 Шаг 1: Создание трёх страниц учебника

Ваша структура папок уже почти готова. Осталось наполнить три ключевых файла. Я подготовил для них содержимое в вашем формате «теория → микрозадача → самостоятельная задача», используя вашу палитру для цветовых акцентов в тексте (через inline-стили, чтобы вы сразу видели, как это работает).

#### 1. `docs/index.md` — Главная страница-хаб

```markdown
---
layout: home

hero:
  name: "Catharsis"
  text: "Учебники по программированию"
  tagline: "Просто. Глубоко. С практикой."
  actions:
    - theme: brand
      text: "Начать с Java"
      link: "/java/"
    - theme: alt
      text: "О проекте"
      link: "/about"

features:
  - title: "Java Concurrency"
    details: "От создания потоков до синхронизации. С микрозадачами и самостоятельной практикой."
    link: "/java/concurrency/"
---
```

#### 2. `docs/java/index.md` — Введение в Java

```markdown
# Java

Добро пожаловать в учебник по Java. Здесь мы начинаем с одного из самых важных и сложных разделов — **многопоточности**.

## Почему многопоточность?

Современные процессоры имеют несколько ядер. Многопоточность позволяет использовать их все, делая программы быстрее и отзывчивее. Это навык, который отличает junior-разработчика от специалиста, который может писать производительный код.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Совет:</strong> Не пытайтесь выучить всю многопоточность за один день. Это большая тема, но мы разобьём её на маленькие, понятные шаги.
</div>

## С чего начать?

Переходите к разделу **[Многопоточность](/java/concurrency/)**, где мы разберём основы создания потоков.
```

#### 3. `docs/java/concurrency/index.md` — Введение в раздел

```markdown
# Многопоточность в Java

Этот раздел посвящён тому, как заставить вашу программу делать несколько дел одновременно.

## Содержание раздела

- **[Основы потоков](/java/concurrency/threads-basics)** — как создать поток и запустить его.
- *Синхронизация* (скоро) — как избежать проблем, когда потоки мешают друг другу.
- *Пулы потоков* (скоро) — как эффективно управлять множеством задач.
```

#### 4. `docs/java/concurrency/threads-basics.md` — Первый урок

```markdown
# Основы потоков в Java

## Теория

**Поток (Thread)** — это независимая последовательность выполнения кода внутри программы. По умолчанию в Java-программе уже есть один поток — главный (`main`).

Чтобы создать свой поток, есть два основных способа:

1.  **Унаследовать класс `Thread`** и переопределить метод `run()`.
2.  **Реализовать интерфейс `Runnable`** и передать его в конструктор `Thread`. (Этот способ предпочтительнее, так как Java не поддерживает множественное наследование классов).

Вот как выглядит создание потока через `Runnable`:

```java
public class MyTask implements Runnable {
    @Override
    public void run() {
        System.out.println("Поток работает: " + Thread.currentThread().getName());
    }
}

// Где-то в коде:
Thread thread = new Thread(new MyTask());
thread.start(); // запускает поток
```

<div style="background-color: #251445; border-left: 4px solid #00E5D1; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #00E5D1;">Важно:</strong> Всегда вызывайте <code>start()</code>, а не <code>run()</code> напрямую. Вызов <code>run()</code> просто выполнит код в текущем потоке, не создавая новый.
</div>

## Микрозадача: Сумма элементов массива

**Задача:** Напишите программу, которая в отдельном потоке вычисляет сумму всех элементов массива целых чисел.

**Решение:**

```java
import java.util.Arrays;

public class ArraySumTask implements Runnable {
    private final int[] array;

    public ArraySumTask(int[] array) {
        this.array = array;
    }

    @Override
    public void run() {
        int sum = 0;
        for (int value : array) {
            sum += value;
        }
        System.out.println("Сумма элементов: " + sum);
    }

    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        Thread sumThread = new Thread(new ArraySumTask(numbers));
        sumThread.start();
    }
}
```

## 🎯 Самостоятельная задача: Произведение элементов

А теперь попробуйте сами. Напишите программу, которая в отдельном потоке вычисляет **произведение** элементов массива. Используйте ту же структуру, что и в примере выше: создайте класс, реализующий `Runnable`, и запустите его в новом потоке.
```

### ⚙️ Шаг 2: Настройка GitHub Pages

Перед публикацией нужно сделать два важных шага.

#### 1. Укажите `base` в конфигурации

Откройте `docs/.vitepress/config.mts` и добавьте параметр `base`. Он должен совпадать с именем вашего репозитория на GitHub.

```typescript
export default defineConfig({
  title: "Catharsis",
  description: "Учебники по программированию",
  base: '/catharsis-books/', // 👈 Замените на имя вашего репозитория
  // ... остальная конфигурация
})
```

> **Важно:** Если вы создадите репозиторий с именем `catharsis-books`, сайт будет доступен по адресу `https://ваш-логин.github.io/catharsis-books/`. Если репозиторий называется `ваш-логин.github.io`, параметр `base` нужно убрать или установить в `'/'`.

#### 2. Создайте файл рабочего процесса (workflow)

В корне вашего проекта создайте папку `.github/workflows` и внутри неё — файл `deploy.yml` со следующим содержимым. Этот файл автоматизирует сборку и публикацию.

```yaml
name: Deploy VitePress site to Pages

on:
  push:
    branches: [main]

  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Install dependencies
        run: npm ci

      - name: Build with VitePress
        run: npm run docs:build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs/.vitepress/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 🚀 Шаг 3: Публикация

1.  **Создайте репозиторий** на GitHub (например, `catharsis-books`).
2.  **Запушьте код** в ветку `main`.
3.  В настройках репозитория на GitHub перейдите в **Settings → Pages**.
4.  В разделе **"Build and deployment"** выберите **Source: GitHub Actions**.

После этого GitHub Actions автоматически соберёт и опубликует ваш сайт. Через пару минут он будет доступен по адресу `https://ваш-логин.github.io/имя-репозитория/`.

Теперь у вас есть работающий сайт с тремя страницами и настроенным деплоем. Можно переходить к написанию следующих статей. Если на каком-то из шагов возникнут вопросы, спрашивайте.