# Разборы практикума по модулю 1

## Как пользоваться этой страницей

Разбор — это не «эталон». Это **один из возможных** способов решить задачу. Если ваш код отличается от приведённого, но работает и вы понимаете почему — это нормально. Многопоточность почти никогда не имеет единственного правильного ответа.

Читайте разбор **после** того, как попробовали сами. Иначе весь смысл практикума теряется: вы запомните решение, а не научитесь решать.

## Задача 1. Два счётчика

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Runnable even = () -> printNumbers("even", 0, 20, 2);
        Runnable odd  = () -> printNumbers("odd",  1, 19, 2);

        Thread tEven = new Thread(even, "even");
        Thread tOdd  = new Thread(odd,  "odd");
        tEven.start();
        tOdd.start();
        tEven.join();
        tOdd.join();
        System.out.println("Готово");
    }

    private static void printNumbers(String name, int from, int to, int step) {
        for (int i = from; i <= to; i += step) {
            System.out.println("[" + name + "] " + i);
            try {
                Thread.sleep(100);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }
}
```

**Что здесь важно.** Лямбда не должна печатать напрямую — лучше вынести в метод `printNumbers`, потому что логика одинаковая, отличаются только параметры. Имя потока задаётся в конструкторе `Thread(task, name)`, а не через `setName()` — так надёжнее. Обработка `InterruptedException` восстанавливает флаг и завершает метод: это вежливое поведение, о котором мы говорили в главе 1.6.

## Задача 2. Найди три ошибки

**Ошибка 1.** `worker.run()` вместо `worker.start()`. Задача выполняется в главном потоке. Потока `worker` фактически нет.

**Ошибка 2.** Нет `worker.join()`. Даже если бы был `start()`, главный поток не дождался бы `worker` и напечатал «main завершается» раньше времени.

**Ошибка 3.** `catch (InterruptedException e) { /* ничего */ }` — молчаливое проглатывание. Если поток прервут, программа этого не заметит, а флаг прерывания будет сброшен. Правильно — восстановить флаг и выйти:

```java
catch (InterruptedException e) {
    Thread.currentThread().interrupt();
    return;
}
```

**Исправленный код:**

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread worker = new Thread(() -> {
            try {
                for (int i = 0; i < 5; i++) {
                    System.out.println("Работаю: " + i);
                    Thread.sleep(500);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            System.out.println("Готово");
        }, "worker");

        worker.start();
        worker.join();
        System.out.println("main завершается");
    }
}
```

## Задача 3. Все шесть состояний

Один из вариантов:

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        // 1. NEW
        Thread t = new Thread(() -> {
            try {
                Thread.sleep(500);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        System.out.println("NEW — " + t.getState());

        // 2. RUNNABLE / TIMED_WAITING
        t.start();
        Thread.sleep(100);
        System.out.println("TIMED_WAITING — " + t.getState());

        // 3. WAITING
        Object lock = new Object();
        Thread waiter = new Thread(() -> {
            synchronized (lock) {
                try {
                    lock.wait();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });
        waiter.start();
        Thread.sleep(100);
        System.out.println("WAITING — " + waiter.getState());

        // 4. BLOCKED
        Thread blocker1 = new Thread(() -> {
            synchronized (lock) {
                try { Thread.sleep(500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
        });
        Thread blocker2 = new Thread(() -> {
            synchronized (lock) { /* ждёт */ }
        });
        blocker1.start();
        Thread.sleep(100);
        blocker2.start();
        Thread.sleep(100);
        System.out.println("BLOCKED — " + blocker2.getState());

        // 5. TERMINATED
        synchronized (lock) { lock.notifyAll(); } // разбудить waiter
        t.join();
        waiter.join();
        blocker1.join();
        blocker2.join();
        System.out.println("TERMINATED — " + t.getState());
    }
}
```

**Что здесь важно.** `RUNNABLE` пропущен специально — состояние слишком короткое, чтобы его надёжно поймать из другого потока. Если вам оно нужно — запустите поток, который крутится в CPU-bound цикле, и снимите состояние почти сразу. Но и тут возможны варианты: планировщик может успеть дать потоку поработать, а может ещё нет.

`waiter` висит в `wait()` без таймаута — это `WAITING`. `blocker2` висит на мониторе, занятом `blocker1` — это `BLOCKED`. Разница между ними наглядна.

## Задача 4. Тише едешь — дальше будешь

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        Thread a = new Thread(() -> loopWith("counter-A", () -> {
            try { Thread.sleep(100); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }));
        Thread b = new Thread(() -> loopWith("counter-B", () -> Thread.yield()));
        Thread c = new Thread(() -> loopWith("counter-C", () -> {}));
        a.start();
        b.start();
        c.start();
        Thread.sleep(1000);
        a.interrupt();
        b.interrupt();
        c.interrupt();
        a.join();
        b.join();
        c.join();
    }

    private static void loopWith(String name, Runnable pause) {
        for (int i = 1; i <= 10; i++) {
            System.out.println("[" + name + "] " + i);
            pause.run();
        }
    }
}
```

**Что вы должны были увидеть.** `counter-A` с `sleep(100)` печатает примерно 10 чисел за секунду — то есть отстаёт сильнее всех. `counter-C` без пауз обычно обгоняет всех. `counter-B` с `yield()` — где-то посередине и нестабильно: иногда обгоняет `counter-C`, иногда нет.

**Почему `yield()` нестабилен.** Потому что планировщик **не обязан** реагировать. `yield()` — это вежливая просьба, а не команда. Иногда планировщик передаёт CPU другому потоку, иногда — нет. На современных JVM и ОС `yield()` часто вообще игнорируется, поэтому `counter-B` может вести себя как `counter-C`.

## Задача 5. Прерывание с уборкой

**Обычный поток:**

```java
Thread normal = new Thread(() -> {
    try {
        for (int i = 0; i < 100; i++) {
            System.out.println("Пишу строку " + i);
            Thread.sleep(1000);
        }
    } catch (InterruptedException e) {
        System.out.println("Прерван на итерации");
    } finally {
        System.out.println("Файл закрыт корректно");
    }
});
normal.start();
Thread.sleep(2000);
normal.interrupt();
normal.join();
```

**Вывод:** «Файл закрыт корректно» **будет** напечатано. `join()` дожидается завершения потока, а `finally` выполняется после `catch`.

**Демон-поток:**

```java
Thread daemon = new Thread(() -> {
    try {
        for (int i = 0; i < 100; i++) {
            System.out.println("Пишу строку " + i);
            Thread.sleep(1000);
        }
    } catch (InterruptedException e) {
        System.out.println("Прерван на итерации");
    } finally {
        System.out.println("Файл закрыт корректно");
    }
});
daemon.setDaemon(true);
daemon.start();
Thread.sleep(2000);
// main завершается, не прерывая daemon
```

**Вывод:** «Файл закрыт корректно» **может не появиться**. JVM убивает демон при завершении `main`, `finally` не гарантирован.

**Разница.** Прерывание через `interrupt()` — это **вежливая просьба остановиться**. Поток сам решает, когда завершиться, `finally` успевает выполниться. Завершение JVM — это **принудительное убийство демонов**. Гарантий нет.

## Задача 6. Приоритет — это пожелание

```java
public class Main {
    public static void main(String[] args) throws InterruptedException {
        for (int run = 1; run <= 5; run++) {
            Thread high = create("high", Thread.MAX_PRIORITY);
            Thread low  = create("low",  Thread.MIN_PRIORITY);
            high.start();
            low.start();
            high.join();
            low.join();
            System.out.println();
        }
    }

    private static Thread create(String name, int priority) {
        return new Thread(() -> {
            long start = System.nanoTime();
            long sum = 0;
            for (int i = 0; i < 10_000_000; i++) sum += i;
            long elapsed = (System.nanoTime() - start) / 1_000_000;
            System.out.println("[" + name + "] " + elapsed + " мс");
        }, name);
    }
}
```

Если выставить приоритеты внутри `create` через `thread.setPriority(priority)` до `start()` — эксперимент покажет, что `high` **не всегда** быстрее `low`. В некоторых запусках `low` окажется даже быстрее.

**Почему.** На современных Linux-планировщиках (CFS) приоритеты потоков Java практически не учитываются. На Windows влияние есть, но слабое. На macOS — по-разному в зависимости от версии. В любом случае — **нельзя полагаться** на приоритет для логики программы. Это подсказка, а не гарантия.

## Задача 7. Диагноз по симптому

**Программа А.** Не зависает, но и не делает того, что задумано: дважды вызывает `join()` на уже завершённом потоке. Второй `join()` возвращается сразу. Ошибка не в зависании, а в логике: `join()` вызывают один раз. Возможно, автор хотел дождаться **двух** потоков, а создал один.

**Программа Б.** Завершается, но с неприятным сюрпризом: `daemon` живёт в `while (true)`, а `normal` спит 5 секунд. `normal.join()` ждёт 5 секунд, потом `main` завершается, и `daemon` убивается. Если бы `normal` не было — программа завершилась бы сразу после `daemon.start()`, а `daemon` не успел бы ничего сделать. Ошибка в том, что **демон используется для работы, которую нужно дождаться**. Если нужен результат — поток должен быть обычным.

**Программа В.** Зависает по-настоящему. `while (t.isAlive()) {}` крутится в главном потоке, ожидая завершения `t`. Но `t` тоже работает — и оба конкурируют за CPU. Это классический **busy wait**: главный поток тратит всё процессорное время на проверку, а `t` не получает процессорного времени, чтобы завершиться. На одноядерной машине зависнет навсегда. На многоядерной, скорее всего, завершится — но неэффективно.

**Исправление В:**

```java
t.join();
```

`join()` усыпляет главный поток, пока `t` не завершится. Никакого busy wait.

## Задача 8. Резюме в одном приложении

```java
import java.util.concurrent.atomic.AtomicInteger;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        AtomicInteger active = new AtomicInteger(3);

        Runnable taskA = createTask("task-A", active);
        Runnable taskB = createTask("task-B", active);
        Runnable taskC = createTask("task-C", active);

        Thread tA = new Thread(taskA, "task-A");
        Thread tB = new Thread(taskB, "task-B");
        Thread tC = new Thread(taskC, "task-C");

        Thread monitor = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("[monitor] активно: " + active.get() + " из 3");
                try {
                    Thread.sleep(300);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
            System.out.println("[monitor] завершён");
        }, "monitor");
        monitor.setDaemon(true);

        long start = System.currentTimeMillis();
        monitor.start();
        tA.start(); tB.start(); tC.start();
        tA.join(); tB.join(); tC.join();
        monitor.interrupt();
        monitor.join();
        long elapsed = System.currentTimeMillis() - start;
        System.out.println("Всего задач: 3, завершено: " + (3 - active.get()) + ", время: " + elapsed + " мс");
    }

    private static Runnable createTask(String name, AtomicInteger active) {
        return () -> {
            try {
                long sleep = 1000 + (long) (Math.random() * 2000);
                Thread.sleep(sleep);
                System.out.println("[" + name + "] завершена за " + sleep + " мс");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                active.decrementAndGet();
            }
        };
    }
}
```

**Замечание.** Здесь используется `AtomicInteger`, хотя формально это тема модуля 2. Это оправдано: без атомарного счётчика `active` мы получили бы гонку. Можно заменить на `synchronized`, но получится громоздче. Если хотите — попробуйте оба варианта. Это хороший мостик к модулю 2: вы уже почувствовали, зачем нужны атомарные типы, ещё не пройдя главу о них.

## Проектное задание. Менеджер фоновых задач

Один из вариантов реализации:

```java
import java.util.concurrent.atomic.AtomicInteger;

public class TaskManager {
    private final AtomicInteger completed = new AtomicInteger(0);
    private final AtomicInteger failed = new AtomicInteger(0);

    public void run(String[] names) throws InterruptedException {
        int total = names.length;
        Thread[] workers = new Thread[total];
        for (int i = 0; i < total; i++) {
            String name = names[i];
            workers[i] = new Thread(() -> {
                try {
                    long sleep = 1000 + (long) (Math.random() * 4000);
                    Thread.sleep(sleep);
                    if (Math.random() < 0.2) {
                        throw new RuntimeException("случайный сбой");
                    }
                    System.out.println("[" + name + "] завершена");
                    completed.incrementAndGet();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (RuntimeException e) {
                    System.out.println("[" + name + "] упала: " + e.getMessage());
                    failed.incrementAndGet();
                } finally {
                    System.out.println("[" + name + "] уборка выполнена");
                }
            }, name);
        }

        Thread reporter = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                System.out.println("[reporter] активно: " + (total - completed.get() - failed.get()) + " из " + total);
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "reporter");
        reporter.setDaemon(true);

        long start = System.currentTimeMillis();
        reporter.start();
        for (Thread t : workers) t.start();
        for (Thread t : workers) t.join();
        reporter.interrupt();
        reporter.join();

        long elapsed = System.currentTimeMillis() - start;
        System.out.println("Завершено: " + completed.get() + ", упало: " + failed.get() + ", время: " + elapsed + " мс");
    }

    public static void main(String[] args) throws InterruptedException {
        new TaskManager().run(new String[]{"task-A", "task-B", "task-C"});
    }
}
```

**Разбор ключевых решений.**

**Почему `reporter` — демон.** Он не производит полезную работу, а только наблюдает. Если бы он был обычным потоком, программа ждала бы его завершения. Но `reporter` не должен решать, когда программе заканчиваться. Он уходит вместе с ней.

**Почему задачи — обычные потоки.** Их результат важен. Программа **должна** их дождаться. Если бы они были демонами, JVM могла бы их убить посреди работы, не дав завершиться.

**Почему исключение не останавливает остальные.** Каждая задача в своём `try/catch`. `RuntimeException` из одной задачи не может «перекинуться» на другую — они в разных потоках. Это важное свойство: изоляция ошибок обеспечена самой моделью потоков.

**Почему время ≈ времени самой долгой задачи.** Задачи работают параллельно, каждая в своём потоке. Общее время — максимум по всем, а не сумма. Если бы запускали последовательно — было бы около 9 секунд (1+3+5), а параллельно — около 5.

**Про сто задач.** Ответ «сто потоков — это нормально» неверен. Каждый поток занимает память под стек (~1 МБ по умолчанию) и требует переключения контекста. Сто потоков ещё выдержит, тысяча — уже проблема. Для большого числа задач нужны **пулы потоков** (`ExecutorService`), о которых — в модуле 4. Это правильный ответ на вопрос со звёздочкой: `TaskManager` следовало бы переписать на пуле, когда задач станет много.

---

**Если все восемь задач решены и проектное задание сделано** — модуль 1 пройден по-настоящему. Не по прочтению, а по практике. Дальше — модуль 2 «Синхронизация», где начнётся настоящая боль: гонки данных, `synchronized`, `volatile` и дедлоки. Но теперь у вас есть база, на которую это всё ляжет.