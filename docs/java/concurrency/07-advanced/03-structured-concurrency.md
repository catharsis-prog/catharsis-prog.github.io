# 7.3. Structured Concurrency

## Где вы это уже видели

**Поездка с детьми.** Вы собрались в парк с тремя детьми. Выходите из дома — все вместе. Если один по дороге упал и разбил коленку — вы **не бросаете** остальных и не идёте дальше. Вы останавливаетесь, обрабатываете коленку, возвращаетесь домой **всей группой**. Если один отстал — ждёте его. Никто не «доходит до парка сам по себе» — группа движется как **единое целое**. Это structured concurrency: «все или никто».

**Обед из трёх блюд.** Вы готовите суп, салат и гарнир. Если суп выкипел и его нельзя спасти — вы **не продолжаете** готовить салат и гарнир «в надежде, что обед получится». Вы говорите: «обед отменяется», выключаете плиту, идёте в кафе. Все три блюда — **одна задача** «приготовить обед». Если провалилась одна часть — провалилась вся задача.

**Экспедиция на вершину.** Группа из пяти альпинистов. Все идут вместе, страхуют друг друга. Если один сорвался в расщелину и его не вытащить — **вся группа** разворачивается. Никто не «продолжает восхождение без него». Экспедиция — это единое целое, а не пять независимых восхождений.

**Утренняя планёрка.** Все собираются к 9:00. Если один опоздал на 10 минут — планёрка начинается в 9:10, но **все ждут** его. Если один не придёт вообще — планёрка **отменяется**, потому что без него нет кворума. Это не «каждый делает свой доклад в удобное время», это **одно событие**.

**Общее во всех случаях** одно: есть **родительская задача**, которая порождает **несколько дочерних**, и все они образуют **единое целое**. Если родитель завершился — дети **не могут** продолжать жить. Если один ребёнок провалился — родитель **решает**, отменять ли остальных. Дети **не переживают** родителя, и родитель **не забывает** о детях. Это и есть structured concurrency — «структурированная многопоточность».

## Теория

### Проблема, которую решает structured concurrency

Вспомним, как мы работали до сих пор.

**`ExecutorService` + `Future`.** Запустили задачу через `submit` — получили `Future`. Задача живёт **сама по себе** в пуле. Если родительский метод завершился (или упал), дочерняя задача **продолжает работать**. Она «отвязана» от родителя. Это **утечка потоков** (thread leak): работа идёт, ресурсы заняты, результат никому не нужен, но задача не остановлена.

**`CompletableFuture`.** То же самое: `supplyAsync` запускает задачу в `commonPool` или в своём пуле. Родитель может «уйти», а `CompletableFuture` продолжит работать. Если родитель отменён — дети **не отменяются автоматически**.

**`parallelStream`.** Внутри использует `ForkJoinPool`, который **сам** управляет задачами. Но и здесь: если внешний код отменён — стрим не обязательно остановится.

Проблема в том, что **связь между задачей-родителем и задачами-детьми существует только в голове программиста**. Язык её не выражает. `Future` позволяет любому потоку «присоединиться» к любой задаче. Нет правила «дети умирают вместе с родителем». Нет правила «если один ребёнок упал — отменить остальных».

Именно эту связь делает **явной** structured concurrency.

### Что такое StructuredTaskScope

`StructuredTaskScope` — класс (точнее, в новых версиях — интерфейс) из `java.util.concurrent`. Он создаёт **область (scope)**, внутри которой запускаются дочерние задачи (`Subtask`). Правила простые.

**Правило 1: дети не переживают родителя.** Когда блок `try-with-resources` завершается (нормально, с исключением или по `return`), все дочерние задачи **гарантированно** завершаются (или отменяются). Не остаётся «висящих» потоков.

**Правило 2: родитель ждёт детей.** Метод `join()` (или `joinUntil`) **обязателен**. Без него scope не закроется, а `Subtask.get()` бросит исключение. Родитель не может «уйти», не дождавшись.

**Правило 3: политика завершения.** Родитель решает, что делать, если один ребёнок упал: отменить всех или продолжить. Это выражается через `Joiner` (в новых версиях) или подклассы `ShutdownOnFailure`/`ShutdownOnSuccess` (в старых preview).

**Правило 4: структура — это дерево.** Scope'ы и подзадачи образуют дерево. Попытка вызвать `fork()` из потока, который не является владельцем scope или его подзадачей, — ошибка (`WrongThreadException`). Это гарантирует, что структура не «размазывается» по программе.

<div style="background-color: #1E0F33; border-left: 4px solid #B388FF; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #B388FF;">Правило:</strong> structured concurrency — это не «ещё один способ запускать потоки». Это <em>дисциплина</em>: дочерние задачи не могут жить дольше родителя, и родитель обязан их дождаться. Это делает код предсказуемым и предотвращает утечки.
</div>

### Статус API: preview

Важно понимать: structured concurrency в Java **всё ещё preview**. API менялся несколько раз.

- **JDK 21** — первый preview (JEP 453). Класс `StructuredTaskScope`, подклассы `ShutdownOnFailure`/`ShutdownOnSuccess`, конструкторы.
- **JDK 22–24** — последующие preview, доработки.
- **JDK 25** — пятый preview (JEP 505). **Крупное изменение API**: вместо конструкторов — статические фабрики `StructuredTaskScope.open()`, вместо подклассов — интерфейс `Joiner`. `StructuredTaskScope` стал **sealed interface**.
- **JDK 26–27** — дальнейшие доработки (JEP 525, 533).

**Что это значит для вас.** Если вы на JDK 21–24 — используйте старый API (`new StructuredTaskScope.ShutdownOnFailure()`). Если на JDK 25+ — используйте новый (`StructuredTaskScope.open()`). **Не копируйте примеры из интернета, не проверив, под какую версию они написаны.** Старый и новый API **несовместимы**.

В этом уроке мы будем показывать **новый API (JDK 25+)**, потому что он — направление развития. В конце главы будет краткая справка по старому API для тех, кто на JDK 21–24.

**Требуется флаг `--enable-preview`** при компиляции и запуске. Без него код с `StructuredTaskScope` не скомпилируется.

### Базовый паттерн: open, fork, join

Вот как выглядит structured concurrency в JDK 25+.

```java
import java.util.concurrent.StructuredTaskScope;
import java.util.concurrent.StructuredTaskScope.Subtask;

public class Main {
    public static void main(String[] args) throws Exception {
        try (var scope = StructuredTaskScope.open()) {
            Subtask<String> user = scope.fork(() -> fetchUser("42"));
            Subtask<String> orders = scope.fork(() -> fetchOrders("42"));

            scope.join(); // обязательно: ждём всех

            String userResult = user.get();     // не блокируется, результат уже готов
            String ordersResult = orders.get();
            System.out.println(userResult + " / " + ordersResult);
        } // здесь scope закрывается, все задачи гарантированно завершены
    }

    static String fetchUser(String id) throws InterruptedException {
        Thread.sleep(200);
        return "User-" + id;
    }

    static String fetchOrders(String id) throws InterruptedException {
        Thread.sleep(300);
        return "Orders-" + id;
    }
}
```

**Что здесь важно.**

**`try-with-resources`.** Scope **обязан** быть закрыт. Если забыть — `StructureViolationException` (структура нарушена). `try-with-resources` гарантирует закрытие даже при исключении.

**`scope.fork(...)`** — запускает дочернюю задачу. Возвращает `Subtask<T>` — не `Future`, а именно `Subtask`. Это **другая** абстракция: `Subtask` привязан к scope и не может «убежать».

**`scope.join()`** — **обязательный** вызов. Без него scope не «соберёт» результаты. Если забыть `join()` — scope при закрытии **сам** вызовет `join()` и бросит исключение, потому что «структура нарушена».

**`user.get()`** — **не блокируется**. После `join()` результат уже готов. Если вызвать `get()` **до** `join()` — `IllegalStateException`. Если задача упала — `get()` бросит `ExecutionException` с причиной.

**`try-with-resources` закрывает scope.** При закрытии scope **гарантирует**, что все дочерние задачи завершены (или отменены). Никаких «висящих» потоков.

### Политики завершения: Joiner

Голый `StructuredTaskScope.open()` — это «дождаться всех». Но что если один ребёнок упал? Что если нужен «первый успешный»? Для этого есть **`Joiner`** — политика завершения.

**`Joiner.awaitAll()`** (по умолчанию) — «дождаться всех». Если один упал — остальные **продолжают** работать. Родитель сам решает, что делать с результатами.

**`Joiner.awaitAllSuccessfulOrThrow()`** — «дождаться всех успешных». Если один упал — scope **отменяет** остальных и бросает исключение. Это **«всё или ничего»**.

**`Joiner.awaitAnySuccessful()`** — «дождаться первого успешного». Как только один ребёнок завершился успешно — scope **отменяет** остальных и возвращает результат. Это **hedged request**.

**`Joiner.awaitAny()`** — «дождаться первого завершившегося» (успех или ошибка — неважно).

Пример с «всё или ничего»:

```java
try (var scope = StructuredTaskScope.open(
        StructuredTaskScope.Joiner.awaitAllSuccessfulOrThrow())) {
    Subtask<String> user = scope.fork(() -> fetchUser("42"));
    Subtask<String> orders = scope.fork(() -> fetchOrders("42"));
    scope.join(); // если хоть один упал — бросит исключение, остальные отменены
    // ...
}
```

Пример с «первый успешный»:

```java
try (var scope = StructuredTaskScope.open(
        StructuredTaskScope.Joiner.<String>awaitAnySuccessful())) {
    scope.fork(() -> querySource("fast"));
    scope.fork(() -> querySource("medium"));
    scope.fork(() -> querySource("slow"));
    scope.join(); // как только один ответил — остальные отменены
    String result = scope.result(); // результат победителя
}
```

<div style="background-color: #251445; border-left: 4px solid #00E5D1; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #00E5D1;">Важно:</strong> <code>Joiner</code> — это <em>политика</em>. Она определяет, <strong>когда</strong> scope завершается и <strong>что</strong> делает с остальными задачами. Без явного <code>Joiner</code> используется <code>awaitAll</code> — «дождаться всех, не отменять».
</div>

### Обработка ошибок и таймауты

**Ошибки.** Если задача упала — `Subtask.get()` бросает `ExecutionException`. Если используется `awaitAllSuccessfulOrThrow` — `scope.join()` сам бросает исключение.

```java
try (var scope = StructuredTaskScope.open(
        StructuredTaskScope.Joiner.awaitAllSuccessfulOrThrow())) {
    Subtask<String> user = scope.fork(() -> fetchUser("42"));
    Subtask<String> orders = scope.fork(() -> fetchOrders("42"));
    try {
        scope.join();
    } catch (ExecutionException e) {
        System.out.println("Одна из задач упала: " + e.getCause().getMessage());
        // scope уже отменил остальные
    }
}
```

**Таймауты.** У scope можно задать **дедлайн** через конфигурацию:

```java
try (var scope = StructuredTaskScope.open(
        StructuredTaskScope.Joiner.awaitAll(),
        cfg -> cfg.withTimeout(Duration.ofSeconds(1)))) {
    Subtask<String> user = scope.fork(() -> fetchUser("42"));
    Subtask<String> orders = scope.fork(() -> fetchOrders("42"));
    scope.join(); // если не успели за 1 секунду — TimeoutException
}
```

`withTimeout` задаёт **общий** таймаут на весь scope. Если время вышло — scope отменяет все задачи и `join()` бросает `StructuredTaskScope.TimeoutException`.

**`joinUntil(Instant)`** — альтернатива: «ждать до указанного момента».

```java
Instant deadline = Instant.now().plusSeconds(1);
try (var scope = StructuredTaskScope.open()) {
    scope.fork(() -> fetchUser("42"));
    scope.fork(() -> fetchOrders("42"));
    scope.joinUntil(deadline); // если дедлайн прошёл — TimeoutException
}
```

### Subtask: не Future

`Subtask<T>` — это **не** `Future<T>`. Отличия важны.

| | `Future` | `Subtask` |
|---|---|---|
| Может «убежать» из scope | Да | **Нет** |
| `get()` блокируется | Да | **Нет** (после `join`) |
| `get()` до завершения | Блокируется | `IllegalStateException` |
| Привязан к родителю | Нет | **Да** |
| Отмена | Вручную | Автоматически при закрытии scope |

`Subtask.get()` **никогда не блокируется**. Он либо возвращает результат (если задача завершилась успешно), либо бросает исключение (если упала), либо `IllegalStateException` (если вызван до `join()` или задача не завершилась успешно). Это заставляет **сначала** `join()`, **потом** `get()` — правильный порядок.

### Сравнение с ExecutorService и CompletableFuture

| | `ExecutorService` + `Future` | `CompletableFuture` | `StructuredTaskScope` |
|---|---|---|---|
| Дети переживают родителя | **Да** (утечка) | **Да** (утечка) | **Нет** |
| Автоматическая отмена | Вручную | Вручную | **Да** (по политике) |
| Родитель обязан ждать | Нет | Нет | **Да** (`join`) |
| Обработка ошибок | Вручную | `exceptionally`/`handle` | Централизованно (`Joiner`) |
| Структура (дерево) | Нет | Нет | **Да** |
| Статус | Stable | Stable | **Preview** |

**Ключевое:** structured concurrency **не заменяет** `ExecutorService` или `CompletableFuture`. Это **дополнение** для случаев, когда важна **структура**: «все дети должны завершиться вместе с родителем», «если один упал — отменить всех». Для «запустил и забыл» — `ExecutorService`. Для «построй цепочку» — `CompletableFuture`. Для «запусти группу как единое целое» — `StructuredTaskScope`.

### Частые ошибки

**Ошибка 1: забыть `join()`.** Scope закроется, но при закрытии **сам** вызовет `join()` и бросит исключение, потому что структура нарушена. **Всегда** `join()` (или `joinUntil`) перед выходом из `try`.

**Ошибка 2: `get()` до `join()`.** `IllegalStateException`. Сначала `join()`, потом `get()`.

**Ошибка 3: `fork()` из чужого потока.** `WrongThreadException`. `fork()` можно вызывать только из потока-владельца scope или из его подзадач. Нельзя «передать scope» в другой поток и там форкать.

**Ошибка 4: `try` без `try-with-resources`.** Если не использовать `try-with-resources`, scope не закроется автоматически. Придётся вызывать `close()` вручную — и легко забыть. `try-with-resources` — обязателен.

**Ошибка 5: `Joiner` без параметра типа.** `Joiner.awaitAnySuccessful()` — generic. Если компилятор не может вывести тип — указывайте явно: `Joiner.<String>awaitAnySuccessful()`.

**Ошибка 6: `StructuredTaskScope` для CPU-bound задач.** Scope использует **виртуальные потоки** (глава 7.2) для подзадач. Для CPU-bound задач это не даёт выигрыша — только накладные расходы. Для CPU-bound — пул на число ядер (глава 4.2).

### Аналогия с поездкой и экспедицией

Вернёмся к началу. **`StructuredTaskScope`** — это **поездка с детьми**. Вы (родитель) выходите из дома, берёте детей (форкаете задачи). Идёте вместе. Если один упал — вы **останавливаетесь** и решаете: вернуться всем или продолжить (это `Joiner`). Вы **не можете** «уйти вперёд», оставив детей (нельзя выйти из `try` без `join`). Когда возвращаетесь — все дети **дома** (scope закрыт, все задачи завершены).

**`ExecutorService`** — это **такси для каждого ребёнка**. Посадил в машину — и он уехал. Куда, когда вернётся — вы не контролируете. Может, он всё ещё катается, а вы уже дома. Это утечка.

**`CompletableFuture`** — это **цепочка поручений**. «Сходи в магазин, потом на почту, потом домой». Цепочка выполняется сама, но если вы «уехали из города» — цепочка **продолжается** без вас. Никто не гарантирует, что она остановится.

**`Joiner`** — это **правило поведения группы**. «Все или никто» (`awaitAllSuccessfulOrThrow`), «первый дошедший» (`awaitAnySuccessful`), «просто все вместе» (`awaitAll`).

**`Subtask`** — это **ребёнок в поездке**. Он **не может** уехать отдельно. Он всегда с группой. Его результат можно получить **только после** того, как группа вернулась (`join`). До этого — нельзя (`IllegalStateException`).

## Микрозадача 1: базовый scope

**Задача:** Создайте `StructuredTaskScope.open()`, форкните две задачи: одна спит 200 мс и возвращает `"user"`, другая спит 300 мс и возвращает `"orders"`. Вызовите `join()`, потом `get()` на обеих. Замерьте общее время. Убедитесь, что оно ≈ 300 мс (параллельно).

**Решение:**

```java
import java.util.concurrent.StructuredTaskScope;

public class Main {
    public static void main(String[] args) throws Exception {
        long start = System.currentTimeMillis();

        try (var scope = StructuredTaskScope.open()) {
            var user = scope.fork(() -> {
                Thread.sleep(200);
                return "user";
            });
            var orders = scope.fork(() -> {
                Thread.sleep(300);
                return "orders";
            });

            scope.join();

            System.out.println("User: " + user.get());
            System.out.println("Orders: " + orders.get());
        }

        long elapsed = System.currentTimeMillis() - start;
        System.out.println("Общее время: " + elapsed + " мс");
    }
}
```

**Возможный вывод:**

```text
User: user
Orders: orders
Общее время: 305 мс
```

**Разбор:** две задачи выполняются **параллельно**. Общее время — max(200, 300) = 300 мс, а не сумма 500. `join()` дождался обеих. `get()` вернул результаты мгновенно (задачи уже завершены). Scope закрылся, гарантировав, что обе задачи завершены.

## Микрозадача 2: «всё или ничего»

**Задача:** Используйте `StructuredTaskScope.open(Joiner.awaitAllSuccessfulOrThrow())`. Форкните две задачи: одна **успешна**, другая **падает** с `RuntimeException`. Убедитесь, что `join()` бросает `ExecutionException`, а вторая задача **отменена**.

**Решение:**

```java
import java.util.concurrent.StructuredTaskScope;

public class Main {
    public static void main(String[] args) throws Exception {
        try (var scope = StructuredTaskScope.open(
                StructuredTaskScope.Joiner.awaitAllSuccessfulOrThrow())) {

            var success = scope.fork(() -> {
                Thread.sleep(100);
                return "success";
            });
            var failure = scope.fork(() -> {
                Thread.sleep(200);
                throw new RuntimeException("boom");
            });

            try {
                scope.join();
            } catch (Exception e) {
                System.out.println("join упал: " + e.getClass().getSimpleName()
                        + " / " + e.getCause().getMessage());
                System.out.println("success isDone: " + success.state());
                System.out.println("failure isDone: " + failure.state());
            }
        }
    }
}
```

**Возможный вывод:**

```text
join упал: ExecutionException / boom
success isDone: SUCCESS
failure isDone: FAILED
```

**Разбор:** `awaitAllSuccessfulOrThrow` — политика «всё или ничего». Как только одна задача упала — scope **отменяет** остальные. `success` успела завершиться до отмены (она спала 100 мс, а `failure` упала через 200 мс). `failure` — упала. `join()` бросил `ExecutionException` с причиной `"boom"`. Обе задачи завершены (одна успешно, другая с ошибкой), scope закрылся без утечек.

## 🎯 Самостоятельная задача

Реализуйте **сервис загрузки профиля** с structured concurrency.

**Постановка:**

1. `loadUser(id)` — спит 200 мс, возвращает `User`.
2. `loadOrders(id)` — спит 300 мс, возвращает `List<Order>`.
3. `loadRecommendations(id)` — спит 400 мс, возвращает `List<Item>`.
4. `combine(User, List<Order>, List<Item>)` — собирает `Profile`.

**Требования:**

1. Используйте `StructuredTaskScope` для параллельной загрузки трёх источников.
2. Используйте `Joiner.awaitAllSuccessfulOrThrow()` — если **любой** источник упал, весь профиль не загружается.
3. Обработайте `ExecutionException` от `join()` — верните `null` (профиль не загружен).
4. Замерьте общее время. Должно быть ≈ 400 мс (параллельно), а не 900 мс (последовательно).
5. Добавьте `withTimeout(Duration.ofMillis(500))` — если не успели за 500 мс, `TimeoutException`, вернуть `null`.

**Дополнительно:**

- Замените `awaitAllSuccessfulOrThrow` на `awaitAnySuccessful`. Что изменится? Какой результат вернётся?
- Добавьте «искусственное» падение `loadOrders` с вероятностью 50%. Запустите 10 раз. Сколько раз профиль загрузился?
- Проверьте: после `join()` (успешного или с ошибкой) **все** задачи завершены. Не осталось «висящих» потоков.

**Вопросы в комментарии:**

1. Почему `StructuredTaskScope` гарантирует, что дети не переживут родителя? Как это достигается?
2. Почему `get()` **не блокируется** после `join()`?
3. В чём разница между `awaitAll()` и `awaitAllSuccessfulOrThrow()`?
4. Почему `StructuredTaskScope` не подходит для CPU-bound задач?

## 📌 Что дальше

В следующей главе — **«Неизменяемость как стратегия»**. Разберём, как отказ от изменения данных **устраняет** гонки целиком, а не «защищает» от них. Узнаем, почему `final`-поля, `record` и неизменяемые коллекции — это не «стиль», а **архитектурное решение**, которое делает многопоточный код проще. А то ведь до сих пор мы всё время **защищали** изменяемые данные. Пора посмотреть, что будет, если их **не менять**.