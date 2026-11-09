# 6.2. CompletableFuture: создание и цепочки

## Где вы это уже видели

**Приготовление обеда.** Вы поставили вариться суп. Пока он варится — нарезали овощи для салата. Пока тушится мясо — сервировали стол. Не так: «сначала сварить суп, потом порезать, потом сервировать». А так: «запустил суп — он идёт — я делаю следующее». Каждый следующий шаг **запускается по готовности** предыдущего, и вы не стоите над кастрюлей.

**Сборка мебели по инструкции.** Пункт 1 — собрать каркас. Пункт 2 — прикрутить полки. Пункт 3 — приделать дверцы. Каждый пункт **зависит от предыдущего**: пока каркас не готов — полки прикручивать некуда. Но вы не «ждёте в блокировке», вы просто **переходите к следующему пункту, когда готов предыдущий**.

**Онлайн-заказ.** Оформили — ждёте подтверждения. Подтвердили — ждёте сборки. Собрали — ждёте доставки. Доставили — получаете. На каждом шаге срабатывает **уведомление**, и запускается следующий этап. Вы не «сидите и проверяете статус каждые пять секунд» — приложение само сообщает «готово, двигаемся дальше».

**Конвейер на заводе.** Деталь проходит через пять станков. Станок 1 обработал — передал на станок 2. Станок 2 — на станок 3. Каждый станок **не ждёт**, пока предыдущий закончит «всю партию», а берёт деталь, как только она готова, и обрабатывает.

**Общее во всех случаях** одно: есть **последовательность шагов**, где каждый следующий **запускается по завершении** предыдущего. Никто не блокируется в ожидании — просто «сделал A, запустил B, запустил C». Это и есть **асинхронные цепочки**, а `CompletableFuture` — инструмент для их построения.

## Теория

### Почему Future не хватает

В главе 6.1 мы разобрали `Future`: запустил задачу — получил номерок — потом дождался через `get()`. Это работает для «параллельно запустить, потом собрать результаты». Но есть сценарии, где `Future` **неудобен** или **невозможен**.

**Сценарий 1: цепочка.** «Загрузи пользователя, потом загрузи его заказы, потом посчитай сумму». С `Future` это выглядит так:

```java
Future<User> userFuture = pool.submit(() -> loadUser(id));
User user = userFuture.get();                      // блокируемся
Future<List<Order>> ordersFuture = pool.submit(() -> loadOrders(user));
List<Order> orders = ordersFuture.get();           // блокируемся
Future<Long> sumFuture = pool.submit(() -> sum(orders));
Long sum = sumFuture.get();                        // блокируемся
```

Три `get()` — три блокировки. Поток **ждёт** на каждом шаге. В итоге «асинхронность» превращается в «последовательность блокировок». Выигрыша почти нет.

**Сценарий 2: комбинация.** «Загрузи A и B параллельно, потом сложи». С `Future`:

```java
Future<A> aFuture = pool.submit(() -> loadA());
Future<B> bFuture = pool.submit(() -> loadB());
A a = aFuture.get();  // ждём A
B b = bFuture.get();  // ждём B
return a.combine(b);
```

Если A загрузится за секунду, а B за десять — вы прождёте десять секунд, хотя «сложить» можно было бы, как только готовы оба. `Future` не умеет «сложи, когда оба готовы». Приходится ждать вручную.

**Сценарий 3: обработка ошибок.** «Загрузи, а если не получилось — верни значение по умолчанию». С `Future` — только через `try/catch` вокруг `get()`. Громоздко.

**Сценарий 4: callback.** «Когда задача закончится — сделай что-то». С `Future` — только «дождись и сделай». Если «дождаться» нужно в другом потоке (например, в UI-потоке) — нужно вручную перекидывать результат.

`CompletableFuture` решает все четыре сценария.

### Что такое CompletableFuture

`CompletableFuture<T>` — реализация `Future<T>` с расширениями. Умеет всё, что умеет `Future` (`get`, `isDone`, `cancel`), плюс:

- **Создавать** задачу асинхронно (`supplyAsync`, `runAsync`).
- **Строить цепочки** (`thenApply`, `thenCompose`, `thenAccept`).
- **Комбинировать** несколько `CompletableFuture` (`thenCombine`, `allOf`, `anyOf`).
- **Обрабатывать ошибки** в цепочке (`exceptionally`, `handle`).
- **Завершать вручную** (`complete`, `completeExceptionally`).
- **Запускать callback по завершении** (`thenRun`, `whenComplete`).

Ключевое слово — **`Completable`**: «завершаемый». Вы можете **сами** завершить его, когда хотите, а не только дождаться, пока завершится задача.

### Создание

Три основных способа создать `CompletableFuture`.

**`supplyAsync(Supplier<U>)`** — асинхронно выполнить задачу с результатом.

```java
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    return "результат";
});
```

Выполняется в `ForkJoinPool.commonPool()` (глава 4.6) по умолчанию. Можно передать свой `Executor`:

```java
ExecutorService pool = Executors.newFixedThreadPool(4);
CompletableFuture<String> future = CompletableFuture.supplyAsync(() -> {
    return "результат";
}, pool);
```

**`runAsync(Runnable)`** — асинхронно выполнить задачу **без результата**.

```java
CompletableFuture<Void> future = CompletableFuture.runAsync(() -> {
    System.out.println("Работаю в фоне");
});
```

**`completedFuture(T)`** — уже завершённый `CompletableFuture` с готовым результатом. Полезно для «заглушек» и тестов.

```java
CompletableFuture<String> done = CompletableFuture.completedFuture("готово");
```

Плюс можно создать **пустой** и завершить позже:

```java
CompletableFuture<String> future = new CompletableFuture<>();
// ... где-то позже
future.complete("результат"); // вручную завершить
```

Это уникальная возможность `CompletableFuture`: **вы сами решаете, когда завершить**. Не привязано к задаче в пуле. Это удобно для «мостов» между callback-API и `Future`-API.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Правило:</strong> по умолчанию <code>supplyAsync</code>/<code>runAsync</code> используют <code>ForkJoinPool.commonPool()</code> — общий на всю программу. Для изоляции передавайте свой <code>Executor</code>. Особенно если задача делает I/O — <code>commonPool</code> для этого не предназначен.
</div>

### thenApply: преобразование результата

Главный метод цепочек. `thenApply(Function<T, U>)` — «когда результат будет готов, примени к нему функцию, и получится новый результат типа U».

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> "hello")
    .thenApply(s -> s.toUpperCase())          // "HELLO"
    .thenApply(s -> s + " WORLD");            // "HELLO WORLD"

String result = future.get(); // "HELLO WORLD"
```

**Что происходит:** `supplyAsync` запускает задачу, возвращает `CompletableFuture<String>`. `thenApply` **не блокируется** — он регистрирует «когда будет готово, сделай вот это». Возвращает новый `CompletableFuture<String>` — результат второго шага. Второй `thenApply` регистрирует третий шаг. Всё это — **без блокировки**.

`get()` в конце — единственная блокировка. Но её можно избежать, если использовать `thenAccept` (см. ниже).

### thenAccept: побочное действие

`thenAccept(Consumer<T>)` — «когда результат будет готов, сделай что-то с ним, но не возвращай нового результата».

```java
CompletableFuture
    .supplyAsync(() -> "hello")
    .thenApply(s -> s.toUpperCase())
    .thenAccept(s -> System.out.println("Результат: " + s));
```

`thenAccept` возвращает `CompletableFuture<Void>` — потому что результата нет, только действие.

### thenRun: действие без результата

`thenRun(Runnable)` — «когда результат будет готов, выполни что-то, не заглядывая в результат».

```java
CompletableFuture
    .supplyAsync(() -> "hello")
    .thenRun(() -> System.out.println("Первый шаг завершён"));
```

Возвращает `CompletableFuture<Void>`. Полезно для «побочных эффектов» — логирования, метрик.

### thenCompose: цепочка с вложенным CompletableFuture

Вот тут начинается важное. `thenApply` преобразует результат `T` в `U`. Но что если преобразование **само возвращает `CompletableFuture`**?

```java
// Наивная попытка
CompletableFuture<CompletableFuture<Orders>> future = CompletableFuture
    .supplyAsync(() -> loadUser(id))
    .thenApply(user -> loadOrdersAsync(user)); // loadOrdersAsync возвращает CF<Orders>
```

Получили **вложенный** `CompletableFuture<CompletableFuture<Orders>>`. Это неудобно — чтобы достать результат, нужно `future.get().get()` — два `get()`.

`thenCompose(Function<T, CompletableFuture<U>>)` — «когда результат T готов, запусти асинхронную операцию, возвращающую `CompletableFuture<U>`, и **разверни** её». Результат — плоский `CompletableFuture<U>`.

```java
CompletableFuture<Orders> future = CompletableFuture
    .supplyAsync(() -> loadUser(id))
    .thenCompose(user -> loadOrdersAsync(user)); // loadOrdersAsync возвращает CF<Orders>
```

**Правило выбора:** если функция возвращает обычное значение — `thenApply`. Если функцию возвращает `CompletableFuture` — `thenCompose`. Это как `map` и `flatMap` в стримах.

```java
// Аналогия со стримами
stream.map(x -> x + 1);                  // thenApply
stream.flatMap(x -> Stream.of(x, x+1));  // thenCompose
```

### thenCombine: комбинация двух

`thenCombine(CompletableFuture<U> other, BiFunction<T, U, V>)` — «дождись **обоих** результатов, примени функцию к обоим».

```java
CompletableFuture<A> aFuture = CompletableFuture.supplyAsync(() -> loadA());
CompletableFuture<B> bFuture = CompletableFuture.supplyAsync(() -> loadB());

CompletableFuture<C> cFuture = aFuture.thenCombine(bFuture, (a, b) -> combine(a, b));
```

**Оба** загружаются параллельно. `combine` вызывается, когда **оба** готовы. **Никакой блокировки**. Это то, чего не хватало `Future`.

### thenAcceptBoth и runAfterBoth

Аналоги `thenCombine`, но без возврата результата.

**`thenAcceptBoth(CompletableFuture<U> other, BiConsumer<T, U>)`** — «когда оба готовы, сделай что-то с обоими результатами».

```java
aFuture.thenAcceptBoth(bFuture, (a, b) -> System.out.println(a + " и " + b));
```

**`runAfterBoth(CompletableFuture<?> other, Runnable)`** — «когда оба готовы, выполни действие, не заглядывая в результаты».

```java
aFuture.runAfterBoth(bFuture, () -> System.out.println("Оба готовы"));
```

### applyToEither и acceptEither

`applyToEither(CompletableFuture<U> other, Function<T, V>)` — «когда **любой** из двух готов, примени функцию к его результату». Второй результат игнорируется.

```java
CompletableFuture<String> fast = CompletableFuture.supplyAsync(() -> slowLoad());
CompletableFuture<String> fallback = CompletableFuture.supplyAsync(() -> fastFallback());

CompletableFuture<String> winner = fast.applyToEither(fallback, s -> "Получили: " + s);
```

Полезно для **hedged requests**: «отправь два запроса, ответь первым пришедшим». Или для **timeout**: «основной запрос + таймаут-заглушка, что первое — то и ответ».

**`acceptEither`** — то же, но с `Consumer`, без возврата.

### Цепочка целиком: пример

Соберём всё вместе на практике. Задача: «загрузить пользователя, загрузить его заказы, посчитать сумму».

```java
ExecutorService pool = Executors.newFixedThreadPool(4);

CompletableFuture<Long> result = CompletableFuture
    .supplyAsync(() -> loadUser(id), pool)
    .thenCompose(user -> CompletableFuture.supplyAsync(
        () -> loadOrders(user), pool))
    .thenApply(orders -> orders.stream().mapToLong(Order::amount).sum())
    .thenApply(sum -> sum * 100 / 100); // какое-то преобразование

Long total = result.get(); // единственная блокировка — в конце
```

Три шага, каждый запускается **по готовности** предыдущего. Никаких блокировок между шагами. Один `get()` в конце.

**Или без `get()` вообще** — если результат нужно «отдать» в callback:

```java
result.thenAccept(total -> System.out.println("Итого: " + total));
```

Программа завершится, когда `thenAccept` выполнится. Никакого блокирующего `get()`.

### Исключения в цепочках

Если на каком-то шаге случится исключение — **вся цепочка** завершится с этим исключением. Последующие шаги **не выполнятся**. `get()` бросит `ExecutionException` с причиной.

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> "hello")
    .thenApply(s -> { throw new RuntimeException("упс"); })
    .thenApply(s -> s + " world"); // НЕ выполнится

future.get(); // ExecutionException, cause = RuntimeException("упс")
```

Это **правильное** поведение: цепочка — это «сделай A, потом B, потом C». Если B упал — C делать бессмысленно.

Обработка ошибок — в главе 6.3. Пока просто запомните: **исключение в любом шаге «убивает» всю цепочку**, и последующие шаги не выполняются.

### Асинхронность шагов

По умолчанию `thenApply`, `thenCompose` и другие выполняются **в том же потоке**, который завершил предыдущий шаг. Это быстро (нет переключения контекста), но может быть неожиданно.

```java
CompletableFuture
    .supplyAsync(() -> "hello")     // в ForkJoinPool
    .thenApply(s -> s.toUpperCase()) // в том же потоке ForkJoinPool
    .thenApply(s -> s + " world");   // в том же потоке
```

Если хотите, чтобы шаг выполнялся в **другом** потоке — используйте `thenApplyAsync`:

```java
.thenApplyAsync(s -> s.toUpperCase()) // в ForkJoinPool.commonPool()
.thenApplyAsync(s -> s + " world", pool) // в своём пуле
```

**Когда нужен `Async`-вариант:** когда шаг **долгий** и вы не хотите занимать поток, который завершил предыдущий шаг. Например, `supplyAsync` — короткий, а `thenApply` — долгий. Без `Async` долгий шаг будет в том же потоке, что и короткий, — и поток пула будет занят.

**Когда не нужен:** когда шаг короткий (например, преобразование строки). Переключение контекста дороже, чем сам шаг. Обычный `thenApply` — быстрее.

<div style="background-color: #251445; border-left: 4px solid #00E5D1; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #00E5D1;">Важно:</strong> <code>thenApply</code> без <code>Async</code> выполняется в том же потоке, что и предыдущий шаг. Если шаг долгий — он займёт поток пула. Используйте <code>thenApplyAsync</code>, если шаг долгий и его нужно «перекинуть» в другой поток.
</div>

### Частые ошибки

**Ошибка 1: забыть `get()` и удивляться, что «ничего не происходит».** `CompletableFuture` ленив: без `get()`, `thenAccept` или `join()` — цепочка не запустится, потому что никто не запрашивает результат. Точнее, `supplyAsync` запустится, но без «потребителя» результат просто потеряется.

**Ошибка 2: `thenApply` вместо `thenCompose`.** Если функция возвращает `CompletableFuture`, а вы используете `thenApply` — получите вложенный `CompletableFuture<CompletableFuture<...>>`. С `thenCompose` — плоский. Как `map` vs `flatMap` в стримах.

**Ошибка 3: `supplyAsync` без `Executor` для I/O.** По умолчанию — `ForkJoinPool.commonPool()`, который рассчитан на CPU-bound. Для I/O-bound задач — свой `Executor` (глава 4.2). Иначе `commonPool` быстро «залипнет», и все остальные `CompletableFuture` в программе встанут.

**Ошибка 4: `get()` без `try/catch`.** Как и у `Future` — четыре исключения. Плюс `CompletionException` (обёртка над причиной) в некоторых методах.

**Ошибка 5: `thenApply` для долгих шагов без `Async`.** Долгий шаг занимает поток пула, который завершил предыдущий. Если это `ForkJoinPool.commonPool` — он «залипнет», и другие задачи встанут.

**Ошибка 6: `join()` в главном потоке без таймаута.** `join()` — как `get()`, но без проверяемых исключений (оборачивает в `CompletionException`). Тоже может ждать вечно. `get(timeout)` — с таймаутом.

**Ошибка 7: путать `CompletableFuture` и `Future`.** `Future` — «дождись результата». `CompletableFuture` — «построй цепочку». Не пытайтесь строить цепочки на `Future` — это ад из `get()` в `get()`.

### Аналогия с приготовлением обеда

Вернёмся к началу. **`Future`** — это **кастрюля с супом**. Поставили — ждёте. Когда готово — снимаете. Пока варится — вы **не можете делать что-то, что зависит от супа** (например, добавить сметану). Только ждать.

**`CompletableFuture`** — это **повар, который сам решает, когда что делать**. «Свари суп — потом добавь сметану — потом позови меня». Вы говорите рецепт, а повар выполняет. Не ждёте, пока суп сварится, чтобы сказать «добавь сметану». Повар сам добавит, когда суп будет готов.

**`thenApply`** — это «повар, возьми готовое блюдо и сделай с ним вот это». **`thenCompose`** — это «повар, возьми готовое блюдо и **запусти следующий рецепт**». **`thenCombine`** — это «повар, дождись, пока готовы два блюда, и объедини их».

**`thenApplyAsync`** — «повар, отдай это другому повару» (в другой поток). **`thenApply`** без `Async` — «повар, сделай это сам, прямо сейчас».

**`get()`** — «позови меня, когда всё будет готово». **`thenAccept`** — «не зови меня, просто сделай вот это в конце».

## Микрозадача 1: цепочка преобразований

**Задача:** Создайте `CompletableFuture`, который начинает с `"hello"`, преобразует в верхний регистр, добавляет `" WORLD"`, потом печатает результат через `thenAccept`. Убедитесь, что ничего не блокируется.

**Решение:**

```java
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) throws Exception {
        CompletableFuture
            .supplyAsync(() -> "hello")
            .thenApply(s -> s.toUpperCase())
            .thenApply(s -> s + " WORLD")
            .thenAccept(s -> System.out.println("Результат: " + s));

        // дать цепочке время выполниться
        Thread.sleep(500);
    }
}
```

**Возможный вывод:**

```text
Результат: HELLO WORLD
```

**Разбор:** `supplyAsync` запускает задачу в `ForkJoinPool.commonPool()`, возвращает `CompletableFuture<String>`. `thenApply` регистрирует «когда будет готово — примени функцию». `thenApply` снова. `thenAccept` — «когда будет готово — напечатай». Всё это **без блокировки**.

`Thread.sleep(500)` в конце — чтобы программа не завершилась раньше, чем цепочка выполнится. В реальном приложении вы бы использовали `get()` или `join()`, но здесь — `sleep` для наглядности. Без `sleep` JVM может завершиться раньше, чем цепочка что-то напечатает.

## Микрозадача 2: thenCompose vs thenApply

**Задача:** Сравните `thenApply` и `thenCompose` на примере, где функция возвращает `CompletableFuture`.

**Решение:**

```java
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) throws Exception {
        // thenApply — вложенный CompletableFuture
        CompletableFuture<CompletableFuture<String>> nested = CompletableFuture
            .supplyAsync(() -> "hello")
            .thenApply(s -> CompletableFuture.supplyAsync(() -> s + " world"));

        System.out.println("thenApply: " + nested.get().get());

        // thenCompose — плоский CompletableFuture
        CompletableFuture<String> flat = CompletableFuture
            .supplyAsync(() -> "hello")
            .thenCompose(s -> CompletableFuture.supplyAsync(() -> s + " world"));

        System.out.println("thenCompose: " + flat.get());
    }
}
```

**Возможный вывод:**

```text
thenApply: hello world
thenCompose: hello world
```

**Разбор:** результат одинаковый, но **тип** разный. С `thenApply` получили `CompletableFuture<CompletableFuture<String>>` — вложенность, приходится `nested.get().get()`. С `thenCompose` — `CompletableFuture<String>`, один `get()`.

**Правило:** если функция возвращает `CompletableFuture` — `thenCompose`. Если обычное значение — `thenApply`. Как `map` и `flatMap` в стримах.

## 🎯 Самостоятельная задача

Реализуйте **асинхронный конвейер обработки пользователя**.

**Постановка:**

1. `loadUser(String id)` — `CompletableFuture<User>`. Спит 200 мс, возвращает `User(id, "User-" + id)`.
2. `loadOrders(User user)` — `CompletableFuture<List<Order>>`. Спит 300 мс, возвращает 3–5 случайных заказов.
3. `calculateTotal(List<Order>)` — `long`. Без `CompletableFuture` — просто синхронно (быстро).
4. `formatResult(long total)` — `String`. Преобразует в `"Итого: X"`.

**Требования:**

1. Постройте цепочку: `loadUser` → `thenCompose(loadOrders)` → `thenApply(calculateTotal)` → `thenApply(formatResult)` → `thenAccept(println)`.
2. Никаких блокировок между шагами. Только `get()` в конце (или `thenAccept` без `get()`).
3. Передайте свой `ExecutorService` во все `supplyAsync`, чтобы не залипал `commonPool`.
4. Замерьте общее время. Убедитесь, что оно ≈ 500 мс (200 + 300), а не 700 + обработка.

**Дополнительно:**

- Добавьте `loadUser` и `loadOrders` **параллельно**: `loadUser(id)` и `loadUser(id + "-shadow")` — `thenCombine`, чтобы получить «основного» и «теневого» пользователя, потом выбрать «лучшего».
- Добавьте искусственное исключение в `loadOrders` с вероятностью 20%. Убедитесь, что цепочка **останавливается** и `get()` бросает `ExecutionException`.
- Замените `thenApply(calculateTotal)` на `thenApplyAsync(calculateTotal)`. Замерьте. Заметна ли разница? Почему?

**Вопросы в комментарии:**

1. Почему `thenCompose` нужен для `loadOrders`, а `thenApply` — для `calculateTotal`?
2. Почему `thenApply` по умолчанию выполняется в том же потоке, что и предыдущий шаг? Когда это плохо?
3. Что произойдёт, если в цепочке один шаг упадёт? Выполнятся ли последующие?
4. В чём разница между `get()` и `join()`? Когда что использовать?

## 📌 Что дальше

В следующей главе — **«CompletableFuture: ошибки и таймауты»**. Разберём, как обрабатывать исключения в цепочке (`exceptionally`, `handle`, `whenComplete`), как задавать таймауты (`orTimeout`, `completeOnTimeout`), и как комбинировать несколько `CompletableFuture` (`allOf`, `anyOf`). А то ведь до сих пор мы строили цепочки «в идеальном мире», где ничего не падает. Пора научиться обрабатывать ошибки — иначе цепочка «умрёт» от первой же неудачи.