---
title: Разбор практикума — Композиция и интерфейсы
description: Решения семи задач пятого модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Композиция и интерфейсы

## Как читать этот разбор

Решения ниже — не единственно правильные. В композиции многое зависит от контекста: агрегация или композиция, DI через конструктор или через сеттер, фасад или сервис. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и обосновано — оно тоже правильное.

Обращайте внимание не столько на код, сколько на **обоснования**. В композиции «почему агрегация, а не композиция» — не менее важный вопрос, чем «как написать код».

## Задача 1. Замена наследования композицией

```java
class Song {
    private final String title;

    Song(String title) {
        this.title = title;
    }

    String getTitle() { return title; }
}

class Playlist {
    private final String name;
    private final List<Song> songs;

    Playlist(String name) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Имя плейлиста не может быть пустым");
        }
        this.name = name;
        this.songs = new ArrayList<>();
    }

    void addSong(Song song) {
        if (song == null) {
            throw new IllegalArgumentException("Песня не может быть null");
        }
        songs.add(song);
    }

    void removeSong(Song song) {
        songs.remove(song);
    }

    int getSongCount() {
        return songs.size();
    }

    List<Song> getSongs() {
        return Collections.unmodifiableList(songs);
    }

    String getName() {
        return name;
    }
}
```

Использование:

```java
Playlist playlist = new Playlist("Мой плейлист");
playlist.addSong(new Song("Песня 1"));
playlist.addSong(new Song("Песня 2"));
playlist.addSong(new Song("Песня 3"));

System.out.println(playlist.getSongCount());   // 3

try {
    playlist.getSongs().add(new Song("Песня 4"));   // UnsupportedOperationException
} catch (UnsupportedOperationException e) {
    System.out.println("Список защищён");
}

playlist.removeSong(playlist.getSongs().get(0));
System.out.println(playlist.getSongCount());   // 2
```

**Что мы потеряли.** Возможность передать `Playlist` туда, где ожидается `List<Song>` или `Collection<Song>`. Но это, скорее всего, **не нужно**: `Playlist` — не список, а «плейлист». Если функции нужен список песен, — ей и надо передавать `List<Song>`, а не `Playlist`.

**Что приобрели:**

- **Чистый интерфейс.** У `Playlist` только те методы, которые нужны: `addSong`, `removeSong`, `getSongCount`, `getSongs`, `getName`. Никаких `add(int, Song)`, `sort`, `clear`, `subList` — они не имеют смысла для плейлиста.
- **Контроль над состоянием.** `Playlist` сам создаёт список, сам управляет им, и никто снаружи не может его изменить. `getSongs` возвращает неизменяемое представление — снаружи не «подложат» песню в обход `addSong`.
- **Изоляция от изменений.** Если завтра `List` (или `ArrayList`) добавит новый метод, — `Playlist` его не получит. `Playlist` изолирован от эволюции стандартной библиотеки.
- **Честная семантика.** `Playlist` — это плейлист, а не список. `playlist.addSong(song)` читается лучше, чем `playlist.add(song)`, и **не позволяет** делать с плейлистом то, что не имеет смысла.

**Что можно улучшить.** Если плейлист не должен содержать дубликатов — добавить проверку в `addSong`. Если плейлист должен быть неизменяемым — не делать `addSong`/`removeSong`, а принимать список в конструкторе и делать копию. Если песни должны быть «в порядке» — использовать `LinkedHashSet` вместо `ArrayList`.

## Задача 2. Агрегация vs композиция

```java
class Employee {
    private final String name;
    private double salary;

    Employee(String name, double salary) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Имя не может быть пустым");
        }
        if (salary < 0) {
            throw new IllegalArgumentException("Зарплата не может быть отрицательной");
        }
        this.name = name;
        this.salary = salary;
    }

    String getName() { return name; }
    double getSalary() { return salary; }
    void setSalary(double salary) { this.salary = salary; }
}

class Department {
    private final String name;
    private final List<Employee> employees = new ArrayList<>();

    Department(String name) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Название отдела не может быть пустым");
        }
        this.name = name;
    }

    void hire(Employee employee) {
        if (employee == null) {
            throw new IllegalArgumentException("Сотрудник не может быть null");
        }
        employees.add(employee);
    }

    void fire(Employee employee) {
        employees.remove(employee);
    }

    List<Employee> getEmployees() {
        return Collections.unmodifiableList(employees);
    }

    String getName() { return name; }
}

class Company {
    private final String name;
    private final List<Department> departments = new ArrayList<>();

    Company(String name) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Название компании не может быть пустым");
        }
        this.name = name;
    }

    Department createDepartment(String name) {
        Department department = new Department(name);
        departments.add(department);
        return department;
    }

    void transfer(Employee employee, Department from, Department to) {
        if (employee == null || from == null || to == null) {
            throw new IllegalArgumentException("Аргументы не могут быть null");
        }
        if (!from.getEmployees().contains(employee)) {
            throw new IllegalArgumentException("Сотрудник не работает в отделе-источнике");
        }
        from.fire(employee);
        to.hire(employee);
    }

    List<Department> getDepartments() {
        return Collections.unmodifiableList(departments);
    }
}
```

Использование:

```java
Company company = new Company("Acme");
Department dev = company.createDepartment("Разработка");
Department sales = company.createDepartment("Продажи");

Employee alice = new Employee("Алиса", 100_000);
Employee bob = new Employee("Боб", 80_000);
Employee carol = new Employee("Кэрол", 90_000);

dev.hire(alice);
dev.hire(bob);
sales.hire(carol);

company.transfer(bob, dev, sales);

System.out.println("Разработка: " + dev.getEmployees().size());   // 1
System.out.println("Продажи: " + sales.getEmployees().size());    // 2
```

**Почему `Company → Department` — композиция.** Компания **создаёт** свои отделы (`createDepartment`). Отделы **не передаются** снаружи. Если компания «закрывается» (собирается сборщиком мусора), — отделы тоже. Отделы «принадлежат» компании в том смысле, что не могут существовать «сами по себе» — у отдела есть имя и сотрудники, но он не «живёт» вне компании.

**Почему `Department → Employee` — агрегация.** Сотрудник **принимается** снаружи (`hire`). Он может быть переведён в другой отдел (`transfer`). Сотрудник «живёт своей жизнью»: он не «умирает», когда его увольняют из отдела, — он переходит в другой отдел. И один сотрудник может работать в **нескольких** отделах (если разрешить) — но в нашей задаче мы этого не делаем, чтобы не усложнять.

**Что произойдёт с сотрудниками, если отдел «удалён»?** Отдел не «удаляется» — он остаётся в списке `departments` компании. Удалить отдел можно было бы методом `closeDepartment`, который «увольняет» всех сотрудников или переводит их в другой отдел. Если бы мы этого не делали — сотрудники остались бы в «мёртвом» отделе. Это **не проблема** нашей задачи, но в реальной системе стоит продумать.

**Что произойдёт с сотрудниками, если компания «удалена»?** Сотрудники **не удаляются** — они «живут своей жизнью». Но если на них нет ссылок ни в одном отделе, ни в `EmployeeRepository`, — они собираются сборщиком мусора. Это нормально для агрегации.

**Может ли сотрудник быть в двух отделах?** Технически — да: `dev.hire(alice); sales.hire(alice);`. Это **не запрещено** нашей реализацией. Но это может привести к проблемам: `alice` есть в двух списках, `getEmployees().size()` в обоих отделах учитывает её, зарплата не делится и т. д. Если нужно разрешить — стоит подумать, как это выразить (например, `Employee` знает про свои отделы, или отделы «не знают» про сотрудников, а есть общий реестр). Если не нужно — добавить проверку в `hire`: `if (employees.contains(employee)) throw ...`.

**Мораль.** Композиция — когда «содержимое» создаётся и «умирает» с контейнером. Агрегация — когда «содержимое» приходит снаружи и «живёт своей жизнью». В нашей задаче `Company → Department` — композиция (отделы создаются компанией), `Department → Employee` — агрегация (сотрудники приходят снаружи).

## Задача 3. Делегирование вместо копирования

```java
interface Logger {
    void log(String message);
}

class FileLogger implements Logger {
    @Override
    public void log(String message) {
        System.out.println("[FILE] " + message);
    }
}

class ConsoleLogger implements Logger {
    @Override
    public void log(String message) {
        System.out.println("[CONSOLE] " + message);
    }
}

class FilteringLogger implements Logger {
    private final Logger delegate;

    FilteringLogger(Logger delegate) {
        if (delegate == null) {
            throw new IllegalArgumentException("Delegate не может быть null");
        }
        this.delegate = delegate;
    }

    @Override
    public void log(String message) {
        if (message != null && message.contains("ERROR")) {
            delegate.log(message);
        }
    }
}
```

Использование:

```java
Logger fileLogger = new FilteringLogger(new FileLogger());
fileLogger.log("ERROR: что-то сломалось");   // [FILE] ERROR: ...
fileLogger.log("INFO: всё хорошо");          // ничего не выводится

Logger consoleLogger = new FilteringLogger(new ConsoleLogger());
consoleLogger.log("ERROR: снова сломалось"); // [CONSOLE] ERROR: ...

Logger doubleFiltered = new FilteringLogger(
    new FilteringLogger(new FileLogger())
);
doubleFiltered.log("ERROR: двойная фильтрация");   // [FILE] ERROR: ...
doubleFiltered.log("INFO: не пройдёт");            // ничего
```

**Что мы выиграли.**

**Первое: убрали дублирование.** В старом варианте было четыре класса, и каждый дублировал логику фильтрации. В новом — три класса (интерфейс + два логгера + обёртка), и логика фильтрации — **в одном месте** (`FilteringLogger`).

**Второе: комбинируемость.** `FilteringLogger` работает с **любым** `Logger`. Хотите `FileLogger` — пожалуйста. Хотите `ConsoleLogger` — пожалуйста. Хотите `EmailLogger` (если добавите) — тоже. Не нужно создавать `FilteringFileLogger`, `FilteringConsoleLogger`, `FilteringEmailLogger` — достаточно `new FilteringLogger(anyLogger)`.

**Третье: цепочки.** `FilteringLogger` можно «нанизывать» друг на друга. `new FilteringLogger(new FilteringLogger(...))` — работает. Это **декоратор** (decorator) — паттерн, о котором будем говорить в модуле 6.

**Что было бы, если бы мы добавили `EmailLogger` и `FilteringEmailLogger`.** В «старом» варианте было бы **6** классов: `FileLogger`, `ConsoleLogger`, `EmailLogger`, `FilteringFileLogger`, `FilteringConsoleLogger`, `FilteringEmailLogger`. В «новом» — **5**: интерфейс + три логгера + `FilteringLogger` (один, работает с любым). С двумя логгерами разница в один класс, с пятью — уже в четыре.

**Мораль.** Делегирование — это способ **вынести** поведение в отдельный класс и **комбинировать** его с другими. Вместо «декартова произведения» классов (`Filtering × File`, `Filtering × Console`, `Filtering × Email`) — «линейная композиция» (`Filtering(File)`, `Filtering(Console)`, `Filtering(Email)`).

## Задача 4. Программирование под интерфейс

```java
interface Database {
    List<String> query(String sql);
}

class MySQLDatabase implements Database {
    private final String connectionString;

    MySQLDatabase(String connectionString) {
        this.connectionString = connectionString;
    }

    @Override
    public List<String> query(String sql) {
        // ... выполнение запроса к MySQL ...
        return List.of("row1", "row2", "row3");
    }
}

class InMemoryDatabase implements Database {
    private final List<String> data = new ArrayList<>();

    void add(String row) {
        data.add(row);
    }

    @Override
    public List<String> query(String sql) {
        return new ArrayList<>(data);   // «выполняем» запрос — возвращаем всё
    }
}

class ReportService {
    private final Database database;

    ReportService(Database database) {
        if (database == null) {
            throw new IllegalArgumentException("Database не может быть null");
        }
        this.database = database;
    }

    List<String> loadReport() {
        return database.query("SELECT * FROM reports");
    }
}
```

Использование:

```java
ReportService withMySQL = new ReportService(
    new MySQLDatabase("localhost:3306")
);
System.out.println(withMySQL.loadReport());

InMemoryDatabase inMemory = new InMemoryDatabase();
inMemory.add("report1");
inMemory.add("report2");

ReportService withInMemory = new ReportService(inMemory);
System.out.println(withInMemory.loadReport());   // [report1, report2]
```

**Что делает `ReportService` простым и тестируемым.**

**Первое: `ReportService` не знает про MySQL.** Он знает только, что у него есть `Database` с методом `query`. Замена на `InMemoryDatabase` или `FakeDatabase` — одна строчка в `main`.

**Второе: тесты не требуют MySQL.** В тестах подставляем `InMemoryDatabase` или `FakeDatabase`, который возвращает заранее заданные строки. Тест быстрый, детерминированный, без инфраструктуры.

**Третье: `ReportService` не создаёт `Database` сам.** Он **принимает** её через конструктор. Это DI — принцип, который мы прошли в прошлом уроке. `ReportService` зависит от **контракта**, а не от реализации.

**Что потерялось.** Возможность использовать методы, специфичные для `MySQLDatabase` (например, `setAutoCommit`, если бы он был). Но это, скорее всего, **не нужно** `ReportService`: ему нужен `query`, а `setAutoCommit` — забота того, кто настраивает соединение.

**Мораль.** «Программировать под интерфейс» — это не «добавить интерфейс ради интерфейса», а **осознанно** отделить «что я использую» от «как это реализовано». `ReportService` использует **только** `query` — значит, ему нужен интерфейс с одним методом. Всё остальное — забота `Database`.

## Задача 5. Dependency Injection через конструктор

```java
interface UserRepository {
    User findByEmail(String email);
}

interface PasswordHasher {
    String hash(String password);
    boolean matches(String password, String hash);
}

interface TokenGenerator {
    String generate(long userId);
}

class User {
    private final long id;
    private final String email;
    private final String passwordHash;

    User(long id, String email, String passwordHash) {
        this.id = id;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    long getId() { return id; }
    String getEmail() { return email; }
    String getPasswordHash() { return passwordHash; }
}

class AuthService {
    private final UserRepository repository;
    private final PasswordHasher hasher;
    private final TokenGenerator tokenGenerator;

    AuthService(UserRepository repository,
                PasswordHasher hasher,
                TokenGenerator tokenGenerator) {
        if (repository == null || hasher == null || tokenGenerator == null) {
            throw new IllegalArgumentException("Зависимости не могут быть null");
        }
        this.repository = repository;
        this.hasher = hasher;
        this.tokenGenerator = tokenGenerator;
    }

    String login(String email, String password) {
        User user = repository.findByEmail(email);
        if (user == null || !hasher.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Неверный логин или пароль");
        }
        return tokenGenerator.generate(user.getId());
    }
}
```

Заглушки:

```java
class FakeUserRepository implements UserRepository {
    private final User user;

    FakeUserRepository(User user) {
        this.user = user;
    }

    @Override
    public User findByEmail(String email) {
        if (user != null && user.getEmail().equals(email)) {
            return user;
        }
        return null;
    }
}

class FakePasswordHasher implements PasswordHasher {
    @Override
    public String hash(String password) {
        return password;
    }

    @Override
    public boolean matches(String password, String hash) {
        return password.equals("correct");
    }
}

class FakeTokenGenerator implements TokenGenerator {
    @Override
    public String generate(long userId) {
        return "fake-token-" + userId;
    }
}
```

Использование:

```java
User alice = new User(1L, "alice@example.com", "whatever");
AuthService service = new AuthService(
    new FakeUserRepository(alice),
    new FakePasswordHasher(),
    new FakeTokenGenerator()
);

System.out.println(service.login("alice@example.com", "correct"));
// fake-token-1

try {
    service.login("alice@example.com", "wrong");
} catch (IllegalArgumentException e) {
    System.out.println(e.getMessage());   // Неверный логин или пароль
}
```

**Что изменилось в тестируемости `AuthService`.**

**До рефакторинга:** `AuthService` создавал `JpaUserRepository`, `BcryptHasher(12)`, `JwtTokenGenerator("secret")`. Чтобы протестировать `login`, нужно было:
- поднять PostgreSQL (для `JpaUserRepository`);
- подождать, пока bcrypt хеширует (медленно);
- проверить, что JWT «правильный» (что требует разбора токена).

Тесты медленные, требуют инфраструктуры, «мигают».

**После рефакторинга:** `AuthService` принимает зависимости через конструктор. В тестах:
- `FakeUserRepository` возвращает заранее заданного пользователя;
- `FakePasswordHasher` возвращает `true` для пароля `"correct"` — без bcrypt;
- `FakeTokenGenerator` возвращает фиксированный токен — без JWT.

Тесты быстрые, детерминированные, без инфраструктуры.

**Какие тесты теперь можно написать, которых раньше не было:**

- «Если пользователь не найден, — `IllegalArgumentException`» — `FakeUserRepository` возвращает `null`.
- «Если пароль неверный, — `IllegalArgumentException`» — `FakePasswordHasher` возвращает `false`.
- «Если всё верно, — возвращается токен» — `FakeTokenGenerator` возвращает фиксированный.
- «Токен генерируется с правильным `userId`» — `FakeTokenGenerator` записывает вызовы.
- «`repository.findByEmail` вызывается ровно один раз» — `FakeUserRepository` считает вызовы.

Все эти тесты **невозможны** без DI, потому что настоящие `JpaUserRepository`, `BcryptHasher` и `JwtTokenGenerator` «съели» бы весь контроль.

**Мораль.** DI через конструктор — это не «плюс балл к красоте», а **условие** тестируемости. Если класс не получает зависимости снаружи — он привязан к инфраструктуре, и тестировать его можно только «через интеграционные тесты».

## Задача 6. Фасад для подсистемы

```java
class Projector {
    void on() { System.out.println("Проектор включён"); }
    void off() { System.out.println("Проектор выключен"); }
    void setInput(String input) { System.out.println("Вход: " + input); }
}

class SoundSystem {
    void on() { System.out.println("Звук включён"); }
    void off() { System.out.println("Звук выключен"); }
    void setVolume(int volume) { System.out.println("Громкость: " + volume); }
}

class DvdPlayer {
    void on() { System.out.println("DVD включён"); }
    void off() { System.out.println("DVD выключен"); }
    void play(String movie) { System.out.println("Играет: " + movie); }
}

class Lights {
    void dim() { System.out.println("Свет приглушён"); }
    void on() { System.out.println("Свет включён"); }
}

class Screen {
    void down() { System.out.println("Экран опущен"); }
    void up() { System.out.println("Экран поднят"); }
}

class HomeTheaterFacade {
    private final Projector projector;
    private final SoundSystem sound;
    private final DvdPlayer dvd;
    private final Lights lights;
    private final Screen screen;

    HomeTheaterFacade(Projector projector, SoundSystem sound,
                      DvdPlayer dvd, Lights lights, Screen screen) {
        if (projector == null || sound == null || dvd == null
                || lights == null || screen == null) {
            throw new IllegalArgumentException("Компоненты не могут быть null");
        }
        this.projector = projector;
        this.sound = sound;
        this.dvd = dvd;
        this.lights = lights;
        this.screen = screen;
    }

    void watchMovie(String movie) {
        projector.on();
        projector.setInput("DVD");
        sound.on();
        sound.setVolume(10);
        dvd.on();
        screen.down();
        lights.dim();
        dvd.play(movie);
    }

    void endMovie() {
        dvd.off();
        screen.up();
        lights.on();
        sound.off();
        projector.off();
    }
}
```

Использование:

```java
HomeTheaterFacade theater = new HomeTheaterFacade(
    new Projector(), new SoundSystem(),
    new DvdPlayer(), new Lights(), new Screen()
);

theater.watchMovie("Интерстеллар");
theater.endMovie();
```

**Должен ли `HomeTheaterFacade` принимать зависимости через конструктор или создавать сам?**

**Через конструктор** — правильно. Причин несколько:

- **Тестируемость.** В тестах можно подставить «заглушки» компонентов (например, `FakeProjector`, который записывает вызовы), и проверить, что `watchMovie` вызывает нужные методы в нужном порядке.
- **Гибкость.** Можно собрать фасад из **разных** реализаций (например, `SmartProjector` вместо `Projector`). Фасад не знает про конкретные классы.
- **Явные зависимости.** По сигнатуре конструктора сразу видно, что нужно фасаду: проектор, звук, DVD, свет, экран. Это документация.

**Через создание внутри** — неправильно. Тогда фасад привязан к конкретным классам, тестировать сложно, заменить нельзя. Это то же самое, что мы обсуждали в уроке про DI.

**Что должен делать фасад, если `projector.on()` бросил исключение?**

Зависит от того, какая семантика у сценария.

**Вариант «прервать»:** если проектор не включился, — нет смысла продолжать. Сценарий прерывается, ресурсы не освобождаются (звук не включён, DVD не включён, экран не опущен). Клиент получает исключение и решает, что делать.

**Вариант «продолжить с логированием»:** если проектор не включился, — залогировать ошибку, но продолжить. Сценарий «частично выполнится»: звук включится, DVD включится, но без проектора. Клиент получит «что-то», не «всё или ничего».

**Вариант «откатить»:** если проектор не включился, — откатить всё, что успели сделать. `projector.off()`, `sound.off()`, `dvd.off()`, `screen.up()`, `lights.on()`. Это сложно: нужно отслеживать, что уже сделано, и вызывать «обратные» методы.

В **нашей** задаче `watchMovie` — это «сценарий», и «прервать» — самый простой вариант. Клиент получает исключение и понимает, что сценарий не выполнился. В реальной системе стоило бы **откатывать** — но это уже отдельная логика, и её лучше вынести в «сервис», а не в фасад.

**Если завтра понадобится третий сценарий (например, «играть в игру»), — сколько файлов придётся менять?**

Только `HomeTheaterFacade` — добавить метод `playGame()`. Все компоненты (`Projector`, `SoundSystem`, `DvdPlayer`, `Lights`, `Screen`) — не меняются. Это главное преимущество фасада: подсистема стабильна, фасад «собирает» из неё сценарии.

**Мораль.** Фасад — это «сборник типичных сценариев». Добавление нового сценария — добавление одного метода в фасад. Подсистема не меняется.

## Задача 7. Проект — «умный дом»

Покажу один из разумных вариантов.

### Компоненты

```java
interface Switchable {
    void on();
    void off();
    boolean isOn();
}

interface Securable {
    void arm();
    void disarm();
    boolean isArmed();
}

interface Openable {
    void open();
    void close();
    boolean isOpen();
}

final class Light implements Switchable {
    private boolean on = false;

    @Override public void on() { on = true; System.out.println("Свет включён"); }
    @Override public void off() { on = false; System.out.println("Свет выключен"); }
    @Override public boolean isOn() { return on; }

    void dim() { System.out.println("Свет приглушён"); }
}

final class Thermostat implements Switchable {
    private boolean on = false;
    private int temperature = 20;

    @Override public void on() { on = true; System.out.println("Отопление включено"); }
    @Override public void off() { on = false; System.out.println("Отопление выключено"); }
    @Override public boolean isOn() { return on; }

    void setTemperature(int t) {
        if (t < 0 || t > 40) {
            throw new IllegalArgumentException("Недопустимая температура: " + t);
        }
        temperature = t;
        System.out.println("Температура: " + t);
    }

    int getTemperature() { return temperature; }
}

final class SecuritySystem implements Securable {
    private boolean armed = false;

    @Override public void arm() { armed = true; System.out.println("Охрана включена"); }
    @Override public void disarm() { armed = false; System.out.println("Охрана снята"); }
    @Override public boolean isArmed() { return armed; }
}

final class MusicSystem implements Switchable {
    private boolean on = false;

    @Override public void on() { on = true; System.out.println("Музыка включена"); }
    @Override public void off() { on = false; System.out.println("Музыка выключена"); }
    @Override public boolean isOn() { return on; }

    void play(String track) { System.out.println("Играет: " + track); }
    void setVolume(int v) { System.out.println("Громкость: " + v); }
}

final class Window implements Openable {
    private boolean open = false;

    @Override public void open() { open = true; System.out.println("Окно открыто"); }
    @Override public void close() { open = false; System.out.println("Окно закрыто"); }
    @Override public boolean isOpen() { return open; }
}

final class CoffeeMachine implements Switchable {
    private boolean on = false;

    @Override public void on() { on = true; System.out.println("Кофемашина включена"); }
    @Override public void off() { on = false; System.out.println("Кофемашина выключена"); }
    @Override public boolean isOn() { return on; }

    void brew() {
        if (!on) on();
        System.out.println("Кофе варится");
    }
}
```

**Решения.** Все компоненты `final` — потому что они «готовые изделия», не планируется наследоваться. Интерфейсы — маленькие (`Switchable`, `Securable`, `Openable`) — по одному «навыку». Это **не** «божественный интерфейс» `SmartDevice` с двадцатью методами. О таких вещах будем говорить в модуле 6 (принцип ISP).

**Что можно улучшить.** `Light.dim()` не входит в `Switchable` — потому что не все «включаемые» умеют приглушаться. Это правильно: интерфейс должен содержать **только** те методы, которые имеют смысл для **всех** реализаций. Если бы `dim()` был в `Switchable`, — `Thermostat` и `CoffeeMachine` вынуждены были бы его реализовывать (или бросать `UnsupportedOperationException`), что нарушило бы принцип подстановки (LSP). Об этом — в модуле 6.

### Фасад

```java
final class SmartHomeFacade {
    private final Light light;
    private final Thermostat thermostat;
    private final SecuritySystem security;
    private final MusicSystem music;
    private final Window window;
    private final CoffeeMachine coffee;

    SmartHomeFacade(Light light, Thermostat thermostat,
                    SecuritySystem security, MusicSystem music,
                    Window window, CoffeeMachine coffee) {
        if (light == null || thermostat == null || security == null
                || music == null || window == null || coffee == null) {
            throw new IllegalArgumentException("Компоненты не могут быть null");
        }
        this.light = light;
        this.thermostat = thermostat;
        this.security = security;
        this.music = music;
        this.window = window;
        this.coffee = coffee;
    }

    void arriveHome() {
        security.disarm();
        light.on();
        thermostat.on();
        thermostat.setTemperature(22);
        window.open();
    }

    void leaveHome() {
        light.off();
        thermostat.off();
        security.arm();
        window.close();
        coffee.off();
    }

    void movieMode() {
        light.dim();
        window.close();
        music.on();
        music.setVolume(5);
        music.play("Soundtrack");
        thermostat.setTemperature(20);
    }

    void morningRoutine() {
        security.disarm();
        light.on();
        coffee.brew();
        music.on();
        music.play("Morning");
    }

    void goodNight() {
        light.off();
        thermostat.off();
        security.arm();
        window.close();
        music.off();
    }
}
```

**Решения.** Фасад `final` — потому что наследоваться от него не планируется, и `final` защищает от неожиданных наследников. Все зависимости — через конструктор (DI). Внутри — только вызовы компонентов, никакой бизнес-логики. Каждый метод — «сценарий», который «собирает» вызовы компонентов.

### Сценарий проверки

```java
public class Main {
    public static void main(String[] args) {
        // Создаём компоненты
        Light light = new Light();
        Thermostat thermostat = new Thermostat();
        SecuritySystem security = new SecuritySystem();
        MusicSystem music = new MusicSystem();
        Window window = new Window();
        CoffeeMachine coffee = new CoffeeMachine();

        // Собираем фасад
        SmartHomeFacade home = new SmartHomeFacade(
            light, thermostat, security, music, window, coffee
        );

        System.out.println("=== Пришли домой ===");
        home.arriveHome();

        System.out.println("\n=== Режим кино ===");
        home.movieMode();

        System.out.println("\n=== Доброй ночи ===");
        home.goodNight();

        System.out.println("\n=== Уходим (дважды) ===");
        home.leaveHome();
        home.leaveHome();   // второй раз — не ломается
    }
}
```

Ожидаемый вывод:

```
=== Пришли домой ===
Охрана снята
Свет включён
Отопление включено
Температура: 22
Окно открыто

=== Режим кино ===
Свет приглушён
Окно закрыто
Музыка включена
Громкость: 5
Играет: Soundtrack
Температура: 20

=== Доброй ночи ===
Свет выключен
Отопление выключено
Охрана включена
Окно закрыто
Музыка выключена

=== Уходим (дважды) ===
Свет выключен
Отопление выключено
Охрана включена
Окно закрыто
Кофемашина выключена
Свет выключен
Отопление выключено
Охрана включена
Окно закрыто
Кофемашина выключена
```

**Что можно улучшить.**

**Первое.** `leaveHome()` идемпотентен: вызов дважды не ломается (второй раз просто «выключает то, что уже выключено»). Это **хорошо** — сценарий «ушёл» можно вызывать сколько угодно. Но если бы `Light.on()` бросал исключение при повторном вызове, — пришлось бы добавлять проверки. В нашей реализации `on()`/`off()` идемпотентны — поэтому всё работает.

**Второе.** `arriveHome()` **не** выключает кофемашину. Если она была включена, — останется. Это может быть как «правильно» (если вы оставили её специально), так и «неправильно» (если забыли выключить). В реальной системе стоило бы добавить `coffee.off()` или явно сказать, что «кофемашина не трогается». Это — бизнес-решение.

**Третье.** `SmartHomeFacade` **не** Singleton. В реальном приложении, вероятно, фасад один (один «умный дом»), но делать его Singleton'ом **не обязательно** — можно просто создать один экземпляр в `main` и передавать, куда нужно. Singleton — глобальное состояние, которое часто приносит больше проблем, чем пользы.

### Ответы на вопросы

**1. Новый компонент `SmartLock`.** Придётся добавить:
- класс `SmartLock` (1 файл);
- интерфейс, если у него есть «навык», которого нет у других (например, `Lockable`) — 1 файл;
- поле в `SmartHomeFacade` и, возможно, в конструкторе — 1 файл (изменение);
- новые сценарии, если нужно (`lockDoors()`) — 1 файл (изменение).

Итого — 3–4 файла. Все существующие сценарии **не меняются**. Это главное преимущество: расширение через добавление, а не через изменение.

**2. Второй сценарий «гости».** Добавляется **один** метод в `SmartHomeFacade` — `guestsArrive()` с нужными вызовами. Компоненты не меняются. Это то же самое: фасад — «сборник сценариев», новый сценарий — новый метод.

**3. Логирование каждого вызова компонента.** Не меняя компоненты — через **декоратор**. Создаём `LoggingSwitchable`, `LoggingSecurable` и т. д., которые оборачивают настоящий компонент и логируют вызов:

```java
class LoggingSwitchable implements Switchable {
    private final Switchable delegate;
    private final Logger logger;

    LoggingSwitchable(Switchable delegate, Logger logger) {
        this.delegate = delegate;
        this.logger = logger;
    }

    @Override public void on() {
        logger.log(delegate.getClass().getSimpleName() + ".on()");
        delegate.on();
    }
    // ... и так далее для всех методов
}
```

Затем в `main`:

```java
Light light = new Light();
Switchable loggedLight = new LoggingSwitchable(light, logger);
SmartHomeFacade home = new SmartHomeFacade(loggedLight, ...);
```

Теперь **каждый** вызов `light.on()` логируется, хотя `Light` ничего не знает про логирование. Это декоратор — паттерн, о котором будем говорить в модуле 6. Пока что просто запомните идею: **обернуть объект в другой объект с тем же интерфейсом** и добавить логирование.

**4. Один `Light` в двух фасадах.** Это **нормально** — это **агрегация**. `Light` не «принадлежит» фасаду, он «используется» фасадом. Два фасада могут использовать один `Light` — например, `SmartHomeFacade` для «дома» и `OfficeFacade` для «офиса», если это один и тот же физический свет (странно, но технически возможно). В нашей задаче — вряд ли нужно, но технически — работает.

**5. Нужен ли `SmartHomeFacade` Singleton?** **Не обязательно.** В реальном приложении фасад один, но это можно обеспечить **вручную** — создать один экземпляр в `main` и передавать, куда нужно. Singleton — это **глобальное состояние**, и оно часто приносит больше проблем, чем пользы (сложно тестировать, сложно менять). Лучше — обычный класс, один экземпляр которого создаётся в `main`. Если очень нужно — DI-контейнер сам сделает его Singleton'ом.

### Что можно улучшить

**Первое.** `SmartHomeFacade` — `final`. Это правильно: наследоваться от него не планируется. Но если кто-то захочет добавить «сценарий для конкретного дома», — придётся либо сделать его не-`final`, либо использовать композицию (обернуть фасад в другой фасад). Оба варианта — рабочие; выбор зависит от того, планируется ли расширение.

**Второе.** `arriveHome`, `leaveHome`, `movieMode` и т. д. — это **«сценарии»**. Если их станет много (десять, двадцать), — `SmartHomeFacade` разрастётся. В реальной системе стоит вынести каждый сценарий в **отдельный класс** `Scenario` с методом `execute()`. Тогда `SmartHomeFacade` будет «сборником сценариев»: `home.execute("arrive")`. Это паттерн «Команда» (Command). Мы его не проходим, но полезно знать, что он есть.

**Третье.** Компоненты **не** знают друг о друге. `Light` не знает про `Thermostat`, `SecuritySystem` не знает про `Window`. Это **хорошо**: каждый компонент — «кирпичик», из которого фасад собирает сценарии. Если бы `Light` знал про `SecuritySystem` (например, «включаться только когда охрана снята»), — это была бы **связанность**, которую сложно менять.

**Четвёртое.** `LoggingSwitchable` — пример декоратора. Если вы хотите логировать **все** компоненты, — обернуть каждый. Если хотите логировать **только** некоторые — обернуть только их. Декоратор даёт гибкость: «хочу логирование» — обернул, «не хочу» — не обернул.

Все эти замечания — не «ошибки» учебного решения, а **точки роста**. Хорошее учебное решение — то, которое работает и понятно. Понимание того, что можно улучшить, — уже следующий шаг.