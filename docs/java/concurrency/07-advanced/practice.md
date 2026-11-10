# Практикум по модулю 7. Продвинутое

## Зачем это

Модули 1–6 были про «как писать многопоточный код». Модуль 7 — про то, что отличает «работающий» код от «хорошего»: `ThreadLocal`, виртуальные потоки, structured concurrency, неизменяемость, диагностика.

Мы прошли пять глав. Пора собрать всё вместе. Задачи практикума требуют **выбирать** инструмент под задачу и **находить** проблемы в чужом коде — а не просто применять то, что изучали вчера.

**Разборы** — на отдельной странице: **[Разборы практикума](/java/concurrency/07-advanced/practice-solutions)**. Сначала попробуйте сами.

## Задача 1. ThreadLocal с корректной очисткой

**Что комбинируется:** 7.1 (`ThreadLocal`), 4.2 (`ExecutorService`), 7.5 (диагностика).

Реализуйте **контекст транзакции** на `ThreadLocal`.

**Постановка:**

1. Класс `TransactionContext`:
   - `ThreadLocal<String> transactionId`.
   - `ThreadLocal<Long> startTime`.
   - `ThreadLocal<List<String>> operations` — список выполненных операций.
   - `init(String id)` — устанавливает всё, включая пустой список операций.
   - `addOperation(String op)` — добавляет в список.
   - `getTransactionId()`, `getElapsed()`.
   - `clear()` — `remove()` на всех трёх.
2. Класс `TransactionProcessor`:
   - `process(String txId)` — `init`, три операции, `clear` в `finally`.
3. Пул на 4 потока. Отправьте 100 задач.

**Тесты:**

1. **С `clear()`:** после 100 задач — в каждом потоке пула `ThreadLocal` пуст. Проверьте через специальный метод, который читает `operations.size()` в начале `process` — должно быть `0` (или `null`).
2. **Без `clear()`:** уберите `clear()`. Запустите снова. Убедитесь, что `operations` «накапливаются» между задачами на одном потоке — это утечка.
3. **Диагностика:** снимите `jstack` во время работы. Убедитесь, что потоки пула — в `WAITING` на `take()`, и их **ровно 4**, не больше.

**Дополнительно:**

- Замените `ThreadLocal` на `InheritableThreadLocal`. Запустите. Работает ли передача в пуле? Почему?
- Добавьте в `process` внутри `CompletableFuture.supplyAsync(...)`. Убедитесь, что `transactionId` **не передаётся** в асинхронную задачу (это ожидаемо). Как это исправить? (Подсказка: передать явно через замыкание.)
- Замерьте: 1000 задач с `ThreadLocal` и без. Есть ли разница? Почему?

**Вопросы в комментарии:**

1. Почему `clear()` в `finally` — обязателен, даже если задача «не упала»?
2. Почему `set(null)` не заменяет `remove()`?
3. Почему `InheritableThreadLocal` не работает для задач в пуле?
4. Как `ThreadLocal` связан с утечкой памяти в пуле?

## Задача 2. Найди три ошибки

**Что комбинируется:** 7.1, 7.2, 7.4.

Вам дан код. В нём **три ошибки**, из-за которых программа либо течёт по памяти, либо теряет данные, либо «залипает». Найдите их, объясните и исправьте.

```java
import java.util.concurrent.*;
import java.util.*;

public class Main {
    private static final ThreadLocal<List<String>> buffer = 
        ThreadLocal.withInitial(ArrayList::new);

    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);

        for (int i = 0; i < 100; i++) {
            int id = i;
            pool.submit(() -> {
                buffer.get().add("item-" + id);
                // ... обработка
            });
        }

        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
        System.out.println("Готово");
    }
}
```

**Подсказки:**

- Ошибка 1 — `ThreadLocal` без `remove()`. Каждый поток пула накапливает `List<String>` — утечка памяти. Плюс «протекание» данных между задачами.
- Ошибка 2 — `submit` возвращает `Future`, а мы его игнорируем. Если задача упадёт — никто не узнает.
- Ошибка 3 — `pool.shutdown()` **без** `awaitTermination` **внутри** `try/finally` — если `main` прервут, пул не завершится. Плюс — `shutdown` не отменяет задачи, которые ещё в очереди.

## Задача 3. Виртуальные потоки для I/O

**Что комбинируется:** 7.2 (виртуальные потоки), 4.2 (`ExecutorService`), 7.5 (замеры).

Сравните **платформенные** и **виртуальные** потоки на I/O-bound задаче.

**Постановка:**

1. 10 000 «HTTP-запросов», каждый — `Thread.sleep(100)` (имитация I/O).
2. **Версия A:** `Executors.newFixedThreadPool(100)` — 100 платформенных потоков.
3. **Версия B:** `Executors.newVirtualThreadPerTaskExecutor()` — виртуальный поток на задачу.
4. **Версия C:** `Executors.newFixedThreadPool(1000)` — 1000 платформенных потоков (попробуйте, если память позволяет).

**Замеры:**

- Общее время каждой версии.
- Количество потоков в `jstack` во время работы.

**Дополнительно:**

- Добавьте `synchronized` вокруг `Thread.sleep(100)`. Замерьте на **JDK 21** и **JDK 24+**. Объясните разницу (pinning).
- Замените `synchronized` на `ReentrantLock`. Замерьте снова. Что изменилось?
- Запустите **CPU-bound** задачу (например, сумму квадратов от 1 до 1 000 000) в обеих версиях. Есть ли выигрыш у виртуальных потоков? Почему?

**Вопросы в комментарии:**

1. Почему виртуальные потоки дают огромный выигрыш на I/O-bound и почти ничего — на CPU-bound?
2. Почему `newFixedThreadPool(1000)` может упасть с `OutOfMemoryError`, а `newVirtualThreadPerTaskExecutor` — нет?
3. Что такое pinning и почему `synchronized` его вызывает (JDK 21–23)?
4. Почему виртуальные потоки **не нужно** пулить?

## Задача 4. Structured concurrency: «всё или ничего»

**Что комбинируется:** 7.3 (`StructuredTaskScope`), 6.3 (`CompletableFuture` — для сравнения).

Реализуйте **загрузку профиля** двумя способами: `CompletableFuture` и `StructuredTaskScope`.

**Постановка:** три источника:
- `loadUser(id)` — 200 мс, 20% падений.
- `loadOrders(id)` — 300 мс, 20% падений.
- `loadRecommendations(id)` — 400 мс, 10% падений.

**Версия A: `CompletableFuture`.**

1. Три `supplyAsync`.
2. `exceptionally` на каждом — вернуть `null` при ошибке.
3. `allOf` + `join` — собрать результаты.
4. Если **любой** `null` — вернуть `null` (профиль не загружен).

**Версия B: `StructuredTaskScope`.**

1. `open(Joiner.awaitAllSuccessfulOrThrow())`.
2. Три `fork`.
3. `join()` — если хоть один упал, `ExecutionException`, остальные **отменены**.
4. `get()` на каждом после `join`.

**Требования:**

- Замерьте время обеих версий на 100 запусках.
- Соберите статистику: сколько раз профиль загрузился (все успешны), сколько раз — нет.
- Убедитесь, что версия B **гарантирует** «все или никто»: если один упал, остальные **отменены** (а не «доработали в фоне»).

**Дополнительно:**

- Добавьте `withTimeout(Duration.ofMillis(500))` в версию B. Что произойдёт при таймауте?
- В версии A добавьте `orTimeout(500ms)` на каждом. Сравните поведение: в A — каждый «свой» таймаут, в B — общий на scope.
- Проверьте в `jstack` во время работы: в версии A могут быть «висящие» `CompletableFuture`, в B — нет (scope закрыт — все задачи завершены).

**Вопросы в комментарии:**

1. Почему версия B **гарантирует**, что «дети не переживут родителя», а версия A — нет?
2. Почему `get()` в версии B **не блокируется** после `join()`?
3. В чём разница между «отменить» (cancel) в A и «отменить» в B? Кто и когда отменяет?
4. Почему `StructuredTaskScope` — **preview** API? Что это значит для продакшена?

## Задача 5. Неизменяемость: immutable vs mutable

**Что комбинируется:** 7.4 (immutability), 2.2 (`synchronized`), 2.6 (атомарные).

Сравните **три** подхода к «счётчику денег».

**Постановка:**

1. **`MutableMoney`** — класс с `long amount`, `synchronized void add(long delta)`.
2. **`AtomicMoney`** — класс с `AtomicLong amount`, `void add(long delta)` через `addAndGet`.
3. **`ImmutableMoney`** — `record`, `ImmutableMoney add(long delta)` возвращает **новый** объект.

**Тесты:**

1. 10 потоков, каждый 100 000 раз добавляет 1. Замерьте время каждой версии.
2. Проверьте итоговый баланс: 1 000 000 во всех.
3. **Без синхронизации:** `MutableMoney` без `synchronized` — гонка, баланс меньше. `ImmutableMoney` без синхронизации — **корректен** (менять нечего).
4. **Под нагрузкой:** 100 потоков, 10 000 операций. Какая версия быстрее? Почему?

**Дополнительно:**

- Добавьте `ImmutableMoney` с **большим** состоянием (например, `List<Long> history`). Каждое `add` создаёт **новый** список с добавленной записью. Замерьте на 1000 операций. Насколько медленнее, чем `MutableMoney`?
- Замените `List` на `persistent list` (например, из Vavr, если есть). Сравните. Почему persistent list быстрее обычного копирования?
- Проверьте: `ImmutableMoney` можно **безопасно** шарить между потоками **без** `synchronized`. Запустите 100 раз — результат всегда корректен.

**Вопросы в комментарии:**

1. Почему `ImmutableMoney` потокобезопасен **без** `synchronized`?
2. Почему `AtomicMoney` быстрее `synchronized MutableMoney`?
3. В каком случае `ImmutableMoney` будет **медленнее** `AtomicMoney`?
4. Почему `record` с полем `List` — **не** полностью неизменяем? Как это исправить?

## Задача 6. Диагностика: найди проблему

**Что комбинируется:** 7.5 (диагностика), 2.7 (deadlock), 2.8 (livelock), 4.5 (shutdown).

Вам даны **четыре** программы. Каждая «зависает» или «тормозит». Снимите `jstack`, найдите проблему, исправьте.

**Программа A: deadlock.**

```java
public class A {
    static final Object L1 = new Object();
    static final Object L2 = new Object();

    public static void main(String[] args) {
        new Thread(() -> { synchronized (L1) { sleep(100); synchronized (L2) {} } }).start();
        new Thread(() -> { synchronized (L2) { sleep(100); synchronized (L1) {} } }).start();
    }
    static void sleep(long ms) { try { Thread.sleep(ms); } catch (InterruptedException e) {} }
}
```

**Программа B: contention.**

```java
public class B {
    static synchronized void slow() {
        try { Thread.sleep(50); } catch (InterruptedException e) {}
    }
    public static void main(String[] args) {
        for (int i = 0; i < 20; i++) new Thread(() -> { for (int j = 0; j < 10; j++) slow(); }).start();
    }
}
```

**Программа C: утечка потоков.**

```java
public class C {
    public static void main(String[] args) {
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> { try { Thread.sleep(600_000); } catch (InterruptedException e) {} }, "worker-" + i).start();
        }
    }
}
```

**Программа D: busy wait.**

```java
public class D {
    static volatile boolean ready = false;
    public static void main(String[] args) {
        new Thread(() -> { ready = true; }).start();
        while (!ready) { /* spin */ }
        System.out.println("Готово");
    }
}
```

**Что сделать:**

1. Запустите каждую.
2. Снимите `jstack -l <pid>`.
3. Найдите в дампе: для A — «Found one Java-level deadlock»; для B — много `BLOCKED` на одном мониторе; для C — 1000 потоков `worker-*` в `TIMED_WAITING`; для D — поток `main` в `RUNNABLE` на `while (!ready)`.
4. Исправьте каждую:
   - A — порядок захвата (глава 2.7).
   - B — вынести `sleep` за `synchronized` или заменить на `AtomicInteger`.
   - C — заменить на пул с `shutdown`.
   - D — заменить `volatile` + busy wait на `CountDownLatch` (глава 3.1) или `wait`/`notify`.

**Вопросы в комментарии:**

1. Почему в A JVM **сама** находит deadlock, а в D — нет?
2. Почему в B потоки в `BLOCKED`, а в C — в `TIMED_WAITING`? В чём разница (глава 1.4)?
3. Почему в D `volatile` **не спасает** от busy wait? Ведь поток видит `ready = true`?
4. Как бы вы **автоматизировали** поиск таких проблем в CI? (Подсказка: JFR + метрики + алерты.)

## Задача 7. Диагноз по симптому

**Что комбинируется:** всё.

Вам даны три **описания** проблем. Для каждой — предложите **инструмент** диагностики и **гипотезу**.

**Проблема A:** «Веб-сервер обрабатывает 100 запросов в секунду, а должен 10 000. CPU 30%, память 50%. Потоки в пуле — 200, большинство в `WAITING` на `BlockingQueue.take()`».

**Проблема B:** «Программа работает сутки, потом падает с `OutOfMemoryError`. Heap dump показывает: 90% памяти — `ThreadLocal$ThreadLocalMap` с большими `byte[]`».

**Проблема C:** «Сервис на JDK 21, обработка HTTP-запросов в виртуальных потоках. Под нагрузкой throughput падает до уровня платформенных потоков. Профилировщик показывает: много потоков «пришпилены» к носителям».

**Вопросы:**

1. Для A — какой инструмент? Что искать? Какая гипотеза?
2. Для B — какой инструмент? Что искать? Какая гипотеза?
3. Для C — какой инструмент? Что искать? Какая гипотеза?
4. Для каждой — как **исправить**?

## Задача 8. Резюме в одном приложении

**Что комбинируется:** всё.

Напишите **диагностируемый** сервис обработки заказов, который **демонстрирует** все концепции модуля 7.

**Сценарий:**

1. **Пул платформенных потоков** (10) для CPU-bound «валидации».
2. **Пул виртуальных потоков** для I/O-bound «отправки в платежную систему».
3. **`ThreadLocal`** для контекста заказа (`orderId`, `startTime`) — с `clear()` в `finally`.
4. **`StructuredTaskScope`** для «всё или ничего» при проверке заказа (три проверки параллельно).
5. **Неизменяемый `Order`** (`record`) — для безопасной передачи между потоками.
6. **Метрики** через `AtomicLong`: `processed`, `failed`, `timeouts`.
7. **`jstack`-дружественность**: все потоки с именами (`validate-worker-1`, `payment-virtual-5`, `order-scope-1`).
8. **`ThreadLocal` в `finally`** — проверьте, что утечки нет.

**Требования:**

- Все потоки **именованы**.
- `ThreadLocal` очищается в `finally`.
- Виртуальные потоки — для I/O, платформенные — для CPU.
- `StructuredTaskScope` — для «всё или ничего».
- Метрики — для диагностики.
- В конце — сводка: сколько заказов, сколько ошибок, сколько времени.

**Что проверяется:** умение собрать **диагностируемое** приложение, а не просто «работающее».

## 🎯 Проектное задание. Диагностика реального приложения

Это задание сложнее предыдущих. Оно не про «написать», а про **«найти и исправить»**.

### Постановка

Вам дан **готовый** код приложения, в котором **зашиты** пять проблем. Найдите их, объясните, исправьте.

### Код

```java
import java.util.*;
import java.util.concurrent.*;

public class ShopService {
    private static final ThreadLocal<Long> requestStart = new ThreadLocal<>();
    private static final Map<String, Integer> stock = new HashMap<>();
    private static final List<String> orders = new ArrayList<>();
    private final ExecutorService pool = Executors.newFixedThreadPool(50);
    private final Object lock = new Object();

    static {
        stock.put("apple", 100);
        stock.put("banana", 100);
    }

    public String buy(String item, int qty) throws Exception {
        requestStart.set(System.currentTimeMillis());

        Future<Boolean> check = pool.submit(() -> {
            synchronized (lock) {
                Integer available = stock.get(item);
                if (available == null || available < qty) {
                    return false;
                }
                stock.put(item, available - qty);
                return true;
            }
        });

        if (!check.get()) {
            return "out of stock";
        }

        Future<String> process = pool.submit(() -> {
            Thread.sleep(100);
            return "order-" + UUID.randomUUID();
        });

        String orderId = process.get();
        synchronized (lock) {
            orders.add(orderId);
        }
        return orderId;
    }

    public static void main(String[] args) throws Exception {
        ShopService shop = new ShopService();
        for (int i = 0; i < 1000; i++) {
            shop.buy("apple", 1);
        }
        System.out.println("Orders: " + orders.size());
        // НЕТ shutdown()
    }
}
```

### Пять проблем

1. **`HashMap` не потокобезопасна.** `stock` — обычный `HashMap`, к нему обращаются из разных потоков пула. Гонка. → `ConcurrentHashMap` с `merge`/`compute`.

2. **`ArrayList` не потокобезопасен.** `orders` — обычный `ArrayList`. Даже под `synchronized` — часть обращений (например, итерация) может быть без блокировки. → `CopyOnWriteArrayList` или `Collections.synchronizedList` с блокировкой **всех** обращений.

3. **`ThreadLocal` без `remove()`.** `requestStart` устанавливается, но не очищается. В пуле из 50 потоков — утечка. → `try/finally` с `requestStart.remove()`.

4. **Задачи в пуле, который **сам** пул.** `buy` вызывается из `main`, но внутри — `pool.submit(...)`, `pool.submit(...)`. `check.get()` и `process.get()` — блокируются. Если `main` отправит 1000 задач в пул из 50 потоков, **все 50** будут заняты блокирующими `get()` — и новые задачи **не запустятся**. **Deadlock** (или «pool starvation»). → не использовать пул для `buy`, или использовать **два** пула (один для `check`, другой для `process`), или перейти на `CompletableFuture` с явным `Executor`.

5. **Нет `shutdown()`.** `pool` — не демон, 50 потоков живут. `main` завершится, но JVM — нет. → `try/finally` с `pool.shutdown()` + `awaitTermination`.

### Тесты

1. **До исправления:** запустите. Что происходит? Скорее всего, зависнет или выдаст неверное `Orders`.
2. **Снимите `jstack`** во время работы. Найдите: потоки `pool-1-thread-*` в `WAITING` (на `get()`), `main` в `TIMED_WAITING` / `WAITING`. Это «pool starvation».
3. **Исправьте по одной проблеме.** После каждого исправления — запускайте, проверяйте, снимайте дамп.
4. **После всех исправлений:** 1000 заказов, `Orders: 1000`, `stock` корректен, программа завершается, `jstack` показывает **0** потоков пула (все завершены).

### Задание со звёздочкой

1. Почему «задачи в пуле, который сам пул» — это **рецепт** deadlock? Как это формально описать через теорию (глава 2.7)?
2. Как бы вы **нашли** проблему 4 **без** `jstack`? Что бы вы увидели в метриках?
3. Как бы вы **автоматизировали** поиск всех пяти проблем в CI? (Подсказка: `jcstress`, JFR, статический анализ — SpotBugs, PMD.)
4. Почему `ThreadLocal` в пуле — **всегда** потенциальная проблема, даже если `remove()` есть?

## 📖 Разборы

Все решения — на отдельной странице: **[Разборы практикума](/java/concurrency/07-advanced/practice-solutions)**. Сверяйтесь только после того, как попробовали сами.