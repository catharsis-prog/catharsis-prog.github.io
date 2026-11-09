# Разборы практикума по модулю 6

## Как пользоваться этой страницей

Разбор — это не «эталон». Читайте **после** того, как попробовали сами.

## Задача 1. Future vs CompletableFuture

**Ключевой момент:** обе версии **параллельны**. Три источника запускаются одновременно (через `submit` или `supplyAsync`), общее время ≈ max(300, 500, 200) = 500 мс. `Future` и `CompletableFuture` **одинаково** быстры для «параллельно запустить, потом собрать». Разница — в **удобстве** и **возможностях**.

**Ответы на вопросы.**

1. **Почему B не быстрее A.** Обе версии запускают все три источника параллельно. Время определяется самым медленным (500 мс). `CompletableFuture` не «быстрее» — он просто **удобнее** для цепочек. Для «запустить и собрать» — `Future` не хуже.

2. **Разница при 10 источниках.** С `Future` — 10 `submit` + 10 `get()` в цикле, плюс `ExecutorService` на 10 потоков. С `CompletableFuture` — `CompletableFuture.allOf(futures).thenApply(...)`. Код короче, но при 10 источниках разница невелика. **Реальная** разница появляется, когда нужно **комбинировать** (например, «сложить результаты двух» или «взять первый успешный») — там `CompletableFuture` выигрывает сильно.

3. **Первый успешный.** С `Future` — только через `invokeAny` на `ExecutorService`, но он работает только для `Callable` и не даёт «гибкой» обработки. С `CompletableFuture` — `anyOf` + `handle` на каждом, гибко.

## Задача 2. Найди три ошибки

**Ошибка 1.** `ArrayList` + `parallelStream().forEach(result::add)` — гонка. `ArrayList` не потокобезопасен. Результат: `size()` может быть меньше 100000, или `ConcurrentModificationException`. **Исправление:** `collect(Collectors.toList())` или `ConcurrentLinkedQueue`.

**Ошибка 2.** `.exceptionally(ex -> ex.getMessage())` — `ex` это `CompletionException`, у которого `getMessage()` часто `null` (или строка вида `"java.lang.RuntimeException: сбой"`). Кроме того, `.thenApply(s -> s + "!")` **не выполнится**, потому что `supplyAsync` упал. `exceptionally` восстановит цепочку, но результат будет `null` или `"java.lang.RuntimeException: сбой"` — не то, что ожидалось. **Исправление:** `ex.getCause().getMessage()` — но `ex.getCause()` может быть `null`, если `CompletionException` без причины. Лучше: `ex instanceof CompletionException && ex.getCause() != null ? ex.getCause().getMessage() : ex.getMessage()`.

**Ошибка 3.** `completeOnTimeout` **не отменяет** задачу. `get()` вернёт `"fallback"` через 1 секунду, но `supplyAsync` продолжит спать 10 секунд. Программа завершится только через 10 секунд, потому что `main` ждёт (`pool.shutdown()` + `awaitTermination`, или JVM ждёт не-демон потоки). **Исправление:** либо `orTimeout` + `cancel(true)` вручную, либо не использовать `completeOnTimeout` для долгих задач, либо использовать демон-потоки в `Executor`.

## Задача 3. Цепочка с обработкой ошибок

```java
ExecutorService pool = Executors.newFixedThreadPool(8);

public Profile loadProfile(String id) {
    long start = System.currentTimeMillis();

    CompletableFuture<User> userFuture = CompletableFuture
        .supplyAsync(() -> loadUser(id), pool)
        .orTimeout(1, TimeUnit.SECONDS)
        .whenComplete((u, ex) -> log("loadUser", u, ex));

    CompletableFuture<List<Order>> ordersFuture = userFuture
        .thenCompose(user -> CompletableFuture
            .supplyAsync(() -> loadOrders(user), pool)
            .orTimeout(1, TimeUnit.SECONDS)
            .whenComplete((o, ex) -> log("loadOrders", o, ex))
            .exceptionally(ex -> Collections.emptyList()));

    CompletableFuture<List<Item>> recsFuture = userFuture
        .thenCompose(user -> CompletableFuture
            .supplyAsync(() -> loadRecommendations(user), pool)
            .orTimeout(1, TimeUnit.SECONDS)
            .whenComplete((r, ex) -> log("loadRecommendations", r, ex))
            .exceptionally(ex -> Collections.emptyList()));

    return userFuture
        .exceptionally(ex -> null)
        .thenCombine(ordersFuture, (user, orders) -> new Object[]{user, orders})
        .thenCombine(recsFuture, (arr, recs) -> new Profile((User) arr[0], (List<Order>) arr[1], recs))
        .join();
}
```

**Что здесь важно.**

- `ordersFuture` и `recsFuture` **запускаются параллельно**: обе зависят от `userFuture`, но не друг от друга. `thenCompose` после `userFuture` регистрирует их обе, и они стартуют одновременно, как только `user` готов.
- `exceptionally` на каждом — превращает ошибку в пустой список.
- `orTimeout` на каждом — не более 1 секунды.
- `whenComplete` — только логирует, не меняет результат.

**Ответы на вопросы.**

1. **Почему параллельно.** Они не зависят друг от друга. Если запускать последовательно — 300 + 400 = 700 мс, параллельно — max(300, 400) = 400 мс. Разница почти в 2 раза.

2. **Почему `exceptionally`, не `handle`.** `handle` получает `(result, ex)`, но здесь нужен только «fallback». `exceptionally` семантически точнее: «если ошибка — верни это». `handle` был бы избыточен.

3. **Почему `whenComplete` не должен бросать.** Если `whenComplete` бросит — оно **заменит** исходный результат. Цепочка, которая была «успех», станет «ошибка», и `exceptionally` «сработает» на пустом месте. Для логирования — оборачивайте в `try/catch`.

4. **Почему `orTimeout` на каждом.** Общий таймаут на всю цепочку «зарежет» всю цепочку, если один шаг медленный. Локальный — «этот шаг не успел — fallback», остальные могут продолжаться. Гибче.

## Задача 4. Первый успешный

```java
CompletableFuture<String> hedged(String key) {
    CompletableFuture<String> fast = CompletableFuture
        .supplyAsync(() -> querySource("fast", 100, 0.5), pool)
        .handle((r, ex) -> ex != null ? null : r);

    CompletableFuture<String> medium = CompletableFuture
        .supplyAsync(() -> querySource("medium", 300, 0.2), pool)
        .handle((r, ex) -> ex != null ? null : r);

    CompletableFuture<String> slow = CompletableFuture
        .supplyAsync(() -> querySource("slow", 500, 0.05), pool)
        .handle((r, ex) -> ex != null ? null : r);

    return CompletableFuture
        .anyOf(fast, medium, slow)
        .thenApply(o -> (String) o)
        .thenCompose(result -> {
            if (result != null) return CompletableFuture.completedFuture(result);
            // первый готовый был null — ждём остальных
            return CompletableFuture.allOf(fast, medium, slow)
                .thenApply(v -> {
                    String f = fast.join();
                    String m = medium.join();
                    String s = slow.join();
                    if (f != null) return f;
                    if (m != null) return m;
                    if (s != null) return s;
                    return "all failed";
                });
        });
}
```

**Что здесь важно.**

- `handle` на каждом — превращает ошибку в `null`, чтобы `anyOf` не падал на «первом упавшем».
- `anyOf` возвращает **первый завершившийся** — но он может быть `null` (если упал).
- Если первый — `null`, ждём **всех** и берём первый не-null.
- Если все `null` — `"all failed"`.

**Ответы на вопросы.**

1. **Почему `anyOf` без `handle` — плохо.** `anyOf` завершается с ошибкой, если **первый завершившийся** упал. Даже если остальные могли бы дать результат. `handle` превращает ошибку в `null`, и `anyOf` «успешно» возвращает `null` — это можно обработать.

2. **Преимущество hedged.** Не ждём самый медленный источник. Если `fast` ответил за 100 мс — не ждём `slow` (500 мс). Экономия 400 мс. И надёжность: если `fast` упал, `medium` может ответить.

3. **Когда последовательный лучше.** Когда ресурсы ограничены: три параллельных запроса — это 3× нагрузка на источники. Для «дешёвых» источников — ок. Для «дорогих» (например, платный API) — лучше последовательно.

4. **«Первый успешный» ≠ «первый завершившийся».** Первый завершившийся может быть **с ошибкой**. «Первый успешный» — это первый, кто вернул **не-null** результат. Разница — в обработке ошибок.

## Задача 5. parallelStream vs CompletableFuture

**Типичные результаты для CPU-bound (100 000 транзакций, 1 мкс каждая):**

| Версия | Время |
|---|---|
| `stream` (последовательно) | ~150 мс |
| `parallelStream` | ~40 мс |
| `CompletableFuture` (8 частей) | ~45 мс |

**Типичные результаты для I/O-bound (`Thread.sleep(1)`):**

| Версия | Время |
|---|---|
| `stream` | ~100 000 мс (100 секунд) |
| `parallelStream` | ~15 000 мс (7 потоков) |
| `CompletableFuture` (100 потоков) | ~1000 мс |

**Ответы на вопросы.**

1. **Почему `parallelStream` не всегда выигрывает.** Накладные расходы на splitting, merging, переключение контекста. На маленьких коллекциях — больше, чем выигрыш. На 100 элементах `parallelStream` может быть **медленнее** в 2–3 раза.

2. **Почему `CompletableFuture` может быть быстрее.** С `parallelStream` — `commonPool` из 7 потоков. С `CompletableFuture` — свой пул на 100 потоков. Для I/O-bound — 100 потоков «ждут» параллельно, а 7 — только 7. Разница — в 14 раз.

3. **Почему `parallelStream` — плохой выбор для I/O.** `commonPool` «залипает»: 7 потоков спят на `Thread.sleep(1)`, остальные `parallelStream` в программе — ждут. `CompletableFuture` с явным пулом — `commonPool` свободен.

4. **Когда «8 частей» лучше.** Когда задача **однородная** и вы точно знаете, что нужно 8 потоков. `parallelStream` использует `commonPool`, который может быть занят. Свой пул — изолирован.

## Задача 6. Асинхронный пайплайн

```java
public class AsyncPipeline {
    private static final String POISON = "__END__";

    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<String> input = new ArrayBlockingQueue<>(20);
        BlockingQueue<String> output = new ArrayBlockingQueue<>(20);
        ExecutorService pool = Executors.newFixedThreadPool(8);
        AtomicInteger failed = new AtomicInteger(0);
        AtomicInteger success = new AtomicInteger(0);

        // Producer
        Thread producer = new Thread(() -> {
            try {
                for (int i = 0; i < 20; i++) {
                    input.put("request-" + i);
                    Thread.sleep(100);
                }
                input.put(POISON);
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });

        // Consumer
        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    String r = output.take();
                    if (POISON.equals(r)) return;
                    System.out.println("Result: " + r);
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });

        // Async-обработчик
        Thread processor = new Thread(() -> {
            try {
                while (true) {
                    String req = input.take();
                    if (POISON.equals(req)) {
                        // дождаться всех in-flight CompletableFuture (упрощённо)
                        Thread.sleep(500);
                        output.put(POISON);
                        return;
                    }
                    CompletableFuture
                        .supplyAsync(() -> step1(req), pool)
                        .thenCompose(r1 -> CompletableFuture.supplyAsync(() -> step2(r1), pool))
                        .thenCompose(r2 -> CompletableFuture.supplyAsync(() -> step3(r2), pool))
                        .whenComplete((res, ex) -> {
                            try {
                                if (ex != null) {
                                    failed.incrementAndGet();
                                    output.put("error: " + req);
                                } else {
                                    success.incrementAndGet();
                                    output.put(res);
                                }
                            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                        });
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });

        producer.start(); consumer.start(); processor.start();
        producer.join(); processor.join(); consumer.join();
        pool.shutdown();
        pool.awaitTermination(10, TimeUnit.SECONDS);
        System.out.println("Success: " + success.get() + ", Failed: " + failed.get());
    }
}
```

**Ответы на вопросы.**

1. **Почему `CompletableFuture` удобнее.** С `ExecutorService.submit` пришлось бы хранить `Future` для каждого шага, вручную связывать их (`.get()` внутри следующего `submit`), и обрабатывать исключения на каждом шаге. С `thenCompose` и `whenComplete` — всё делается **одной цепочкой**, без ручного связывания.

2. **Почему `exceptionally` на каждом шаге.** Ошибка на шаге 2 должна «вернуть» результат, чтобы шаг 3 мог продолжить (или явно «упасть»). Если `exceptionally` только в конце — шаг 2 «убьёт» всю цепочку, и шаг 3 не выполнится. В этой задаче — «упал на шаге 2 — вернуть "error"», поэтому `exceptionally` (или `whenComplete` с обработкой) на каждом.

3. **Почему `thenCompose`.** `step1`, `step2`, `step3` — каждая возвращает `CompletableFuture<String>`. `thenApply` дал бы `CompletableFuture<CompletableFuture<String>>`. `thenCompose` — плоский `CompletableFuture<String>`.

4. **Ограничение параллелизма.** `CompletableFuture` сам не ограничивает. Ограничение — через `Semaphore` (глава 3.3) или через **ограниченный `Executor`** (например, `newFixedThreadPool(5)` — не более 5 задач одновременно).

## Задача 7. Диагноз по симптому

**Программа А.** `commonPool` из 7 потоков на 1000 I/O-задач. Каждый `httpGet` — секунда. 1000 / 7 ≈ 143 секунды. Плюс **все** другие `parallelStream` и `CompletableFuture` без явного пула в программе «встанут». **Исправление:** свой `ExecutorService` с большим числом потоков (100–200 для I/O).

**Программа Б.** `.thenApply(user -> loadOrders(user))` — `loadOrders` возвращает `List<Order>`, но `thenApply` **не** «разворачивает» `CompletableFuture`. Тип будет `CompletableFuture<CompletableFuture<List<Order>>>`. `.thenApply(orders -> sum(orders))` — `orders` это `CompletableFuture`, а не `List`. **Ошибка компиляции** или `ClassCastException`. **Исправление:** `.thenCompose(user -> loadOrdersAsync(user))`.

**Программа В.** `Thread.sleep(10)` внутри `parallelStream` — 100 000 элементов × 10 мс = 1000 секунд последовательно. С 7 потоками — ~143 секунды. С последовательным — те же 1000 секунд (sleep не «параллелится»). Но `parallelStream` **«залипает»** `commonPool` на 143 секунды — все остальные `parallelStream` встают. **Исправление:** `CompletableFuture` с явным пулом.

## Задача 8. Резюме в одном приложении

Ключевые моменты.

- **`BlockingQueue`** для запросов и результатов.
- **`CompletableFuture`** для каждого запроса — три источника параллельно через `thenCombine`/`allOf`.
- **`orTimeout(500ms)`** на каждом источнике.
- **`exceptionally`** — fallback на пустой результат.
- **`Semaphore(5)`** — ограничение параллелизма.
- **`ConcurrentLinkedQueue`** — для результатов (если нужен «неблокирующий» сбор).

**Схема:**

```java
while ((request = input.poll(1, SECONDS)) != null) {
    semaphore.acquire();
    CompletableFuture
        .supplyAsync(() -> sourceA(request), pool)
        .orTimeout(500, MILLISECONDS)
        .exceptionally(ex -> "A-error")
        .thenCombine(
            CompletableFuture.supplyAsync(() -> sourceB(request), pool)
                .orTimeout(500, MILLISECONDS)
                .exceptionally(ex -> "B-error"),
            (a, b) -> a + "|" + b
        )
        .thenCombine(
            CompletableFuture.supplyAsync(() -> sourceC(request), pool)
                .orTimeout(500, MILLISECONDS)
                .exceptionally(ex -> "C-error"),
            (ab, c) -> ab + "|" + c
        )
        .whenComplete((result, ex) -> {
            results.add(result);
            semaphore.release();
        });
}
```

**Что важно:** `whenComplete` освобождает `Semaphore` — иначе «зависнет» после 5 запросов.

## Проектное задание. Асинхронный агрегатор с fallback

Ключевые стратегии.

**Fallback (последовательный):**

```java
CompletableFuture<String> fallback(String key) {
    return trySource(0, key);
}

private CompletableFuture<String> trySource(int index, String key) {
    if (index >= sources.size()) {
        return CompletableFuture.completedFuture("all failed");
    }
    return sources.get(index).apply(key)
        .orTimeout(1, TimeUnit.SECONDS)
        .exceptionally(ex -> null)
        .thenCompose(result -> result != null
            ? CompletableFuture.completedFuture(result)
            : trySource(index + 1, key));
}
```

**Parallel:**

```java
CompletableFuture<String> parallel(String key) {
    List<CompletableFuture<String>> futures = sources.stream()
        .map(s -> s.apply(key)
            .orTimeout(1, TimeUnit.SECONDS)
            .handle((r, ex) -> ex != null ? null : r))
        .collect(Collectors.toList());

    return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
        .thenApply(v -> futures.stream()
            .map(CompletableFuture::join)
            .filter(Objects::nonNull)
            .findFirst()
            .orElse("all failed"));
}
```

**Hedged (с задержкой):**

```java
CompletableFuture<String> hedged(String key) {
    CompletableFuture<String> primary = sources.get(0).apply(key)
        .orTimeout(1, TimeUnit.SECONDS)
        .handle((r, ex) -> ex != null ? null : r);

    // через 200 мс запускаем secondary, если primary ещё не ответил
    CompletableFuture<String> secondary = primary.thenCompose(p -> p != null
        ? CompletableFuture.completedFuture(p)
        : CompletableFuture.supplyAsync(() -> null, delayedExecutor(200, MILLISECONDS))
            .thenCompose(ignored -> sources.get(1).apply(key)
                .orTimeout(1, TimeUnit.SECONDS)
                .handle((r, ex) -> ex != null ? null : r)));

    // через 400 мс — tertiary, если ни primary, ни secondary не ответили
    // ...

    return primary.thenCombine(secondary, (p, s) -> p != null ? p : s);
}
```

**Ответы на вопросы со звёздочкой.**

1. **Fallback медленнее, но надёжнее.** `parallel` — все три источника **всегда** запускаются. В среднем быстрее (первый готовый), но 3× нагрузка. `fallback` — только один, если он успешен. В среднем медленнее (ждём один, но по очереди), но нагрузка 1×. Для «дешёвых» источников — `parallel`, для «дорогих» — `fallback`.

2. **Hedged через `delayedExecutor`.** `CompletableFuture.delayedExecutor(delay, unit)` — статический метод, возвращает `Executor`, который выполняет задачи **через задержку**. Используется для «запустить secondary через 200 мс, если primary ещё не готов».

3. **Адаптивный выбор.** Хранить «скользящее среднее» времени ответа primary. Если < 100 мс — `fallback` (primary быстрый, secondary не нужен). Если > 300 мс — `parallel` (primary медленный, параллельность окупается). Если между — `hedged` (компромисс). Это классический паттерн из Site Reliability Engineering.

4. **Все три стратегии вместе.** 1 + 1 + 2 = 4× нагрузка на sources. Может «убить» источники. Используется в **адаптивных** системах: одна стратегия на запрос, выбор — на основе метрик. Не «все три одновременно».

---

**Если все восемь задач решены и проектное задание сделано** — модуль 6 пройден. Вы теперь умеете:

- использовать `Future` для «запусти и дождись»;
- строить цепочки через `CompletableFuture` без блокировок;
- обрабатывать ошибки и таймауты в цепочках;
- комбинировать несколько `CompletableFuture` через `allOf` и `anyOf`;
- выбирать между `parallelStream`, `CompletableFuture` и `ExecutorService` под задачу.

Дальше — **модуль 7 «Продвинутое»**, где мы разберём `ThreadLocal`, виртуальные потоки, structured concurrency, неизменяемость и диагностику. Это финальный модуль, и он собирает всё, что было раньше, в «взрослую» картину.