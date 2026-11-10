# Разборы практикума по модулю 7

## Как пользоваться этой страницей

Разбор — это не «эталон». Читайте **после** того, как попробовали сами.

## Задача 1. ThreadLocal с корректной очисткой

```java
public class TransactionContext {
    private static final ThreadLocal<String> txId = new ThreadLocal<>();
    private static final ThreadLocal<Long> startTime = new ThreadLocal<>();
    private static final ThreadLocal<List<String>> operations = ThreadLocal.withInitial(ArrayList::new);

    public static void init(String id) {
        txId.set(id);
        startTime.set(System.currentTimeMillis());
        operations.set(new ArrayList<>());
    }

    public static void addOperation(String op) { operations.get().add(op); }
    public static String getTxId() { return txId.get(); }
    public static long getElapsed() { return System.currentTimeMillis() - startTime.get(); }

    public static void clear() {
        txId.remove();
        startTime.remove();
        operations.remove();
    }
}

public class TransactionProcessor {
    public void process(String txId) {
        TransactionContext.init(txId);
        try {
            TransactionContext.addOperation("step1");
            TransactionContext.addOperation("step2");
            TransactionContext.addOperation("step3");
        } finally {
            TransactionContext.clear();
        }
    }
}
```

**Ответы на вопросы.**

1. **Почему `clear()` в `finally` обязателен.** Поток пула **не завершается** после задачи — он возвращается в пул. `ThreadLocal` живёт **в потоке**, а не в задаче. Без `clear()` — значение остаётся, следующий запрос на этом потоке увидит **чужой** `txId` и `operations`. Это «протекание данных» + утечка памяти (если `operations` большой).

2. **Почему `set(null)` не заменяет `remove()`.** `set(null)` записывает `null` в `ThreadLocalMap` как значение. Запись **остаётся** в мапе (ключ `ThreadLocal`, значение `null`). `remove()` удаляет **запись** из мапы. С точки зрения памяти — `set(null)` всё равно оставляет «мусор» в мапе.

3. **Почему `InheritableThreadLocal` не работает в пуле.** Потоки пула создаются **один раз** (при старте). Они «наследуют» `InheritableThreadLocal` от потока-создателя пула, а не от «текущей задачи». Задача отправляется в пул — но поток **уже создан**, «наследование» не происходит.

4. **Связь с утечкой.** `ThreadLocalMap` — поле в `Thread`. Пока `Thread` жив — мапа жива. В пуле потоки живут **всегда** (до `shutdown`). Значит, `ThreadLocalMap` — всегда в памяти. Если значения большие — утечка.

## Задача 2. Найди три ошибки

**Ошибка 1.** `ThreadLocal` без `remove()`. В пуле — 4 потока, каждый накапливает `List<String>`. Через 100 задач на каждый поток — по 25 элементов в списке (плюс «протекание» — задача N видит данные задачи N-1 на том же потоке). Утечка памяти + некорректные данные.

**Ошибка 2.** `submit` без сохранения `Future`. Если задача упадёт — исключение «застрянет» в `Future`, никто не узнает.

**Ошибка 3.** `shutdown()` **без** `awaitTermination`. `main` завершится, а пул может ещё работать. JVM подождёт, но `main` не увидит, что все задачи завершены. Плюс — если `main` прервут (`InterruptedException`), `shutdown` не вызовется, пул останется жив.

**Исправление:**

```java
public class Main {
    private static final ThreadLocal<List<String>> buffer = 
        ThreadLocal.withInitial(ArrayList::new);

    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<?>> futures = new ArrayList<>();

        try {
            for (int i = 0; i < 100; i++) {
                int id = i;
                futures.add(pool.submit(() -> {
                    try {
                        buffer.get().add("item-" + id);
                        // ... обработка
                    } finally {
                        buffer.remove(); // ← обязательно
                    }
                }));
            }
        } finally {
            pool.shutdown();
            if (!pool.awaitTermination(5, TimeUnit.SECONDS)) {
                pool.shutdownNow();
            }
        }

        int failed = 0;
        for (Future<?> f : futures) {
            try { f.get(); } catch (ExecutionException e) { failed++; }
        }
        System.out.println("Готово, упало: " + failed);
    }
}
```

## Задача 3. Виртуальные потоки для I/O

**Типичные результаты (JDK 21, 8 ядер):**

| Версия | Время на 10 000 задач по 100 мс |
|---|---|
| Платформенные (100 потоков) | ~10 000 мс (100 × 100 мс) |
| Платформенные (1000 потоков) | ~1000 мс (10 × 100 мс) |
| Виртуальные | ~100 мс (все параллельно) |

**Разбор.** Виртуальные потоки дают **огромный** выигрыш: 10 000 задач «ждут» одновременно, занимая лишь несколько носителей (по числу ядер). Платформенные — ограничены пулом.

**Pinning (JDK 21–23).** Если обернуть `Thread.sleep` в `synchronized` — виртуальный поток **пришпиливается** к носителю. 10 000 виртуальных потоков → 8 носителей → 8 «работают», 9992 «ждут». Время: 10 000 / 8 × 100 мс = 125 000 мс (в 1250 раз медленнее!). На JDK 24+ — pinning по `synchronized` решён, разница минимальна.

**CPU-bound.** Виртуальные потоки **не дают** выигрыша: задача «считает», поток не размонтируется. 10 000 CPU-bound задач на 8 носителях — как 10 000 платформенных на 8 ядрах. Только накладные расходы на планирование.

**Ответы на вопросы.**

1. **I/O vs CPU.** I/O-bound: поток **ждёт** — виртуальный размонтируется, носитель свободен. CPU-bound: поток **считает** — не размонтируется, носитель занят.

2. **`OutOfMemoryError` vs виртуальные.** 1000 платформенных × 1 МБ стека = 1 ГБ. 10 000 × 1 МБ = 10 ГБ. Виртуальные — стек в куче, растёт по мере необходимости, по умолчанию маленький. 10 000 виртуальных — десятки МБ.

3. **Pinning.** Виртуальный поток привязан к носителю, пока находится внутри `synchronized` (JDK 21–23). Даже если блокируется (`sleep`, I/O) — не размонтируется. Носитель занят.

4. **Почему не пулить.** Виртуальные потоки **дешёвые**. Создание — микросекунды, память — килобайты. Пул — механизм **переиспользования дорогих** ресурсов. Виртуальные не нужно переиспользовать — создавайте новые.

## Задача 4. Structured concurrency: «всё или ничего»

**Ключевое различие.**

**`CompletableFuture`:** `exceptionally` на каждом — возвращает `null`. `allOf` — ждёт всех, даже если один упал. Результат: если один `null` — профиль не загружен. Но остальные **доработали до конца** (потратили ресурсы).

**`StructuredTaskScope`:** `awaitAllSuccessfulOrThrow` — как только один упал, **отменяет** остальных. `join()` бросает `ExecutionException`. Результат: если один упал — профиль не загружен, остальные **отменены** (не дорабатывают).

**Ответы на вопросы.**

1. **Почему B гарантирует.** Scope **закрывается** в `try-with-resources`. При закрытии — **гарантирует**, что все дочерние задачи завершены (или отменены). В `CompletableFuture` — задачи «живут» в пуле, родитель может «уйти», не дождавшись.

2. **Почему `get()` не блокируется.** После `join()` все задачи **завершены**. `get()` — просто «прочитать результат». Если задача не завершена — `get()` бросит `IllegalStateException` (это **ошибка** использования, а не «блокировка»).

3. **Разница «отменить».** В A — вы **вручную** вызываете `cancel(true)` на каждом `CompletableFuture`. Или не вызываете — тогда они «живут». В B — scope **сам** отменяет остальных, когда политика (`Joiner`) сработала. Это **автоматически**, не нужно помнить.

4. **Preview.** `StructuredTaskScope` — **preview** API. Требует `--enable-preview`. Может меняться между версиями (JDK 21 vs 25 — **разный** API). В продакшене — осторожно: обновление JDK может **сломать** код.

## Задача 5. Неизменяемость

**Типичные результаты (10 потоков, 100 000 операций, 8 ядер):**

| Версия | Время | Корректность |
|---|---|---|
| `MutableMoney` + `synchronized` | ~500 мс | Всегда 1 000 000 |
| `AtomicMoney` | ~200 мс | Всегда 1 000 000 |
| `ImmutableMoney` | ~300 мс | Всегда 1 000 000 |
| `MutableMoney` без `synchronized` | ~100 мс | Меньше 1 000 000 (гонка) |

**Разбор.** `AtomicMoney` быстрее `synchronized` — CAS вместо блокировки (глава 2.6). `ImmutableMoney` — быстро, но каждая операция создаёт **новый** объект — немного медленнее `AtomicMoney` (аллокация). `MutableMoney` без синхронизации — «быстро», но **некорректно**.

**С большим состоянием.** `ImmutableMoney` с `List<Long> history` — каждое `add` создаёт **новый** список с копией всех элементов. 1000 операций = 1000 копий по 1, 2, 3, ..., 1000 элементов = **500 000** операций копирования. **Катастрофа**. Для таких — persistent list (Vavr) или изменяемая структура.

**Ответы на вопросы.**

1. **Почему `ImmutableMoney` потокобезопасен.** Поля `final`, нет сеттеров, объект **не меняется**. Два потока могут **читать** одновременно — никто никому не мешает. «Писать» нечего.

2. **Почему `AtomicMoney` быстрее.** `synchronized` — блокировка (поток засыпает, просыпается). `AtomicLong` — CAS (без блокировки, «попробуй, если не вышло — повтори»). При низкой конкуренции — быстрее.

3. **Когда `ImmutableMoney` медленнее.** Когда состояние **большое** и меняется **часто**. Копирование большого состояния на каждую операцию — O(n). Для маленьких объектов (числа) — O(1), не проблема.

4. **Почему `record` с `List` — не полностью.** `record` гарантирует `final` на **ссылке**, но **содержимое** списка можно менять (`list.add(...)`). Для полной — `List.copyOf` в компактном конструкторе.

## Задача 6. Диагностика

**A — deadlock.** `jstack` покажет «Found one Java-level deadlock». Исправление: порядок захвата (глава 2.7).

**B — contention.** `jstack` покажет много `BLOCKED` на мониторе `B.class`, один в `TIMED_WAITING` (sleep). Исправление: вынести `sleep` за `synchronized`, или `AtomicInteger`.

**C — утечка.** `jstack` покажет 1000 потоков `worker-*` в `TIMED_WAITING` на `Thread.sleep`. Исправление: пул с `shutdown`.

**D — busy wait.** `jstack` покажет `main` в `RUNNABLE` на `while (!ready)`. Остальные — `WAITING` или `TERMINATED`. Исправление: `CountDownLatch` / `wait`/`notify`.

**Ответы на вопросы.**

1. **Почему A JVM находит, а D — нет.** Deadlock — формальное состояние: цикл ожидания мониторов. JVM **умеет** его детектировать. Busy wait — не «проблема» с точки зрения JVM: поток в `RUNNABLE`, работает. JVM не знает, что работа «бесполезная».

2. **`BLOCKED` vs `TIMED_WAITING`.** `BLOCKED` — ждёт **монитор**. `TIMED_WAITING` — ждёт **время** (`sleep`, `wait(timeout)`). В B — ждут монитор (`BLOCKED`). В C — спят (`TIMED_WAITING`). Разные причины.

3. **Почему `volatile` не спасает.** `volatile` гарантирует **видимость**: `main` увидит `ready = true`. Но `while (!ready)` — **busy wait**: поток **крутится** в цикле, тратя CPU. `volatile` не «останавливает» поток — он только «обновляет» значение. Для «остановки» — `CountDownLatch.await()` (усыпляет) или `BlockingQueue.take()`.

4. **Автоматизация.** JFR с метриками: `jdk.JavaMonitorEnter`, `jdk.ThreadPark`, `jdk.ThreadSleep`. Алерт: если contention > X% или потоков > Y — проблема. Плюс статический анализ (SpotBugs, PMD) — ловит `synchronized` без `try/finally`, `ThreadLocal` без `remove` и т.п.

## Задача 7. Диагноз по симптому

**A.** Инструмент: **thread dump** (`jstack`). Гипотеза: пул **маленький** (200 потоков), задачи **быстрые**, но `take()` на пустой очереди — потоки **ждут**. Либо producer **медленный** (не успевает класть), либо consumer **быстрый**, но задача «ничего не делает». **Исправление:** увеличить пул, или проверить producer (может, он «залип»), или проверить логику consumer (может, он «пустой» `take` крутит).

**B.** Инструмент: **heap dump** (`jmap -dump`) + **Eclipse MAT**. Гипотеза: `ThreadLocal` без `remove()` в пуле. Каждый поток держит `byte[]`, которые не освобождаются. **Исправление:** `remove()` в `finally` (глава 7.1).

**C.** Инструмент: **JFR** + **`jstack`** (для pinning) + **async-profiler** (для native). Гипотеза: `synchronized` вокруг I/O в JDK 21 — pinning. **Исправление:** заменить `synchronized` на `ReentrantLock`, или обновиться на JDK 24+, или вынести I/O за пределы `synchronized`.

**Ответы на вопросы.**

1. **A — `jstack`.** Искать: потоки в `WAITING` на `take()`, `pool-1-thread-*`. Гипотеза: пул маленький или producer медленный.

2. **B — heap dump.** Искать: `ThreadLocalMap` с большими значениями. Гипотеза: утечка `ThreadLocal`.

3. **C — JFR + `jstack`.** Искать: `jdk.JavaMonitorEnter` с высоким временем, потоки «пришпилены». Гипотеза: `synchronized` вокруг I/O.

4. **Исправления:** A — увеличить пул / проверить producer; B — `remove()` в `finally`; C — `ReentrantLock` / JDK 24+ / вынести I/O.

## Задача 8. Резюме в одном приложении

Ключевые моменты.

```java
public class OrderService {
    private static final ThreadLocal<OrderContext> context = new ThreadLocal<>();
    private final ExecutorService validatePool = Executors.newFixedThreadPool(10, r -> {
        Thread t = new Thread(r);
        t.setName("validate-" + t.getId());
        return t;
    });
    private final ExecutorService paymentPool = Executors.newVirtualThreadPerTaskExecutor();
    private final AtomicLong processed = new AtomicLong();
    private final AtomicLong failed = new AtomicLong();
    private final AtomicLong timeouts = new AtomicLong();

    public OrderResult process(Order order) {
        context.set(new OrderContext(order.id(), System.currentTimeMillis()));
        try {
            // CPU-bound валидация — платформенный пул
            Future<Boolean> valid = validatePool.submit(() -> validate(order));

            // I/O-bound оплата — виртуальный пул
            Future<String> payment = paymentPool.submit(() -> pay(order));

            if (!valid.get(1, TimeUnit.SECONDS)) {
                failed.incrementAndGet();
                return OrderResult.invalid();
            }
            String txId = payment.get(5, TimeUnit.SECONDS);
            processed.incrementAndGet();
            return OrderResult.success(txId);
        } catch (TimeoutException e) {
            timeouts.incrementAndGet();
            return OrderResult.timeout();
        } catch (Exception e) {
            failed.incrementAndGet();
            return OrderResult.error(e);
        } finally {
            context.remove(); // ← обязательно
        }
    }
}
```

**Что важно.**

- **Платформенный пул** — для CPU-bound валидации (10 = число ядер).
- **Виртуальный пул** — для I/O-bound оплаты (новый поток на задачу).
- **`ThreadLocal`** — для контекста, `remove()` в `finally`.
- **`StructuredTaskScope`** — для «всё или ничего» (если нужна атомарность между проверками).
- **Неизменяемый `Order`** (`record`) — безопасно передавать между потоками.
- **Метрики** — для диагностики.
- **Имена потоков** — для `jstack`.

## Проектное задание. Диагностика реального приложения

**Пять проблем и исправления.**

**Проблема 1: `HashMap` `stock`.** → `ConcurrentHashMap` с `merge`:

```java
stock.merge(item, -qty, Integer::sum); // атомарно
```

Плюс проверка «хватает ли» — через `compute`:

```java
Boolean ok = stock.compute(item, (k, v) -> v != null && v >= qty ? v - qty : v) != null;
```

**Проблема 2: `ArrayList` `orders`.** → `CopyOnWriteArrayList` (глава 5.3) или `Collections.synchronizedList` с блокировкой **всех** обращений.

**Проблема 3: `ThreadLocal` без `remove()`.** → `try/finally` с `requestStart.remove()`.

**Проблема 4: задачи в пуле, который сам пул.** «Pool starvation»: `buy` вызывается из `main`, но **внутри** `buy` — `pool.submit(...).get()`. `main` блокируется на `get()`, а пул из 50 потоков — все заняты **такими же** `get()`. Новые задачи **не запускаются**. Deadlock.

**Исправление:** либо `buy` — **не** через пул (вызывать синхронно), либо **два** пула: один для `check`, другой для `process`, либо `CompletableFuture` с явным `Executor` (без блокирующего `get` внутри `buy`).

**Проблема 5: нет `shutdown()`.** → `try/finally` с `shutdown` + `awaitTermination`.

**Ответы на вопросы со звёздочкой.**

1. **Pool starvation.** Формально: 50 потоков пула — все в `WAITING` на `Future.get()`. Новые задачи — в очереди. Очередь растёт. Прогресса нет. Это **вариант** deadlock: «потоки ждут задачи, задачи ждут потоков». Классическая проблема «recursive thread pool».

2. **Без `jstack`.** Метрики: `pool.getActiveCount() == pool.getPoolSize()` (все заняты), `pool.getQueue().size()` растёт. Если есть метрики — видно «очередь растёт, активных — максимум, throughput — ноль». Это признак pool starvation.

3. **Автоматизация.** `jcstress` — для тестирования многопоточных структур (находит гонки). JFR — для contention. SpotBugs/PMD — статический анализ (`synchronized` без `try/finally`, `ThreadLocal` без `remove`, `HashMap` в многопоточном контексте). Плюс **нагрузочное** тестирование (JMeter, Gatling) — под нагрузкой проблемы проявляются.

4. **Почему `ThreadLocal` всегда проблема.** В пуле — поток **переиспользуется**. `ThreadLocal` живёт **в потоке**. Даже с `remove()` — если **забыли** в одном месте, утечка. Если **ошиблись** с областью видимости (например, `remove` в неправильном `finally`) — утечка. Плюс — `ThreadLocal` **скрывает** зависимости: «откуда взялся `context`?» — не видно в сигнатуре. В современном коде — предпочитайте **явную** передачу параметров (через `record`, `CompletableFuture` с контекстом). `ThreadLocal` — только для «сквозных» вещей (trace-id, user), и **всегда** с `remove()`.

---

**Если все восемь задач решены и проектное задание сделано** — модуль 7 пройден, и **весь раздел по многопоточности** завершён. Вы теперь умеете:

- использовать `ThreadLocal` без утечек;
- выбирать между платформенными и виртуальными потоками;
- строить structured concurrency;
- применять неизменяемость как стратегию;
- диагностировать проблемы через `jstack`, JFR, VisualVM, async-profiler.

**Что дальше — финальный проект всего раздела:** «Многопоточный сервис обработки заказов», который объединяет **все** модули. Это то, что можно показать в портфолио.