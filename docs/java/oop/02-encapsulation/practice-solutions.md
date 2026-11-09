---
title: Разбор практикума — Инкапсуляция
description: Решения семи задач второго модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Инкапсуляция

## Как читать этот разбор

Решения ниже — не единственно правильные. В инкапсуляции редко бывает один правильный ответ, особенно в проектном задании. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и понятно — оно тоже правильное.

Обращайте внимание не столько на код, сколько на комментарии и на «почему». Синтаксис вы и так выучите, а вот привычка задавать вопрос «какой инвариант я хочу гарантировать» — это то, что отличает класс, которому можно доверять, от класса, который «вроде работает».

## Задача 1. Счёт с открытыми полями

```java
class Account {
    private String owner;
    private double balance;

    Account(String owner, double initialBalance) {
        if (owner == null || owner.isEmpty()) {
            throw new IllegalArgumentException("Владелец не может быть пустым");
        }
        if (initialBalance < 0) {
            throw new IllegalArgumentException("Начальный баланс не может быть отрицательным");
        }
        this.owner = owner;
        this.balance = initialBalance;
    }

    String getOwner() {
        return owner;
    }

    void setOwner(String owner) {
        if (owner == null || owner.isEmpty()) {
            throw new IllegalArgumentException("Владелец не может быть пустым");
        }
        this.owner = owner;
    }

    double getBalance() {
        return balance;
    }

    void deposit(double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма пополнения должна быть положительной");
        }
        balance += amount;
    }

    void withdraw(double amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма списания должна быть положительной");
        }
        if (amount > balance) {
            throw new IllegalStateException("Недостаточно средств");
        }
        balance -= amount;
    }
}
```

Проверка:

```java
Account account = new Account("Алиса", 1000);
account.deposit(500);                    // 1500
account.withdraw(200);                   // 1300
System.out.println(account.getBalance()); // 1300.0

try {
    account.withdraw(2000);
} catch (IllegalStateException e) {
    System.out.println(e.getMessage());   // Недостаточно средств
}
System.out.println(account.getBalance()); // 1300.0 — не изменилось
```

**На что обратить внимание.** Ключевое решение здесь — **не делать сеттер для `balance`**. Можно было бы написать `setBalance(double)`, но это разрешило бы устанавливать любое значение в обход проверок. Вместо этого — `deposit` и `withdraw`, которые выражают **намерение** («пополнить», «списать»), а не «установить значение». Это и есть разница между «голым» сеттером и настоящей инкапсуляцией, о которой мы говорили в уроке 3.

Вторая деталь: при ошибке в `withdraw` баланс **не меняется**. Мы проверяем условие **до** того, как изменить поле. Если бы проверка стояла после `balance -= amount`, пришлось бы «откатывать» изменение, что сложнее и легче забыть. Правило простое: **сначала проверь, потом меняй**.

Третья деталь: `double` для денег — плохо. Настоящий банковский счёт должен использовать `BigDecimal`. В задаче 7 мы это и сделаем. Здесь `double` оставлен для простоты, но в комментарии к коду стоит пометить, что это упрощение.

## Задача 2. Температура с инвариантом

```java
class Temperature {
    enum Unit { CELSIUS, FAHRENHEIT, KELVIN }

    private double value;
    private Unit unit;

    Temperature(double value, Unit unit) {
        if (unit == null) {
            throw new IllegalArgumentException("Единица измерения не может быть null");
        }
        if (value < absoluteZero(unit)) {
            throw new IllegalArgumentException(
                "Температура не может быть ниже абсолютного нуля: " + value);
        }
        this.value = value;
        this.unit = unit;
    }

    double getValue() { return value; }
    Unit getUnit() { return unit; }

    void setValue(double newValue) {
        if (newValue < absoluteZero(unit)) {
            throw new IllegalArgumentException(
                "Температура не может быть ниже абсолютного нуля: " + newValue);
        }
        this.value = newValue;
    }

    void setUnit(Unit newUnit) {
        if (newUnit == null) {
            throw new IllegalArgumentException("Единица измерения не может быть null");
        }
        if (newUnit == this.unit) {
            return;
        }
        double celsius = toCelsius(this.value, this.unit);
        double newValue = fromCelsius(celsius, newUnit);
        this.value = newValue;
        this.unit = newUnit;
    }

    @Override
    public String toString() {
        return value + " " + symbol(unit);
    }

    private static double absoluteZero(Unit unit) {
        switch (unit) {
            case CELSIUS:    return -273.15;
            case FAHRENHEIT: return -459.67;
            case KELVIN:     return 0.0;
            default:         throw new IllegalArgumentException("Неизвестная единица: " + unit);
        }
    }

    private static double toCelsius(double value, Unit unit) {
        switch (unit) {
            case CELSIUS:    return value;
            case FAHRENHEIT: return (value - 32) * 5 / 9;
            case KELVIN:     return value - 273.15;
            default:         throw new IllegalArgumentException("Неизвестная единица: " + unit);
        }
    }

    private static double fromCelsius(double celsius, Unit unit) {
        switch (unit) {
            case CELSIUS:    return celsius;
            case FAHRENHEIT: return celsius * 9 / 5 + 32;
            case KELVIN:     return celsius + 273.15;
            default:         throw new IllegalArgumentException("Неизвестная единица: " + unit);
        }
    }

    private static String symbol(Unit unit) {
        switch (unit) {
            case CELSIUS:    return "°C";
            case FAHRENHEIT: return "°F";
            case KELVIN:     return "K";
            default:         return "?";
        }
    }
}
```

Проверка:

```java
Temperature t = new Temperature(25, Temperature.Unit.CELSIUS);
System.out.println(t);              // 25.0 °C

t.setUnit(Temperature.Unit.FAHRENHEIT);
System.out.println(t);              // 77.0 °F

t.setValue(100);
System.out.println(t);              // 100.0 °F

try {
    t.setValue(-500);
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage()); // ниже абсолютного нуля
}
System.out.println(t);              // 100.0 °F — не изменилось
```

**На что обратить внимание.** Здесь два тонких момента.

**Первый — инвариант «не ниже абсолютного нуля» зависит от единицы.** Проверка в `setValue` использует **текущую** единицу. Если бы мы всегда проверяли `value >= 0`, это работало бы только для кельвинов, а для цельсия и фаренгейта — нет. Поэтому `absoluteZero(unit)` — отдельный метод, который знает порог для каждой единицы.

**Второй — при смене единицы значение пересчитывается.** Мы не проверяем инвариант после пересчёта, потому что он сохраняется автоматически: если температура была выше абсолютного нуля в старой единице, то после корректного пересчёта она будет выше абсолютного нуля и в новой. Это важное свойство: **если инвариант сохраняется при преобразовании, его не надо проверять заново**. Если бы мы не были уверены в формуле — проверяли бы.

**Третий — округление.** При пересчёте `25 °C → 77 °F` всё хорошо, но при некоторых значениях может появиться погрешность `double`. В реальном коде для температур (как и для денег) лучше использовать `BigDecimal` или хранить значение в одной «канонической» единице (например, кельвинах) и пересчитывать только при выводе. Это, кстати, хорошее упражнение: перепишите класс так, чтобы он хранил температуру **только** в кельвинах, а `getValue()` возвращал значение в текущей единице.

## Задача 3. Плейлист с защитой коллекции

```java
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Song {
    private final String title;
    private final String artist;

    Song(String title, String artist) {
        this.title = title;
        this.artist = artist;
    }

    String getTitle() { return title; }
    String getArtist() { return artist; }

    @Override
    public String toString() {
        return title + " — " + artist;
    }
}

class Playlist {
    private final String name;
    private final List<Song> songs;

    Playlist(String name, List<Song> songs) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Имя плейлиста не может быть пустым");
        }
        if (songs == null) {
            throw new IllegalArgumentException("Список песен не может быть null");
        }
        this.name = name;
        this.songs = new ArrayList<>(songs);   // копия при приёме
    }

    String getName() { return name; }

    List<Song> getSongs() {
        return Collections.unmodifiableList(songs);   // неизменяемое представление
    }

    void addSong(Song song) {
        if (song == null) {
            throw new IllegalArgumentException("Песня не может быть null");
        }
        if (songs.contains(song)) {
            throw new IllegalArgumentException("Эта песня уже в плейлисте");
        }
        songs.add(song);
    }

    void removeSong(Song song) {
        songs.remove(song);
    }

    int getSongCount() {
        return songs.size();
    }
}
```

Проверка:

```java
Song song1 = new Song("Песня 1", "Исполнитель 1");
Song song2 = new Song("Песня 2", "Исполнитель 2");

List<Song> initial = new ArrayList<>();
initial.add(song1);

Playlist playlist = new Playlist("Мой плейлист", initial);
System.out.println(playlist.getSongCount());   // 1

// пытаемся изменить снаружи через исходный список — не влияет
initial.add(song2);
System.out.println(playlist.getSongCount());   // 1

// пытаемся изменить через геттер — выбросит UnsupportedOperationException
try {
    playlist.getSongs().add(song2);
} catch (UnsupportedOperationException e) {
    System.out.println("Список защищён");
}

// а через addSong — можно
playlist.addSong(song2);
System.out.println(playlist.getSongCount());   // 2

// дубликат — нельзя
try {
    playlist.addSong(song1);
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage());         // Эта песня уже в плейлисте
}
```

**На что обратить внимание.** Здесь важно понять **разницу между копией и неизменяемым представлением**.

В конструкторе мы делаем **копию** (`new ArrayList<>(songs)`). Это нужно, потому что внутренний список должен быть **изменяемым** — мы же добавляем и удаляем песни через `addSong`/`removeSong`. Если бы мы использовали `List.copyOf`, внутренний список стал бы неизменяемым, и `addSong` не смог бы работать. Поэтому копируем в **свой** изменяемый список.

В геттере мы возвращаем **неизменяемое представление** (`Collections.unmodifiableList(songs)`). Это нужно, чтобы снаружи нельзя было менять список в обход `addSong`. При этом внутренний список остаётся изменяемым — мы сами его меняем.

Это, пожалуй, самая частая ошибка в таких классах: использовать `List.copyOf` в конструкторе и удивляться, почему `addSong` падает, или возвращать сам список и удивляться, почему снаружи его меняют. **Копия — на входе, неизменяемое представление — на выходе.** Запомните эту формулу.

Есть ещё вариант — возвращать **копию** из геттера (`return new ArrayList<>(songs);`). Это тоже работает, но создаёт новый список при каждом вызове. Если геттер вызывается часто, это накладно. `Collections.unmodifiableList` дешевле: он создаёт «обёртку», а не копию. Минус — обёртка «живая»: если внутренний список изменится, изменения будут видны через обёртку. Обычно это нормально, но если вам нужен «снимок» на момент вызова — используйте копию.

## Задача 4. Два типа исключений

```java
class BankAccount {
    private final String owner;
    private double balance;

    BankAccount(String owner, double initialBalance) {
        if (owner == null || owner.isEmpty()) {
            throw new IllegalArgumentException("Владелец не может быть пустым");
        }
        if (initialBalance < 0) {
            throw new IllegalArgumentException("Начальный баланс не может быть отрицательным");
        }
        this.owner = owner;
        this.balance = initialBalance;
    }

    String getOwner() { return owner; }
    double getBalance() { return balance; }

    void deposit(double amount) {
        // Невалидный аргумент: отрицательная сумма — это ошибка вызывающего кода
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма пополнения должна быть положительной");
        }
        balance += amount;
    }

    void withdraw(double amount) {
        // Невалидный аргумент: отрицательная сумма
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма списания должна быть положительной");
        }
        // Неподходящее состояние: сумма валидна, но на счёте недостаточно денег
        if (amount > balance) {
            throw new IllegalStateException("Недостаточно средств: баланс " + balance);
        }
        balance -= amount;
    }

    void transferTo(BankAccount other, double amount) {
        if (other == null) {
            throw new IllegalArgumentException("Счёт получателя не может быть null");
        }
        if (other == this) {
            throw new IllegalArgumentException("Нельзя перевести деньги на тот же счёт");
        }
        if (amount <= 0) {
            throw new IllegalArgumentException("Сумма перевода должна быть положительной");
        }
        if (amount > balance) {
            throw new IllegalStateException("Недостаточно средств: баланс " + balance);
        }
        // сначала списываем, потом зачисляем.
        // если что-то пойдёт не так на стороне other — откатывать нечего: other.deposit не бросает.
        this.balance -= amount;
        other.balance += amount;
    }
}
```

**На что обратить внимание.** Главное здесь — **разница между двумя типами исключений**.

`IllegalArgumentException` — это «вы передали мне плохое значение». Отрицательная сумма — ерунда сама по себе, независимо от состояния счёта. Это ошибка **вызывающего кода**, и её надо исправлять.

`IllegalStateException` — это «значение-то нормальное, но сейчас нельзя». Сумма 1000 — валидная, но если на счёте 500, — перевести нельзя. Это не ошибка вызывающего кода: он мог не знать, что на счёте 500. Это **состояние** объекта, которое не позволяет выполнить операцию.

Разница не всегда очевидна, и на практике бывает, что `withdraw` на недостаток средств бросает `IllegalArgumentException` — «мол, вы передали сумму, которую нельзя снять». Но я считаю, что это неправильно: сумма валидна, проблема в состоянии. Правильнее — `IllegalStateException`. Это, кстати, тот случай, где нет единственно правильного ответа; главное — **быть последовательным**: выберите одно правило и придерживайтесь его во всём проекте.

Второй важный момент — в `transferTo` **сначала проверяются все условия, потом происходят изменения**. Если бы мы списали деньги, а потом обнаружили, что `other` — `null`, — пришлось бы «откатывать» списание. Правило простое: **сначала все проверки, потом все изменения**. Это гарантирует, что при ошибке ни один объект не окажется в «полуизменённом» состоянии.

И третий момент — в `transferTo` мы напрямую обращаемся к `other.balance`. Это разрешено, потому что мы внутри класса `BankAccount` и `other` — тоже `BankAccount`. Java позволяет обращаться к `private`-полям **другого объекта того же класса**. Это нормально, но не всегда желательно: если завтра мы захотим добавить в `deposit` какую-то логику (например, логирование), — мы её обойдём. Правильнее было бы вызвать `other.deposit(amount)`, но это уже вопрос вкуса. В данном случае я оставил прямой доступ, потому что `transferTo` — это «внутренняя операция банка», и она имеет право знать о внутренностях.

## Задача 5. Неизменяемый диапазон дат

```java
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

final class DateRange {
    private final LocalDate start;
    private final LocalDate end;

    DateRange(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            throw new IllegalArgumentException("Границы диапазона не могут быть null");
        }
        if (start.isAfter(end)) {
            throw new IllegalArgumentException(
                "Начало диапазона позже конца: " + start + " > " + end);
        }
        this.start = start;
        this.end = end;
    }

    LocalDate getStart() { return start; }
    LocalDate getEnd() { return end; }

    boolean contains(LocalDate date) {
        if (date == null) {
            return false;
        }
        return !date.isBefore(start) && !date.isAfter(end);
    }

    boolean overlaps(DateRange other) {
        if (other == null) {
            return false;
        }
        return !this.end.isBefore(other.start) && !this.start.isAfter(other.end);
    }

    long lengthInDays() {
        return ChronoUnit.DAYS.between(start, end) + 1;   // +1 — потому что диапазон включительный
    }

    DateRange shift(int days) {
        return new DateRange(start.plusDays(days), end.plusDays(days));
    }

    @Override
    public String toString() {
        return "[" + start + " — " + end + "]";
    }
}
```

Проверка:

```java
DateRange january = new DateRange(
    LocalDate.of(2024, 1, 1),
    LocalDate.of(2024, 1, 31)
);

System.out.println(january);                       // [2024-01-01 — 2024-01-31]
System.out.println(january.contains(LocalDate.of(2024, 1, 15)));  // true
System.out.println(january.contains(LocalDate.of(2024, 2, 1)));   // false
System.out.println(january.lengthInDays());        // 31

DateRange shifted = january.shift(31);
System.out.println(shifted);                       // [2024-02-01 — 2024-03-02]
System.out.println(january);                       // [2024-01-01 — 2024-01-31] — не изменился
```

**На что обратить внимание.** Здесь два тонких момента.

**Первый — `LocalDate` неизменяем.** Это значит, что нам **не нужно** защитное копирование: `LocalDate` нельзя изменить после создания. Если бы мы использовали `java.util.Date` (изменяемый), — пришлось бы копировать в конструкторе и в геттерах. `LocalDate` — часть «нового» API (`java.time`), и одно из его главных преимуществ — неизменяемость. Используйте его, а не `Date`, и будет вам счастье.

**Второй — `shift` возвращает новый объект.** Это и есть суть неизменяемого класса: все методы, которые «меняют» состояние, возвращают **новый** объект, а исходный остаётся нетронутым. Обратите внимание на `plusDays` у `LocalDate` — он тоже возвращает новый `LocalDate`, а не меняет старый. Это единообразно: `LocalDate` и `DateRange` следуют одному принципу.

Есть ещё один момент — **`lengthInDays` с `+1`**. Если диапазон с 1 по 31 января включительно, — это 31 день, а не 30. `ChronoUnit.DAYS.between` возвращает 30 (разницу), поэтому мы прибавляем 1. Такие «пограничные» случаи — частая причина ошибок, и их стоит проверять тестами (например, что `lengthInDays` для одного дня равен 1, а не 0).

## Задача 6. Рефакторинг в record

```java
public record UserCredentials(String username, String email) {
    public UserCredentials {
        if (username == null || username.isEmpty()) {
            throw new IllegalArgumentException("Имя пользователя не может быть пустым");
        }
        if (username.length() < 3 || username.length() > 20) {
            throw new IllegalArgumentException(
                "Имя пользователя должно быть от 3 до 20 символов");
        }
        if (!username.matches("[a-zA-Z0-9_]+")) {
            throw new IllegalArgumentException(
                "Имя пользователя может содержать только буквы, цифры и _");
        }
        if (email == null || !email.contains("@")) {
            throw new IllegalArgumentException("Некорректный email: " + email);
        }
    }
}
```

Проверка:

```java
UserCredentials creds = new UserCredentials("alice_99", "alice@example.com");
System.out.println(creds);                    // UserCredentials[username=alice_99, email=alice@example.com]
System.out.println(creds.username());         // alice_99
System.out.println(creds.email());            // alice@example.com

UserCredentials same = new UserCredentials("alice_99", "alice@example.com");
System.out.println(creds.equals(same));       // true — equals сгенерирован автоматически
System.out.println(creds.hashCode() == same.hashCode());  // true — hashCode тоже

try {
    new UserCredentials("ab", "alice@example.com");
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage());       // Имя пользователя должно быть от 3 до 20 символов
}

try {
    new UserCredentials("alice_99", "not-an-email");
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage());       // Некорректный email: not-an-email
}
```

**На что обратить внимание.** Три вещи.

**Первая — весь boilerplate исчез.** Из 40 строк осталось 15, и то половина — это проверки. Всё остальное (конструктор, геттеры, `equals`, `hashCode`, `toString`) генерируется автоматически.

**Вторая — геттеры называются без `get`.** `creds.username()`, а не `creds.getUsername()`. Это соглашение `record`: раз поля — это данные, а не свойства с логикой, — геттеры короткие. Некоторые библиотеки (Jackson, например) это понимают; некоторые — требуют настройки. Если вы используете `record` для DTO в JSON, — проверьте, что библиотека понимает такой формат.

**Третья — валидация в компактном конструкторе.** Синтаксис `public UserCredentials { ... }` — без параметров. Java сама подставит все поля. Внутри мы не присваиваем их — присваивание происходит автоматически после тела компактного конструктора. Если нужно **изменить** значение (например, нормализовать email), — присваиваем **параметру** (`email = email.toLowerCase()`), и это повлияет на поле. В нашем случае мы только проверяем, поэтому ничего не присваиваем.

**Что можно улучшить.** Регулярное выражение `[a-zA-Z0-9_]+` проверяет только ASCII-символы. Если хотите разрешить кириллицу или юникод — используйте `\w` с флагом `UNICODE_CHARACTER_CLASS` или другой паттерн. Это тонкость, которая вылезет, когда пользователь попробует ввести имя на русском.

## Задача 7. Проект — Банковская система

Это большое задание, и решений у него много. Покажу один из разумных вариантов, а в комментариях объясню ключевые решения.

### Transaction

```java
import java.math.BigDecimal;
import java.time.Instant;

enum TransactionType { DEPOSIT, WITHDRAWAL }

record Transaction(TransactionType type, BigDecimal amount, Instant timestamp) {
    Transaction(TransactionType type, BigDecimal amount) {
        this(type, amount, Instant.now());
    }

    Transaction {
        if (type == null) {
            throw new IllegalArgumentException("Тип транзакции не может быть null");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Сумма должна быть положительной");
        }
        if (timestamp == null) {
            timestamp = Instant.now();
        }
    }

    @Override
    public String toString() {
        return timestamp + " " + type + " " + amount;
    }
}
```

**Решения.** `record` здесь идеален: транзакция — это набор значений (тип, сумма, время), она не меняется после создания, и её нужно сравнивать и хранить. `BigDecimal` вместо `double` — потому что деньги. `Instant` вместо `Date` — потому что `Instant` неизменяем.

Обратите внимание на два конструктора: полный (с `timestamp`) и сокращённый (без него, ставит текущий момент). Сокращённый делегирует полному через `this(...)`. Это тот самый приём из урока 4 — «один главный конструктор, остальные делегируют».

Ещё тонкость: в компактном конструкторе есть проверка `if (timestamp == null) timestamp = Instant.now()`. Это **изменение параметра**, которое повлияет на поле. Работает только в компактном конструкторе; в обычном пришлось бы писать `this.timestamp = ...`.

### Customer

```java
class Customer {
    private static long nextId = 1;

    private final long id;
    private final String name;

    Customer(String name) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Имя клиента не может быть пустым");
        }
        this.id = nextId++;
        this.name = name;
    }

    long getId() { return id; }
    String getName() { return name; }

    @Override
    public String toString() {
        return "Customer#" + id + " " + name;
    }
}
```

**Решения.** `id` и `name` — `private final`: клиент не меняется после создания. `nextId` — `static`, потому что нумерация сквозная. Обратите внимание: `id` присваивается в конструкторе, а не в объявлении поля, — потому что `nextId++` должен выполняться при создании **каждого** объекта, а не один раз при загрузке класса.

В реальном банке `id` был бы из базы данных, и `static`-счётчик был бы неуместен. Но для учебной задачи это нормально; главное — понимать ограничение (при перезапуске программы нумерация сбросится).

### Account

```java
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

class Account {
    private final String accountNumber;
    private final Customer owner;
    private BigDecimal balance;
    private final List<Transaction> transactions;

    Account(String accountNumber, Customer owner, BigDecimal initialBalance) {
        if (accountNumber == null || accountNumber.isEmpty()) {
            throw new IllegalArgumentException("Номер счёта не может быть пустым");
        }
        if (owner == null) {
            throw new IllegalArgumentException("Владелец не может быть null");
        }
        if (initialBalance == null || initialBalance.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Начальный баланс не может быть отрицательным");
        }
        this.accountNumber = accountNumber;
        this.owner = owner;
        this.balance = initialBalance;
        this.transactions = new ArrayList<>();
    }

    String getAccountNumber() { return accountNumber; }
    Customer getOwner() { return owner; }
    BigDecimal getBalance() { return balance; }

    List<Transaction> getTransactions() {
        return Collections.unmodifiableList(transactions);
    }

    void deposit(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Сумма пополнения должна быть положительной");
        }
        balance = balance.add(amount);
        transactions.add(new Transaction(TransactionType.DEPOSIT, amount));
    }

    void withdraw(BigDecimal amount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Сумма списания должна быть положительной");
        }
        if (amount.compareTo(balance) > 0) {
            throw new IllegalStateException(
                "Недостаточно средств: баланс " + balance + ", запрошено " + amount);
        }
        balance = balance.subtract(amount);
        transactions.add(new Transaction(TransactionType.WITHDRAWAL, amount));
    }

    @Override
    public String toString() {
        return accountNumber + " (" + owner.getName() + "): " + balance;
    }
}
```

**Решения.** Поля `private`, `accountNumber` и `owner` — `final` (не меняются), `balance` и `transactions` — изменяемые (счёт живёт). Конструктор проверяет всё, что можно проверить.

`getTransactions` возвращает `Collections.unmodifiableList`, а не сам список. Это та самая формула из задачи 3: **копия на входе (если нужно), неизменяемое представление на выходе**.

В `deposit` и `withdraw` — сначала все проверки, потом изменения. Если проверка не прошла, — ни баланс, ни история не меняются. Это важно: если бы мы сначала добавляли транзакцию в историю, а потом обнаруживали, что средств недостаточно, — история была бы «грязной».

Обратите внимание на `amount.compareTo(BigDecimal.ZERO)` вместо `amount <= 0`. `BigDecimal` — объект, `<=` не работает; нужно использовать `compareTo`. Это частая ошибка у тех, кто привык к `double`.

### Bank

```java
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

class Bank {
    private final List<Customer> customers;
    private final List<Account> accounts;

    Bank() {
        this.customers = new ArrayList<>();
        this.accounts = new ArrayList<>();
    }

    Customer registerCustomer(String name) {
        Customer customer = new Customer(name);
        customers.add(customer);
        return customer;
    }

    Account openAccount(Customer customer, String accountNumber, BigDecimal initialBalance) {
        if (customer == null) {
            throw new IllegalArgumentException("Клиент не может быть null");
        }
        if (!customers.contains(customer)) {
            throw new IllegalArgumentException("Клиент не зарегистрирован в банке");
        }
        if (findAccount(accountNumber).isPresent()) {
            throw new IllegalArgumentException("Счёт с таким номером уже существует");
        }
        Account account = new Account(accountNumber, customer, initialBalance);
        accounts.add(account);
        return account;
    }

    Optional<Account> findAccount(String accountNumber) {
        for (Account account : accounts) {
            if (account.getAccountNumber().equals(accountNumber)) {
                return Optional.of(account);
            }
        }
        return Optional.empty();
    }

    void transfer(String fromNumber, String toNumber, BigDecimal amount) {
        if (fromNumber == null || toNumber == null) {
            throw new IllegalArgumentException("Номера счетов не могут быть null");
        }
        if (fromNumber.equals(toNumber)) {
            throw new IllegalArgumentException("Нельзя перевести деньги на тот же счёт");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Сумма перевода должна быть положительной");
        }
        Account from = findAccount(fromNumber)
            .orElseThrow(() -> new IllegalArgumentException("Счёт не найден: " + fromNumber));
        Account to = findAccount(toNumber)
            .orElseThrow(() -> new IllegalArgumentException("Счёт не найден: " + toNumber));
        // сначала списываем: если не хватит — упадёт здесь, и `to` не изменится
        from.withdraw(amount);
        to.deposit(amount);
    }

    void printAllAccounts() {
        System.out.println("=== Счета ===");
        for (Account account : accounts) {
            System.out.println(account);
        }
    }
}
```

**Решения.** Списки `customers` и `accounts` — `private final`, инициализируются пустыми. Прямого доступа к ним снаружи нет — только через методы.

`findAccount` возвращает `Optional<Account>` — потому что «счёт может не найтись». Это честнее, чем `null`: вызывающий код **обязан** как-то обработать пустой `Optional`. Если не хотите пока использовать `Optional`, можно вернуть `null` и проверять его, — но `Optional` лучше, и в современной Java это стандарт.

`transfer` — самая важная часть. Порядок операций: сначала все проверки, потом `from.withdraw(amount)`, потом `to.deposit(amount)`. Если `withdraw` упадёт (недостаточно средств), — `to.deposit` не выполнится, и **ни один счёт не изменится**. Если бы мы сначала делали `deposit`, а потом `withdraw`, — при ошибке `withdraw` деньги бы «появились из воздуха» на `to`. Это классическая ошибка, и её легко допустить.

### Сценарий проверки

```java
public class Main {
    public static void main(String[] args) {
        Bank bank = new Bank();

        Customer alice = bank.registerCustomer("Алиса");
        Customer bob = bank.registerCustomer("Боб");

        bank.openAccount(alice, "A-001", new BigDecimal("1000"));
        bank.openAccount(bob, "B-001", new BigDecimal("500"));

        bank.transfer("A-001", "B-001", new BigDecimal("300"));

        bank.printAllAccounts();
        // A-001 (Алиса): 700
        // B-001 (Боб): 800

        try {
            bank.transfer("A-001", "B-001", new BigDecimal("1000"));
        } catch (IllegalStateException e) {
            System.out.println("Ошибка: " + e.getMessage());   // Недостаточно средств
        }

        bank.printAllAccounts();
        // A-001 (Алиса): 700 — не изменилось
        // B-001 (Боб): 800 — не изменилось

        // история транзакций Алисы
        Account aliceAccount = bank.findAccount("A-001").orElseThrow();
        System.out.println("=== История Алисы ===");
        for (Transaction t : aliceAccount.getTransactions()) {
            System.out.println(t);
        }
        // только списание 300

        try {
            bank.openAccount(alice, "A-001", new BigDecimal("100"));
        } catch (IllegalArgumentException e) {
            System.out.println("Ошибка: " + e.getMessage());
            // Счёт с таким номером уже существует
        }

        Account bobAccount = bank.findAccount("B-001").orElseThrow();
        System.out.println("=== История Боба ===");
        for (Transaction t : bobAccount.getTransactions()) {
            System.out.println(t);
        }
        // только пополнение 300
    }
}
```

Ожидаемый вывод примерно такой:

```
=== Счета ===
A-001 (Алиса): 700
B-001 (Боб): 800
Ошибка: Недостаточно средств: баланс 700, запрошено 1000
=== Счета ===
A-001 (Алиса): 700
B-001 (Боб): 800
=== История Алисы ===
2024-... WITHDRAWAL 300
Ошибка: Счёт с таким номером уже существует
=== История Боба ===
2024-... DEPOSIT 300
```

### Что здесь можно улучшить

Это учебное решение, и в реальном коде его можно улучшить. Несколько идей, которые пригодятся дальше.

**Валидация в `Bank`.** `registerCustomer` не проверяет, что имя непустое — это делает `Customer`. Это нормально: `Bank` доверяет `Customer`, что тот не создастся с пустым именем. Но `openAccount` должен проверять, что `initialBalance` не `null`, — сейчас это делает конструктор `Account`, и если передать `null`, будет `NullPointerException` (потому что `initialBalance.compareTo(...)` упадёт). Лучше проверить явно и бросить `IllegalArgumentException`.

**`transfer` и `withdraw`.** В `transfer` мы делаем `from.withdraw(amount)`, а потом `to.deposit(amount)`. Если `to.deposit` упадёт (например, из-за `null`, хотя мы проверили, — или из-за какой-то другой причины), — деньги «зависнут»: с `from` списались, а на `to` не попали. В реальной банковской системе это решается транзакциями (в смысле баз данных), а в учебной — можно просто быть аккуратным. Но подумать об этом стоит: **любая операция, меняющая два объекта, должна быть атомарной** — либо оба изменения, либо ни одного.

**`Optional` в `findAccount`.** Если решите не использовать `Optional`, — возвращайте `null` и **обязательно** проверяйте его в `openAccount` и `transfer`. Иначе `findAccount(...).getAccountNumber()` упадёт с `NullPointerException`, и это будет неприятно.

**Конкурентность.** Если два потока одновременно переводят деньги с одного счёта, — возможна гонка. Об этом мы поговорим в модуле про многопоточность. Пока что просто запомните: **класс с изменяемым состоянием не безопасен в многопоточной среде**, если не добавить синхронизацию.

**`BigDecimal` и сравнение.** Помните, что `BigDecimal` сравнивается через `compareTo`, а не через `equals` (потому что `equals` учитывает масштаб: `1.0` и `1.00` — не `equals`, хотя `compareTo` даёт 0). В нашем коде мы везде используем `compareTo`, и это правильно. Если бы использовали `equals`, — могли бы получить странные результаты.

Всё это — не ошибки учебного решения, а точки роста. Хорошее учебное решение — то, которое работает и понятно, а не то, которое сразу учитывает все возможные требования. Понимание того, что можно улучшить, — уже следующий шаг.