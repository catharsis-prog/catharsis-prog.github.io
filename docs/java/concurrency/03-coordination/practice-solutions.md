# Разборы практикума по модулю 3

## Как пользоваться этой страницей

Разбор — это не «эталон». Это **один из возможных** способов решить задачу. Читайте разбор **после** того, как попробовали сами.

## Задача 1. Запуск микросервисов

```java
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(3);

        startDependency("db", latch, false);
        startDependency("cache", latch, true);  // упадёт
        startDependency("queue", latch, false);

        if (latch.await(5, TimeUnit.SECONDS)) {
            System.out.println("order: все зависимости готовы, принимаю запросы");
        } else {
            System.out.println("order: не все зависимости готовы за 5 секунд");
        }
    }

    private static void startDependency(String name, CountDownLatch latch, boolean willFail) {
        new Thread(() -> {
            try {
                long sleep = 500 + (long) (Math.random() * 2500);
                Thread.sleep(sleep);
                if (willFail) {
                    throw new RuntimeException("симуляция сбоя");
                }
                System.out.println("[" + name + "] готов");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (RuntimeException e) {
                System.out.println("[" + name + "] упал: " + e.getMessage());
            } finally {
                latch.countDown();
            }
        }, name).start();
    }
}
```

**Что здесь важно.** `countDown()` в `finally` — потому что зависимость может упасть до `countDown()`, и без `finally` счётчик не уменьшится. Тогда `await()` будет ждать вечно. Таймаут в `await` — вторая страховка: даже если один `countDown` потерян из-за бага, программа не зависнет навсегда.

**Почему `CountDownLatch`, а не `join()`.** `join()` ждёт завершения **потока**. Но «зависимость готова» — это не «поток завершился». В реальной системе зависимость может сигнализировать о готовности и продолжать работать (обрабатывать запросы). `join()` тут не подойдёт — поток не завершится. `CountDownLatch` — подойдёт: он ждёт **события** «готов», а не «завершения».

## Задача 2. Многораундовая симуляция

```java
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final int SIZE = 20;
    private static final int STEPS = 10;
    private static final int WORKERS = 4;
    private static final int CHUNK = SIZE / WORKERS; // 5

    private static double[] current;
    private static double[] next;

    public static void main(String[] args) {
        current = new double[SIZE];
        next = new double[SIZE];
        current[SIZE / 2] = 100.0;

        CyclicBarrier barrier = new CyclicBarrier(WORKERS, () -> {
            printState();
            double[] tmp = current;
            current = next;
            next = tmp;
        });

        for (int w = 0; w < WORKERS; w++) {
            int start = w * CHUNK;
            new Thread(() -> {
                try {
                    for (int step = 0; step < STEPS; step++) {
                        for (int i = start; i < start + CHUNK; i++) {
                            double left = (i > 0) ? current[i - 1] : current[i];
                            double right = (i < SIZE - 1) ? current[i + 1] : current[i];
                            next[i] = (left + current[i] + right) / 3.0;
                        }
                        barrier.await();
                    }
                } catch (Exception e) {
                    Thread.currentThread().interrupt();
                }
            }, "worker-" + (w + 1)).start();
        }
    }

    private static void printState() {
        StringBuilder sb = new StringBuilder();
        double max = 0;
        for (double v : current) {
            sb.append(String.format("%.1f ", v));
            if (v > max) max = v;
        }
        System.out.println("Состояние: " + sb + "| max: " + max);
    }
}
```

**Что здесь важно.** **Double buffering** — потому что воркеры читают соседние элементы, которые могут быть в **чужой** части массива. Если бы они писали в тот же массив, что читают, один воркер мог бы прочитать уже обновлённое значение, а другой — ещё старое. Результат зависел бы от порядка. С двумя массивами (`current` и `next`) все читают `current` (старое состояние) и пишут в `next` (новое). После барьера массивы меняются местами — это делает `BarrierAction`.

**Почему `BarrierAction` безопасно читает.** Между `await()` каждого воркера и `BarrierAction` действует happens-before: все записи в `next` видны в `BarrierAction`. А между `BarrierAction` (замена ссылок) и следующими `await()` — тоже happens-before: все воркеры увидят новый `current`. Это гарантируется механизмом барьера.

**Если один воркер упадёт.** Остальные получат `BrokenBarrierException` на следующем `await()`. Программа не зависнет — барьер «сломается», и все выйдут. Это одна из причин, почему `CyclicBarrier` удобнее ручной синхронизации: он сам обрабатывает «аварию» одного из участников.

## Задача 3. Rate limiting для API

```java
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    private static final int LIMIT = 5;
    private static final int REQUESTS = 50;
    private static final AtomicInteger active = new AtomicInteger(0);
    private static final AtomicInteger maxSeen = new AtomicInteger(0);
    private static final Semaphore semaphore = new Semaphore(LIMIT, true);

    public static void main(String[] args) throws InterruptedException {
        Thread monitor = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("active = " + active.get());
                try { Thread.sleep(100); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });
        monitor.setDaemon(true);
        monitor.start();

        Thread[] workers = new Thread[REQUESTS];
        for (int i = 0; i < REQUESTS; i++) {
            int id = i + 1;
            workers[i] = new Thread(() -> {
                try {
                    if (!semaphore.tryAcquire(2, TimeUnit.SECONDS)) {
                        System.out.println("[worker-" + id + "] timeout");
                        return;
                    }
                    try {
                        int now = active.incrementAndGet();
                        maxSeen.updateAndGet(m -> Math.max(m, now));
                        Thread.sleep(100 + (long) (Math.random() * 400));
                    } finally {
                        active.decrementAndGet();
                        semaphore.release();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }, "worker-" + id);
            workers[i].start();
        }

        for (Thread t : workers) t.join();
        monitor.interrupt();
        System.out.println("Максимум активных: " + maxSeen.get());
    }
}
```

**Что здесь важно.** `Semaphore(5, true)` — справедливый, чтобы потоки получали разрешения в порядке прихода, а не «кто первый успел». `tryAcquire` с таймаутом — страховка: если разрешение не пришло за 2 секунды, поток не ждёт вечно, а завершается.

**Почему `Semaphore`, а не `ThreadPoolExecutor(5)`.** Пул ограничивает **потоки**, но не **доступ к ресурсу**. Если у вас пул из 5 потоков, а внешнее API выдерживает только 5 одновременных — это случайное совпадение. Завтра пул станет 10 — API начнёт отдавать 429. `Semaphore` ограничивает именно **доступ к API**, независимо от того, сколько потоков его пытаются получить.

**Про `fair=true`.** Без `fair` некоторые потоки могли бы «обгонять» других, и при большом количестве запросов кто-то мог бы голодать. С `fair` — порядок прихода соблюдается. Это чуть медленнее, но предсказуемее.

## Задача 4. Конвейер с обменом

```java
import java.util.concurrent.Exchanger;
import java.util.concurrent.TimeUnit;

public class Main {
    private static final Exchanger<StringBuilder> exchanger = new Exchanger<>();

    public static void main(String[] args) throws InterruptedException {
        Thread reader = new Thread(() -> {
            StringBuilder buffer = new StringBuilder();
            try {
                for (int i = 1; i <= 10; i++) {
                    buffer.append("line-").append(i).append("\n");
                    if (i % 5 == 0) {
                        buffer = exchanger.exchange(buffer, 2, TimeUnit.SECONDS);
                        buffer.setLength(0); // очищаем полученный пустой
                    }
                }
                // сигнал о завершении — пустой буфер
                exchanger.exchange(new StringBuilder(), 2, TimeUnit.SECONDS);
            } catch (Exception e) {
                Thread.currentThread().interrupt();
            }
        }, "reader");

        Thread writer = new Thread(() -> {
            StringBuilder buffer = new StringBuilder();
            try {
                while (true) {
                    buffer = exchanger.exchange(buffer, 2, TimeUnit.SECONDS);
                    if (buffer.length() == 0) {
                        System.out.println("writer: получен сигнал завершения");
                        return;
                    }
                    System.out.println("writer: получил блок данных:\n" + buffer);
                    buffer.setLength(0);
                }
            } catch (Exception e) {
                Thread.currentThread().interrupt();
            }
        }, "writer");

        reader.start();
        writer.start();
        reader.join();
        writer.join();
    }
}
```

**Что здесь важно.** `Exchanger` здесь **идеален** именно потому, что это ровно два потока и обмен объектами. Альтернатива — `BlockingQueue` — работала бы, но она копирует элементы (каждый `put` кладёт в очередь). А `Exchanger` просто меняет два `StringBuilder` местами — никакого копирования. В реальных системах это даёт заметный выигрыш на больших объёмах.

**Про очистку буфера.** `buffer.setLength(0)` после получения — обязательно. Иначе `reader` получит буфер с уже записанным содержимым и начнёт дописывать к нему, а `writer` увидит старые строки повторно.

**Про сигнал завершения.** `Exchanger` не имеет «закрытия», как у очередей. Сигнал о конце — это специальное значение (пустой `StringBuilder` или `null`). В реальном коде часто используют `Optional` или `sealed interface` с вариантом `Done`, чтобы сигнал нельзя было перепутать с данными.

## Задача 5. Динамические фазы

```java
import java.util.concurrent.Phaser;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Phaser phaser = new Phaser(1); // главный поток — участник
        phaser.bulkRegister(5);        // 5 воркеров

        for (int i = 1; i <= 5; i++) {
            int id = i;
            new Thread(() -> {
                try {
                    System.out.println("[worker-" + id + "] фаза 0");
                    phaser.arriveAndAwaitAdvance();

                    if (id == 4 || id == 5) {
                        phaser.arriveAndDeregister();
                        System.out.println("[worker-" + id + "] ушёл");
                        return;
                    }

                    System.out.println("[worker-" + id + "] фаза 1");
                    phaser.arriveAndAwaitAdvance();

                    System.out.println("[worker-" + id + "] фаза 2");
                    phaser.arriveAndDeregister();
                } catch (Exception e) {
                    Thread.currentThread().interrupt();
                }
            }, "worker-" + id).start();
        }

        // главный поток ждёт конца фазы 0
        phaser.arriveAndAwaitAdvance();

        // конец фазы 1
        phaser.arriveAndAwaitAdvance();

        // перед фазой 2 добавляем нового
        phaser.register();
        new Thread(() -> {
            System.out.println("[worker-6] фаза 2");
            phaser.arriveAndDeregister();
        }, "worker-6").start();

        // главный поток тоже участвует в фазе 2
        phaser.arriveAndAwaitAdvance();
        phaser.arriveAndDeregister();
    }
}
```

**Что здесь важно.** Главный поток **сам является участником** фазера (`new Phaser(1)`). Это нужно, чтобы он мог `arriveAndAwaitAdvance()` — дождаться завершения фазы. Если бы он не был участником, `arriveAndAwaitAdvance()` бросил бы `IllegalStateException` (или вёл бы себя непредсказуемо).

**Почему не `CyclicBarrier`.** В `CyclicBarrier` число участников фиксировано. У нас же два уходят (4 и 5), потом один приходит (6). `CyclicBarrier` не позволяет менять число участников. `Phaser` — позволяет через `register()`/`arriveAndDeregister()`.

**Тонкость с `register()`.** Новый участник должен регистрироваться **до** того, как текущая фаза закончится. Если зарегистрировать после — он присоединится к следующей, а не к текущей. В примере мы регистрируем между фазами 1 и 2 — то есть после того, как фаза 1 завершилась, но до того, как фаза 2 началась. Это правильный момент.

## Задача 6. BoundedBuffer с Condition

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class BoundedBuffer<T> {
    private final Deque<T> items = new ArrayDeque<>();
    private final int capacity;
    private final Lock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private final Condition notFull = lock.newCondition();

    public BoundedBuffer(int capacity) { this.capacity = capacity; }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (items.size() == capacity) {
                notFull.await();
            }
            items.addLast(item);
            notEmpty.signal();
        } finally {
            lock.unlock();
        }
    }

    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (items.isEmpty()) {
                notEmpty.await();
            }
            T item = items.removeFirst();
            notFull.signal();
            return item;
        } finally {
            lock.unlock();
        }
    }

    public boolean offer(T item, long timeout, TimeUnit unit) throws InterruptedException {
        long nanos = unit.toNanos(timeout);
        lock.lock();
        try {
            while (items.size() == capacity) {
                if (nanos <= 0) return false;
                nanos = notFull.awaitNanos(nanos);
            }
            items.addLast(item);
            notEmpty.signal();
            return true;
        } finally {
            lock.unlock();
        }
    }

    public int size() {
        lock.lock();
        try {
            return items.size();
        } finally {
            lock.unlock();
        }
    }
}
```

**Что здесь важно.** `signal()` на `notEmpty` будит **только** тех, кто ждёт «есть данные». `signal()` на `notFull` — только тех, кто ждёт «есть место». Это безопаснее, чем `notify()` на `synchronized`, потому что не может разбудить «не того». `notify` мог разбудить `producer`, когда нужен был `consumer`, и наоборот.

**`awaitNanos`** — тонкость. `awaitNanos(nanos)` возвращает **оставшееся** время, а не прошедшее. В цикле `while` нужно обновлять `nanos` оставшимся значением. Если бы вы использовали просто `await(timeout)`, при spurious wakeup время ожидания сбрасывалось бы, и таймаут мог бы не сработать вовремя.

**Про производительность.** `signal()` vs `signalAll()` — при небольшом числе потоков разница невелика. Но при высокой конкуренции `signal` лучше: он будит одного, а `signalAll` — всех, и остальные просыпаются впустую, проверяют условие и снова засыпают. Это лишние переключения контекста.

## Задача 7. Диагноз по симптому

**Программа А.** `countDown()` **не** в `finally`. Если `doWork()` выбросит исключение, `countDown` не выполнится, счётчик не уменьшится, `latch.await()` будет ждать вечно. **Исправление:**

```java
try {
    doWork();
} catch (Exception e) {
    // логируем
} finally {
    latch.countDown();
}
```

**Программа Б.** `release()` дважды. `Semaphore` не отслеживает, кто сколько взял. После нескольких `process()` разрешений станет больше, чем изначально. Инвариант «не больше 3 одновременно» сломается — теперь может быть 4, 5, 6. **Исправление:** убрать второй `release()`, следить за парностью `acquire`/`release`. В реальном коде — `try/finally` с одним `release` в `finally`.

**Программа В.** `lock.unlock()` **до** окончания работы. «Ещё работа» идёт без блокировки — если она обращается к общим данным, это гонка. **Исправление:** `unlock` в `finally` в конце метода, чтобы блокировка держалась всё время работы с общими данными.

## Задача 8. Резюме в одном приложении

Полный код здесь приводить не буду — он объёмный, а идея важнее. Ключевые моменты:

- **`Phaser(1)` + `register()`** для воркеров — чтобы главный поток мог координировать этапы.
- **`CountDownLatch`** — перед `Phaser`, чтобы `order-service` не начал работу до инициализации зависимостей.
- **`Semaphore(2)`** — вокруг вызова «платёжной системы». Не вокруг всего этапа, а именно вокруг вызова — это важно.
- **`CyclicBarrier(3)`** — на каждом этапе три воркера встречаются, `BarrierAction` агрегирует результат.
- **`Exchanger`** — два аудитора обмениваются проблемами. Ровно два — потому что `Exchanger` только для двух.
- **`ReentrantLock`** — для счётчика обработанных заказов. Можно было `AtomicInteger`, но задача требует `Lock` — пусть будет.

**Главный навык этой задачи** — не написать код, а **выбрать примитив под задачу**. Каждый из шести примитивов решает свою проблему, и путать их — значит писать сложный код там, где можно простой.

## Проектное задание. Многопоточный веб-сканер

Ключевые решения по дизайну:

```java
public class WebScanner {
    private final int concurrency;
    private final Semaphore semaphore;
    private final AtomicInteger success = new AtomicInteger(0);
    private final AtomicInteger failed = new AtomicInteger(0);
    private final Phaser phaser;

    public WebScanner(int concurrency, int totalUrls) {
        this.concurrency = concurrency;
        this.semaphore = new Semaphore(concurrency, true);
        this.phaser = new Phaser(1); // главный + воркеры
        phaser.bulkRegister(totalUrls);
    }

    public void scan(List<String> urls) throws InterruptedException {
        CountDownLatch ready = new CountDownLatch(urls.size());
        Thread monitor = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("Успешно: " + success.get() + ", ошибок: " + failed.get());
                try { Thread.sleep(500); } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });
        monitor.setDaemon(true);
        monitor.start();

        for (String url : urls) {
            new Thread(() -> {
                try {
                    // этап 1 — главная страница
                    semaphore.acquire();
                    try {
                        if (Math.random() < 0.2) {
                            throw new RuntimeException("сайт недоступен");
                        }
                        Thread.sleep(200);
                        success.incrementAndGet();
                    } finally {
                        semaphore.release();
                    }
                    ready.countDown();
                    phaser.arriveAndAwaitAdvance();

                    // этап 2 — ссылки
                    semaphore.acquire();
                    try {
                        Thread.sleep(100);
                    } finally {
                        semaphore.release();
                    }
                    phaser.arriveAndAwaitAdvance();

                    // этап 3 — агрегация
                    phaser.arriveAndDeregister();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    phaser.arriveAndDeregister();
                } catch (RuntimeException e) {
                    failed.incrementAndGet();
                    ready.countDown();
                    phaser.arriveAndDeregister();
                }
            }, "worker-" + url).start();
        }

        // главный поток ждёт все этапы
        phaser.arriveAndAwaitAdvance();
        phaser.arriveAndAwaitAdvance();
        phaser.arriveAndAwaitAdvance();
        phaser.arriveAndDeregister();

        monitor.interrupt();
        System.out.println("Итого: " + success.get() + " успешно, " + failed.get() + " ошибок");
    }
}
```

**Ключевые моменты дизайна.**

**Упавший воркер дерегистрируется.** Если сайт упал на первом этапе, воркер вызывает `arriveAndDeregister()` и выходит. На следующих фазах `Phaser` его уже не ждёт. Это именно то, ради чего нужен `Phaser`, а не `CyclicBarrier`.

**`Semaphore` вокруг `acquire`-блока.** Не вокруг всего этапа — только вокруг «запроса к сайту». Иначе потоки держали бы разрешение, пока ждут барьера, и параллелизм фактически стал бы 1.

**`ready` latch.** Хотя `Phaser` сам синхронизирует фазы, `ready` даёт понять, что все воркеры **дошли** до первого `await`. Это не обязательно, но полезно для отладки: если воркер завис на инициализации, `ready.await(timeout)` покажет это.

**Монитор — демон.** Он не производит полезной работы, только наблюдает. Если программа завершается, он не должен её держать.

**Задание со звёздочкой.**

1. `N = 20` — `Semaphore` не ограничивает, все 20 бегут одновременно. Нагрузка на «сайты» максимальная. `N = 1` — всё последовательно, медленно, но безопасно.
2. Если этапов 10 — `Phaser` справится без изменений. Просто больше `arriveAndAwaitAdvance()`. `CyclicBarrier` тоже справится, но с фиксированным составом.
3. «Отмена» — через общий `volatile boolean cancelled`. Воркеры проверяют его в начале каждой фазы и вызывают `arriveAndDeregister()`, если отменено.
4. Если воркер упадёт с `RuntimeException` **между** `arriveAndAwaitAdvance` — `Phaser` не сломается, но число участников уменьшится (не в фазе). Нужно ловить все исключения и вызывать `arriveAndDeregister` в `finally`. Иначе `Phaser` будет ждать «призрака».

---

**Если все восемь задач решены и проектное задание сделано** — модуль 3 пройден. Вы теперь умеете:

- использовать `CountDownLatch` для ожидания N событий;
- синхронизировать группу через `CyclicBarrier`;
- ограничивать параллелизм через `Semaphore`;
- обмениваться значениями через `Exchanger`;
- строить многофазные алгоритмы через `Phaser`;
- использовать `ReentrantLock` и `Condition`, когда `synchronized` не справляется.

Дальше — **модуль 4 «Пулы потоков и Executor Framework»**, где мы перестанем создавать потоки вручную и научимся управлять ими через `ExecutorService`. Это то, что в реальной работе используется каждый день.