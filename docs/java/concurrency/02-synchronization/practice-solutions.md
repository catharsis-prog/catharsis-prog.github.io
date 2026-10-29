# Разборы практикума по модулю 2

## Как пользоваться этой страницей

Разбор — это не «эталон». Это **один из возможных** способов решить задачу. Если ваш код отличается от приведённого, но работает и вы понимаете почему — это нормально. Многопоточность почти никогда не имеет единственного правильного ответа.

Читайте разбор **после** того, как попробовали сами.

## Задача 1. Один счётчик, три подхода

**Версия 1: `synchronized`.**

```java
public class Main {
    private static int counter = 0;

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(Main::incrementMany);
        Thread t2 = new Thread(Main::incrementMany);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("synchronized: " + counter);
    }

    private static synchronized void incrementMany() {
        for (int i = 0; i < 1000; i++) counter++;
    }
}
```

**Версия 2: `AtomicInteger`.**

```java
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final AtomicInteger counter = new AtomicInteger(0);

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(Main::incrementMany);
        Thread t2 = new Thread(Main::incrementMany);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("AtomicInteger: " + counter.get());
    }

    private static void incrementMany() {
        for (int i = 0; i < 1000; i++) counter.incrementAndGet();
    }
}
```

**Версия 3: `volatile` внутри `synchronized`.**

```java
public class Main {
    private static volatile int counter = 0;

    public static void main(String[] args) throws InterruptedException {
        Thread t1 = new Thread(Main::incrementMany);
        Thread t2 = new Thread(Main::incrementMany);
        t1.start(); t2.start();
        t1.join(); t2.join();
        System.out.println("volatile+synchronized: " + counter);
    }

    private static void incrementMany() {
        for (int i = 0; i < 1000; i++) {
            synchronized (Main.class) {
                counter++;
            }
        }
    }
}
```

**Что здесь важно.** Все три дают 2000. Разница — в производительности и в назначении.

`synchronized` на методе блокирует весь цикл из 1000 итераций — это грубо. `AtomicInteger` использует CAS-цикл без блокировки — быстро. `volatile` + `synchronized`-блок вокруг `counter++` — это `synchronized` на минимальном участке плюс `volatile` для видимости, хотя `synchronized` сам по себе уже даёт видимость, так что `volatile` здесь **избыточен**.

**Ответы на вопросы.**

1. На коротком цикле разница в производительности невелика. При больших объёмах `AtomicInteger` обычно быстрее. `synchronized` на методе — самый медленный вариант, потому что блокирует больше, чем нужно.
2. `volatile` даёт **видимость**, но не атомарность. `synchronized` даёт **и видимость, и атомарность**. В третьей версии именно `synchronized`-блок делает `counter++` атомарным; `volatile` тут ничего не добавляет.
3. `synchronized` — когда операция сложная (несколько переменных, check-then-act). `AtomicInteger` — когда операция простая (инкремент, замена, добавление).

## Задача 2. Найди три ошибки

**Ошибка 1.** `producer` не вызывает `lock.notify()`/`lock.notifyAll()` — `consumer` не просыпается. Даже если условие стало `true`, сигнала нет.

**Ошибка 2.** `ready` не `volatile` и не защищён тем же монитором, что и у `consumer`. `producer` пишет `ready = true` без `synchronized (lock)`, `consumer` читает под `lock`. Между записью и чтением **нет** happens-before. `consumer` может не увидеть `true` — даже после `notifyAll`.

**Ошибка 3.** `if` вместо `while`. Если `wait()` проснётся «ложно» (spurious wakeup), `consumer` продолжит без проверки условия.

**Исправленный код:**

```java
public class Main {
    private static boolean ready = false;
    private static int data = 0;
    private static final Object lock = new Object();

    public static void main(String[] args) throws InterruptedException {
        Thread producer = new Thread(() -> {
            synchronized (lock) {
                data = 42;
                ready = true;
                lock.notifyAll();
            }
        }, "producer");

        Thread consumer = new Thread(() -> {
            synchronized (lock) {
                while (!ready) {
                    try {
                        lock.wait();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
                System.out.println("data = " + data);
            }
        }, "consumer");

        consumer.start();
        Thread.sleep(100);
        producer.start();
        producer.join();
        consumer.join();
    }
}
```

**Что здесь важно.** `producer` теперь **внутри** `synchronized (lock)`, поэтому запись `ready = true` защищена тем же монитором, что и чтение. Между выходом `producer` из `synchronized` и входом `consumer` в `synchronized` действует happens-before через монитор. `notifyAll` разбудит `consumer`, а `while` защитит от spurious wakeup.

## Задача 3. Цепочка happens-before

**Ответ: да, `C` гарантированно увидит `dataA == 1`.**

**Цепочка:**

1. Поток `A`: `dataA = 1` happens-before `dataA`-запись видна в `B` (volatile-правило).
2. Поток `B`: чтение `dataA == 1` happens-before запись `dataB = 2` (program order внутри `B`).
3. Поток `C`: чтение `dataB == 2` happens-before чтение `dataA` (volatile-правило и program order внутри `C`).
4. По транзитивности: `dataA = 1` happens-before `dataB = 2` happens-before чтения `dataA` в `C`. Значит, `C` увидит `dataA = 1`.

**Дополнительно.** Если `dataA` сделать обычным `int`, цепочка **не сохранится**. Между `dataA = 1` (без volatile) и чтением `dataA` в `C` нет прямого happens-before. `dataB` (volatile) даёт happens-before только для действий **до** записи `dataB`. Запись `dataA` была до записи `dataB` — значит, по правилу volatile она должна быть видна. **Но** запись `dataA` — это запись в **обычную** переменную, и правило volatile распространяется на неё только если она была сделана **тем же потоком** до volatile-записи. Здесь так и есть: `A` записал `dataA`, потом `B` увидел `dataA` через volatile, потом `B` записал `dataB`. Цепочка сохраняется: `dataA = 1` happens-before чтения `dataA` в `B` (volatile) happens-before записи `dataB` (program order в `B`) happens-before чтения `dataB` в `C` (volatile) happens-before чтения `dataA` в `C` (program order в `C`). **Транзитивность работает и без `volatile` на `dataA`.**

Это тонкий момент: `volatile` на промежуточных переменных «протягивает» видимость **всех** изменений, сделанных до них. Если ваша цепочка volatile-переменных соединяет запись и чтение, всё, что было до записи, видно после чтения — даже если это обычные переменные.

## Задача 4. Переводы без deadlock

```java
public class BankAccount {
    private final int id;
    private int balance;

    public BankAccount(int id, int balance) {
        this.id = id;
        this.balance = balance;
    }

    public void transfer(BankAccount to, int amount) {
        BankAccount first = this.id < to.id ? this : to;
        BankAccount second = this.id < to.id ? to : this;
        synchronized (first) {
            synchronized (second) {
                this.balance -= amount;
                to.balance += amount;
            }
        }
    }

    public int getBalance() {
        synchronized (this) {
            return balance;
        }
    }
}
```

**Что здесь важно.** Порядок захвата определяется по `id`, а не по тому, кто «свой», а кто «чужой». Оба потока, как бы они ни вызывали `transfer`, захватывают сначала счёт с меньшим `id`, потом с большим. Цикла нет, deadlock невозможен.

`getBalance()` синхронизирован по `this` — это **не** тот же монитор, что используется в `transfer` для этого счёта, если `id` не совпадает. Формально это значит, что `getBalance` может увидеть промежуточное состояние. Для точности `getBalance` тоже должен использовать **тот же порядок**, но поскольку он читает только один счёт, а `transfer` держит оба — на практике чтение `getBalance` во время `transfer` может увидеть «половину перевода». Если это критично — нужно либо защищать все операции одним монитором, либо использовать `BankAccount.class`.

**Ответы на вопросы.**

1. Порядок по `id` разрывает цикл ожидания: не может быть «A ждёт B, B ждёт A», потому что оба захватывают в порядке возрастания.
2. Если оба перевода с A на B — deadlock без порядка **возможен** только если разные мониторы. При едином мониторе — нет.
3. Порядок по `id` сохраняет параллельность: переводы между независимыми парами счетов не сериализуются. Глобальный монитор `BankAccount.class` сериализует **все** переводы — плохо для производительности.

## Задача 5. Ограниченный буфер

```java
import java.util.ArrayDeque;
import java.util.Deque;

public class BoundedBuffer<T> {
    private final Deque<T> items = new ArrayDeque<>();
    private final int capacity;

    public BoundedBuffer(int capacity) {
        this.capacity = capacity;
    }

    public synchronized void put(T item) throws InterruptedException {
        while (items.size() == capacity) {
            wait();
        }
        items.addLast(item);
        notifyAll();
    }

    public synchronized T take() throws InterruptedException {
        while (items.isEmpty()) {
            wait();
        }
        T item = items.removeFirst();
        notifyAll();
        return item;
    }

    public synchronized int size() {
        return items.size();
    }
}
```

**Что здесь важно.** Оба метода используют `while` и `notifyAll()`. После `put` будим всех — мог освободиться элемент для `take`. После `take` будим всех — могло освободиться место для `put`. `notifyAll` безопаснее, чем `notify`, потому что `notify` может разбудить «не тот» поток.

**Про замену на `notify()`.** Если заменить `notifyAll()` на `notify()`, программа **зависнет** — почти гарантированно. Причина: `notify()` будит **один случайный** поток. Если разбудили `producer`, а нужно было разбудить `consumer` (потому что буфер освободился и нужен `take`), `producer` увидит, что буфер полон, и снова уснёт. `consumer`, который мог бы забрать элемент, так и не будет разбужен. Все засыпают, программа висит. Это классическая ловушка `notify` + несколько условий.

## Задача 6. Справедливость и starvation

**Ответы на вопросы.**

1. Пять потоков **не** получают равное количество итераций. Один поток может сделать 200 итераций, другой — 20, третий — 5. Распределение сильно неравномерное.
2. **Да, starvation возможен.** `notify()` будит один поток. Если повезло одному и тому же — он снова захватывает лок, снова отпускает, снова его будят. Другие стоят.
3. С `notifyAll()` распределение становится **гораздо ровнее**: каждый раз будятся все, кто ждёт, кто-то один захватывает лок, но шанс примерно одинаковый у всех. Не идеальная справедливость, но starvation исчезает на практике.
4. Сделать лок справедливым — вести очередь ожидающих и будить того, кто дольше всех ждёт. Это делается через `ReentrantLock(true)` (глава 3.5) или через ручную очередь `Thread`-объектов с `wait`/`notify`. Вторая реализация — учебная, в реальном коде используют `ReentrantLock`.

**Что здесь важно.** `synchronized` и `notify()` **не гарантируют справедливость**. В реальном коде, где важна fairness, используют `ReentrantLock(true)` или другие справедливые блокировки. `notifyAll()` — это «дешёвый» способ снизить starvation, но не устранить его полностью.

## Задача 7. Диагноз по симптому

**Программа А — deadlock.** Оба потока захватывают мониторы в разном порядке: `t1` — `lockA` потом `lockB`, `t2` — `lockB` потом `lockA`. Через 100 мс каждый держит свой монитор и ждёт чужой. Цикл. CPU почти 0% (оба в `BLOCKED`). **Исправление:** порядок захвата — оба сначала `lockA`, потом `lockB`.

**Программа Б — livelock.** Оба потока видят `resourceBusy == false`, оба ставят его в `true`, оба «работают», оба ставят `false`. Или: один ставит `true`, второй видит `true`, уступает через `yield()`. Но `yield()` не гарантирует, что первый успеет. Оба активны, CPU 100%, но полезной работы почти нет — они постоянно уступают друг другу. **Исправление:** использовать `synchronized` вместо флага `resourceBusy`. Или добавить случайные задержки.

**Программа В — starvation.** Пять потоков конкурируют за `lock`, `notify` нет (всё через `synchronized`). На практике starvation проявляется редко, потому что `synchronized` в современных JVM довольно справедлив, но **теоретически** один поток может захватывать лок раз за разом, а другой — почти не получать доступа. В программе без `notify` starvation менее вероятен, но возможен. **Исправление:** если нужна гарантия fairness — `ReentrantLock(true)`. В данном случае — просто наблюдение: посчитайте, сколько итераций сделал каждый поток; если разброс большой — это starvation.

**Ключевое различие.** А — CPU ~0%, потоки в `BLOCKED`. Б — CPU 100%, потоки в `RUNNABLE`. В — CPU варьируется, но один поток явно отстаёт.

## Задача 8. Резюме в одном приложении

```java
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static volatile boolean running = true;
    private static final AtomicInteger totalOps = new AtomicInteger(0);
    private static final AtomicInteger produced = new AtomicInteger(0);
    private static final AtomicInteger consumed = new AtomicInteger(0);
    private static final AtomicInteger producedSum = new AtomicInteger(0);
    private static final AtomicInteger consumedSum = new AtomicInteger(0);

    public static void main(String[] args) throws InterruptedException {
        BoundedBuffer<Integer> buffer = new BoundedBuffer<>(10);

        Thread[] producers = new Thread[3];
        for (int i = 0; i < 3; i++) {
            producers[i] = new Thread(() -> {
                try {
                    for (int j = 0; j < 50; j++) {
                        int value = (int) (Math.random() * 100);
                        buffer.put(value);
                        produced.incrementAndGet();
                        producedSum.addAndGet(value);
                        totalOps.incrementAndGet();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }, "producer-" + i);
        }

        Thread[] consumers = new Thread[3];
        for (int i = 0; i < 3; i++) {
            consumers[i] = new Thread(() -> {
                try {
                    for (int j = 0; j < 50; j++) {
                        Integer value = buffer.take();
                        consumed.incrementAndGet();
                        consumedSum.addAndGet(value);
                        totalOps.incrementAndGet();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }, "consumer-" + i);
        }

        Thread monitor = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("[monitor] ops = " + totalOps.get());
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "monitor");
        monitor.setDaemon(true);

        monitor.start();
        for (Thread t : producers) t.start();
        for (Thread t : consumers) t.start();

        Thread.sleep(2000);
        running = false;
        for (Thread t : producers) t.join();
        for (Thread t : consumers) t.join();
        monitor.interrupt();
        monitor.join();

        System.out.println("Произведено: " + produced.get() + ", потреблено: " + consumed.get());
        System.out.println("Сумма произведённых: " + producedSum.get() + ", потреблённых: " + consumedSum.get());
        System.out.println("Остаток в буфере: " + buffer.size());
    }
}
```

**Что здесь важно.** Все механизмы работают вместе: `volatile` для флага, `AtomicInteger` для счётчиков, `synchronized` и `wait`/`notify` внутри `BoundedBuffer`, `interrupt` для `monitor`, `daemon` для `monitor`. Сумма произведённых должна быть равна сумме потреблённых — это проверка, что ничего не потерялось и не продублировалось.

## Проектное задание. Потокобезопасный кеш с TTL

Один из вариантов реализации:

```java
import java.util.HashMap;
import java.util.Map;

public class TTLCache<K, V> {
    private static class Entry<V> {
        final V value;
        final long createdAt;

        Entry(V value, long createdAt) {
            this.value = value;
            this.createdAt = createdAt;
        }
    }

    private final Map<K, Entry<V>> map = new HashMap<>();
    private final int capacity;
    private final long ttlMillis;
    private long hits = 0;
    private long misses = 0;

    public TTLCache(int capacity, long ttlMillis) {
        this.capacity = capacity;
        this.ttlMillis = ttlMillis;
    }

    public synchronized void put(K key, V value) {
        if (map.size() >= capacity && !map.containsKey(key)) {
            // вытесняем самую старую запись
            K oldestKey = null;
            long oldestTime = Long.MAX_VALUE;
            for (Map.Entry<K, Entry<V>> e : map.entrySet()) {
                if (e.getValue().createdAt < oldestTime) {
                    oldestTime = e.getValue().createdAt;
                    oldestKey = e.getKey();
                }
            }
            if (oldestKey != null) map.remove(oldestKey);
        }
        map.put(key, new Entry<>(value, System.currentTimeMillis()));
    }

    public synchronized V get(K key) {
        Entry<V> entry = map.get(key);
        if (entry == null) {
            misses++;
            return null;
        }
        if (System.currentTimeMillis() - entry.createdAt > ttlMillis) {
            map.remove(key);
            misses++;
            return null;
        }
        hits++;
        return entry.value;
    }

    public synchronized int size() {
        long now = System.currentTimeMillis();
        return (int) map.values().stream()
                .filter(e -> now - e.createdAt <= ttlMillis)
                .count();
    }

    public synchronized void cleanup() {
        long now = System.currentTimeMillis();
        map.entrySet().removeIf(e -> now - e.getValue().createdAt > ttlMillis);
    }

    public synchronized long getHits() { return hits; }
    public synchronized long getMisses() { return misses; }
}
```

**Разбор ключевых решений.**

**Один монитор на весь кеш.** Простое и надёжное решение. Все методы `synchronized` на `this`. Race conditions нет, deadlock нет (один монитор, вложенности нет).

**`cleanup` отдельным методом.** Демон `cleaner` вызывает `cleanup` раз в 100 мс. Если бы `cleanup` был встроен в `get`/`put` — было бы ещё медленнее.

**Почему `cleaner` — демон.** Он не производит полезной работы с точки зрения бизнеса. Кеш может работать и без него — просто истёкшие записи будут удаляться при `get`. Если бы `cleaner` был обычным потоком, программа ждала бы его завершения. А он не должен решать, когда программе заканчиваться.

**Почему операции — обычные потоки.** Их результат важен. Программа должна их дождаться.

**Ответы на вопросы со звёздочкой.**

1. `cleaner` и `reporter` — обслуживающие, их работа не критична для результата. Операции — полезная работа, её нужно дождаться.
2. Если `get` делать **без** `synchronized` — будет гонка. `HashMap` не потокобезопасен, одновременное чтение и запись может привести к `ConcurrentModificationException` или повреждению структуры. Даже если бы `get` только читал, `size()` мог бы вернуть неверное значение. Нужен либо `synchronized`, либо `ConcurrentHashMap`.
3. Для частых `get` и редких `put` — `ConcurrentHashMap` без блокировки при чтении. Для ещё большей производительности — `ReadWriteLock` (глава 3.5): много читателей, один писатель.
4. При `capacity = 1_000_000` и `ttlMillis = 1` — каждая запись живёт миллисекунду. `cleanup` раз в 100 мс будет удалять практически всё. `put` будет постоянно вытеснять записи. Кеш будет бесполезен. Решение: увеличить `ttlMillis`, или использовать `cleanup` чаще, или не использовать TTL вообще для этого сценария.

---

**Если все восемь задач решены и проектное задание сделано** — модуль 2 пройден по-настоящему. Вы теперь умеете:

- видеть гонки данных и устранять их;
- понимать, какой монитор захватывается в каждом случае;
- различать видимость и атомарность;
- доказывать корректность через happens-before;
- использовать атомарные классы вместо `synchronized` там, где это уместно;
- распознавать deadlock, livelock и starvation и бороться с каждым;
- координировать потоки через `wait`/`notify`.

Дальше — модуль 3 «Высокоуровневая координация», где мы перестанем вручную жонглировать `wait`/`notify` и перейдём к готовым инструментам: `CountDownLatch`, `CyclicBarrier`, `Semaphore`, `Lock`. Они делают то же самое, но проще и безопаснее.