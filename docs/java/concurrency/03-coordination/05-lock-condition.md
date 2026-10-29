# 3.5. Lock и Condition

## Где вы это уже видели

**Шкафчик с замком.** В спортзале — шкафчики. Вы приходите, вешаете замок, кладёте вещи, уходите на тренировку. Через час возвращаетесь, открываете своим ключом, забираете вещи. Ключ у вас, и только у вас. Никто не может открыть шкафчик, пока вы не откроете. А ещё — вы можете **отдать ключ другу**, и он откроет. Это не «занято/свободно», это именно **владение ключом**.

**Переговорка с бронью.** Вы бронируете переговорку на час. Входите, закрываетесь. Через час — выходите. Если переговорка занята — вы **не стоите под дверью**, а идёте пить кофе и возвращаетесь через двадцать минут. Или **сразу уходите** и договариваетесь о другом времени. Гибко.

**Многоканальный телефон в офисе.** Один телефон, но три линии. Звонок по вопросам оплаты — на первую линию. По техническим вопросам — на вторую. По общим вопросам — на третью. Каждый менеджер сидит на своей линии и слышит только свои звонки. Это `Condition` — несколько «каналов» ожидания на одном объекте.

**Дверной звонок с разными мелодиями.** Гость звонит — мелодия одна. Курьер — другая. Сантехник — третья. Вы слышите, кто именно пришёл, и решаете, идти ли открывать. Если бы звонок был один на всех, вам пришлось бы каждый раз вставать и проверять, кто там. `wait`/`notify` — это один звонок на всех. `Condition` — это разные звонки.

**Общее во всех случаях** одно: есть **владение** (ключ, бронь), которое можно передать, и есть **каналы оповещения**, которые можно разделить. `Lock` даёт первое, `Condition` — второе. Вместе они — более гибкая альтернатива `synchronized` и `wait`/`notify`.

## Теория

### Зачем Lock, если есть synchronized

`synchronized` — прекрасный инструмент, и в большинстве случаев его достаточно. Но у него есть ограничения, которые иногда мешают.

**Первое: нет таймаута.** Если поток не может захватить монитор — он ждёт **вечно**. Нет способа сказать «попробуй секунду и, если не вышло, иди дальше».

**Второе: нет прерывания.** Если поток ждёт монитор, его нельзя прервать через `interrupt()` — он всё равно дождётся. `synchronized` игнорирует прерывание во время ожидания.

**Третье: нет справедливости.** `synchronized` не гарантирует, что монитор получит тот, кто дольше ждёт. Может повезти «новичку», а «старожил» будет ждать.

**Четвёртое: один монитор — одно условие.** Все, кто ждёт на `synchronized`, ждут **одного и того же** сигнала через `wait`/`notify`. Нельзя разделить ожидающих по разным условиям.

`Lock` и `Condition` решают все четыре проблемы.

### ReentrantLock

Основной класс — `ReentrantLock` из `java.util.concurrent.locks`.

```java
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

Lock lock = new ReentrantLock();

lock.lock();
try {
    // критическая секция
} finally {
    lock.unlock();
}
```

Обратите внимание на структуру: `lock()`, потом `try`, потом `finally` с `unlock()`. Это **канонический паттерн**, который нужно запомнить наизусть. `unlock()` обязательно в `finally` — иначе при исключении блокировка останется захваченной навсегда.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Правило:</strong> <code>lock()</code> — до <code>try</code>, <code>unlock()</code> — в <code>finally</code>. Всегда. Без исключений. Иначе — вечный дедлок.
</div>

### Reentrant — «повторно входимый»

Слово `Reentrant` в названии означает, что поток может **повторно захватить** уже захваченную им блокировку.

```java
lock.lock();
try {
    // ...
    lock.lock(); // тот же поток может захватить ещё раз
    try {
        // ...
    } finally {
        lock.unlock();
    }
} finally {
    lock.unlock();
}
```

Внутри `ReentrantLock` хранит **счётчик захватов**. Каждый `lock()` увеличивает его на 1, каждый `unlock()` — уменьшает. Блокировка реально освобождается, только когда счётчик дойдёт до нуля.

Зачем это нужно? Например, если метод `A` захватывает блокировку и вызывает метод `B`, который тоже её захватывает. Без reentrancy это привело бы к дедлоку: поток ждал бы сам себя. С `ReentrantLock` — работает.

`synchronized` тоже реентрантен — это стандартное свойство мониторов Java.

### tryLock: попробовать и не ждать

Главное преимущество `Lock` перед `synchronized` — возможность **не блокироваться**.

**`tryLock()`** — пытается захватить блокировку **сразу**. Если получилось — `true`, если нет — `false`. Не блокируется.

```java
if (lock.tryLock()) {
    try {
        // работаем
    } finally {
        lock.unlock();
    }
} else {
    // не получилось — делаем что-то другое
}
```

**`tryLock(timeout, unit)`** — пытается захватить **не дольше** указанного времени. Бросает `InterruptedException`, если поток прервали во время ожидания.

```java
try {
    if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
        try {
            // работаем
        } finally {
            lock.unlock();
        }
    } else {
        // не дождались за 500 мс
    }
} catch (InterruptedException e) {
    Thread.currentThread().interrupt();
}
```

Это спасает от вечного ожидания. Если блокировка «залипла» из-за бага в чужом коде — вы не зависнете, а пойдёте дальше (или обработаете ситуацию).

`tryLock` — главная причина использовать `ReentrantLock` вместо `synchronized`.

### lockInterruptibly: прерываемое ожидание

`synchronized` игнорирует `interrupt()` во время ожидания монитора. `ReentrantLock` позволяет **прервать** ожидание.

```java
try {
    lock.lockInterruptibly();
    try {
        // работаем
    } finally {
        lock.unlock();
    }
} catch (InterruptedException e) {
    // нас прервали, пока мы ждали блокировку
    Thread.currentThread().interrupt();
}
```

Разница с `lock()`: `lock()` ждёт блокировку и **не реагирует** на `interrupt()`. `lockInterruptibly()` ждёт блокировку, но если поток прервут — бросит `InterruptedException` и перестанет ждать.

Это нужно в задачах, где важно уметь «отменить» ожидание: например, при завершении программы, когда нужно, чтобы все потоки быстро остановились.

### Справедливость

`ReentrantLock` может быть справедливым и несправедливым. По умолчанию — несправедливый.

```java
Lock unfair = new ReentrantLock();          // по умолчанию
Lock fair = new ReentrantLock(true);        // fair mode
```

В несправедливом режиме блокировку получает **любой**, кто её попросит в момент освобождения. В справедливом — тот, кто дольше всех ждёт (FIFO).

Справедливый режим защищает от starvation, но медленнее: нужно управлять очередью. По умолчанию — несправедливый, как и у `Semaphore`.

### Condition: несколько условий ожидания

Вот тут начинается главная сила `Lock`. С `synchronized` есть только один набор `wait`/`notify` — все ждут одного и того же. С `Condition` можно создать **несколько условий** на одной блокировке.

```java
Lock lock = new ReentrantLock();
Condition notEmpty = lock.newCondition();
Condition notFull = lock.newCondition();
```

Теперь у нас два разных «канала» ожидания:

- Потоки, которые ждут, что **буфер не пуст**, ждут на `notEmpty`.
- Потоки, которые ждут, что **буфер не полон**, ждут на `notFull`.

Каждый канал имеет свои методы:

- `await()` — аналог `wait()`.
- `signal()` — аналог `notify()`.
- `signalAll()` — аналог `notifyAll()`.

И вот главное преимущество: **можно будить только нужных**. Если в буфер положили элемент — будим `notEmpty` (ждущих «есть данные»). Если из буфера забрали — будим `notFull` (ждущих «есть место»). Не нужно будить всех.

Это устраняет проблему `notify()` из главы 2.9: с несколькими условиями `signal()` безопасен, потому что будит **только тех, кто ждёт именно этого сигнала**.

### Правильное использование Condition

`await()`/`signal()`/`signalAll()` можно вызывать **только когда захвачен `lock`**. Иначе — `IllegalMonitorStateException`, как и с `wait`/`notify`.

```java
lock.lock();
try {
    while (!condition) {
        notEmpty.await();
    }
    // работаем
} finally {
    lock.unlock();
}
```

`while` — по тем же причинам, что и с `wait`: spurious wakeup, несколько ждущих, изменение условия. Всегда `while`, никогда `if`.

### Паттерн producer-consumer с Condition

Классический пример, где `Condition` раскрывается полностью:

```java
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class BoundedBuffer<T> {
    private final Object[] items;
    private int count = 0;
    private int putIndex = 0;
    private int takeIndex = 0;

    private final Lock lock = new ReentrantLock();
    private final Condition notEmpty = lock.newCondition();
    private final Condition notFull = lock.newCondition();

    public BoundedBuffer(int capacity) {
        items = new Object[capacity];
    }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (count == items.length) {
                notFull.await(); // ждём, пока есть место
            }
            items[putIndex] = item;
            putIndex = (putIndex + 1) % items.length;
            count++;
            notEmpty.signal(); // будим того, кто ждёт «есть данные»
        } finally {
            lock.unlock();
        }
    }

    @SuppressWarnings("unchecked")
    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (count == 0) {
                notEmpty.await(); // ждём, пока есть данные
            }
            T item = (T) items[takeIndex];
            items[takeIndex] = null;
            takeIndex = (takeIndex + 1) % items.length;
            count--;
            notFull.signal(); // будим того, кто ждёт «есть место»
            return item;
        } finally {
            lock.unlock();
        }
    }
}
```

Сравните с версией на `synchronized` + `wait`/`notifyAll` из главы 2.9. Там приходилось будить **всех**, потому что `notify()` мог разбудить «не того». Здесь `signal()` будит **только нужных** — тех, кто ждёт на конкретном `Condition`. Эффективнее и безопаснее.

### tryLock с Condition

`Condition` умеет `await` с таймаутом и **прерываемый** await:

```java
boolean await(long time, TimeUnit unit);   // ждать не дольше
long awaitNanos(long nanosTimeout);        // то же в наносекундах
boolean awaitUntil(Date deadline);         // до конкретного момента
void awaitUninterruptibly();               // не реагировать на interrupt
```

`awaitUninterruptibly()` — редкий случай: иногда нужно дождаться сигнала **несмотря на interrupt**. Обычно не нужно, но знать про такой метод стоит.

### Lock vs synchronized

Когда что использовать? Вот простая шпаргалка.

**Используйте `synchronized`, если:**

- Задача простая: один монитор, никаких таймаутов, никакой справедливости.
- Вы не пишете библиотеку и не знаете, как код будет использоваться.
- Вам нужен минимальный код и максимальная простота.

**Используйте `ReentrantLock`, если:**

- Нужен `tryLock` с таймаутом.
- Нужна справедливость.
- Нужна возможность прервать ожидание (`lockInterruptibly`).
- Нужны несколько `Condition` на одной блокировке.
- Вы строите сложный примитив синхронизации (свой `BoundedBuffer`, свой пул).

**Правило простое:** по умолчанию — `synchronized`. Если упираетесь в его ограничения — переходите на `Lock`. Не наоборот.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Правило:</strong> <code>synchronized</code> — по умолчанию. <code>ReentrantLock</code> — когда нужны его дополнительные возможности. Не выбирайте <code>Lock</code> «на всякий случай»: он требует явного <code>unlock</code>, и забыть его легче, чем кажется.
</div>

### Частые ошибки

**Ошибка 1: забыть `unlock()`.** Самая частая. Всегда — в `finally`. Без исключений.

**Ошибка 2: `unlock()` в другом потоке.** `ReentrantLock` отслеживает, **кто** захватил блокировку. Если `unlock()` вызовет другой поток — `IllegalMonitorStateException`. В отличие от `Semaphore`, где `release()` может быть из любого потока, `Lock` требует, чтобы освобождал **тот же** поток, что и захватил.

**Ошибка 3: `await()` без `lock`.** `Condition.await()` работает только внутри `lock.lock()`/`lock.unlock()`. Иначе — `IllegalMonitorStateException`.

**Ошибка 4: `signal()` без `lock`.** То же самое: `signal` и `signalAll` требуют захваченной блокировки.

**Ошибка 5: `if` вместо `while` вокруг `await()`.** Та же проблема, что и с `wait`. Spurious wakeup, несколько ждущих, изменение условия. Всегда `while`.

**Ошибка 6: путать `Condition.await()` с `Thread.sleep()`.** `await()` отпускает блокировку, `sleep()` — нет. Разница та же, что между `wait()` и `sleep()`.

### Аналогия со шкафчиком и звонками

Вернёмся к началу. `Lock` — это **шкафчик с замком**. Вы захватили ключ — шкафчик ваш. Можете отдать ключ другу (в `ReentrantLock` — нет, только тот же поток, но в `Semaphore` — можно). Можете вернуться через час — ключ всё ещё работает. Можете попробовать открыть чужой шкафчик (`tryLock`) — если занят, уйдёте ни с чем.

`Condition` — это **разные звонки на двери**. Один для «пришли гости», другой для «пришёл курьер», третий для «пришёл сантехник». Вы слышите, кто именно пришёл, и решаете, стоит ли вставать. С `synchronized` звонок один: «кто-то пришёл», и вы каждый раз встаёте проверять.

`signal()` — это «нажать на конкретный звонок». `signalAll()` — «нажать на все звонки». С `Condition` можно нажимать на нужный, а не на все сразу.

## Микрозадача 1: tryLock

**Задача:** Создайте `ReentrantLock` и два потока. Первый захватывает блокировку и держит 2 секунды. Второй пытается захватить через `tryLock(500, TimeUnit.MILLISECONDS)`. Убедитесь, что второй не дождался и пошёл дальше.

**Решение:**

```java
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Main {
    public static void main(String[] args) throws InterruptedException {
        Lock lock = new ReentrantLock();

        Thread holder = new Thread(() -> {
            lock.lock();
            try {
                System.out.println("holder: захватил блокировку");
                Thread.sleep(2000);
                System.out.println("holder: отпускаю");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                lock.unlock();
            }
        }, "holder");

        Thread contender = new Thread(() -> {
            try {
                if (lock.tryLock(500, TimeUnit.MILLISECONDS)) {
                    try {
                        System.out.println("contender: захватил блокировку");
                    } finally {
                        lock.unlock();
                    }
                } else {
                    System.out.println("contender: не дождался за 500 мс");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }, "contender");

        holder.start();
        Thread.sleep(100);
        contender.start();
        holder.join();
        contender.join();
    }
}
```

**Возможный вывод:**

```text
holder: захватил блокировку
contender: не дождался за 500 мс
holder: отпускаю
```

**Разбор:** `holder` захватил блокировку и спит 2 секунды. `contender` пытается захватить через `tryLock(500мс)`. Через 500 мс он понимает, что блокировка всё ещё занята, и **не ждёт дальше** — выводит сообщение и завершается. А `holder` продолжает держать блокировку ещё 1,5 секунды. С `synchronized` такого не сделать: `contender` ждал бы все 2 секунды.

## Микрозадача 2: два Condition

**Задача:** Реализуйте `BoundedBuffer` на `ReentrantLock` и двух `Condition`: `notEmpty` и `notFull`. Ёмкость 2. Один producer кладёт 5 элементов, один consumer забирает 5. Убедитесь, что программа работает без `notifyAll` — только `signal`.

**Решение:**

```java
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.locks.Condition;
import java.util.concurrent.locks.Lock;
import java.util.concurrent.locks.ReentrantLock;

public class Main {
    private static final Deque<Integer> items = new ArrayDeque<>();
    private static final int CAPACITY = 2;
    private static final Lock lock = new ReentrantLock();
    private static final Condition notEmpty = lock.newCondition();
    private static final Condition notFull = lock.newCondition();

    public static void main(String[] args) throws InterruptedException {
        Thread producer = new Thread(() -> {
            for (int i = 1; i <= 5; i++) {
                lock.lock();
                try {
                    while (items.size() == CAPACITY) {
                        notFull.await();
                    }
                    items.addLast(i);
                    System.out.println("producer: положил " + i);
                    notEmpty.signal();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } finally {
                    lock.unlock();
                }
            }
        }, "producer");

        Thread consumer = new Thread(() -> {
            for (int i = 1; i <= 5; i++) {
                lock.lock();
                try {
                    while (items.isEmpty()) {
                        notEmpty.await();
                    }
                    int value = items.removeFirst();
                    System.out.println("consumer: забрал " + value);
                    notFull.signal();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } finally {
                    lock.unlock();
                }
            }
        }, "consumer");

        producer.start();
        consumer.start();
        producer.join();
        consumer.join();
    }
}
```

**Возможный вывод:**

```text
producer: положил 1
producer: положил 2
consumer: забрал 1
producer: положил 3
consumer: забрал 2
producer: положил 4
consumer: забрал 3
producer: положил 5
consumer: забрал 4
consumer: забрал 5
```

**Разбор:** `notEmpty.signal()` будит **только** того, кто ждёт «есть данные». `notFull.signal()` — только того, кто ждёт «есть место». Не нужно будить всех: producer не конкурирует с consumer за один и тот же сигнал. Это гораздо эффективнее, чем `notifyAll`, и безопаснее, чем `notify` (не разбудит «не того»).

## 🎯 Самостоятельная задача

Реализуйте **потокобезопасный стек с ограничением размера** на `ReentrantLock` и **двух** `Condition`.

**Постановка:**

1. Класс `BoundedStack<T>`:
   - Конструктор принимает `capacity`.
   - Внутри — `ArrayDeque<T>`, `ReentrantLock` и два `Condition`: `notEmpty`, `notFull`.
   - Метод `push(T item)` — кладёт элемент. Если стек полон — **ждёт**, пока освободится место.
   - Метод `T pop()` — забирает верхний элемент. Если стек пуст — **ждёт**, пока появится элемент.
   - Метод `int size()` — текущий размер (под блокировкой).
2. Все методы работают под `lock`. Использовать `while` для проверки условий, `signal` для пробуждения нужного условия.

**Тесты:**

1. `BoundedStack<Integer>` ёмкостью 3.
2. Два `producer`-потока, каждый кладёт 50 чисел.
3. Два `consumer`-потока, каждый забирает 50 чисел.
4. Все четыре потока должны завершиться. Сумма всех положенных чисел равна сумме всех забранных.

**Дополнительно:**

- Замените `signal()` на `signalAll()`. Запустите. Работает ли? Быстрее или медленнее?
- Замените `ReentrantLock` на `synchronized` и один `Condition` на `wait`/`notifyAll`. Работает ли? Что приходится менять?
- Добавьте `tryLock(1, TimeUnit.SECONDS)` в `push`. Если не удалось за секунду — бросать `IllegalStateException`. Запустите с переполненным стеком. Убедитесь, что producer'ы не зависают.

В комментарии к коду ответьте:

1. Почему `signal()` безопаснее `notify()`, но `signalAll()` тоже иногда нужен?
2. В чём разница между «`unlock()` в `finally`» и «`countDown()` в `finally`» из главы 3.1?
3. Почему `ReentrantLock` не позволяет `unlock()` из другого потока, а `Semaphore` позволяет `release()` из любого? Это случайность или осознанное решение?
4. Как бы вы реализовали справедливый `BoundedStack`? Достаточно ли `new ReentrantLock(true)`?

## 📌 Модуль 3 завершён

Это была последняя глава **модуля 3 «Высокоуровневая координация»**. Мы прошли путь от `CountDownLatch` («дождаться всех») до `ReentrantLock` и `Condition` («гибкая блокировка с несколькими условиями»). Теперь вы умеете:

- ждать завершения N задач через `CountDownLatch`;
- синхронизировать фиксированную группу через `CyclicBarrier`;
- ограничивать параллелизм через `Semaphore`;
- обмениваться значениями через `Exchanger`;
- строить многофазные алгоритмы через `Phaser`;
- использовать `ReentrantLock` и `Condition` вместо `synchronized`, когда нужны таймауты, справедливость или несколько условий.

**Что дальше — практикум модуля 3.** Восемь задач посложнее и проектное задание «Многопоточный веб-сканер» — программа, которая параллельно обходит сайты, ограничивает параллелизм через `Semaphore`, синхронизирует этапы через `CyclicBarrier` и корректно завершается.

А затем — **модуль 4 «Пулы потоков и Executor Framework»**, где мы перестанем создавать потоки вручную и научимся управлять ими через `ExecutorService`.