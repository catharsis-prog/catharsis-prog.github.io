# Финальный проект. Многопоточный сервис обработки заказов

## Что это и зачем

Это **финальный проект всего раздела по многопоточности**. Не «ещё одна задача» — а **сборка** всего, что вы прошли за семь модулей, в одну работающую систему. Если вы дошли до этой страницы и решили хотя бы половину практикумов — вы готовы.

Проект **не для того, чтобы «сдать и забыть»**. Это то, что можно **показать в портфолио** на собеседовании: «вот сервис, который обрабатывает 10 000 заказов в секунду, вот как я решил конкурентность, вот как диагностировал проблемы». Нанимающий увидит не «прочитал книжку», а «умеет строить».

**Что проверяется:**

- Все механизмы из модулей 1–7 — **в связке**, а не по отдельности.
- **Дизайн**: не просто «работает», а «предсказуемо, диагностируемо, масштабируемо».
- **Дисциплина**: имена потоков, обработка ошибок, корректное завершение, метрики.

**Сколько времени.** Проект рассчитан на **несколько вечеров**. Не пытайтесь сделать за один. Разбейте на этапы: сначала «чтобы работало», потом «чтобы было правильно», потом «чтобы было быстро и диагностируемо».

## Постановка

Вам нужно написать **сервис обработки заказов** для интернет-магазина. Сервис принимает заказы, проверяет их, отправляет в платёжную систему, резервирует товар на складе, отправляет уведомление пользователю и сохраняет результат.

**Вход:** поток «заказов» из «внешнего мира». В реальной системе — HTTP-запросы, сообщения из Kafka, файлы. В проекте — `BlockingQueue` или симулятор, который генерирует заказы с заданной частотой.

**Выход:** для каждого заказа — «успешно» (с номером транзакции) или «ошибка» (с причиной). Плюс метрики: сколько обработано, сколько упало, где узкие места.

### Архитектура

Сервис состоит из **пяти этапов**, каждый — со своими характеристиками.

**Этап 1: приём.** Принимает заказ, валидирует «формат» (все поля на месте, сумма положительная). **CPU-bound**, быстрый.

**Этап 2: проверка склада.** Запрашивает «склад» — есть ли товар. **I/O-bound** (в реальной системе — сеть, в проекте — `Thread.sleep` + случайный отказ). Может занять 100–300 мс.

**Этап 3: оплата.** Отправляет в «платёжную систему». **I/O-bound**, самый медленный (200–500 мс). Может упасть с вероятностью 10%.

**Этап 4: резервирование.** Резервирует товар на складе. **CPU-bound + короткий I/O** (50–100 мс). **Должен быть атомарным** — если заказ не прошёл, товар не должен «застрять».

**Этап 5: уведомление.** Отправляет пользователю письмо. **I/O-bound**, может «упасть» (50% шанс), но **не критично** — если не отправилось, заказ всё равно успешен.

### Потоки и пулы

Вот где начинается многопоточность.

**Очередь приёма.** `ArrayBlockingQueue<Order>(1000)`. Producer — «внешний мир» (симулятор), consumer — пул обработки.

**Пул валидации.** `Executors.newFixedThreadPool(4)` — CPU-bound, быстрая валидация.

**Пул склада.** `Executors.newVirtualThreadPerTaskExecutor()` — I/O-bound, много параллельных запросов. (На JDK 21+ — виртуальные. На JDK < 21 — `newFixedThreadPool(50)` или `CompletableFuture` с явным пулом.)

**Пул оплаты.** Тоже виртуальные или `newFixedThreadPool(20)` — I/O-bound, но **с ограничением** (платёжная система не любит больше 20 одновременных запросов). Ограничение — через `Semaphore(20)`.

**Пул уведомлений.** `newFixedThreadPool(10)` — I/O-bound, но **не критично** — можно «отбросить», если очередь переполнена (`CallerRunsPolicy` или `DiscardPolicy` с метрикой).

**Планировщик метрик.** `newScheduledThreadPool(1)` — раз в секунду печатает статистику. Демон.

**Пул общих задач.** `ForkJoinPool` — для параллельной «сборки» результата, если нужно.

### Модель данных

```java
public record Order(String id, String userId, String itemId, int quantity, long amount) {}

public sealed interface OrderResult permits Success, Failure {
    record Success(String orderId, String transactionId, long processedAt) implements OrderResult {}
    record Failure(String orderId, String reason, long processedAt) implements OrderResult {}
}

public final class Metrics {
    private final LongAdder accepted = new LongAdder();
    private final LongAdder validated = new LongAdder();
    private final LongAdder stockChecked = new LongAdder();
    private final LongAdder paid = new LongAdder();
    private final LongAdder reserved = new LongAdder();
    private final LongAdder notified = new LongAdder();
    private final LongAdder failed = new LongAdder();
    private final LongAdder timeouts = new LongAdder();
    // геттеры и increment-методы
}
```

**Обратите внимание:** `Order` — `record` (неизменяемый, глава 7.4). `OrderResult` — `sealed` (Java 17+, для типобезопасности). `Metrics` — `LongAdder` (глава 2.6, лучше `AtomicLong` при высокой конкуренции).

### Обработка ошибок

**На каждом этапе — своя стратегия.**

**Валидация:** «заказ некорректен» → `Failure` сразу, дальше не идём.

**Склад:** «нет товара» → `Failure`, дальше не идём. «Склад недоступен» (timeout) → **retry** один раз, потом `Failure`.

**Оплата:** «платёж отклонён» → `Failure`. «Платёжная система недоступна» (timeout) → **retry** один раз, потом `Failure`. Успех → `transactionId`.

**Резервирование:** «не удалось зарезервировать» → **откат** оплаты (в реальной системе — refund). В проекте — просто `Failure` с пометкой «требуется возврат».

**Уведомление:** «не удалось отправить» → **не влияет** на результат. Заказ успешен, но метрика «notified» не увеличивается.

**Общий принцип:** этап может **упасть**, но сервис **продолжает** обрабатывать другие заказы. Один «плохой» заказ не должен «уронить» сервис.

### Асинхронная обработка

Каждый заказ проходит через **цепочку** этапов. Это идеальный кандидат для `CompletableFuture` (глава 6.2).

```java
CompletableFuture<OrderResult> process(Order order) {
    return CompletableFuture
        .supplyAsync(() -> validate(order), validatePool)
        .thenCompose(validated -> validated != null
            ? CompletableFuture.supplyAsync(() -> checkStock(validated), stockPool)
                .orTimeout(1, TimeUnit.SECONDS)
                .exceptionally(ex -> StockResult.unavailable())
            : CompletableFuture.completedFuture(StockResult.invalid()))
        .thenCompose(stock -> stock.ok()
            ? CompletableFuture.supplyAsync(() -> pay(order), paymentPool)
                .orTimeout(2, TimeUnit.SECONDS)
            : CompletableFuture.completedFuture(PaymentResult.outOfStock()))
        .thenCompose(payment -> payment.ok()
            ? CompletableFuture.supplyAsync(() -> reserve(order), reservePool)
            : CompletableFuture.completedFuture(ReserveResult.paymentFailed()))
        .thenApply(reserve -> {
            if (reserve.ok()) {
                CompletableFuture.runAsync(() -> notify(order), notifyPool)
                    .exceptionally(ex -> null); // не влияет на результат
                return OrderResult.success(order.id(), payment.transactionId());
            }
            return OrderResult.failure(order.id(), reserve.reason());
        });
}
```

**Что важно.**

- **Каждый этап** — в **своём** пуле. CPU-bound — платформенный, I/O-bound — виртуальный или с `Semaphore`.
- **`thenCompose`** — потому что каждый этап возвращает `CompletableFuture`.
- **`orTimeout`** — на I/O-этапах (склад, оплата). Не ждём вечно.
- **`exceptionally`** — на этапах, где «ошибка = fallback» (склад недоступен → «недоступен», не «упал»).
- **Уведомление** — **fire-and-forget**: запустили и не ждём. `exceptionally(ex -> null)` — чтобы ошибка уведомления не «убила» цепочку.
- **Ошибки на этапах** — не «пробрасываются» в `main`, а **обрабатываются** и превращаются в `OrderResult`.

### Structured concurrency (опционально)

Если на JDK 21+, можно использовать `StructuredTaskScope` для «все или ничего» на этапах проверки. Например, «склад» и «резерв» можно проверить **параллельно**, и если хоть один «нет» — отменить оба.

```java
try (var scope = StructuredTaskScope.open(Joiner.awaitAllSuccessfulOrThrow())) {
    var stock = scope.fork(() -> checkStock(order));
    var reserve = scope.fork(() -> reserve(order));
    scope.join();
    // оба успешны — идём дальше
} catch (ExecutionException e) {
    // один упал — оба отменены
}
```

**Осторожно:** это **preview**. Если JDK < 21 или нет `--enable-preview` — используйте `CompletableFuture` с `exceptionally` и **ручной** отменой через `cancel(true)`.

### Ограничение параллелизма

Три места, где нужно **ограничить** параллелизм.

**Платёжная система:** не больше 20 одновременных запросов. `Semaphore(20)` вокруг вызова.

```java
private final Semaphore paymentSemaphore = new Semaphore(20);

PaymentResult pay(Order order) {
    try {
        paymentSemaphore.acquire();
        try {
            return paymentClient.charge(order);
        } finally {
            paymentSemaphore.release();
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        return PaymentResult.interrupted();
    }
}
```

**Склад:** не больше 50 одновременных запросов (аналогично).

**Очередь приёма:** `ArrayBlockingQueue(1000)`. Если очередь полна — «внешний мир» **ждёт** (`put`) или **отвергает** (`offer` + метрика `rejected`).

### Корректное завершение

Сервис должен **корректно** завершаться по сигналу (Ctrl+C, SIGTERM, `shutdown()` из теста).

**Что нужно сделать.**

1. **Перестать принимать новые заказы.** `running = false`, producer перестаёт класть в очередь.
2. **Дождаться, пока очередь опустеет.** `queue.isEmpty()` в цикле с таймаутом.
3. **Завершить пулы.** `shutdown()` + `awaitTermination` для каждого.
4. **Если не завершились** — `shutdownNow()` + повторный `awaitTermination`.
5. **Напечатать финальные метрики.**

```java
public void shutdown() throws InterruptedException {
    running = false;

    // ждём, пока очередь опустеет
    long deadline = System.currentTimeMillis() + 30_000;
    while (!queue.isEmpty() && System.currentTimeMillis() < deadline) {
        Thread.sleep(100);
    }

    // завершаем пулы
    shutdownPool(validatePool);
    shutdownPool(stockPool);
    shutdownPool(paymentPool);
    shutdownPool(reservePool);
    shutdownPool(notifyPool);
    scheduler.shutdown();

    metrics.print();
}

private void shutdownPool(ExecutorService pool) throws InterruptedException {
    pool.shutdown();
    if (!pool.awaitTermination(10, TimeUnit.SECONDS)) {
        pool.shutdownNow();
        if (!pool.awaitTermination(5, TimeUnit.SECONDS)) {
            System.err.println("Пул не завершился: " + pool);
        }
    }
}
```

**Shutdown hook** — для Ctrl+C:

```java
Runtime.getRuntime().addShutdownHook(new Thread(() -> {
    try {
        service.shutdown();
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
    }
}));
```

### Метрики и диагностика

**Что мерить.**

- **Принято** (`accepted`) — сколько заказов пришло.
- **Прошло валидацию** (`validated`).
- **Склад проверен** (`stockChecked`), из них «нет товара» (`outOfStock`).
- **Оплачено** (`paid`), из них «отклонено» (`paymentFailed`).
- **Зарезервировано** (`reserved`).
- **Уведомлено** (`notified`).
- **Ошибок** (`failed`), **таймаутов** (`timeouts`).
- **Размер очереди** (`queueSize`).
- **Активных потоков в каждом пуле** (`activeCount`).

**Как печатать.** `ScheduledExecutorService` раз в секунду:

```java
scheduler.scheduleAtFixedRate(() -> {
    try {
        System.out.printf(
            "[%tT] queue=%d accepted=%d paid=%d failed=%d timeouts=%d%n",
            new Date(),
            queue.size(),
            metrics.accepted.sum(),
            metrics.paid.sum(),
            metrics.failed.sum(),
            metrics.timeouts.sum()
        );
    } catch (Throwable t) {
        System.err.println("metrics error: " + t);
    }
}, 0, 1, TimeUnit.SECONDS);
```

**Что важно:** `try/catch(Throwable)` вокруг тела — иначе `ScheduledExecutorService` «умрёт» после первого исключения (глава 4.4).

**Имена потоков** — обязательно. `validate-worker-1`, `stock-virtual-5`, `payment-3`, `notify-worker-2`, `metrics-scheduler`. В `jstack` — сразу видно, где проблема (глава 7.5).

### Тестирование под нагрузкой

**Что проверить.**

1. **Пропускная способность.** Сколько заказов в секунду обрабатывается при 10 потоках producer? При 100?
2. **Задержка.** Сколько в среднем и в 99-м перцентиле (p99)?
3. **Ошибки.** Какой процент заказов падает? На каком этапе?
4. **Пиковая нагрузка.** Что происходит, если разом приходит 5000 заказов? Очередь переполняется? `rejected`?
5. **Отказы.** Что если «склад» недоступен 5 секунд? Сервис продолжает работать? Восстанавливается?
6. **Завершение.** Ctrl+C во время нагрузки — сервис корректно завершается? Все задачи дорабатывают? Метрики печатаются?

**Как измерять.** JMH (Java Microbenchmark Harness) или простые замеры через `System.nanoTime()`. Для нагрузки — `ExecutorService` с producer'ами, которые кладут заказы с заданной частотой.

### Диагностика: типичные проблемы

**Проблема 1: «сервис тормозит, очередь растёт».**

Снять `jstack`. Смотреть: пулы. Если `validatePool` — все в `RUNNABLE` на `validate` — CPU-bound, мало потоков (4 на 8 ядер). Если `paymentPool` — все в `WAITING` на `Semaphore.acquire` — платёжная система «забита», 20 потоков ждут. Решение: увеличить `Semaphore`, или разобраться, почему платёжная система медленная.

**Проблема 2: «через час падает с `OutOfMemoryError`».**

Heap dump. Смотреть: что занимает память. Если `ThreadLocalMap` — утечка (глава 7.1). Если `ArrayBlockingQueue` — очередь переполнена, producer быстрее consumer. Если `CompletableFuture` — «висящие» цепочки (забыли `join`/`get`).

**Проблема 3: «раз в день зависает».**

`jstack` в момент зависания. Смотреть: deadlock? `BLOCKED` на одном мониторе? `WAITING` на `take`? Если deadlock — порядок захвата (глава 2.7). Если `WAITING` на `take` — producer «залип», не кладёт. Если `BLOCKED` — contention, возможно, `synchronized` вокруг долгой операции.

**Проблема 4: «на JDK 21 виртуальные потоки не дают ускорения».**

Профилировщик (JFR). Смотреть: `jdk.JavaMonitorEnter` с большим временем. Если много — pinning (глава 7.2). Решение: `ReentrantLock` вместо `synchronized`, или JDK 24+.

**Проблема 5: «платёжная система отвечает 500 — сервис падает».**

Смотреть: обработка ошибок. `CompletableFuture` без `exceptionally` — цепочка «умирает», `main` не узнаёт. Нужно `exceptionally` на каждом I/O-этапе, `OrderResult.failure` с причиной.

### Этапы выполнения

**Этап 1: «чтобы работало».** Простая версия: один пул, синхронная обработка, без таймаутов, без метрик. Цель — **запустить** и увидеть, что заказы обрабатываются.

**Этап 2: «правильно».** Разделить пулы: CPU-bound и I/O-bound. Добавить `CompletableFuture` с цепочкой. Добавить `orTimeout` на I/O. Добавить `Semaphore` на платёжную систему.

**Этап 3: «надёжно».** Обработка ошибок на каждом этапе. Retry. Fallback. Метрики через `LongAdder`. Планировщик метрик.

**Этап 4: «диагностируемо».** Имена потоков. Shutdown hook. Корректное завершение. Логирование ошибок с контекстом.

**Этап 5: «быстро».** Профилирование. Поиск узких мест. Виртуальные потоки (если JDK 21+). `LongAdder` вместо `AtomicLong`. `Semaphore` с `fair=true`, если нужна справедливость.

**Этап 6 (опционально): «structured concurrency».** `StructuredTaskScope` для «всё или ничего» на этапах проверки. Требует JDK 21+ с `--enable-preview`.

### Критерии готовности

Проект **готов**, если:

1. **Функциональность:** все 5 этапов работают. Успешные заказы → `Success` с `transactionId`. Неуспешные → `Failure` с причиной.
2. **Корректность:** под нагрузкой 1000 заказов/сек — 0 «потерянных», 0 «задублированных». Все `Success` + все `Failure` = все принятые.
3. **Надёжность:** падение «склада» или «оплаты» на 5 секунд — сервис **продолжает** работать, восстанавливается.
4. **Завершение:** Ctrl+C — сервис завершается за < 30 секунд, все задачи дорабатывают, метрики печатаются.
5. **Диагностируемость:** `jstack` показывает **осмысленные** имена потоков. Метрики печатаются раз в секунду.
6. **Производительность:** throughput ≥ 100 заказов/сек (при «оплате» 200 мс и `Semaphore(20)` — теоретический максимум 100/сек; реальный — 80–90).

### Что показать в портфолио

**README** с описанием архитектуры, диаграммой потоков, метриками под нагрузкой, известными ограничениями.

**Код** — на GitHub. С тестами (JUnit 5 + JMH). С `Dockerfile` (чтобы можно было запустить).

**Замеры.** «Под нагрузкой 100 заказов/сек — p99 250 мс, 0 ошибок. При 200 заказов/сек — p99 800 мс, 5% timeout на оплате (платёжная система не справляется)».

**Диагностика.** «Вот `jstack` под нагрузкой — видно, что 20 потоков ждут `Semaphore`, значит, платёжная система — узкое место. Вот heap dump после суток — `ThreadLocal` без `remove` дал утечку 200 МБ. Исправил — стало 50 МБ».

**Это и есть «умею писать многопоточный код».** Не «прочитал книжку», а «построил систему и знаю, как её диагностировать».

## 📌 Раздел завершён

Вы прошли **весь раздел по многопоточности**: 7 модулей, 43 урока, 7 практикумов, финальный проект. Это **огромный** объём — сравнимый с университетским курсом. Если вы **решили** хотя бы половину практикумов — вы знаете многопоточность **лучше**, чем 90% разработчиков на собеседованиях.

**И последнее.** Многопоточность — это не «набор трюков». Это **дисциплина мышления**: «а что если два потока?», «а что если упадёт?», «а что если завершится?». Если вы теперь **автоматически** задаёте эти вопросы, глядя на код, — вы **научились**. Дальше — только практика.