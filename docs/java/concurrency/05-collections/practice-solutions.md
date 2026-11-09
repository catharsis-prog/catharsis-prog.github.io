# Разборы практикума по модулю 5

## Как пользоваться этой страницей

Разбор — это не «эталон». Читайте **после** того, как попробовали сами.

## Задача 1. Сравнить четыре списка

Типичные результаты (на машине с 8 ядрами, 1000 чтений, 10 добавлений):

| Вариант | Время | CME | Корректность |
|---|---|---|---|
| `ArrayList` без синхронизации | ~50 мс | 10/10 | Потеря данных |
| `ArrayList` + `synchronized` | ~250 мс | 0 | Полная |
| `Collections.synchronizedList` | ~260 мс | 0 | Полная |
| `CopyOnWriteArrayList` | ~60 мс | 0 | Полная (со снимком) |

**Почему так.**

**Вариант 1:** `ArrayList` не защищён. `modCount` меняется — итератор бросает `ConcurrentModificationException` почти гарантированно, потому что писатель добавляет элементы, пока читатели итерируются. «Или неверный результат» — если итератор не увидит изменения из-за кэшей (что тоже плохо, но по другой причине).

**Варианты 2 и 3:** `synchronized` даёт корректность, но **все** читатели сериализуются. Каждый `for (x : list)` держит монитор **всё время итерации**, а она долгая (1000 элементов). Итого — 250 мс вместо 50, потому что читатели ждут друг друга.

**Вариант 4:** `CopyOnWriteArrayList` **не блокирует** чтения. Каждый итератор работает со своим снимком. 10 добавлений — это 10 копий массива по 1000 элементов, дёшево (10 000 операций копирования — копейки). Итерация — как у `ArrayList` по скорости.

**Когда картина изменится.** Если писатель добавит 10000 элементов — `CopyOnWriteArrayList` станет **худшим** вариантом. 10000 копий по 1000+ элементов = 10+ миллионов операций копирования, плюс память под каждую копию. `synchronized`-версия обгонит его в разы, потому что блокировка на каждой записи — O(1), а не O(n).

**Ответы на вопросы.**

1. **Почему вариант 1 падает или врёт.** `ArrayList` не защищает `modCount`. Итератор проверяет `modCount` и бросает `ConcurrentModificationException`. Если проверка «проскочила» — итератор может видеть неконсистентное состояние (элемент, которого уже нет, или пропустить новый).

2. **Почему вариант 4 быстрее.** Нет блокировок на чтениях. Каждый итератор работает со снимком. Писатель делает свою работу параллельно, никого не задерживая.

3. **Почему при 10000 добавлений вариант 4 станет худшим.** Каждое добавление — O(n) копирование. При n=1000 и 10000 добавлений — 10 миллионов копирований. При этом `synchronized` делает O(1) на добавление под блокировкой — гораздо быстрее.

## Задача 2. Найди три ошибки

**Ошибка 1.** `HashMap` не потокобезопасна. `get` + `put` — составная операция, не атомарная. Между ними может вклиниться другой поток, и один инкремент потеряется. Итоговая сумма будет меньше 10000.

**Ошибка 2.** `failed++` — не атомарно. Даже если `RuntimeException` ловится в `catch`, инкремент `failed` — это read-modify-write, как `count++` из главы 2.1. Часть инкрементов потеряется. Должно быть 20 (10 потоков × 2), а получится меньше.

**Ошибка 3.** Даже `size()` у `HashMap` под нагрузкой может вернуть неверное значение. И `values().stream()` тоже — если во время итерации кто-то ещё пишет. Впрочем, здесь писатели уже закончили (join), но во время работы — `size()` мог быть неверным.

**Исправление:**

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final ConcurrentHashMap<String, Integer> counters = new ConcurrentHashMap<>();
    private static final AtomicInteger failed = new AtomicInteger(0);

    public static void main(String[] args) throws InterruptedException {
        Thread[] threads = new Thread[10];
        for (int i = 0; i < 10; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    String key = "key-" + (j % 100);
                    counters.merge(key, 1, Integer::sum); // атомарно
                    if (j % 500 == 0) {
                        try {
                            throw new RuntimeException("симуляция");
                        } catch (RuntimeException e) {
                            failed.incrementAndGet(); // атомарно
                        }
                    }
                }
            });
            threads[i].start();
        }
        for (Thread t : threads) t.join();
        System.out.println("Уникальных ключей: " + counters.size());
        System.out.println("Сумма значений: " + counters.values().stream().mapToInt(Integer::intValue).sum());
        System.out.println("Сбоев: " + failed.get());
    }
}
```

**Что здесь важно.** `merge` — атомарная операция над `ConcurrentHashMap`. `failed.incrementAndGet()` — атомарный инкремент. Теперь сумма всегда 10000, сбоев всегда 20.

## Задача 3. Кеш с ленивой загрузкой

```java
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public class UserRepository {
    public static class User {
        public final String id, name;
        public User(String id, String name) { this.id = id; this.name = name; }
    }

    private final ConcurrentHashMap<String, User> cache = new ConcurrentHashMap<>();
    private final AtomicInteger loads = new AtomicInteger(0);

    public User getUser(String id) {
        return cache.computeIfAbsent(id, this::loadFromDb);
    }

    public void invalidate(String id) {
        cache.remove(id);
    }

    public int size() {
        return cache.size();
    }

    public int getLoads() {
        return loads.get();
    }

    private User loadFromDb(String id) {
        loads.incrementAndGet();
        try {
            Thread.sleep(200);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return new User(id, "User-" + id);
    }
}
```

**Ответы на вопросы.**

1. **Почему `computeIfAbsent` гарантирует «одна загрузка на ключ».** Внутри `ConcurrentHashMap` реализует `computeIfAbsent` через CAS на бакете: если бакет пуст — блокируется только этот бакет, вычисляет значение, кладёт. Другие потоки, обращающиеся к тому же ключу, ждут на этом бакете. Первый вычислил — остальные видят готовое значение. Для **разных** ключей — разные бакеты, параллельно.

2. **Почему загрузки разных ключей — параллельно.** Разные ключи = разные бакеты = разные локи. Потоки не конкурируют. Общее время = max(200 мс), а не sum.

3. **Почему долгая операция внутри `computeIfAbsent` — плохо.** Пока функция работает, все потоки, обращающиеся к **тому же ключу**, ждут. Если функция полезла в сеть с таймаутом 30 секунд — все ждут 30 секунд. Один поток «держит» бакет. Для **разных** ключей это не проблема (разные бакеты), но если ключ популярный — блокировка надолго. Обход: сначала проверить `get`, если `null` — загрузить **вне** `computeIfAbsent`, потом `putIfAbsent` с проверкой. Это даёт возможность нескольким потокам загружать параллельно, но дублировать загрузку. Компромисс: либо «одна загрузка», либо «параллельно».

## Задача 4. Producer-consumer с завершением

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final String POISON = "__POISON__";

    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<String> queue = new ArrayBlockingQueue<>(10);
        CountDownLatch producersDone = new CountDownLatch(3);
        AtomicInteger consumed = new AtomicInteger(0);
        int consumersCount = 2;

        // Producers
        for (int i = 0; i < 3; i++) {
            int id = i;
            new Thread(() -> {
                try {
                    for (int j = 0; j < 20; j++) {
                        queue.put("order-" + id + "-" + j);
                        Thread.sleep(50);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    producersDone.countDown();
                }
            }, "producer-" + id).start();
        }

        // Consumers
        Thread[] consumers = new Thread[consumersCount];
        for (int i = 0; i < consumersCount; i++) {
            int id = i;
            consumers[i] = new Thread(() -> {
                try {
                    while (true) {
                        String item = queue.take();
                        if (POISON.equals(item)) {
                            System.out.println("consumer-" + id + " получил poison, завершаюсь");
                            return;
                        }
                        consumed.incrementAndGet();
                        Thread.sleep(100);
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }, "consumer-" + id);
            consumers[i].start();
        }

        producersDone.await();
        System.out.println("Все producers закончили. В очереди: " + queue.size());

        // ждём, пока очередь опустеет
        while (!queue.isEmpty()) {
            Thread.sleep(100);
        }

        // по poison на каждого consumer
        for (int i = 0; i < consumersCount; i++) {
            queue.put(POISON);
        }

        for (Thread c : consumers) c.join();
        System.out.println("Обработано: " + consumed.get() + " (ожидалось 60)");
    }
}
```

**Что здесь важно.**

- `CountDownLatch` даёт точку «все producers закончили».
- Poison pill — по одному на каждого consumer, чтобы каждый получил свой.
- Проверка «очередь опустела» — важна: если послать poison раньше, чем очередь опустеет, consumer получит poison **до** обработки оставшихся заказов. Заказы потеряются.

**Ответы на вопросы.**

1. **Почему нельзя просто закрыть очередь.** В `BlockingQueue` нет `close()`. Это не «поток», у которого можно вызвать `shutdown`. Она просто структура. Сигнал о завершении нужно передать **через данные** (poison pill) или **вне очереди** (флаг + `poll` с таймаутом).

2. **Почему `CountDownLatch` — правильная точка.** Она гарантирует: все producers **завершили** цикл `for`, все `put` сделаны. Дальше можно безопасно ждать опустошения.

3. **Почему poison на каждого consumer.** Каждый consumer должен получить **свой** poison, иначе один возьмёт poison, завершится, а второй останется ждать вечно. Один poison — для одного consumer.

## Задача 5. Неблокирующая очередь событий

```java
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicLong;

public class Main {
    static class Metric {
        final long timestamp;
        final double value;
        Metric(long t, double v) { timestamp = t; value = v; }
    }

    public static void main(String[] args) throws InterruptedException {
        ConcurrentLinkedQueue<Metric> queue = new ConcurrentLinkedQueue<>();
        CountDownLatch done = new CountDownLatch(5);
        AtomicLong count = new AtomicLong();
        AtomicLong sumBits = new AtomicLong(); // для double через bits

        // producers
        for (int i = 0; i < 5; i++) {
            new Thread(() -> {
                for (int j = 0; j < 1000; j++) {
                    queue.offer(new Metric(System.currentTimeMillis(), Math.random() * 100));
                }
                done.countDown();
            }).start();
        }

        // агрегатор
        Thread aggregator = new Thread(() -> {
            try {
                while (true) {
                    if (done.getCount() == 0 && queue.isEmpty()) break;
                    Metric m = queue.poll();
                    if (m == null) {
                        Thread.sleep(10);
                        continue;
                    }
                    count.incrementAndGet();
                    sumBits.addAndGet(Double.doubleToLongBits(m.value));
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        aggregator.start();
        aggregator.join();
        System.out.println("Обработано: " + count.get() + " (ожидалось 5000)");
    }
}
```

**Ответы на вопросы.**

1. **Почему `ConcurrentLinkedQueue` лучше.** Producer **никогда не блокируется**. В сценарии, где приложение генерирует метрику, оно не должно «зависать» из-за того, что агрегатор не успевает. `offer` возвращает `true` мгновенно. Для метрик это правильно: лучше потерять метрику, чем заблокировать приложение.

2. **Если producer быстрее — очередь растёт.** Метрики копятся в памяти. Это надо отслеживать: `size()` (хотя он O(n)) или `LongAdder` в producer отдельно. Признак: очередь растёт и память увеличивается. Решение: увеличить скорость агрегатора, добавить second aggregator, или начать **терять** метрики (что обычно приемлемо для мониторинга).

3. **Когда лучше `BlockingQueue`.** Если метрики **нельзя терять** — например, финансовые транзакции. Тогда `BlockingQueue` с ограничением даёт обратное давление: producer ждёт, но ничего не теряется. Для метрик мониторинга «лучше потерять, чем заблокировать» — поэтому `ConcurrentLinkedQueue`.

## Задача 6. Приоритетная очередь с двумя концами

```java
import java.util.concurrent.BlockingDeque;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    enum Priority { LOW, HIGH }

    static class Task {
        final int id;
        final Priority priority;
        Task(int id, Priority p) { this.id = id; this.priority = p; }
    }

    public static void main(String[] args) throws InterruptedException {
        BlockingDeque<Task> queue = new LinkedBlockingDeque<>(20);
        AtomicInteger lowCount = new AtomicInteger();
        AtomicInteger highCount = new AtomicInteger();

        Thread producer = new Thread(() -> {
            try {
                for (int i = 0; i < 50; i++) {
                    Priority p = ThreadLocalRandom.current().nextBoolean() ? Priority.HIGH : Priority.LOW;
                    Task task = new Task(i, p);
                    if (p == Priority.HIGH) queue.putFirst(task);
                    else queue.putLast(task);
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });

        Thread consumer = new Thread(() -> {
            try {
                while (true) {
                    Task t = queue.pollFirst(500, java.util.concurrent.TimeUnit.MILLISECONDS);
                    if (t == null) break;
                    if (t.priority == Priority.HIGH) highCount.incrementAndGet();
                    else lowCount.incrementAndGet();
                    Thread.sleep(50);
                }
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        });

        producer.start(); consumer.start();
        producer.join(); consumer.join();
        System.out.println("HIGH: " + highCount.get() + ", LOW: " + lowCount.get());
    }
}
```

**Ответы на вопросы.**

1. **Почему `putFirst` для HIGH работает, а для трёх уровней — нет.** `LinkedBlockingDeque` имеет только **два** конца. Для двух приоритетов — голова и хвост. Для трёх — нужен третий «конец», которого нет. Можно эмулировать (второй deque, объединение), но это громоздко. Для трёх уровней — `PriorityBlockingQueue`.

2. **Разница `LinkedBlockingDeque` и `PriorityBlockingQueue`.** Deque — O(1) вставка и извлечение, **два** уровня приоритета через концы. `PriorityBlockingQueue` — O(log n) вставка/извлечение, **любое** число приоритетов (через `Comparator`), но неограниченна и требует сравнимости.

3. **`PriorityBlockingQueue` неограниченна — почему проблема.** В отличие от `LinkedBlockingDeque(20)`, у `PriorityBlockingQueue` **нет** параметра ёмкости. Под нагрузкой она растёт, пока не кончится память. Для ограничения — обёртка или `ThreadPoolExecutor` с `PriorityBlockingQueue` — но там своя специфика (глава 4.3).

## Задача 7. Диагноз по симптому

**Программа А.** `synchronizedList` **не защищает итерацию**. `for (Integer x : list)` — не держит монитор на всё время. Итератор запоминает `modCount` и проверяет — если изменён, бросает `ConcurrentModificationException`. **Исправление:** либо `synchronized (list) { for ... }`, либо `CopyOnWriteArrayList`, либо перейти на `ConcurrentHashMap`/`ConcurrentLinkedQueue` в зависимости от задачи.

**Программа Б.** `LinkedBlockingQueue` **без ёмкости** — на самом деле `Integer.MAX_VALUE`. Под нагрузкой, где producer быстрее consumer, — очередь растёт, пока не кончится память. Через час-два — `OutOfMemoryError`. **Исправление:** `new LinkedBlockingQueue<>(1000)` или `ArrayBlockingQueue<>(1000)`. Плюс — `CallerRunsPolicy`-подобное поведение: если очередь полна — либо блокироваться, либо отвергать, либо обрабатывать в producer-потоке.

**Программа В.** `getOrDefault` + `put` — две операции, не атомарны. Даже `ConcurrentHashMap` не делает их атомарными. **Исправление:** `merge("counter", 1, Integer::sum)` или `compute("counter", (k, v) -> v == null ? 1 : v + 1)`. Оба — атомарны.

## Задача 8. Резюме в одном приложении

Полный код здесь приводить не буду — он объёмный. Ключевые моменты.

**Поток-переносчик «горячий → медленный»:**

```java
while (running) {
    String log = hotBuffer.poll();
    if (log == null) { Thread.sleep(1); continue; }
    if (!slowBuffer.offer(log)) { // переполнение
        // политика: отбрасываем или блокируемся
        overflowCount.incrementAndGet();
    }
}
```

**Поток-писатель:**

```java
while (running || !slowBuffer.isEmpty()) {
    String log = slowBuffer.poll(100, TimeUnit.MILLISECONDS);
    if (log != null) {
        writeToDisk(log); // sleep 10ms
    }
}
```

**Алертер:**

```java
while (running) {
    String log = errorDeque.pollFirst(100, TimeUnit.MILLISECONDS);
    if (log != null) {
        for (LogListener l : listeners) {
            l.onError(log); // CopyOnWriteArrayList — итерация безопасна
        }
    }
}
```

**Счётчики:**

```java
counters.merge(level, 1, Integer::sum); // ConcurrentHashMap — атомарно
```

**Ключевой навык:** выбрать структуру под задачу. Горячий буфер — неблокирующий (`ConcurrentLinkedQueue`), медленный — блокирующий с ёмкостью (`ArrayBlockingQueue`), приоритетные `ERROR` — `LinkedBlockingDeque` с `putFirst`, слушатели — `CopyOnWriteArrayList` (читаются часто, меняются редко), счётчики — `ConcurrentHashMap` с `merge`.

## Проектное задание. Потокобезопасный кеш с TTL и приоритетами

Один из вариантов дизайна.

**Основное хранилище:**

```java
ConcurrentHashMap<K, CacheEntry<V>> cache = new ConcurrentHashMap<>();
```

`get`:

```java
public V get(K key) {
    CacheEntry<V> entry = cache.computeIfAbsent(key, k -> new CacheEntry<>(loader.load(k), Priority.NORMAL));
    if (isExpired(entry)) {
        cache.remove(key, entry);
        entry = cache.computeIfAbsent(key, k -> new CacheEntry<>(loader.load(k), Priority.NORMAL));
    }
    entry.lastAccess = System.currentTimeMillis(); // volatile
    hits.incrementAndGet();
    return entry.value;
}
```

**Вытеснение (только LOW):**

```java
private void evictIfNeeded() {
    while (cache.size() > capacity) {
        K toEvict = findOldestLow(); // обход мапы — дорого, но под нагрузкой редко
        if (toEvict == null) break; // все HIGH — не вытесняем
        cache.remove(toEvict);
        evictions.incrementAndGet();
    }
}
```

**Фоновый cleaner:**

```java
scheduler.scheduleAtFixedRate(() -> {
    try {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> now - e.getValue().createdAt > ttl);
        expirations.addAndGet(...);
    } catch (Throwable t) { /* лог */ }
}, 0, 100, TimeUnit.MILLISECONDS);
```

**Ответы на вопросы со звёздочкой.**

1. **Эффективный LRU.** В стандартной библиотеке нет готового потокобезопасного LRU. `LinkedHashMap` с `accessOrder = true` — не потокобезопасен. `ConcurrentLinkedDeque` — можно, но вставка/удаление в середину — O(n). Промышленные кеши (Caffeine, Guava) используют собственные структуры: **bounded concurrent queue** с метками доступа и периодическим сканированием. Своими руками — сложно. Обычно берут готовый кеш.

2. **Приоритетное вытеснение.** Держать три мапы (или три набора ключей): `lowKeys`, `normalKeys`, `highKeys` — и вытеснять сначала из `lowKeys`, потом `normalKeys`, `highKeys` — только в крайнем случае. Или одна мапа + `ConcurrentSkipListMap<Priority, ConcurrentLinkedDeque<K>>`. Сложно, но реализуемо.

3. **Cleaner не успевает.** Отслеживать `size()` кеша через `AtomicLong` (обновлять при `put`/`remove`), и если размер растёт — увеличить частоту `cleaner` или добавить **второй** cleaner (например, один раз в секунду с `shutdownNow`-логикой). Признак: `expirations` растёт медленнее, чем `puts`, а `size()` растёт.

4. **Зачем `snapshot()` через `ConcurrentSkipListMap`.** `entrySet()` у `ConcurrentHashMap` **не упорядочен**. Для дебага часто нужно «все записи по порядку создания». `ConcurrentSkipListMap<createdAt, K>` даёт **отсортированный** снимок, и можно смотреть «первые N» или «последние N». Это удобно в логах и в админке. Обычная `entrySet()` даст произвольный порядок, что для дебага неудобно.

---

**Если все восемь задач решены и проектное задание сделано** — модуль 5 пройден. Вы теперь умеете:

- выбирать между `ArrayList`, `synchronizedList`, `CopyOnWriteArrayList` под задачу;
- использовать `ConcurrentHashMap` с атомарными операциями;
- строить producer-consumer на `BlockingQueue` с корректным завершением;
- применять неблокирующие очереди для «положил и забыл»;
- различать `BlockingDeque`, `SynchronousQueue` и когда что нужно.

Дальше — **модуль 6 «Асинхронность»**, где мы перестанем блокироваться на результатах и научимся строить цепочки вычислений через `CompletableFuture`. Это то, что в современном Java-коде используется постоянно — особенно в сервисах, где нужно «сделай запрос, потом обработай, потом отправь».