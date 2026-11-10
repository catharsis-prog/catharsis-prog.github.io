# 7.5. Диагностика и отладка

## Где вы это уже видели

**Врач и анализы.** Пациент приходит и говорит: «Плохо». Врач не назначает лечение сразу — сначала **слушает**, **измеряет давление**, **берёт кровь**, **делает УЗИ**. Только по **симптомам** и **данным** ставит диагноз. Без анализов — гадание. С анализами — план.

**Автомеханик и диагностика.** Машина «не едет». Механик не разбирает двигатель сразу — подключает **сканер**, смотрит коды ошибок, слушает, как работает. Потом — давление в шинах, зазоры, компрессия. Каждый инструмент отвечает на **свой** вопрос.

**Сисадмин и логи.** Сервер «тормозит». Сисадмин не перезагружает сразу — смотрит **`top`**, **`iostat`**, **`journalctl`**. Что ест процессор? Что ест диск? Какие ошибки в логах? По симптомам — гипотеза, по данным — подтверждение.

**Детектив и улики.** Преступление. Детектив не «догадывается», кто виноват, — он собирает **улики**: отпечатки, свидетели, записи камер. По уликам — версия, по проверке — подтверждение. Без улик — не обвинение, а домыслы.

**Общее во всех случаях** одно: **диагностика — это сбор данных, а не гадание**. В многопоточном коде это особенно важно: проблемы **нестабильны**, **редки**, **не воспроизводятся** на тестовой машине. Без инструментов — вы «щупаете в темноте». С инструментами — находите за минуты.

## Теория

### Почему многопоточные баги сложно ловить

Многопоточные баги — **не как обычные**. Обычный баг: «подал A — получил B вместо C». Стабильно. Воспроизводится. Можно отладить по шагам.

Многопоточный баг: «подал A — **иногда** получил B, **иногда** C, **иногда** D». Зависит от планировщика, нагрузки, числа ядер, версии JVM, погоды за окном. На тестовой машине — работает. На проде — падает раз в неделю.

**Четыре причины.**

**Первая: недетерминизм.** Планировщик решает, какой поток когда работает. Вы **не контролируете** порядок. Один запуск — один результат, другой запуск — другой.

**Вторая: редкость.** Гонка (глава 2.1) может проявляться раз в миллион запусков. Вы не «поймаете» её обычным запуском. Нужна нагрузка, нужны специальные инструменты, нужно **ждать**.

**Третья: отсутствие стека.** Когда падает `NullPointerException` — есть стек: «строка 42, метод `foo`». Когда «программа зависла» — **стека нет**. Нужно **снять** его специально.

**Четвёртая: «на моей машине работает».** Разное число ядер, разный планировщик, разная JVM. Баг «исчезает» при отладке, потому что отладчик **меняет** тайминги.

**Вывод:** для многопоточных багов нужны **специальные инструменты**. Не «поставить точку останова и посмотреть переменные» — это **меняет** поведение. А «снять снимок состояния» — и анализировать.

### Главный инструмент: thread dump

**Thread dump** — снимок всех потоков JVM в **данный момент**: кто что делает, в каком состоянии, что держит, чего ждёт. Это **основной** инструмент для диагностики многопоточных проблем.

**Что в дампе:**

- имя потока (`"worker-1"`);
- состояние (`RUNNABLE`, `BLOCKED`, `WAITING`, `TIMED_WAITING`);
- стек вызовов (какой метод выполняется);
- какие мониторы/локи держит (`locked`);
- какие мониторы/локи ждёт (`waiting to lock`);
- сколько времени в этом состоянии (если JVM поддерживает).

**Как снять.**

**Способ 1: `jstack`.** Из терминала:

```bash
jstack <pid>
```

`pid` — идентификатор Java-процесса. Найти можно через `jps` (входит в JDK) или `ps aux | grep java`.

**Способ 2: `jcmd`.** Более современный:

```bash
jcmd <pid> Thread.print
```

**Способ 3: `Ctrl+\`** (на Linux/macOS) или **`Ctrl+Break`** (на Windows) — в консоли работающей Java-программы. JVM напечатает дамп в stdout.

**Способ 4: `kill -3 <pid>`** — посылает сигнал SIGQUIT, JVM печатает дамп в stdout. Работает на Linux/macOS. На Windows — `jstack`.

**Способ 5: IDE.** IntelliJ IDEA, Eclipse — кнопка «Thread dump» в окне Debug. Удобно во время отладки.

**Способ 6: `jvisualvm` / `jconsole` / Java Mission Control.** Графические инструменты, входят в JDK. Умеют снимать дамп, показывать графики, анализировать.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Правило:</strong> когда программа «зависла» — <strong>первое</strong>, что нужно сделать, — снять thread dump. Не перезапускать, не «подождать ещё», не гадать. Снять дамп и посмотреть. Потом — перезапускать.
</div>

### Как читать thread dump

Дамп выглядит как набор блоков, по одному на поток.

```text
"worker-1" #12 prio=5 os_prio=0 tid=0x... nid=0x... waiting on condition [0x...]
   java.lang.Thread.State: WAITING (parking)
        at jdk.internal.misc.Unsafe.park(Native Method)
        - parking to wait for  <0x000000076b8a4e60> (a java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject)
        at java.util.concurrent.locks.LockSupport.park(LockSupport.java:211)
        at java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1670)
        at java.util.concurrent.ArrayBlockingQueue.take(ArrayBlockingQueue.java:417)
        at com.example.Worker.run(Worker.java:42)
        at java.lang.Thread.run(Thread.java:840)

"worker-2" #13 prio=5 os_prio=0 tid=0x... nid=0x... waiting for monitor entry [0x...]
   java.lang.Thread.State: BLOCKED (on object monitor)
        at com.example.Service.process(Service.java:15)
        - waiting to lock <0x000000076b8a4e60> (a com.example.Service)
        at com.example.Worker.run(Worker.java:20)
        at java.lang.Thread.run(Thread.java:840)
```

**Что читать.**

**Имя и номер** (`"worker-1" #12`). Имя — то, что вы задали (глава 1.7). Если не задали — `Thread-0`, `Thread-1` и т.д. «Анонимные» потоки — плохо для диагностики. Поэтому имена важны.

**Состояние** (`WAITING`, `BLOCKED`). Уже обсуждали (глава 1.4). Главное: `RUNNABLE` — работает, `BLOCKED`/`WAITING`/`TIMED_WAITING` — ждёт.

**Стек.** Сверху вниз: «что сейчас выполняется», «кто вызвал», «кто вызвал вызвавшего», до `Thread.run`. Ищите **ваш** код (`com.example...`), а не JDK-код. JDK-код — это «обёртка», ваш код — «причина».

**«Держит» и «ждёт».** `locked <0x...>` — держит монитор. `waiting to lock <0x...>` — ждёт монитор. Если несколько потоков ждут **один** монитор, который держит **один** поток — это **contention** (глава 2.2). Если потоки ждут **друг друга** — это **deadlock** (глава 2.7).

### Deadlock в дампе

JVM **умеет** определять deadlock и печатать его в дампе. Ищите блок «Found one Java-level deadlock».

```text
Found one Java-level deadlock:
=============================
"t1":
  waiting to lock monitor 0x0000000000000001 (object 0x0000000000000002, a java.lang.Object),
  which is held by "t2"
"t2":
  waiting to lock monitor 0x0000000000000003 (object 0x0000000000000004, a java.lang.Object),
  which is held by "t1"

Java stack information for the threads listed above:
===================================================
"t1":
    at com.example.Service.methodA(Service.java:15)
    - waiting to lock <0x0000000000000002> (a java.lang.Object)
    - locked <0x0000000000000004> (a java.lang.Object)
"t2":
    at com.example.Service.methodB(Service.java:25)
    - waiting to lock <0x0000000000000004> (a java.lang.Object)
    - locked <0x0000000000000002> (a java.lang.Object)
```

**Что видно:** `t1` держит `0x04` и ждёт `0x02`. `t2` держит `0x02` и ждёт `0x04`. **Цикл**. Deadlock. JVM **сама** нашла и показала. Это огромное преимущество — не нужно вручную сопоставлять мониторы.

**Что делать:** исправить порядок захвата (глава 2.7). Или перейти на `tryLock` с таймаутом.

### Contention в дампе

Если deadlock нет, но программа «тормозит» — ищите **contention**. Много потоков в `BLOCKED` на **одном** мониторе, который держит **один** поток.

```text
"worker-1" ... BLOCKED (on object monitor)
   at com.example.Counter.increment(Counter.java:10)
   - waiting to lock <0x...> (a com.example.Counter)

"worker-2" ... BLOCKED (on object monitor)
   at com.example.Counter.increment(Counter.java:10)
   - waiting to lock <0x...> (a com.example.Counter)

"worker-3" ... BLOCKED (on object monitor)
   at com.example.Counter.increment(Counter.java:10)
   - waiting to lock <0x...> (a com.example.Counter)

"worker-0" ... RUNNABLE
   at com.example.Counter.increment(Counter.java:10)
   - locked <0x...> (a com.example.Counter)
```

**Что видно:** три потока ждут монитор `Counter`, один держит. Это **contention** — узкое место. `worker-0` работает, остальные ждут. **Если `increment` быстрый** — contention нормален (монитор быстро освобождается). **Если `increment` медленный** (например, спит или делает I/O) — contention **убивает** производительность.

**Что делать:** уменьшить критическую секцию (глава 2.2). Или заменить на `AtomicInteger` (глава 2.6), `LongAdder`, `ConcurrentHashMap.merge` — в зависимости от задачи.

### «Залипший» поток

Если все потоки в `RUNNABLE`, но ничего не происходит — возможно, **busy wait** (глава 2.8). Один или несколько потоков крутятся в цикле, не делая полезной работы.

```text
"worker-1" ... RUNNABLE
   at com.example.Main.spin(Main.java:15)  // while(true) { } или while(!flag) { }

"worker-2" ... RUNNABLE
   at com.example.Main.spin(Main.java:15)
```

**Что видно:** потоки в `RUNNABLE` на **одном** методе `spin`. Это busy wait. Процессор загружен на 100%, полезной работы — ноль.

**Что делать:** заменить `while(!flag) {}` на `wait`/`notify` (глава 2.9), `BlockingQueue` (глава 5.4), `CountDownLatch` (глава 3.1) — в зависимости от задачи. Или хотя бы добавить `Thread.sleep(1)` (глава 1.5).

### Утечка потоков

Если в дампе **сотни** или **тысячи** потоков с одинаковым стеком — возможно, **утечка потоков** (thread leak). Потоки создаются, но не завершаются.

```text
"worker-1" ... WAITING
   at java.util.concurrent.ArrayBlockingQueue.take(...)
   at com.example.Worker.run(Worker.java:20)

"worker-2" ... WAITING
   at java.util.concurrent.ArrayBlockingQueue.take(...)
   at com.example.Worker.run(Worker.java:20)

... (ещё 998 таких же)
```

**Что видно:** 1000 потоков `worker-*` ждут на `take()` из `BlockingQueue`. Никто не кладёт — они ждут вечно. Это утечка: потоки созданы, но не завершены.

**Что делать:** найти, **кто** их создал и **почему** не завершил. Обычно — `ExecutorService` без `shutdown()` (глава 4.5), или свой пул, который «забыли» закрыть.

### Java Flight Recorder (JFR)

`jstack` — это «снимок». **Java Flight Recorder** — это **запись** событий JVM за период времени. Как «чёрный ящик» в самолёте: пишет всё, что происходит, потом можно «прокрутить» назад.

**Что записывает:**

- Создание/завершение потоков.
- Захваты/освобождения мониторов (contention).
- Выделение памяти (GC).
- I/O-операции.
- Выполнение методов (сэмплирование).
- Ошибки/исключения.

**Как запустить.**

```bash
# Запуск записи на 60 секунд
jcmd <pid> JFR.start duration=60s filename=recording.jfr

# Через 60 секунд — остановится автоматически
```

Или через **Java Mission Control** (JMC) — графический интерфейс для JFR.

**Что смотреть.**

- **Thread contention** — где потоки ждут друг друга.
- **Method profiling** — где процессор проводит время.
- **GC** — как часто и долго работает сборщик.
- **Allocation** — кто выделяет много памяти.
- **Exceptions** — какие исключения бросаются (даже если ловятся).

**Преимущество перед `jstack`:** `jstack` — один снимок. `JFR` — **непрерывная** запись. Можно увидеть, **что** произошло **до** «зависания», а не только «после». Это часто решает проблему: «зависло» — но **почему**?

**Осторожно:** JFR работает с **небольшим** overhead (1–2%), но в **критических** средах его не включают постоянно. Обычно — по требованию, когда проблема уже есть.

### VisualVM и JConsole

**VisualVM** — графический инструмент, входит в JDK (до JDK 8 — вместе, в 9+ — отдельно). Умеет:

- Показывать **графики**: CPU, память, потоки.
- Снимать **thread dump** (кнопка).
- Делать **heap dump** (снимок памяти).
- **Профилировать**: CPU, память.
- Подключаться к **удалённым** JVM (через JMX).

**JConsole** — более простой, входит в JDK. Умеет показывать потоки, память, MBeans. Проще, чем VisualVM, но достаточно для базовой диагностики.

**Что смотреть в VisualVM.**

- **Monitor** — график CPU и памяти. Если CPU 100% — ищите busy wait или contention. Если память растёт — утечка.
- **Threads** — график числа потоков. Если растёт — утечка потоков.
- **Thread dump** — кнопка, показывает дамп в удобном виде. JVM **сама** выделяет deadlock.
- **Sampler** — профилировщик. Показывает, какие методы «едят» CPU.

**Важно:** VisualVM **подключается** к JVM и **влияет** на её поведение (особенно профилировщик). Не используйте на **боевом** сервере без необходимости. Для диагностики «на месте» — `jstack`, `jcmd`, `JFR`.

### async-profiler: для «горячих» мест

`async-profiler` — **сторонний** инструмент (не входит в JDK), но **очень** популярный. Это **сэмплирующий** профайлер, который показывает, **где** процессор проводит время, с **минимальным** overhead.

**Преимущество:** работает через `perf_events` Linux (или `AsyncGetCallTrace`), не через JVMTI. Это даёт **точную** картину, включая **native** код, **GC**, **contention**. JFR и VisualVM в этом слабее.

**Как использовать:**

```bash
# Профилирование CPU на 30 секунд
./profiler.sh -d 30 -e cpu -f profile.html <pid>

# Профилирование аллокаций
./profiler.sh -d 30 -e alloc -f alloc.html <pid>

# Профилирование contention (блокировки)
./profiler.sh -d 30 -e lock -f lock.html <pid>
```

На выходе — **flame graph** (график «пламени»), где видно, какие методы «съедают» больше всего. Очень наглядно.

**Когда использовать:** когда `jstack` показал **что** происходит, но не показал **почему** это медленно. `async-profiler` даёт «где именно болит».

### Типичные сценарии

**Сценарий 1: «программа зависла».**

1. Снять **thread dump** (`jstack`).
2. Найти блок «Found one Java-level deadlock» — если есть, это deadlock.
3. Если deadlock нет — найти потоки в `BLOCKED`, ждущие **один** монитор.
4. Если все в `WAITING` — найти, **чего** они ждут (`waiting on condition`).
5. Исправить причину.

**Сценарий 2: «программа тормозит, но работает».**

1. Запустить **JFR** на 30–60 секунд.
2. Посмотреть **thread contention** — где потоки ждут.
3. Посмотреть **method profiling** — где процессор проводит время.
4. Если contention высокий — уменьшить критическую секцию, заменить `synchronized` на `Atomic`/`Concurrent*`.
5. Если CPU 100% на «полезной» работе — увеличить пул, добавить ядер, оптимизировать алгоритм.

**Сценарий 3: «память растёт, потом `OutOfMemoryError`».**

1. Снять **heap dump** (`jmap -dump:format=b,file=heap.hprof <pid>`).
2. Проанализировать в **VisualVM** или **Eclipse MAT** — какой объект занимает больше всего памяти.
3. Найти **кто** его держит (GC roots) — часто это `ThreadLocal` (глава 7.1), статическая мапа или кеш без eviction.
4. Исправить утечку.

**Сценарий 4: «раз в неделю падает, не воспроизводится».**

1. Включить **JFR** «по кругу» (ring buffer) — запись последних N минут. При падении — сохранить.
2. Смотреть **исключения**, **потоки**, **GC** в момент падения.
3. Если JFR нет — включить **логирование** с метриками (размер пулов, очередей, время операций).
4. Если проблема в **редкой** гонке — использовать **`jcstress`** (фреймворк для тестирования многопоточных структур) или **`-XX:+StressLCM`** / **`-XX:+StressGCM`** (JVM-флаги, «перемешивают» порядок инструкций, увеличивая шанс поймать гонку).

### Частые ошибки

**Ошибка 1: перезапустить, не сняв дамп.** «Зависло — перезапустим». После перезапуска — проблема **исчезла**, и вы **не знаете**, почему. Следующий раз — снова. **Всегда** снимайте дамп **до** перезапуска.

**Ошибка 2: использовать отладчик для многопоточных багов.** Точка останова **меняет** тайминги. Баг **исчезает** при отладке. Для многопоточных — **снимки**, **логи**, **JFR**, а не пошаговая отладка.

**Ошибка 3: `jstack` без `-l`.** Флаг `-l` добавляет информацию о **`java.util.concurrent`** локах (ReentrantLock, Condition). Без него вы увидите только `synchronized`-мониторы, а `ReentrantLock` — «за кадром». **Всегда** `jstack -l`.

**Ошибка 4: игнорировать «мелкие» contention.** «Ну, ждут немного — ничего страшного». Если contention **регулярный** — это узкое место. При нагрузке оно **усилится**. Лучше найти и исправить **сейчас**.

**Ошибка 5: VisualVM на боевом сервере.** Профайлер **влияет** на производительность. На боевом — только **JFR** (низкий overhead) или **снимки** (`jstack`, `jcmd`).

**Ошибка 6: без имён потоков.** «Thread-1234» — не говорит ничего. С именами (`http-worker-5`, `db-connection-2`) — дамп читается **в разы** легче. Всегда давайте имена (глава 1.7).

**Ошибка 7: не смотреть в **свой** код.** Дамп полон JDK-методов. Смотрите на **свой** пакет (`com.example...`). JDK — это «обёртка», ваш код — «причина».

### Аналогия с врачом и детективом

Вернёмся к началу. **Thread dump** — это **анализ крови**. Один снимок, показывает «что в крови сейчас». Если «плохо» — сразу видно.

**JFR** — это **холтеровский монитор**. Записывает **несколько дней**. Когда «прихватило» — можно «прокрутить» назад и **увидеть**, что было **до**.

**VisualVM** — это **УЗИ**. Графический интерфейс, видно «структуру»: потоки, память, CPU. **Наглядно**, но «в реальном времени» — влияет на пациента.

**`async-profiler`** — это **МРТ**. Точная картина, где именно «болит», с минимальным вредом. Но нужен **специальный** аппарат (сторонний инструмент).

**Отладчик** — это **операция на открытом сердце**. Точка останова = «остановить сердце». Для многопоточных багов — **противопоказан**: вы **меняете** то, что хотите наблюдать.

**Правило врача:** сначала **анализы**, потом **лечение**. Не наоборот. В многопоточности — то же самое.

## Микрозадача 1: снять дамп и найти deadlock

**Задача:** Напишите программу с deadlock (глава 2.7): два потока, два монитора, захват в разном порядке. Запустите. Снимите thread dump через `jstack`. Найдите блок «Found one Java-level deadlock».

**Решение:**

```java
public class Main {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        Thread t1 = new Thread(() -> {
            synchronized (lockA) {
                System.out.println("t1: захватил A");
                try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                synchronized (lockB) {
                    System.out.println("t1: захватил B");
                }
            }
        }, "t1");

        Thread t2 = new Thread(() -> {
            synchronized (lockB) {
                System.out.println("t2: захватил B");
                try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                synchronized (lockA) {
                    System.out.println("t2: захватил A");
                }
            }
        }, "t2");

        t1.start();
        t2.start();
    }
}
```

**Запуск и дамп:**

```bash
# В одном терминале
java Main
# В другом
jps                          # найти PID
jstack -l <pid> > dump.txt   # снять дамп
# Открыть dump.txt и найти "Found one Java-level deadlock"
```

**Возможный вывод в дампе:**

```text
Found one Java-level deadlock:
=============================
"t1":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "t2"
"t2":
  waiting to lock monitor 0x... (object 0x..., a java.lang.Object),
  which is held by "t1"
```

**Разбор:** JVM **сама** нашла deadlock и показала: `t1` держит `lockA` и ждёт `lockB`, `t2` держит `lockB` и ждёт `lockA`. Цикл. Программа висит вечно. **Без** `jstack` вы бы гадали, что случилось. **С** `jstack` — диагноз за 10 секунд.

**Важно:** флаг `-l` показывает `ReentrantLock` и `Condition`. Без него — только `synchronized`. Для современных программ — **всегда** `jstack -l`.

## Микрозадача 2: найти contention

**Задача:** Напишите программу: 10 потоков вызывают `synchronized`-метод `increment()`, который спит 10 мс (имитация долгой работы). Снимите дамп. Найдите потоки в `BLOCKED` на одном мониторе.

**Решение:**

```java
public class Main {
    private static int counter = 0;

    public static synchronized void increment() {
        try { Thread.sleep(10); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        counter++;
    }

    public static void main(String[] args) {
        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                for (int j = 0; j < 100; j++) {
                    increment();
                }
            }, "worker-" + i).start();
        }
    }
}
```

**Дамп:**

```bash
jstack -l <pid> > dump.txt
```

**Что искать в дампе:**

```text
"worker-1" ... BLOCKED (on object monitor)
   at com.example.Main.increment(Main.java:5)
   - waiting to lock <0x...> (a java.lang.Class for com.example.Main)

"worker-2" ... BLOCKED (on object monitor)
   at com.example.Main.increment(Main.java:5)
   - waiting to lock <0x...> (a java.lang.Class for com.example.Main)

...

"worker-0" ... TIMED_WAITING (sleeping)
   at com.example.Main.increment(Main.java:6)
   - locked <0x...> (a java.lang.Class for com.example.Main)
```

**Разбор:** `worker-0` держит монитор **класса** `Main` (потому что метод `static synchronized` — глава 2.3) и спит 10 мс внутри критической секции. Остальные девять **ждут** этот монитор. Это **contention**: один работает (и то — спит), девять ждут. Throughput — 1 операция в 10 мс, а не 10 в 10 мс.

**Исправление:** вынести `sleep` **за** критическую секцию. Или использовать `AtomicInteger` (глава 2.6) — тогда блокировки нет вовсе.

## 🎯 Самостоятельная задача

Проведите **диагностику** трёх программ и найдите проблемы.

**Программа A: «зависла».**

```java
public class A {
    private static final Object lock = new Object();
    private static boolean ready = false;

    public static void main(String[] args) throws InterruptedException {
        Thread t = new Thread(() -> {
            synchronized (lock) {
                while (!ready) {
                    try { lock.wait(); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                }
            }
            System.out.println("Проснулся");
        });
        t.start();
        Thread.sleep(1000);
        ready = true;
        // забыли notify
    }
}
```

**Программа B: «тормозит».**

```java
public class B {
    private static final List<Integer> list = new ArrayList<>();

    public static synchronized void add(int x) {
        list.add(x);
        try { Thread.sleep(5); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
    }

    public static void main(String[] args) {
        for (int i = 0; i < 20; i++) {
            new Thread(() -> {
                for (int j = 0; j < 100; j++) add(j);
            }).start();
        }
    }
}
```

**Программа C: «утечка потоков».**

```java
public class C {
    public static void main(String[] args) throws InterruptedException {
        for (int i = 0; i < 1000; i++) {
            new Thread(() -> {
                try { Thread.sleep(60000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }, "worker-" + i).start();
        }
        Thread.sleep(5000);
        System.out.println("main завершается, но 1000 потоков спят");
    }
}
```

**Что сделать:**

1. Запустите каждую программу.
2. Снимите thread dump (`jstack -l <pid>`) для каждой.
3. Найдите проблему в дампе: для A — поток в `WAITING` без `notify`; для B — много потоков в `BLOCKED` на одном мониторе; для C — 1000 потоков `worker-*` в `TIMED_WAITING`.
4. Объясните, **что именно** в дампе указывает на проблему.
5. Исправьте каждую программу.

**Дополнительно:**

- Для A: добавьте `notify()` после `ready = true`. Убедитесь, что дамп показывает «проснулся».
- Для B: вынесите `sleep` за `synchronized`, замените `ArrayList` на `ConcurrentLinkedQueue` (глава 5.5). Сравните дампы «до» и «после».
- Для C: замените 1000 потоков на `Executors.newFixedThreadPool(10)` и `shutdown()`. Убедитесь, что потоков в дампе — 10, а не 1000.

**Вопросы в комментарии:**

1. Почему в A поток висит в `WAITING`, а не в `BLOCKED`? В чём разница (глава 1.4)?
2. Почему в B дамп показывает **один** поток в `TIMED_WAITING` и **много** в `BLOCKED`? Что это значит?
3. Почему в C 1000 потоков — проблема, даже если они «просто спят»? (Подсказка: память.)
4. Как бы вы **автоматизировали** диагностику, чтобы не снимать дамп вручную? (Подсказка: JFR + метрики.)

## 📌 Модуль 7 завершён

Это была последняя глава **модуля 7 «Продвинутое»** и **последняя глава всего раздела по многопоточности**. Мы прошли долгий путь: от «что такое поток» до «как диагностировать deadlock в проде». Теперь вы умеете:

- использовать `ThreadLocal` для «личных» данных потока и понимать опасность утечек;
- создавать виртуальные потоки и понимать, когда они дают выигрыш, а когда — нет;
- строить structured concurrency через `StructuredTaskScope`;
- применять неизменяемость как стратегию — «не менять, а создавать новое»;
- диагностировать многопоточные проблемы через `jstack`, JFR, VisualVM, async-profiler.

**Что дальше — практикум модуля 7.** Восемь задач посложнее и проектное задание «Диагностика реального приложения» — по готовому коду с «зашитыми» проблемами (deadlock, утечка потоков, contention, `ThreadLocal`-утечка) найти и исправить всё.

А затем — **финальный проект всего раздела**: «Многопоточный сервис обработки заказов», который объединяет **все** модули: пулы, синхронизацию, коллекции, асинхронность, structured concurrency. Это то, что можно показать в портфолио.