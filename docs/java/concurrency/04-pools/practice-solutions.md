# Разборы практикума по модулю 4

## Как пользоваться этой страницей

Разбор — это не «эталон». Это **один из возможных** способов решить задачу. Читайте разбор **после** того, как попробовали сами.

## Задача 1. Три пула — три задачи

Ключевые решения по пулам:

**Тип A (CPU-bound):**

```java
int cores = Runtime.getRuntime().availableProcessors();
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    cores, cores, 0L, TimeUnit.MILLISECONDS,
    new ArrayBlockingQueue<>(100),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

`core = max = cores`, очередь ограничена. Больше ядер — потоки всё равно конкурируют. Меньше — недоиспользуем CPU.

**Тип B (I/O-bound):**

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    2, 100, 60L, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(200),
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

`core = 2` (минимум), `max = 100` — можно много потоков, потому что они большую часть времени спят. `keepAlive = 60s` — лишние потоки умирают, когда нагрузка спадает.

**Тип C (много коротких задач):**

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    4, 8, 30L, TimeUnit.SECONDS,
    new SynchronousQueue<>(),  // без очереди — сразу передаём или создаём поток
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

`SynchronousQueue` — задача сразу передаётся свободному или создаётся новый поток (до `max`). Для микросекундных задач это лучше, чем копить их в очереди.

**Ответы на вопросы.**

1. **Почему для типа A оптимум около числа ядер.** Задача упирается в CPU. Если потоков больше, чем ядер, — потоки конкурируют за процессор, а не работают параллельно. Конкуренция = переключения контекста = потери. Если меньше — недоиспользуем ядра. Оптимум — ровно число ядер (или чуть больше, если задача не 100% CPU).

2. **Почему для типа B оптимум больше числа ядер.** Поток большую часть времени спит в `sleep`, не занимает процессор. Пока один спит, другой работает. Число потоков ограничено не ядрами, а «пропускной способностью» внешнего ресурса. 100 потоков на I/O-bound задаче — норма.

3. **Почему для типа C пул может проиграть.** Микросекундная задача. Накладные расходы на `execute` (положить в очередь, разбудить поток, переключение контекста) — тоже микросекунды. Если задача занимает меньше времени, чем накладные расходы, — пул проигрывает прямому выполнению в `main`. В реальном коде такие задачи лучше не отправлять в пул, а выполнять в цикле.

## Задача 2. Найди три ошибки

**Ошибка 1.** `submit` возвращает `Future`, а мы его игнорируем. Если задача упала с исключением — исключение «застряло» в `Future` и никогда не будет выброшено. Программа работает, ошибки молчат.

**Ошибка 2.** Нет `awaitTermination`. `shutdown()` не блокируется. `main` завершается сразу, JVM может выйти **до того**, как задачи доработали. Часть задач потеряется. Реально JVM подождёт, пока потоки пула (не-демоны) завершатся — но `main` уже не сможет ничего проверить или залогировать. Нужно `awaitTermination` с таймаутом.

**Ошибка 3.** Все исключения теряются, никто не считает упавшие. Задачи с `id % 100 == 0` падают, но никто об этом не узнаёт. Нужно сохранять `Future` и потом проверять через `get()`.

**Исправленный код:**

```java
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;

public class Main {
    public static void main(String[] args) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        List<Future<?>> futures = new ArrayList<>();

        for (int i = 0; i < 1000; i++) {
            int id = i;
            futures.add(pool.submit(() -> {
                if (id % 100 == 0) {
                    throw new RuntimeException("Задача " + id + " упала");
                }
                System.out.println("Задача " + id + " выполнена");
            }));
        }

        pool.shutdown();
        if (!pool.awaitTermination(10, TimeUnit.SECONDS)) {
            pool.shutdownNow();
        }

        int failed = 0;
        for (Future<?> f : futures) {
            try {
                f.get();
            } catch (ExecutionException e) {
                failed++;
            }
        }
        System.out.println("Упало задач: " + failed);
    }
}
```

## Задача 3. Планировщик с отменой

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
        AtomicInteger heartbeatCount = new AtomicInteger();
        AtomicInteger metricsCount = new AtomicInteger();
        AtomicInteger cleanupCount = new AtomicInteger();

        ScheduledFuture<?> heartbeat = scheduler.scheduleAtFixedRate(() -> {
            try {
                heartbeatCount.incrementAndGet();
                System.out.println("жив");
            } catch (Throwable t) {
                System.err.println("heartbeat упал: " + t);
            }
        }, 0, 500, TimeUnit.MILLISECONDS);

        ScheduledFuture<?> metrics = scheduler.scheduleAtFixedRate(() -> {
            try {
                metricsCount.incrementAndGet();
                System.out.println("метрики");
            } catch (Throwable t) {
                System.err.println("metrics упал: " + t);
            }
        }, 0, 2, TimeUnit.SECONDS);

        ScheduledFuture<?> cleanup = scheduler.scheduleAtFixedRate(() -> {
            try {
                cleanupCount.incrementAndGet();
                System.out.println("уборка");
            } catch (Throwable t) {
                System.err.println("cleanup упал: " + t);
            }
        }, 0, 5, TimeUnit.SECONDS);

        Thread.sleep(10_000);
        cleanup.cancel(false);

        Thread.sleep(5_000);
        heartbeat.cancel(false);
        metrics.cancel(false);

        scheduler.shutdown();
        if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
            scheduler.shutdownNow();
        }

        System.out.println("heartbeat выполнился " + heartbeatCount.get() + " раз");
        System.out.println("metrics выполнился " + metricsCount.get() + " раз");
        System.out.println("cleanup выполнился " + cleanupCount.get() + " раз");
    }
}
```

**Что здесь важно.**

**`try/catch(Throwable)` вокруг всего тела.** Иначе при первом исключении периодическая задача умирает навсегда. Особенно это критично для `metrics`, который может упасть по разным причинам.

**`cancel(false)`** — не прерывать выполняющуюся задачу. Для коротких периодических задач это безопасно.

**`shutdown()` не отменяет задачи.** После `shutdown` периодические задачи **продолжают выполняться**, если их не отменили. Поэтому `cancel` до `shutdown`.

**Ответы на вопросы.**

1. **Почему `cancel(false)` не прерывает выполняющуюся.** Параметр `mayInterruptIfRunning = false` означает «не прерывай, если выполняется». Задача доработает до конца, а после — не запустится снова. Если `true` — задача получит `interrupt` во время выполнения.

2. **Почему `shutdown()` не отменяет периодические.** `shutdown` перестаёт принимать **новые** задачи, но уже **запланированные** периодические — остаются в расписании. Они не «новые» — они уже в очереди. `ScheduledThreadPoolExecutor` считает их «текущими» и продолжает выполнять. Чтобы остановить, нужен явный `cancel`.

3. **Почему после падения `metrics` остальные работают, а пул не завершается.** Потому что у нас `try/catch` — `metrics` не умирает, только логирует. Если бы `try/catch` не было — `metrics` умрёт после первого исключения (её `ScheduledFuture` станет «completed exceptionally»), но `heartbeat` и `cleanup` продолжат работать. Пул не завершится, потому что у него есть активные периодические задачи.

## Задача 4. ForkJoinPool: параллельный WordCount

```java
import java.util.*;
import java.util.concurrent.*;

public class Main {
    private static final int THRESHOLD = 10_000;

    public static void main(String[] args) {
        String[] words = new String[10_000_000];
        Random random = new Random(42);
        String[] dictionary = new String[1000];
        for (int i = 0; i < dictionary.length; i++) dictionary[i] = "word-" + i;
        for (int i = 0; i < words.length; i++) words[i] = dictionary[random.nextInt(1000)];

        // Последовательно
        long start = System.currentTimeMillis();
        Map<String, Integer> seq = new HashMap<>();
        for (String w : words) seq.merge(w, 1, Integer::sum);
        long seqTime = System.currentTimeMillis() - start;

        // Параллельно
        ForkJoinPool pool = new ForkJoinPool();
        start = System.currentTimeMillis();
        Map<String, Integer> par = pool.invoke(new WordCountTask(words, 0, words.length));
        long parTime = System.currentTimeMillis() - start;

        System.out.println("Последовательно: " + seqTime + " мс, уникальных: " + seq.size());
        System.out.println("Параллельно:    " + parTime + " мс, уникальных: " + par.size());
        System.out.println("Совпадает: " + seq.equals(par));
    }

    static class WordCountTask extends RecursiveTask<Map<String, Integer>> {
        private final String[] words;
        private final int from, to;

        WordCountTask(String[] words, int from, int to) {
            this.words = words; this.from = from; this.to = to;
        }

        @Override
        protected Map<String, Integer> compute() {
            if (to - from <= THRESHOLD) {
                Map<String, Integer> local = new HashMap<>();
                for (int i = from; i < to; i++) {
                    local.merge(words[i], 1, Integer::sum);
                }
                return local;
            }
            int mid = (from + to) / 2;
            WordCountTask left = new WordCountTask(words, from, mid);
            WordCountTask right = new WordCountTask(words, mid, to);
            left.fork();
            Map<String, Integer> rightResult = right.compute();
            Map<String, Integer> leftResult = left.join();
            return merge(leftResult, rightResult);
        }

        private Map<String, Integer> merge(Map<String, Integer> a, Map<String, Integer> b) {
            Map<String, Integer> result = new HashMap<>(a);
            b.forEach((k, v) -> result.merge(k, v, Integer::sum));
            return result;
        }
    }
}
```

**Что здесь важно.**

**Слияние мап.** На каждом уровне рекурсии мы сливаем две мапы. Если `THRESHOLD = 10_000` и 10 миллионов слов — получим около 2000 листовых задач, потом 1000 слияний, потом 500, и так далее. Всего около 4000 слияний мап по 1000 элементов. Это дорого.

**Почему `ConcurrentHashMap` может быть лучше.** Вместо слияния в `compute()` — общий `ConcurrentHashMap`, каждая листовая задача в него пишет через `merge()`. `ConcurrentHashMap.merge` атомарен, дополнительная синхронизация не нужна. Нет дорогих слияний на каждом уровне.

**Почему `THRESHOLD` здесь больше, чем для суммы.** Для суммы каждая операция — одно сложение, `THRESHOLD = 10_000` — норм. Для WordCount каждая операция — `map.merge`, что дороже. Плюс слияние мап на каждом уровне дорого. Поэтому лучше крупные листья: меньше слияний, меньше накладных расходов.

**Ответы на вопросы.**

1. **Почему слияние мап может быть дороже подсчёта.** Слияние `HashMap` — это O(n) по элементам меньшей мапы. На каждом уровне рекурсии — слияние. Всего уровней log(N / THRESHOLD). Каждое слияние создаёт новую `HashMap`. Итого — много аллокаций и копирований.

2. **Почему `ConcurrentHashMap` может быть лучше.** Нет слияний. Все задачи пишут в одну мапу атомарно. `ConcurrentHashMap.merge` оптимизирован: блокирует только бакет, а не всю мапу. При 1000 ключах и 8 потоках — минимум конкуренции.

3. **Почему `THRESHOLD` больше.** Стоимость одной листовой задачи выше (merge мапы), поэтому листья должны быть крупнее, чтобы окупить накладные расходы `fork`/`join`. Плюс дорогое слияние на каждом уровне — меньше уровней, меньше слияний.

## Задача 5. Ограниченная очередь и CallerRunsPolicy

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
            2, 4, 10, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(4),
            new ThreadPoolExecutor.CallerRunsPolicy()
        );

        AtomicInteger inPool = new AtomicInteger();
        AtomicInteger inMain = new AtomicInteger();

        Runnable request = () -> {
            String name = Thread.currentThread().getName();
            if (name.startsWith("pool-")) inPool.incrementAndGet();
            else inMain.incrementAndGet();
            try { Thread.sleep(200); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        };

        for (int i = 0; i < 50; i++) pool.execute(request);

        pool.shutdown();
        pool.awaitTermination(30, TimeUnit.SECONDS);

        System.out.println("Выполнено в пуле: " + inPool.get());
        System.out.println("Выполнено в main: " + inMain.get());
    }
}
```

**Что здесь важно.**

**Как работает `CallerRunsPolicy`.** Когда пул переполнен (max = 4, очередь = 4), новая задача **выполняется в вызывающем потоке** — то есть в `main`. Пока `main` выполняет задачу, он не может отправлять новые — это даёт пулу время разгрестись.

**Сколько задач уйдёт в `main`.** Первые 8 (2 core + 4 в очередь + 2 max) попадут в пул. 9-я задача — уже переполнение, выполнится в `main`. Потом `main` освободится, отправит 10-ю (может попасть в пул, если освободилось место), и так далее. В итоге часть задач выполнится в `main` — сколько именно, зависит от скорости.

**Ответы на вопросы.**

1. **Почему появляется `main`.** `CallerRunsPolicy` — это политика «выполняй в том потоке, который отправил задачу». Если отправил `main` — выполнит `main`. Это «обратное давление»: `main` работает и не может отправлять новые задачи, давая пулу разгрестись.

2. **Почему `CallerRunsPolicy` хороша для веб-сервера.** Под нагрузкой сервер не отвергает запросы с ошибкой 503 — он начинает обрабатывать их в потоке, который принял запрос (например, в сетевом reactor-потоке). Это замедляет приём новых запросов, но **ни один запрос не теряется**. Для системы, где важно обработать всё, это правильно.

3. **Если очередь неограниченная.** `CallerRunsPolicy` **никогда не сработает**, потому что очередь всегда принимает. Пул будет работать только с `core` потоками (шаг 3 не достигается, как в главе 4.3). Задачи копятся в памяти, `max` не задействуется, память кончается.

## Задача 6. Корректное завершение под нагрузкой

```java
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
            4, 8, 30, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(10)
        );

        AtomicInteger completed = new AtomicInteger();
        AtomicInteger interrupted = new AtomicInteger();

        for (int i = 0; i < 100; i++) {
            pool.execute(() -> {
                try {
                    Thread.sleep(200);
                    completed.incrementAndGet();
                } catch (InterruptedException e) {
                    interrupted.incrementAndGet();
                    Thread.currentThread().interrupt();
                }
            });
        }

        Thread.sleep(1000);
        pool.shutdown();
        if (!pool.awaitTermination(3, TimeUnit.SECONDS)) {
            List<Runnable> notStarted = pool.shutdownNow();
            System.out.println("Не началось: " + notStarted.size());
            if (!pool.awaitTermination(3, TimeUnit.SECONDS)) {
                System.out.println("Пул не завершился даже после shutdownNow");
            }
        }

        System.out.println("Завершено: " + completed.get());
        System.out.println("Прервано: " + interrupted.get());
    }
}
```

**Что здесь важно.**

**`shutdown()` не прерывает задачи.** Задачи, которые уже выполняются или в очереди, доработают. Только через 3 секунды, если не дождались — `shutdownNow()`, который прерывает.

**`shutdownNow()` возвращает задачи из очереди.** Мы их считаем и логируем. В реальной системе их надо либо куда-то сохранить, либо решить, что с ними делать.

**Ответы на вопросы.**

1. **Почему `shutdown()` не прерывает.** Это **вежливое** завершение. Логика: «доработайте текущие задачи, я не хочу терять результаты». Если задачи — отправка писем, потеря половины хуже, чем подождать лишние секунды.

2. **Почему `shutdownNow()` может «не сработать».** Он посылает `interrupt`, но задача может его проигнорировать. Если внутри `while(true)` без проверки `Thread.interrupted()` или `isInterrupted()` — задача не узнает о прерывании. Тогда пул не завершится, пока задача сама не закончится. Это ответственность задачи, а не пула.

3. **Что делать с задачами из списка.** Вариантов несколько. (1) Ничего — если задачи идемпотентны и повторятся. (2) Залогировать — чтобы знать, что потеряли. (3) Выполнить синхронно — медленно, но ничего не теряется. (4) Отправить в другой пул, если есть резервный.

## Задача 7. Диагноз по симптому

**Программа А.** `main` завершается, `shutdown()` не вызван. Пул из 4 потоков-не-демонов продолжает работать, ждёт новых задач. JVM не может завершиться. Программа **висит**. Через несколько минут — всё ещё висит, память занята, потоки пула ждут. Пользователь убивает `kill -9`.

**Программа Б.** `scheduleAtFixedRate` без `try/catch`. Через какое-то время (в среднем через 100 тиков = 10 секунд) задача упадёт с `RuntimeException`. `ScheduledFuture` станет «completed exceptionally», задача больше **не запустится**. Печать «Тик» прекратится. Никаких сообщений об ошибке — просто тишина. Программа продолжает работать (главный поток спит), но задача мертва.

**Программа В.** Все задачи падают, но `submit` возвращает `Future`, а мы его игнорируем. `ExecutionException` «застряло» в `Future`. `awaitTermination` дождался завершения задач — пул считает задачи выполненными (с исключением). Программа печатает «всё ок», хотя все 100 задач упали. Ошибки потеряны.

**Исправления.**

- А: добавить `shutdown()` + `awaitTermination`.
- Б: обернуть тело в `try/catch(Throwable)` и логировать.
- В: сохранять `Future` и проверять через `get()`, ловить `ExecutionException`.

## Задача 8. Резюме в одном приложении

Ключевые моменты дизайна.

```java
// Пул загрузчиков
ExecutorService downloaders = Executors.newFixedThreadPool(8);

// Пул обработчиков
ThreadPoolExecutor processors = new ThreadPoolExecutor(
    4, 8, 30, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(20),
    new ThreadPoolExecutor.CallerRunsPolicy()
);

// Планировщик (демон)
ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1, r -> {
    Thread t = new Thread(r, "scheduler");
    t.setDaemon(true);
    return t;
});
```

**Что важно.**

- **Загрузчики и обработчики — разные пулы.** Иначе I/O-bound задачи конкурируют с CPU-bound.
- **`CallerRunsPolicy` у processors** — если очередь переполнена, `main` или поток-загрузчик сам обработает задачу. Это даёт обратное давление.
- **`scheduler` — демон.** Он наблюдает, но не должен держать программу.
- **`Future` от `submit`** — сохранять и проверять на исключения.
- **Корректное завершение** — `shutdown()` всех трёх пулов в `finally` + `awaitTermination`.

## Проектное задание. Мини-фреймворк параллельной обработки

Один из вариантов реализации:

```java
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Function;

public class ParallelProcessor<T, R> {
    private final int concurrency;
    private final AtomicBoolean cancelled = new AtomicBoolean(false);
    private final ThreadPoolExecutor pool;

    public ParallelProcessor(int concurrency) {
        this.concurrency = concurrency;
        this.pool = new ThreadPoolExecutor(
            concurrency, concurrency, 0L, TimeUnit.MILLISECONDS,
            new ArrayBlockingQueue<>(concurrency * 4),
            new ThreadPoolExecutor.CallerRunsPolicy()
        );
    }

    public Result<R> process(List<T> input, Function<T, R> fn) throws InterruptedException {
        int n = input.size();
        @SuppressWarnings("unchecked")
        R[] results = (R[]) new Object[n];
        List<Integer> failedIndexes = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger errors = new AtomicInteger(0);
        long start = System.currentTimeMillis();

        try {
            for (int i = 0; i < n; i++) {
                if (cancelled.get()) break;
                int idx = i;
                pool.execute(() -> {
                    try {
                        results[idx] = fn.apply(input.get(idx));
                    } catch (Exception e) {
                        failedIndexes.add(idx);
                        errors.incrementAndGet();
                    }
                });
            }
        } finally {
            pool.shutdown();
            if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
                pool.shutdownNow();
            }
        }

        long elapsed = System.currentTimeMillis() - start;
        return new Result<>(
            Arrays.asList(results),
            new ArrayList<>(failedIndexes),
            elapsed,
            concurrency
        );
    }

    public void cancel() {
        cancelled.set(true);
        pool.shutdownNow();
    }

    public static class Result<R> {
        public final List<R> results;
        public final List<Integer> failedIndexes;
        public final long elapsedMillis;
        public final int concurrency;

        public Result(List<R> results, List<Integer> failedIndexes, long elapsedMillis, int concurrency) {
            this.results = results;
            this.failedIndexes = failedIndexes;
            this.elapsedMillis = elapsedMillis;
            this.concurrency = concurrency;
        }
    }
}
```

**Ключевые решения.**

**Результаты по индексу.** `R[] results` фиксированного размера. Каждая задача пишет в свой индекс — гонки нет, синхронизация не нужна. Это быстрее, чем `Collections.synchronizedList`.

**`failedIndexes` — synchronized list.** Сюда пишут все потоки, порядок не важен, размер небольшой. `Collections.synchronizedList` — норм. Для очень высокой нагрузки можно заменить на `ConcurrentLinkedQueue`.

**`CallerRunsPolicy`.** Если пул перегружен — `main` сам выполнит задачу. Для пакетной обработки это хорошо: обратное давление не даёт задачам копиться в памяти.

**`cancelled` — `AtomicBoolean`.** Проверяется в цикле отправки. После `cancel` новые задачи не отправляются, а `shutdownNow` прерывает выполняющиеся.

**Ответы на вопросы со звёздочкой.**

1. **Почему `CallerRunsPolicy` лучше `AbortPolicy`.** При `AbortPolicy` часть элементов потеряется — они просто не обработаются. При `CallerRunsPolicy` — обработаются, но медленнее (в вызывающем потоке). Для пакетной обработки «медленнее, но все» предпочтительнее «быстро, но с потерями».

2. **`concurrency = 1` и `concurrency = 1000`.** При 1 — всё последовательно, как обычный цикл, но с накладными расходами на пул. При 1000 — 1000 потоков, каждый со стеком ~1 МБ = 1 ГБ памяти. Плюс конкуренция за CPU. Ограничить сверху — например, `Math.min(concurrency, Runtime.getRuntime().availableProcessors() * 2)` для CPU-bound, или `Math.min(concurrency, 200)` для I/O-bound.

3. **Приоритеты.** Через `PriorityBlockingQueue` вместо `ArrayBlockingQueue`, и задачи должны реализовывать `Comparable`. Но `CallerRunsPolicy` с приоритетной очередью работает странно: вызывающий поток выполняет «свою» задачу, игнорируя приоритеты. Альтернатива — своя очередь + свой `RejectedExecutionHandler`, который при переполнении отбрасывает низкоприоритетные.

4. **Через `parallelStream()`.** Можно: `input.parallelStream().map(fn).collect(toList())`. Но есть отличия. (а) `parallelStream` использует `commonPool` — общий на всю программу, может конфликтовать с другими задачами. (б) Нет `CallerRunsPolicy` — при перегрузке задачи либо копятся, либо бросают исключение. (в) Нет `cancel` — прервать можно только через `interrupt` потока, что не всегда сработает. (г) Нет сбора индексов упавших — `parallelStream` бросит первое исключение и остановится.

---

**Если все восемь задач решены и проектное задание сделано** — модуль 4 пройден. Вы теперь умеете:

- выбирать подходящий пул под задачу (CPU-bound, I/O-bound, короткие задачи);
- собирать `ThreadPoolExecutor` с нужными параметрами;
- планировать периодические задачи через `ScheduledExecutorService`;
- корректно завершать пулы, не теряя задачи;
- применять `ForkJoinPool` для рекурсивных задач.

Дальше — **модуль 5 «Потокобезопасные коллекции»**, где мы перестанем вручную синхронизировать `HashMap` и `ArrayList` и научимся использовать готовые потокобезопасные структуры: `ConcurrentHashMap`, `CopyOnWriteArrayList`, `BlockingQueue`. Это то, без чего не обходится ни один реальный многопоточный проект.