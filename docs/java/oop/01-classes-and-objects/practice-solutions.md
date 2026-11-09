---
title: Разбор практикума — Классы и объекты
description: Решения семи задач первого модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Классы и объекты

## Как читать этот разбор

Решения ниже — не единственно правильные. В ООП редко бывает один правильный ответ, особенно в проектном задании. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и понятно — оно тоже правильное.

Обращайте внимание не столько на код, сколько на комментарии и на «почему» в тексте. Синтаксис вы и так выучите, а вот привычка задавать вопрос «почему я сделал именно так» — это то, что отличает код, который через полгода не страшно открыть, от кода, который хочется переписать с нуля.

## Задача 1. Прямоугольник

```java
class Rectangle {
    double width;
    double height;

    double area() {
        return width * height;
    }

    double perimeter() {
        return 2 * (width + height);
    }

    boolean isSquare() {
        return width == height;
    }
}
```

Использование:

```java
Rectangle square = new Rectangle();
square.width = 5;
square.height = 5;
System.out.println(square.area());        // 25.0
System.out.println(square.perimeter());   // 20.0
System.out.println(square.isSquare());    // true

Rectangle elongated = new Rectangle();
elongated.width = 3;
elongated.height = 7;
System.out.println(elongated.area());        // 21.0
System.out.println(elongated.perimeter());   // 20.0
System.out.println(elongated.isSquare());    // false

Rectangle almostSquare = new Rectangle();
almostSquare.width = 4;
almostSquare.height = 4.0001;
System.out.println(almostSquare.isSquare());  // false
```

**На что обратить внимание.** Метод `isSquare` сравнивает `width == height` — для `double` это работает, но требует осторожности. Если бы `width` и `height` получались в результате вычислений, могла бы накопиться погрешность, и «квадрат» перестал бы быть квадратом. Для нашего случая, где мы присваиваем значения напрямую, это нормально. Но если бы это был реальный класс, я бы добавил проверку с допуском:

```java
boolean isSquare() {
    return Math.abs(width - height) < 1e-9;
}
```

Это, кстати, хороший пример того, что «работает» и «правильно» — не всегда одно и то же. Для учебной задачи хватит и `==`, но в реальном коде лучше подумать о погрешности.

## Задача 2. Кофемашина

```java
class CoffeeMachine {
    int waterLevel;
    int beansLevel;
    int cupsMade;

    boolean makeCoffee() {
        if (waterLevel < 200 || beansLevel < 15) {
            return false;
        }
        waterLevel -= 200;
        beansLevel -= 15;
        cupsMade++;
        return true;
    }

    void refillWater(int ml) {
        int space = 2000 - waterLevel;
        if (ml > space) {
            System.out.println("Не хватило места: вылилось " + (ml - space) + " мл");
            waterLevel = 2000;
        } else {
            waterLevel += ml;
        }
    }

    void refillBeans(int grams) {
        int space = 500 - beansLevel;
        if (grams > space) {
            System.out.println("Не хватило места: рассыпалось " + (grams - space) + " г");
            beansLevel = 500;
        } else {
            beansLevel += grams;
        }
    }

    void status() {
        System.out.println("Вода: " + waterLevel + " мл, зёрна: " + beansLevel
                + " г, чашек сделано: " + cupsMade);
    }
}
```

Проверка:

```java
CoffeeMachine machine = new CoffeeMachine();
machine.refillWater(500);
machine.refillBeans(100);

machine.makeCoffee();
machine.makeCoffee();
machine.makeCoffee();

machine.status();   // Вода: 0 мл, зёрна: 55 г, чашек сделано: 3

machine.refillWater(500);
machine.status();   // Вода: 500 мл, зёрна: 55 г, чашек сделано: 3
```

**На что обратить внимание.** Здесь важно, что методы `makeCoffee`, `refillWater`, `refillBeans` меняют поля **своего** объекта. Если создать две кофемашины, у каждой будет своё состояние. Проверить это можно так:

```java
CoffeeMachine a = new CoffeeMachine();
CoffeeMachine b = new CoffeeMachine();

a.refillWater(500);
a.makeCoffee();

a.status();   // Вода: 300 мл, чашек сделано: 1
b.status();   // Вода: 0 мл, чашек сделано: 0
```

Если бы `waterLevel` был `static`, обе машины использовали бы один и тот же бак, и это было бы странно. `static` здесь не нужен: бак у каждой кофемашины свой.

Второй момент — обработка перелива. Я специально сделал так, чтобы метод не просто «обрезал» значение, а печатал предупреждение. Это вежливее: пользователь класса видит, что что-то пошло не так, а не обнаруживает это через полчаса.

## Задача 3. Письмо

```java
class Email {
    String to;
    String subject;
    String body;

    Email(String to, String subject, String body) {
        this.to = to;
        this.subject = subject;
        this.body = body;
    }

    Email(String to, String body) {
        this(to, "(без темы)", body);
    }

    Email(String to) {
        this(to, "(без темы)", "(пустое письмо)");
    }

    void print() {
        System.out.println("Кому: " + to);
        System.out.println("Тема: " + subject);
        System.out.println("---");
        System.out.println(body);
        System.out.println();
    }
}
```

Проверка:

```java
new Email("alice@example.com", "Привет", "Как дела?").print();
new Email("bob@example.com", "Пока").print();
new Email("carol@example.com").print();
```

**На что обратить внимание.** Главное здесь — **делегирование через `this(...)`**. Все три конструктора сходятся в один, полный. Логика инициализации — в одном месте. Если завтра понадобится добавить проверку (например, что `to` не `null`), достаточно сделать это в полном конструкторе, и оно подействует на все три.

Это, кстати, общий принцип: **один конструктор — «главный», остальные делегируют ему**. Так проще поддерживать: не нужно помнить, что в каком конструкторе происходит.

Ещё момент. Я поставил `"(без темы)"` в скобках — чтобы было видно, что это заглушка, а не настоящая тема. Это мелочь, но такие мелочи делают вывод понятнее. Если бы я написал просто `""`, было бы непонятно: тема пустая, или её вообще не задавали?

## Задача 4. Заказ с необязательным клиентом

```java
class Order {
    String customerName;
    int itemCount;
    double totalPrice;

    Order(String customerName, int itemCount, double totalPrice) {
        this.customerName = customerName;
        this.itemCount = itemCount;
        this.totalPrice = totalPrice;
    }

    String getCustomerDisplay() {
        if (customerName == null) {
            return "Гость";
        }
        if (customerName.isEmpty()) {
            return "(пустое имя)";
        }
        return customerName;
    }

    void describe() {
        System.out.println("Заказ для " + getCustomerDisplay()
                + ": " + itemCount + " товаров на " + totalPrice + " руб.");
    }
}
```

Проверка:

```java
new Order("Алиса", 3, 1500.0).describe();   // Заказ для Алиса: 3 товаров на 1500.0 руб.
new Order(null, 1, 500.0).describe();       // Заказ для Гость: 1 товаров на 500.0 руб.
new Order("", 2, 800.0).describe();         // Заказ для (пустое имя): 2 товаров на 800.0 руб.
```

**На что обратить внимание.** Здесь два разных «пустых» значения: `null` и `""`. Это не одно и то же. `null` значит «имени нет вообще», `""` — «имя есть, но оно пустое». В нашем случае оба варианта надо обработать, но по-разному, потому что смысл у них разный.

Если бы я написал просто `if (customerName == null)` и на этом остановился, то при `customerName = ""` метод вернул бы пустую строку, и в выводе было бы «Заказ для : 2 товаров…». Некрасиво. Поэтому вторая проверка — на пустоту.

Есть и другой подход: нормализовать значение в конструкторе. Например:

```java
Order(String customerName, int itemCount, double totalPrice) {
    this.customerName = (customerName == null || customerName.isEmpty())
            ? null
            : customerName;
    ...
}
```

Тогда `customerName` всегда либо `null`, либо непустая строка, и метод `getCustomerDisplay` упрощается. Это тоже разумный подход — «нормализовать на входе, а не на выходе». Какой лучше — зависит от задачи; в нашем случае я оставил проверку в методе, чтобы было видно, что «пустое имя» и «нет имени» — разные вещи.

## Задача 5. Билеты с номерами

```java
class Ticket {
    private static int nextNumber = 1;

    private int number;
    private String eventName;

    Ticket(String eventName) {
        this.number = nextNumber++;
        this.eventName = eventName;
    }

    void print() {
        System.out.println("Билет №" + number + " на " + eventName);
    }
}
```

Проверка:

```java
new Ticket("Концерт").print();      // Билет №1 на Концерт
new Ticket("Спектакль").print();    // Билет №2 на Спектакль
new Ticket("Лекция").print();       // Билет №3 на Лекцию
new Ticket("Кино").print();         // Билет №4 на Кино
new Ticket("Выставка").print();     // Билет №5 на Выставку
```

**На что обратить внимание.** `nextNumber` — `static`, потому что он общий для всех билетов: это не «номер конкретного билета», это «следующий свободный номер». А вот `number` — не `static`: у каждого билета свой номер, и он не должен меняться, когда создаётся следующий билет.

Идиома `this.number = nextNumber++` делает две вещи: присваивает текущее значение `nextNumber` полю `number`, а потом увеличивает `nextNumber` на 1. Это эквивалентно:

```java
this.number = nextNumber;
nextNumber = nextNumber + 1;
```

Просто короче. Иногда эту запись критикуют за неочевидность, но в случае счётчиков она общепринята.

**Ответы на дополнительные вопросы.** Если создать ещё один билет через полчаса после первых пяти — он получит номер 6. `static`-поле живёт всё время работы программы, и «полчаса» на него не влияют. Если перезапустить программу — счётчик сбросится, и первый билет снова получит номер 1. Это важное ограничение: `static`-счётчик не переживает перезапуск программы. Если нужна нумерация, которая сохраняется между запусками, — её надо хранить во внешнем источнике (файл, база данных) и загружать при старте.

Если два билета создать в двух разных потоках — счётчик может сломаться. `nextNumber++` не является атомарной операцией: она состоит из чтения, увеличения и записи. Если два потока сделают это одновременно, оба могут прочитать одно и то же значение и получить одинаковые номера. Это классическая проблема многопоточности, и мы будем разбирать её в модуле про многопоточность (урок про состояние гонки). Пока что просто запомните: **`static`-счётчики не безопасны в многопоточной среде без дополнительной синхронизации**.

## Задача 6. Найдите утечку

Утечка — в `static`-поле `sessions`:

```java
private static java.util.Map<String, Session> sessions = new java.util.HashMap<>();
```

Это `static`-коллекция. Она живёт всё время работы программы. Каждый вызов `register` добавляет в неё сессию — и эта сессия **никогда не станет мусором**, даже если весь остальной код про неё забыл. Потому что `sessions` на неё ссылается, а `sessions` живёт вечно.

Когда пользователь закрывает браузер и уходит — сессия ему больше не нужна. Но она остаётся в `sessions`. Через день активной работы в этой коллекции могут лежать десятки тысяч сессий, и память будет расти, пока программа не упадёт с `OutOfMemoryError`.

**Как исправить.** Нужен способ удалять сессии, которые больше не нужны. Вариантов несколько.

**Вариант первый — явное удаление.** Добавить метод `unregister`:

```java
static void unregister(String id) {
    sessions.remove(id);
}
```

И вызывать его, когда сессия завершается. Это работает, но требует дисциплины: если кто-то забудет вызвать `unregister` — утечка вернётся.

**Вариант второй — ограничение по времени.** Хранить в сессии время создания и периодически удалять старые:

```java
static void cleanup(long maxAgeMillis) {
    long now = System.currentTimeMillis();
    sessions.values().removeIf(s -> now - s.getCreatedAt() > maxAgeMillis);
}
```

Этот метод можно вызывать по таймеру (например, раз в час). Тогда даже если кто-то забыл `unregister`, старые сессии уберутся сами.

**Вариант третий — не `static`.** Если `SessionRegistry` — это объект, который живёт ограниченное время (например, пока живёт приложение), и если приложение само является «долгоживущим» объектом, — можно сделать `sessions` нестатическим полем. Тогда при уничтожении `SessionRegistry` (если он когда-нибудь уничтожается) сессии тоже станут доступны для сборки мусора. Но это работает только если у `SessionRegistry` есть конец жизни. Если он тоже `static` — толку не будет.

**Что бы я выбрал.** Комбинацию первого и второго: явное удаление, когда сессия закрывается штатно, плюс периодическая уборка старых сессий на случай, если штатного закрытия не было. Это надёжнее, чем что-то одно.

**Мораль.** `static`-коллекции — удобны, но опасны. Каждый раз, когда вы кладёте что-то в `static`-`Map` или `List`, задайте себе вопрос: **как и когда это будет удалено?** Если ответа нет — это потенциальная утечка. И это, кстати, одна из причин, по которой `static` считается «опасным» инструментом — не потому что он плохой, а потому что он требует дисциплины, которую легко потерять.

## Задача 7. Проектное задание — модель библиотеки

Это большое задание, и решений у него много. Покажу один из разумных вариантов, а в комментариях объясню ключевые решения.

### Book

```java
class Book {
    private final String title;
    private final String author;
    private final String isbn;
    private boolean available;

    Book(String title, String author, String isbn) {
        this.title = title;
        this.author = author;
        this.isbn = isbn;
        this.available = true;
    }

    boolean checkout() {
        if (!available) {
            return false;
        }
        available = false;
        return true;
    }

    boolean returnBook() {
        if (available) {
            return false;
        }
        available = true;
        return true;
    }

    boolean isAvailable() {
        return available;
    }

    String getTitle() {
        return title;
    }

    String getAuthor() {
        return author;
    }

    String getIsbn() {
        return isbn;
    }

    @Override
    public String toString() {
        return title + " (" + author + ") [ISBN: " + isbn + "]"
                + (available ? " — свободна" : " — выдана");
    }
}
```

**Решения, на которые стоит обратить внимание.**

`title`, `author`, `isbn` — `final`. Они не меняются в течение жизни книги, и это хорошо: не нужно думать, что будет, если кто-то изменит ISBN. `available` — не `final`, потому что оно меняется при выдаче и возврате.

Методы `checkout` и `returnBook` возвращают `boolean`, а не бросают исключение. Это выбор: можно было бы бросать `IllegalStateException` при попытке выдать уже выданную книгу, но для библиотеки «не получилось, потому что книга занята» — это нормальная ситуация, а не ошибка. `boolean` здесь честнее.

`toString` включает состояние — свободна или выдана. Это удобно для отладки и для печати каталога: одна и та же строка используется и там, и там.

### Reader

```java
class Reader {
    private static final int MAX_BOOKS = 5;
    private static int nextTicketNumber = 1;

    private final String name;
    private final int ticketNumber;
    private final java.util.List<Book> borrowedBooks = new java.util.ArrayList<>();

    Reader(String name) {
        this.name = name;
        this.ticketNumber = nextTicketNumber++;
    }

    boolean borrow(Book book) {
        if (book == null) {
            System.out.println("Книга не указана");
            return false;
        }
        if (borrowedBooks.size() >= MAX_BOOKS) {
            System.out.println("Лимит книг исчерпан у " + name);
            return false;
        }
        if (!book.isAvailable()) {
            System.out.println("Книга недоступна: " + book.getTitle());
            return false;
        }
        if (!book.checkout()) {
            // на случай, если состояние изменилось между проверкой и вызовом
            return false;
        }
        borrowedBooks.add(book);
        return true;
    }

    boolean giveBack(Book book) {
        if (book == null) {
            return false;
        }
        if (!borrowedBooks.contains(book)) {
            return false;
        }
        if (!book.returnBook()) {
            return false;
        }
        borrowedBooks.remove(book);
        return true;
    }

    int getBorrowedCount() {
        return borrowedBooks.size();
    }

    String getName() {
        return name;
    }

    @Override
    public String toString() {
        return "Читатель " + name + " (билет №" + ticketNumber + "), книг на руках: "
                + borrowedBooks.size();
    }
}
```

**Решения, на которые стоит обратить внимание.**

`MAX_BOOKS` — `static final`. Это константа: она не меняется и одинакова для всех читателей. Хорошо бы вынести её в конфиг, но для учебной задачи и так нормально.

`nextTicketNumber` — `static`, потому что нумерация сквозная. `ticketNumber` — `final` и не `static`, потому что у каждого читателя свой номер, который не меняется после создания.

`borrowedBooks` инициализирован пустым `ArrayList` прямо в объявлении. Это важно: иначе поле было бы `null`, и вызов `borrowedBooks.size()` упал бы с `NullPointerException` ещё до того, как читатель что-то взял. Мы обсуждали это в уроке 5: **поля-коллекции лучше сразу инициализировать пустыми, чем оставлять `null`**.

Метод `borrow` делает несколько проверок по порядку: `null`, лимит, доступность, и только потом вызывает `book.checkout()`. Последняя проверка (`if (!book.checkout())`) — на случай гонки: между `book.isAvailable()` и `book.checkout()` кто-то мог успеть забрать книгу. В однопоточном коде это невозможно, но в многопоточном — реально. Я оставил её как задел на будущее; в однопоточном коде она всегда даст `true`, если мы до неё дошли.

`contains(book)` в `giveBack` работает по ссылке (`==`), потому что мы не переопределяли `equals` в `Book`. Это нормально для нашей задачи: у нас один объект книги, и мы возвращаем именно его. Если бы у нас было несколько объектов с одинаковым ISBN, `contains` бы не сработал, и пришлось бы переопределять `equals` и `hashCode`. Об этом мы поговорим в модуле про инкапсуляцию и `record`.

### Library

```java
class Library {
    private final java.util.List<Book> books = new java.util.ArrayList<>();
    private final java.util.List<Reader> readers = new java.util.ArrayList<>();

    void addBook(Book book) {
        if (book == null) {
            return;
        }
        books.add(book);
    }

    Reader registerReader(String name) {
        if (name == null || name.isEmpty()) {
            return null;
        }
        Reader reader = new Reader(name);
        readers.add(reader);
        return reader;
    }

    Book findBookByIsbn(String isbn) {
        if (isbn == null) {
            return null;
        }
        for (Book book : books) {
            if (isbn.equals(book.getIsbn())) {
                return book;
            }
        }
        return null;
    }

    boolean lendBook(Reader reader, String isbn) {
        if (reader == null) {
            System.out.println("Читатель не указан");
            return false;
        }
        Book book = findBookByIsbn(isbn);
        if (book == null) {
            System.out.println("Книга с ISBN " + isbn + " не найдена");
            return false;
        }
        return reader.borrow(book);
    }

    boolean acceptReturn(Reader reader, String isbn) {
        if (reader == null) {
            return false;
        }
        Book book = findBookByIsbn(isbn);
        if (book == null) {
            System.out.println("Книга с ISBN " + isbn + " не найдена");
            return false;
        }
        return reader.giveBack(book);
    }

    void printCatalog() {
        System.out.println("=== Каталог ===");
        for (Book book : books) {
            System.out.println(book);
        }
    }

    void printReaders() {
        System.out.println("=== Читатели ===");
        for (Reader reader : readers) {
            System.out.println(reader);
        }
    }
}
```

**Решения, на которые стоит обратить внимание.**

`books` и `readers` инициализированы пустыми списками сразу. Это снимает целый класс проблем с `null`.

`findBookByIsbn` возвращает `null`, если книга не найдена. Это некрасиво, но так устроена сигнатура: «либо книга, либо `null`». В реальном коде лучше было бы вернуть `Optional<Book>` — об этом мы поговорим в модуле про инкапсуляцию. Пока что `null` — приемлемый вариант, главное — не забывать его проверять, что `lendBook` и `acceptReturn` и делают.

Обратите внимание: `lendBook` не делает сам никаких манипуляций с книгой — он только находит её и передаёт `reader.borrow(book)`. Вся логика выдачи — в `Reader`. Это правильно: библиотека не должна знать, как именно читатель берёт книгу; она только связывает читателя с книгой.

Метод `registerReader` возвращает `null`, если имя пустое. Это не идеально (лучше было бы бросить исключение), но для учебной задачи сойдёт. В реальном коде я бы, наверное, бросил `IllegalArgumentException` — «пустое имя читателя» это ошибка вызывающего кода, а не штатная ситуация.

### Сценарий проверки

```java
public class Main {
    public static void main(String[] args) {
        Library library = new Library();

        library.addBook(new Book("Мастер и Маргарита", "Булгаков", "978-5-01"));
        library.addBook(new Book("Пикник на обочине", "Стругацкие", "978-5-02"));
        library.addBook(new Book("Солярис", "Лем", "978-5-03"));
        library.addBook(new Book("451° по Фаренгейту", "Брэдбери", "978-5-04"));
        library.addBook(new Book("Цветы для Элджернона", "Киз", "978-5-05"));

        Reader alice = library.registerReader("Алиса");
        Reader bob = library.registerReader("Боб");

        library.lendBook(alice, "978-5-01");
        library.lendBook(alice, "978-5-02");
        library.lendBook(bob, "978-5-03");

        library.printCatalog();
        library.printReaders();

        // Алиса пытается взять ту же книгу
        library.lendBook(alice, "978-5-01");   // Книга недоступна

        library.acceptReturn(alice, "978-5-01");

        library.printCatalog();
        library.lendBook(bob, "978-5-01");
        library.printReaders();
    }
}
```

Ожидаемый вывод примерно такой:

```
=== Каталог ===
Мастер и Маргарита (Булгаков) [ISBN: 978-5-01] — выдана
Пикник на обочине (Стругацкие) [ISBN: 978-5-02] — выдана
Солярис (Лем) [ISBN: 978-5-03] — выдана
451° по Фаренгейту (Брэдбери) [ISBN: 978-5-04] — свободна
Цветы для Элджернона (Киз) [ISBN: 978-5-05] — свободна
=== Читатели ===
Читатель Алиса (билет №1), книг на руках: 2
Читатель Боб (билет №2), книг на руках: 1
Книга недоступна: Мастер и Маргарита
=== Каталог ===
Мастер и Маргарита (Булгаков) [ISBN: 978-5-01] — свободна
...
=== Читатели ===
Читатель Алиса (билет №1), книг на руках: 1
Читатель Боб (билет №2), книг на руках: 2
```

### Что здесь можно улучшить

Это учебное решение, и в реальном коде его можно улучшить. Несколько идей, которые пригодятся, когда будем проходить следующие модули.

**Инкапсуляция.** Поля уже `private`, но геттеры пока «голые» — они возвращают внутренние объекты без защиты. Например, `Book` возвращает `title` — это нормально, строки неизменяемы. А вот если бы `Reader` возвращал `borrowedBooks` напрямую, кто угодно мог бы добавить туда книгу в обход `borrow`. Мы поговорим об этом в модуле 2.

**`equals` и `hashCode`.** Сейчас `contains(book)` и `books.contains` работают по ссылке. Если бы у нас было две книги с одинаковым ISBN, но разными объектами, `contains` бы не нашёл вторую. В реальном коде `Book` стоило бы научить сравниваться по ISBN. Это тоже в модуле 2, когда будем говорить о `record`.

**`Optional`.** `findBookByIsbn` возвращает `null`. Можно было бы вернуть `Optional<Book>`, и тогда вызывающий код был бы обязан обработать «не найдено». Это современный стиль, и мы поговорим о нём в модуле 5.

**Валидация.** Конструкторы не проверяют, что ISBN не пустой, что название не `null` и т. д. В реальном коде это нужно. Мы тоже будем говорить об этом в модуле 2.

**Многопоточность.** Если два потока одновременно выдают одну и ту же книгу разным читателям, возможна гонка. О том, как с этим бороться, — в модуле про многопоточность.

Всё это — не ошибки учебного решения, а точки роста. Хорошее учебное решение — то, которое работает и понятно, а не то, которое сразу учитывает все возможные требования. Понимание того, что можно улучшить, — уже следующий шаг.