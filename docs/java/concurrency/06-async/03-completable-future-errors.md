# 6.3. CompletableFuture: ошибки и таймауты

## Где вы это уже видели

**Доставка посылки.** Вы заказали книгу. Курьер должен привезти её завтра. Что может пойти не так? Курьер заболел, адрес перепутан, книга закончилась на складе. Хорошая служба доставки **не бросает заказ** — она звонит, извиняется, предлагает альтернативу: «привезём послезавтра», «есть другое издание», «вернём деньги». Это `exceptionally`.

**Тайм-аут в кафе.** Вы заказали кофе. Прошло пять минут — кофе нет. Прошло десять — нет. Вы **не сидите вечно**. Вы подходите к стойке, спрашиваете. Или уходите. Или заказываете что-то другое. У вас есть **тайм-аут** — «жду разумное время, потом действую». Это `orTimeout` и `completeOnTimeout`.

**Запасной аэропорт.** Самолёт не может сесть в пункте назначения — туман. Диспетчер не «ждёт, пока туман рассеется». Он **перенаправляет** самолёт в запасной аэропорт. Пассажиры доедут на автобусе. Это `exceptionally` с fallback.

**Страховка.** Вы застраховали дом. Если случится пожар — страховая **покроет убытки**. Не «вернёт всё как было», но «компенсирует». А если ничего не случилось — страховка просто «наблюдает». Это `whenComplete` — «сделай что-то в конце, независимо от исхода».

**Два курьера на один заказ.** Вы заказали доставку. Служба отправила **двух** курьеров — кто первый приедет, тот и доставит. Второй развернётся. Это `applyToEither` и `anyOf` — «первый готовый побеждает».

**Общее во всех случаях** одно: **что-то может пойти не так**, и с этим нужно **что-то делать**. Не «пусть упадёт», а «обработай ошибку», «подстрахуйся», «не жди вечно», «используй запасной вариант». `CompletableFuture` даёт для этого инструменты.

## Теория

### Что происходит с исключением в цепочке

В главе 6.2 мы сказали: исключение в любом шаге «убивает» всю цепочку. Последующие шаги не выполняются. `get()` бросает `ExecutionException` с причиной.

Это **правильное** поведение по умолчанию: «сделай A, потом B, потом C». Если B упал — C делать бессмысленно.

Но в реальных приложениях «упасть и всё» — не вариант. Нужно **обработать** ошибку: вернуть значение по умолчанию, залогировать, попробовать альтернативу, отправить метрику. `CompletableFuture` даёт три основных способа для этого.

### exceptionally: восстановление после ошибки

`exceptionally(Function<Throwable, T>)` — «если цепочка упала, примени эту функцию к исключению и верни результат типа T».

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() < 0.5) throw new RuntimeException("сбой");
        return "успех";
    })
    .exceptionally(ex -> {
        System.out.println("Поймали: " + ex.getMessage());
        return "значение по умолчанию";
    });
```

**Что происходит:** если `supplyAsync` завершился успешно — `exceptionally` **не вызывается**, результат проходит дальше. Если упал — `exceptionally` вызывается с исключением, и его результат становится результатом всей цепочки.

**Ключевое:** `exceptionally` **восстанавливает** цепочку. После него — цепочка «жива», можно продолжать `thenApply`, `thenCompose` и т.д.

```java
CompletableFuture
    .supplyAsync(() -> "hello")
    .thenApply(s -> { throw new RuntimeException("упс"); })
    .exceptionally(ex -> "восстановлено")         // ← восстановление
    .thenApply(s -> s + "!")                      // ← продолжение
    .thenAccept(System.out::println);             // "восстановлено!"
```

**Ограничение:** `exceptionally` получает **только** `Throwable`, но не «частичный результат». Если предыдущий шаг упал, у нас нет его «недоделанного» значения. Мы можем только вернуть что-то своё.

**Тип возврата:** `exceptionally` должен вернуть **тот же тип**, что и цепочка до него. Если цепочка была `CompletableFuture<String>`, `exceptionally` возвращает `String`. Если хотите вернуть `null` — можно, но `get()` вернёт `null`.

### handle: обработка и успеха, и ошибки

`handle(BiFunction<T, Throwable, U>)` — «вызывается **всегда**: и при успехе, и при ошибке. Получает либо результат, либо исключение (одно из двух — всегда `null`)».

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> {
        if (Math.random() < 0.5) throw new RuntimeException("сбой");
        return "успех";
    })
    .handle((result, ex) -> {
        if (ex != null) {
            System.out.println("Ошибка: " + ex.getMessage());
            return "значение по умолчанию";
        }
        return "результат: " + result;
    });
```

**Что происходит:** `handle` вызывается **всегда**. Если цепочка успешна — `result` содержит значение, `ex = null`. Если упала — `result = null`, `ex` содержит исключение.

**Ключевое отличие от `exceptionally`:** `handle` работает и с успехом, и с ошибкой. `exceptionally` — только с ошибкой. Если нужно **единое** место для «что делать с результатом», — `handle`.

**Тип возврата:** `handle` может вернуть **другой тип**, чем цепочка до него. `exceptionally` — только тот же.

```java
CompletableFuture<Integer> length = CompletableFuture
    .supplyAsync(() -> "hello")
    .handle((s, ex) -> ex != null ? -1 : s.length()); // String → Integer
```

### whenComplete: наблюдение, без изменения

`whenComplete(BiConsumer<T, Throwable>)` — «вызывается **всегда**, но **не меняет** результат». Получает результат или исключение, **ничего не возвращает**.

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> "hello")
    .whenComplete((result, ex) -> {
        if (ex != null) {
            System.err.println("Ошибка: " + ex.getMessage());
        } else {
            System.out.println("Успех: " + result);
        }
    });
// future — CompletableFuture<String> с тем же результатом, что и до whenComplete
```

**Что происходит:** `whenComplete` вызывается всегда. **Не меняет** результат цепочки. Если цепочка была успешной — после `whenComplete` она всё ещё успешна с тем же значением. Если упала — после `whenComplete` она всё ещё упала.

**Применение:** логирование, метрики, освобождение ресурсов — «побочные эффекты», которые не должны влиять на результат.

**Осторожно:** если `whenComplete` **сам** бросит исключение — оно «заменит» исходное. Если цепочка была успешной, а `whenComplete` упал — цепочка станет неуспешной. Если упала, а `whenComplete` упал с другим — новое исключение заменит старое. Будьте аккуратны.

### Сравнение exceptionally, handle, whenComplete

| | `exceptionally` | `handle` | `whenComplete` |
|---|---|---|---|
| Когда вызывается | Только при ошибке | Всегда | Всегда |
| Может изменить результат | Да (восстанавливает) | Да | **Нет** |
| Может изменить тип | Нет | Да | Нет |
| Получает исключение | Да | Да | Да |
| Получает результат | Нет | Да | Да |
| Применение | Fallback | Универсальная обработка | Логирование, метрики |

**Правило выбора:**

- Нужно **восстановить** после ошибки → `exceptionally`.
- Нужно **унифицировать** обработку успеха и ошибки → `handle`.
- Нужно **залогировать** или **отправить метрику**, не меняя результат → `whenComplete`.

### Обработка ошибок в середине цепочки

`exceptionally`, `handle`, `whenComplete` можно ставить **в любом месте** цепочки. Это позволяет строить «зонтики» — блоки, которые обрабатывают ошибки для группы шагов.

```java
CompletableFuture
    .supplyAsync(() -> loadUser(id))
    .thenCompose(user -> loadOrders(user))
    .exceptionally(ex -> {
        // обработать ошибку загрузки user или orders
        return Collections.emptyList();
    })
    .thenApply(orders -> sum(orders))
    .thenAccept(System.out::println);
```

Здесь `exceptionally` «накрывает» два шага: `supplyAsync` и `thenCompose`. Если любой из них упадёт — вернём пустой список. Дальше цепочка продолжит с пустым списком.

**Важно:** `exceptionally` «съедает» ошибку. После него — цепочка «здорова». Если хотите, чтобы ошибка **пробросилась дальше**, — не используйте `exceptionally` или перебросьте исключение вручную:

```java
.exceptionally(ex -> {
    log.error("Ошибка", ex);
    throw new CompletionException(ex); // пробрасываем дальше
})
```

`CompletionException` — обёртка, которую `CompletableFuture` использует для исключений в `join()` и некоторых методах. В `get()` вы получите `ExecutionException` с этой обёрткой в качестве причины.

### orTimeout: таймаут на всю цепочку

`orTimeout(long timeout, TimeUnit unit)` — «если цепочка не завершится за указанное время — завершить её с `TimeoutException`».

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> slowOperation())
    .orTimeout(5, TimeUnit.SECONDS);

try {
    String result = future.get();
} catch (ExecutionException e) {
    if (e.getCause() instanceof TimeoutException) {
        System.out.println("Не успели за 5 секунд");
    }
}
```

**Что происходит:** через 5 секунд, если цепочка ещё не завершилась, `CompletableFuture` **принудительно** завершается с `TimeoutException`. Все последующие шаги получат `TimeoutException` и завершатся.

**Важно:** `orTimeout` **не отменяет** задачу, которая уже выполняется. Он только «отвязывает» `CompletableFuture` от её результата. Задача продолжит работать в фоне (как с `Future.get(timeout)` из главы 6.1). Если задача «висит» на сетевом запросе — она будет «висеть» до своего таймаута.

### completeOnTimeout: таймаут со значением по умолчанию

`completeOnTimeout(T value, long timeout, TimeUnit unit)` — «если цепочка не завершится за указанное время — завершить её с указанным значением».

```java
CompletableFuture<String> future = CompletableFuture
    .supplyAsync(() -> slowOperation())
    .completeOnTimeout("значение по умолчанию", 5, TimeUnit.SECONDS);

String result = future.get(); // либо результат, либо "значение по умолчанию"
```

**Отличие от `orTimeout`:** `orTimeout` завершает с **исключением**, `completeOnTimeout` — с **нормальным значением**. Если «значение по умолчанию» приемлемо — `completeOnTimeout` удобнее (не нужно ловить `ExecutionException`).

**Применение:** «кеш с fallback», «ответ по умолчанию», «страховочное значение».

### allOf: дождаться всех

`CompletableFuture.allOf(CompletableFuture<?>...)` — «дождаться **всех** переданных `CompletableFuture`».

```java
CompletableFuture<String> a = CompletableFuture.supplyAsync(() -> loadA());
CompletableFuture<String> b = CompletableFuture.supplyAsync(() -> loadB());
CompletableFuture<String> c = CompletableFuture.supplyAsync(() -> loadC());

CompletableFuture<Void> all = CompletableFuture.allOf(a, b, c);
all.get(); // ждём все
// теперь можно забрать результаты
String aResult = a.get();
String bResult = b.get();
String cResult = c.get();
```

**Что важно:** `allOf` возвращает `CompletableFuture<Void>` — **не** `CompletableFuture<List<String>>`. Он не собирает результаты автоматически. Нужно **после** `get()` забрать результаты из каждого `CompletableFuture`.

**Обработка ошибок:** `allOf` завершается с ошибкой, если **любой** из переданных `CompletableFuture` упал. Причём **не факт, что все** уже завершились — `allOf` может «упасть» раньше, чем остальные закончатся. Если нужно дождаться **всех** даже при ошибках — оборачивайте каждый `CompletableFuture` в `handle`:

```java
CompletableFuture<List<String>> safe = CompletableFuture.allOf(
    a.handle((r, ex) -> ex != null ? "error-a" : r),
    b.handle((r, ex) -> ex != null ? "error-b" : r),
    c.handle((r, ex) -> ex != null ? "error-c" : r)
).thenApply(v -> List.of(a.join(), b.join(), c.join()));
```

Это классический паттерн: «все должны завершиться, независимо от ошибок». `join()` здесь не блокируется — все `CompletableFuture` уже завершены.

### anyOf: дождаться первого

`CompletableFuture.anyOf(CompletableFuture<?>...)` — «дождаться **первого** завершившегося».

```java
CompletableFuture<String> a = CompletableFuture.supplyAsync(() -> slowLoadA());
CompletableFuture<String> b = CompletableFuture.supplyAsync(() -> slowLoadB());

CompletableFuture<Object> first = CompletableFuture.anyOf(a, b);
Object result = first.get(); // результат того, кто завершился первым
```

**Что важно:** `anyOf` возвращает `CompletableFuture<Object>`, потому что типы могут быть разными. Если типы одинаковые — можно привести:

```java
CompletableFuture<String> first = CompletableFuture.anyOf(a, b)
    .thenApply(o -> (String) o);
```

**Применение:**

- **Hedged requests:** отправить два одинаковых запроса, взять первый ответ.
- **Fallback:** основной + запасной, что первое — то и использовать.
- **Таймаут через `anyOf`:** `anyOf(real, CompletableFuture.delayedExecutor(...).supplyAsync(...))` — но проще `orTimeout`.

**Обработка ошибок:** `anyOf` завершается с ошибкой, если **первый завершившийся** упал. Даже если второй мог бы завершиться успешно. Оборачивайте каждый в `handle`:

```java
CompletableFuture<String> first = CompletableFuture.anyOf(
    a.handle((r, ex) -> ex != null ? "fallback-a" : r),
    b.handle((r, ex) -> ex != null ? "fallback-b" : r)
).thenApply(o -> (String) o);
```

### Таймауты на уровне шага

Иногда нужен таймаут **не на всю цепочку**, а на **конкретный шаг**.

```java
CompletableFuture
    .supplyAsync(() -> loadA())
    .thenCompose(a -> CompletableFuture
        .supplyAsync(() -> loadB(a))
        .orTimeout(3, TimeUnit.SECONDS)         // таймаут только на loadB
        .exceptionally(ex -> "B-default")
    )
    .thenApply(b -> process(b));
```

Здесь таймаут — только для `loadB`. Если `loadB` не успеет — вернёт `"B-default"`, и цепочка продолжит. `loadA` и `process` — без таймаута.

### Частые ошибки

**Ошибка 1: `exceptionally` в конце всей цепочки.** Если ошибка в середине — цепочка «умирает», и `exceptionally` в конце её «оживит». Но промежуточные шаги **не выполнятся**. Если ожидалось, что каждый шаг «подстрахован» — нужно ставить `exceptionally` на каждом шаге.

**Ошибка 2: `handle` вместо `whenComplete` для логирования.** `handle` **меняет** результат (возвращает новый). Если нужно только «посмотреть» — `whenComplete` не меняет. Если поставить `handle` и вернуть `null` — цепочка «потеряет» результат.

**Ошибка 3: `allOf` без `handle`.** Если один упал — `allOf` упадёт, и остальные результаты будут недоступны. Оборачивайте каждый `CompletableFuture` в `handle`, если хотите «все результаты, независимо от ошибок».

**Ошибка 4: `orTimeout` без `cancel`.** `orTimeout` «отвязывает» `CompletableFuture`, но задача продолжает работать. Если задача «висит» на сетевом запросе — она будет «висеть» до своего таймаута. Для «реального» таймаута нужен `cancel(true)` вручную или `completeOnTimeout` + `interrupt` задачи.

**Ошибка 5: `whenComplete` с исключением внутри.** Если `whenComplete` бросит исключение — оно **заменит** исходный результат. Для «наблюдения» — оборачивайте в `try/catch` внутри `whenComplete`.

**Ошибка 6: `get()` без `try/catch`.** Как всегда — четыре исключения: `ExecutionException`, `InterruptedException`, `CancellationException`, `TimeoutException`. Каждое нужно обработать.

**Ошибка 7: `TimeoutException` не отменяет задачу.** Как с `Future.get(timeout)` — задача продолжает работать. Если результат больше не нужен — `cancel(true)` вручную.

### Аналогия с доставкой и страховкой

Вернёмся к началу. **`exceptionally`** — это **служба доставки, которая извиняется и предлагает альтернативу**. Заказ не «провалился», а «восстановился» другим способом.

**`handle`** — это **универсальный менеджер**, который смотрит на исход и решает, что делать: «доставлено — отлично, отмечаем», «не доставлено — звоним, решаем». Один менеджер на все случаи.

**`whenComplete`** — это **журнал доставки**. «Записали: доставлено» или «записали: не доставлено». Журнал **не меняет** исход, только фиксирует.

**`orTimeout`** — это **тайм-аут в кафе**. Через пять минут — «извините, ваш заказ отменяется». Это **ошибка**, вы уходите без кофе.

**`completeOnTimeout`** — это **тайм-аут с заменой**. Через пять минут — «извините, ваш кофе не готов, но вот чай, за счёт заведения». Вы **не уходите с пустыми руками**, получаете альтернативу.

**`allOf`** — это **сбор всей команды**. «Ждём всех, потом идём дальше». Если один не пришёл — команда «сорвана» (если не обработать `handle`).

**`anyOf`** — это **первый пришедший**. «Кто первый — тот и представляет команду». Остальные не важны.

## Микрозадача 1: exceptionally

**Задача:** Создайте `CompletableFuture`, который падает с `RuntimeException`. Добавьте `exceptionally`, который возвращает `"значение по умолчанию"`. Убедитесь, что `get()` возвращает это значение, а не бросает исключение.

**Решение:**

```java
import java.util.concurrent.CompletableFuture;

public class Main {
    public static void main(String[] args) throws Exception {
        CompletableFuture<String> future = CompletableFuture
            .supplyAsync(() -> {
                throw new RuntimeException("симуляция сбоя");
            })
            .exceptionally(ex -> {
                System.out.println("Поймали: " + ex.getCause().getMessage());
                return "значение по умолчанию";
            });

        String result = future.get();
        System.out.println("Результат: " + result);
    }
}
```

**Возможный вывод:**

```text
Поймали: симуляция сбоя
Результат: значение по умолчанию
```

**Разбор:** `supplyAsync` упал с `RuntimeException`. `exceptionally` поймал его — но обратите внимание: `ex` — это `CompletionException`, обёртка. Причина внутри — `ex.getCause()`. `exceptionally` вернул `"значение по умолчанию"` — и это стало результатом цепочки. `get()` вернул его без исключения.

**Важно:** `exceptionally` **восстанавливает** цепочку. Если после него добавить `.thenApply(s -> s + "!")`, оно выполнится с `"значение по умолчанию!"`.

## Микрозадача 2: orTimeout vs completeOnTimeout

**Задача:** Создайте два `CompletableFuture`, каждый спит 5 секунд. Один с `orTimeout(1, TimeUnit.SECONDS)`, другой — с `completeOnTimeout("fallback", 1, TimeUnit.SECONDS)`. Сравните поведение `get()`.

**Решение:**

```java
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

public class Main {
    public static void main(String[] args) {
        // orTimeout — завершает с исключением
        CompletableFuture<String> withOrTimeout = CompletableFuture
            .supplyAsync(() -> {
                try { Thread.sleep(5000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return "оригинальный результат";
            })
            .orTimeout(1, TimeUnit.SECONDS);

        try {
            String result = withOrTimeout.get();
            System.out.println("orTimeout: " + result);
        } catch (ExecutionException e) {
            System.out.println("orTimeout поймал: " + e.getCause().getClass().getSimpleName());
        } catch (Exception e) {
            System.out.println("orTimeout поймал: " + e.getClass().getSimpleName());
        }

        // completeOnTimeout — завершает со значением
        CompletableFuture<String> withCompleteOnTimeout = CompletableFuture
            .supplyAsync(() -> {
                try { Thread.sleep(5000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
                return "оригинальный результат";
            })
            .completeOnTimeout("fallback", 1, TimeUnit.SECONDS);

        try {
            String result = withCompleteOnTimeout.get();
            System.out.println("completeOnTimeout: " + result);
        } catch (Exception e) {
            System.out.println("completeOnTimeout поймал: " + e.getClass().getSimpleName());
        }
    }
}
```

**Возможный вывод:**

```text
orTimeout поймал: TimeoutException
completeOnTimeout: fallback
```

**Разбор:** `orTimeout` через секунду завершил `CompletableFuture` с `TimeoutException` — `get()` бросил `ExecutionException` с `TimeoutException` внутри. `completeOnTimeout` через секунду завершил `CompletableFuture` со значением `"fallback"` — `get()` вернул его без исключения.

Обратите внимание: **задачи продолжают работать** в обоих случаях. Через 5 секунд они завершатся, но их результат уже никому не нужен — `CompletableFuture` уже «закрыт» таймаутом.

**Важно:** `orTimeout` и `completeOnTimeout` — это **не** отмена задачи. Это «отвязка» `CompletableFuture` от результата. Если задача «висит» на сетевом запросе — она будет «висеть» до своего таймаута. Для «реальной» отмены нужен `cancel(true)` на самом `CompletableFuture` (если он связан с задачей в пуле).

## 🎯 Самостоятельная задача

Реализуйте **отказоустойчивый сервис загрузки данных** с несколькими источниками.

**Постановка:**

1. `loadFromPrimary()` — `CompletableFuture<String>`. Спит 300 мс, с вероятностью 30% падает с `RuntimeException`.
2. `loadFromSecondary()` — `CompletableFuture<String>`. Спит 500 мс, с вероятностью 10% падает.
3. `loadFromCache()` — `CompletableFuture<String>`. Мгновенно возвращает `"cached-value"` (всегда успешно).

**Требования:**

1. **Основная логика:** попробовать `primary`. Если упал — `secondary`. Если и он упал — `cache`. Использовать `exceptionally` + `thenCompose`.
2. **Таймаут:** на каждый источник — `orTimeout(1, TimeUnit.SECONDS)`. Если не успел — считать «упал», переходить к следующему.
3. **Логирование:** через `whenComplete` на каждом шаге логировать: «primary: успех/ошибка», «secondary: успех/ошибка», «cache: успех». Не менять результат.
4. **Замер:** общее время загрузки. Должно быть ≈ 300 мс (если primary успешен) или ≈ 800 мс (если primary упал, secondary успешен) или ≈ 800 мс + мгновенно (если оба упали).
5. **`get()` с таймаутом:** `get(3, TimeUnit.SECONDS)`. Если не успели — вернуть `"timeout-fallback"`.

**Дополнительно:**

- Запустите 100 раз. Посчитайте, сколько раз использовался `primary`, `secondary`, `cache`.
- Замените `exceptionally` на `handle`. Сравните: стало ли удобнее?
- Добавьте `allOf` для параллельной загрузки: `primary` и `secondary` параллельно, потом `thenCombine` — выбрать «лучший». Сравните с последовательной версией.

**Вопросы в комментарии:**

1. Почему `exceptionally` в этой задаче — правильный выбор, а `handle` — избыточен?
2. Что произойдёт, если `primary` упадёт с `TimeoutException`, а `exceptionally` его «проглотит» — перейдёт ли цепочка к `secondary`?
3. Почему `whenComplete` не должен бросать исключений в этой задаче?
4. В чём разница между «источник упал» и «источник не успел за таймаут» с точки зрения цепочки?

## 📌 Что дальше

В следующей главе — **«Параллельные стримы»**. Разберём `parallelStream()` — самый простой способ распараллелить обработку коллекции, и почему он **не всегда** даёт ускорение. Узнаем, как `parallelStream` использует `ForkJoinPool.commonPool` (глава 4.6), почему на маленьких коллекциях он **медленнее** обычного стрима, и когда им **не стоит** пользоваться. А то ведь до сих пор мы строили асинхронность вручную, а тут — «одна строчка, и всё параллельно». Слишком хорошо, чтобы быть правдой? Не совсем — но и не так просто, как кажется.