---
title: Разбор практикума — Проектирование и SOLID
description: Решения семи задач шестого модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Проектирование и SOLID

## Как читать этот разбор

Решения ниже — не единственно правильные. В SOLID особенно много «зависит от контекста»: иногда нарушение оправдано, иногда нет. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и обосновано — оно тоже правильное.

Обращайте внимание не столько на код, сколько на обоснования. В SOLID «почему это нарушение» — не менее важный вопрос, чем «как переписать».

## Задача 1. Диагностика SRP

Разберём `OrderManager` по причинам для изменения.

**Группы методов по темам:**

- **Модель заказа:** `addOrder`, `findById`, `calculateTotal`, `applyDiscount`.
- **Хранение:** `saveToDatabase`.
- **Форматирование:** `toJson`.
- **Уведомления:** `sendConfirmationEmail`.

**Причины для изменения (и акторы):**

1. «Изменились правила работы с заказами» — бизнес-аналитик. → `addOrder`, `findById`, `calculateTotal`, `applyDiscount`.
2. «Изменилась схема БД» — DBA. → `saveToDatabase`.
3. «Изменился формат JSON» — разработчик API. → `toJson`.
4. «Изменился шаблон письма» — маркетолог. → `sendConfirmationEmail`.

**Вывод:** четыре причины для изменения, четыре разных актора. Класс нарушает SRP.

**Как разделить:**

```java
class OrderRepository {
    private final List<Order> orders = new ArrayList<>();

    void save(Order order) { orders.add(order); }

    Order findById(String id) {
        return orders.stream().filter(o -> o.getId().equals(id)).findFirst().orElse(null);
    }

    List<Order> findAll() { return List.copyOf(orders); }
}

class OrderCalculator {
    double total(Order order) {
        return order.getItems().stream().mapToDouble(Item::getPrice).sum();
    }

    void applyDiscount(Order order, double percent) {
        // ... применяет скидку ...
    }
}

class OrderJsonSerializer {
    String toJson(Order order) {
        return "{\"id\":\"" + order.getId() + "\"}";
    }
}

class OrderNotifier {
    void sendConfirmation(Order order) {
        // ... отправляет email ...
    }
}
```

Теперь четыре класса, каждый — своя ответственность. `Order` — модель (не показан, но логически отдельно).

**Мораль.** SRP — это про «причины для изменения», а не про «методы». В `OrderManager` четыре причины, четыре разных актора. Разделение — очевидно.

**Что можно улучшить.** `OrderRepository` хранит заказы в `List` — это нормально для тестов, но в реальной системе — через БД. `OrderCalculator` — не «сервис», а «утилита»; его методы можно сделать `static`, если он не имеет состояния. `OrderNotifier` — тоже «сервис» с одной ответственностью.

## Задача 2. Диагностика OCP

`FileExporter` нарушает OCP. Причины:

- при добавлении формата `xml` — **меняется** `FileExporter` (новый `else if`);
- при добавлении формата `markdown` — **меняется** `FileExporter` (новый `else if`);
- если кто-то забудет обновить `FileExporter` — он упадёт с `IllegalArgumentException` в **runtime**, компилятор не подскажет;
- **минимальное** изменение для OCP — заменить `if/else` на `Map<String, Exporter>` с интерфейсом `Exporter`.

**Как переписать:**

```java
interface Exporter {
    void export(Report report, String path);
}

class CsvExporter implements Exporter { /* ... */ }
class PdfExporter implements Exporter { /* ... */ }
class HtmlExporter implements Exporter { /* ... */ }
class XlsxExporter implements Exporter { /* ... */ }

class FileExporter {
    private final Map<String, Exporter> exporters;

    FileExporter(Map<String, Exporter> exporters) {
        this.exporters = exporters;
    }

    void export(Report report, String format) {
        Exporter exporter = exporters.get(format);
        if (exporter == null) {
            throw new IllegalArgumentException("Неизвестный формат: " + format);
        }
        exporter.export(report, "output." + format);
    }
}
```

Сборка в `main`:

```java
FileExporter exporter = new FileExporter(Map.of(
    "csv",  new CsvExporter(),
    "pdf",  new PdfExporter(),
    "html", new HtmlExporter(),
    "xlsx", new XlsxExporter()
));
```

Теперь добавление `xml` — новый класс `XmlExporter` и одна строчка в `main`. `FileExporter` не меняется.

**Что мы потеряли.** `FileExporter` **не знает** о форматах, которые не зарегистрированы. Если в `main` забыли `Map.of("markdown", ...)`, — `FileExporter` не подскажет. Это цена, которую платят за гибкость: **конфигурация** становится явной, но её нужно **не забыть**.

**Мораль.** OCP — это про «новое поведение через новый код». `if/else` — это «новое поведение через изменение старого». Замена — на `Map` + `interface`.

**Что можно улучшить.** `Map<String, Exporter>` — не единственный вариант. Можно — `List<Exporter>` с методом `supports(format)`, если формат определяется не строкой, а как-то иначе. Но для строкового формата `Map` — самое простое.

## Задача 3. Диагностика LSP

`Account.withdraw` **обещает**: «если `amount <= balance`, — снимется». `SavingsAccount.withdraw` **не выполняет** это обещание: если `balance - amount < MIN_BALANCE`, — бросает исключение. Это **усиление предусловия**: `SavingsAccount` требует «не только amount <= balance, но ещё balance - amount >= 1000». Клиент `Account`, который ожидает «amount <= balance → успех», с `SavingsAccount` **сломается**.

**LSP нарушен.**

**Как переписать.**

**Вариант 1: не наследовать.** `SavingsAccount` — **отдельный** класс, не связанный с `Account` через `extends`. Общий интерфейс `Account` с методом `withdraw`, но `SavingsAccount` — **самостоятельная** реализация. Клиент, который ожидает **любой** `Account`, — работает с **любой** реализацией **одинаково** (потому что `withdraw` работает по контракту).

Но в нашем случае контракт `Account` уже **включает** «amount <= balance → успех», а `SavingsAccount` его **нарушает**. Значит, вариант 1 требует **изменения контракта** `Account`.

**Вариант 2: изменить контракт `Account`.** Добавить в `Account` метод `getMinimumBalance()` (по умолчанию `0`), и `withdraw` в `Account` **учитывает** этот минимум:

```java
class Account {
    protected double balance;

    double getMinimumBalance() { return 0; }

    void withdraw(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Сумма должна быть положительной");
        if (balance - amount < getMinimumBalance()) {
            throw new IllegalStateException("Недостаточно средств с учётом минимального баланса");
        }
        balance -= amount;
    }
}

class SavingsAccount extends Account {
    @Override
    double getMinimumBalance() { return 1000; }
}
```

Теперь `SavingsAccount` **не переопределяет** `withdraw` — он только **изменяет** `getMinimumBalance`. `Account.withdraw` **работает одинаково** для всех: проверяет `balance - amount >= getMinimumBalance()`. LSP **соблюдён**: любой клиент `Account` может вызвать `withdraw` и получить **одинаковое поведение** (с учётом `getMinimumBalance`, который **документирован**).

**Вариант 3: композиция.** `SavingsAccount` **содержит** `Account` и **делегирует** ему `deposit`/`getBalance`, но `withdraw` реализует **сам**. Клиент работает с `SavingsAccount` **напрямую**, не через `Account`. LSP **не применяется** (нет подстановки). Это тоже работает, но теряется «общий контракт» — если у вас есть `List<Account>`, `SavingsAccount` туда **не положить**.

**Мораль.** LSP — это про **контракт**, а не про формальное наследование. Если контракт родителя **не выполняется** наследником — либо **не наследовать**, либо **изменить контракт родителя** так, чтобы он **покрывал** все варианты.

**Что можно улучшить.** `getMinimumBalance()` — хороший пример «шаблонного метода»: `Account` **определяет** логику, а наследник **задаёт параметр**. Это OCP (не меняя `withdraw`, можно менять поведение) и LSP (контракт соблюдается).

## Задача 4. Рефакторинг SRP и ISP

Разделим `UserOperations` на несколько маленьких интерфейсов.

```java
interface ReadableUserRepository {
    User findById(long id);
    User findByEmail(String email);
    List<User> findAll();
}

interface WritableUserRepository {
    void save(User user);
    void update(User user);
    void delete(long id);
}

interface UserEmailService {
    void sendWelcomeEmail(User user);
    void sendPasswordResetEmail(User user, String token);
}

interface UserCsvExporter {
    void exportToCsv(List<User> users, String path);
}
```

Теперь `UserService` реализует только те, что имеют смысл:

```java
class UserService implements ReadableUserRepository, WritableUserRepository {
    private final Map<Long, User> users = new HashMap<>();

    @Override
    public User findById(long id) { return users.get(id); }

    @Override
    public User findByEmail(String email) {
        return users.values().stream()
            .filter(u -> u.getEmail().equals(email))
            .findFirst().orElse(null);
    }

    @Override
    public List<User> findAll() { return new ArrayList<>(users.values()); }

    @Override
    public void save(User user) { users.put(user.getId(), user); }

    @Override
    public void update(User user) { users.put(user.getId(), user); }

    @Override
    public void delete(long id) { users.remove(id); }
}
```

Email и экспорт — **отдельные** классы:

```java
class UserEmailService {
    private final EmailSender sender;

    UserEmailService(EmailSender sender) {
        this.sender = sender;
    }

    void sendWelcomeEmail(User user) {
        sender.send(user.getEmail(), "Добро пожаловать!");
    }

    void sendPasswordResetEmail(User user, String token) {
        sender.send(user.getEmail(), "Ваш токен: " + token);
    }
}

class UserCsvExporter {
    void exportToCsv(List<User> users, String path) {
        // ... запись в CSV ...
    }
}
```

Клиент, которому нужен **только** `findById`:

```java
class UserReportService {
    private final ReadableUserRepository repository;

    UserReportService(ReadableUserRepository repository) {
        this.repository = repository;
    }

    void report(long id) {
        User user = repository.findById(id);
        System.out.println(user);
    }
}
```

Теперь `UserReportService` **не зависит** от `save`, `delete`, `sendWelcomeEmail`, `exportToCsv`. Только от `findById`. ISP **соблюдён**.

**Если клиенту нужны и `findById`, и `save`:**

```java
class UserAdminService {
    private final ReadableUserRepository reader;
    private final WritableUserRepository writer;

    UserAdminService(ReadableUserRepository reader, WritableUserRepository writer) {
        this.reader = reader;
        this.writer = writer;
    }

    // использует оба
}
```

Клиент **зависит** от двух интерфейсов сразу. Это **не** нарушает ISP: `UserAdminService` **использует** и `reader`, и `writer`. Он **зависит** ровно от того, что **использует**.

**Мораль.** ISP — это про «клиент зависит от того, что использует». Разделяя интерфейсы, вы **уменьшаете** зависимости. Если клиенту нужно **два** интерфейса — он **зависит** от **двух**. Это нормально.

**Что можно улучшить.** `ReadableUserRepository.findAll()` может быть **не нужен** клиентам, которым нужен только `findById`. Можно разделить дальше: `UserFinder` (findById, findByEmail) и `UserLister` (findAll). Но это уже «на грани» — если **все** клиенты используют `findAll` **только** вместе с `findById`, — разделять не стоит. ISP — **эвристика**, а не «разделяй до бесконечности».

## Задача 5. Рефакторинг OCP и DIP

Введём интерфейс `NotificationChannel`:

```java
interface NotificationChannel {
    void send(String to, String message);
}
```

Конкретные реализации:

```java
class EmailChannel implements NotificationChannel {
    private final SmtpClient smtp;

    EmailChannel(SmtpClient smtp) { this.smtp = smtp; }

    public void send(String to, String message) {
        smtp.send(to, message);
    }
}

class SmsChannel implements NotificationChannel {
    private final SmsGateway gateway;

    SmsChannel(SmsGateway gateway) { this.gateway = gateway; }

    public void send(String to, String message) {
        gateway.sendSms(to, message);
    }
}

class PushChannel implements NotificationChannel {
    private final FirebaseClient firebase;

    PushChannel(FirebaseClient firebase) { this.firebase = firebase; }

    public void send(String to, String message) {
        firebase.push(to, message);
    }
}
```

`NotificationService` теперь:

```java
class NotificationService {
    private final Map<String, NotificationChannel> channels;

    NotificationService(Map<String, NotificationChannel> channels) {
        this.channels = channels;
    }

    void send(String type, String to, String message) {
        NotificationChannel channel = channels.get(type);
        if (channel == null) {
            throw new IllegalArgumentException("Неизвестный канал: " + type);
        }
        channel.send(to, message);
    }
}
```

Сборка в `main`:

```java
NotificationService service = new NotificationService(Map.of(
    "email", new EmailChannel(new SmtpClient("smtp.example.com")),
    "sms",   new SmsChannel(new SmsGateway("api-key")),
    "push",  new PushChannel(new FirebaseClient())
));
```

**Что мы выиграли:**

- **OCP:** добавление нового канала — новый класс + одна строчка в `main`. `NotificationService` не меняется.
- **DIP:** `NotificationService` зависит от `NotificationChannel` (абстракции), а не от `SmtpClient`/`SmsGateway`/`FirebaseClient` (деталей). `EmailChannel` **сам** создаёт `SmtpClient`? Нет — **принимает** через конструктор. DI есть **везде**.

**Что потеряли:**

- **Конфигурация усложнилась.** Раньше `NotificationService` **сам знал** про каналы, теперь — **никто не знает**, пока не посмотришь в `main`. Это **не проблема**, но **цена** гибкости.
- **Если в `Map` нет канала** — `IllegalArgumentException` **в runtime**. Раньше `if/else` тоже падал, но **с явным** списком каналов в коде. Теперь — **зависит** от `main`. Это **та же** проблема, что и в задаче 2.

**Что произойдёт, если в `main` не зарегистрированы все реализации:**

`NotificationService` **не узнает** об этом. Если клиент вызовет `send("telegram", ...)`, а `telegram` не зарегистрирован, — получит `IllegalArgumentException`. Это **правильное** поведение: сервис **не знает** о каналах, которые не зарегистрированы. Регистрация — **ответственность** того, кто собирает систему (в `main`).

**Как клиент узнает о доступных каналах:** либо **документацией** (`main` — источник истины), либо **методом** `getAvailableChannels()` в `NotificationService` (который вернёт `channels.keySet()`). Второй вариант — **лучше**, если клиенту нужно **выбирать** канал.

**Мораль.** OCP и DIP **работают вместе**: интерфейс (DIP) + `Map` (OCP). Один — про **направление** зависимости, другой — про **расширяемость**.

**Что можно улучшить.** `NotificationChannel` можно **не** создавать — использовать стандартный `Consumer<String>` из `java.util.function`. Но тогда **теряется** семантика («канал уведомлений»), и код **менее** читаем. Свой интерфейс — **лучше**.

## Задача 6. Рефакторинг LSP

Вернёмся к `Account`/`SavingsAccount`. Вариант из задачи 3 — через `getMinimumBalance()`:

```java
class Account {
    protected double balance;

    double getMinimumBalance() { return 0; }

    void deposit(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Сумма должна быть положительной");
        balance += amount;
    }

    void withdraw(double amount) {
        if (amount <= 0) throw new IllegalArgumentException("Сумма должна быть положительной");
        if (balance - amount < getMinimumBalance()) {
            throw new IllegalStateException("Недостаточно средств с учётом минимального баланса");
        }
        balance -= amount;
    }

    double getBalance() { return balance; }
}

class SavingsAccount extends Account {
    @Override
    double getMinimumBalance() { return 1000; }
}
```

**Тест на LSP:**

```java
void testWithdraw(Account account) {
    account.deposit(5000);
    account.withdraw(4000);
    if (account.getBalance() != 1000) {
        throw new AssertionError("Ожидался баланс 1000, получен " + account.getBalance());
    }
}

testWithdraw(new Account());         // balance = 1000, OK
testWithdraw(new SavingsAccount());  // balance = 1000, OK
```

Оба варианта **проходят**. LSP **соблюдён**.

**Что будет с `PremiumAccount` (овердрафт):**

`PremiumAccount` разрешает отрицательный баланс. Это **другой** контракт: «можно уйти в минус». `getMinimumBalance()` **не подходит** — там минимум **положительный** или ноль, а тут — **отрицательный**.

**Вариант 1:** `getMinimumBalance()` может возвращать **отрицательное** значение (например, `-10000`). Тогда `PremiumAccount`:

```java
class PremiumAccount extends Account {
    @Override
    double getMinimumBalance() { return -10000; }
}
```

`withdraw` **работает** без изменений: `balance - amount >= -10000`. Овердрафт до 10 000. LSP **соблюдён** (контракт тот же, только параметр другой).

**Вариант 2:** если `PremiumAccount` имеет **другие** правила (например, «проценты на отрицательный баланс»), — это **другая** ответственность. Возможно, `PremiumAccount` **не должен** наследоваться от `Account` — а **содержать** его. Но для базового овердрафта вариант 1 достаточен.

**Мораль.** LSP — это про **контракт**, а не про **формальное** наследование. Если контракт можно **параметризовать** (как `getMinimumBalance`), — LSP соблюдается **проще**, чем если бы пришлось переопределять **метод** `withdraw`.

## Задача 7. Проект — Платёжный сервис

Покажу один из разумных вариантов. В комментариях — ключевые решения.

### Модель

```java
final class Money { /* как в уроке 7 */ }

enum PaymentStatus { CREATED, VALIDATED, SUCCESS, FAILED, REFUNDED }

final class Payment {
    private final String id;
    private final Order order;
    private final Money amount;
    private final PaymentMethod method;
    private PaymentStatus status;
    private int attempts;

    Payment(String id, Order order, Money amount, PaymentMethod method) {
        if (id == null || order == null || amount == null || method == null) {
            throw new IllegalArgumentException("Все поля обязательны");
        }
        this.id = id;
        this.order = order;
        this.amount = amount;
        this.method = method;
        this.status = PaymentStatus.CREATED;
        this.attempts = 0;
    }

    String getId() { return id; }
    Order getOrder() { return order; }
    Money getAmount() { return amount; }
    PaymentMethod getMethod() { return method; }
    PaymentStatus getStatus() { return status; }
    int getAttempts() { return attempts; }

    void markValidated() { status = PaymentStatus.VALIDATED; }
    void markSuccess() { status = PaymentStatus.SUCCESS; }
    void markFailed() { status = PaymentStatus.FAILED; }
    void markRefunded() { status = PaymentStatus.REFUNDED; }
    void incrementAttempts() { attempts++; }
}
```

**Решения.** Поля `final` — модель неизменяема по составу. Статус меняется через методы с проверкой (как в уроке 7). `attempts` — счётчик попыток, увеличивается через `incrementAttempts`.

### Способы оплаты (DIP, LSP, ISP)

```java
interface PaymentMethod {
    String name();
    Money commission(Money amount);
    boolean process(Money amount);
}

final class CardPayment implements PaymentMethod {
    public String name() { return "card"; }
    public Money commission(Money amount) { return amount.multiply(new BigDecimal("0.02")); }
    public boolean process(Money amount) { return true; }
}

final class SbpPayment implements PaymentMethod {
    public String name() { return "sbp"; }
    public Money commission(Money amount) { return amount.multiply(new BigDecimal("0.005")); }
    public boolean process(Money amount) { return true; }
}

final class YooMoneyPayment implements PaymentMethod {
    public String name() { return "yoomoney"; }
    public Money commission(Money amount) { return amount.multiply(new BigDecimal("0.01")); }
    public boolean process(Money amount) { return true; }
}

final class CryptoPayment implements PaymentMethod {
    private static final Money LIMIT = new Money(new BigDecimal("100000"), "RUB");

    public String name() { return "crypto"; }
    public Money commission(Money amount) { return amount.multiply(new BigDecimal("0.05")); }
    public boolean process(Money amount) { return amount.compareTo(LIMIT) <= 0; }
}

final class BonusPayment implements PaymentMethod {
    private static final Money LIMIT = new Money(new BigDecimal("5000"), "RUB");

    public String name() { return "bonus"; }
    public Money commission(Money amount) { return Money.ZERO; }
    public boolean process(Money amount) { return amount.compareTo(LIMIT) <= 0; }
}
```

**Решения.** `PaymentMethod` — интерфейс с тремя методами. `name` — для выбора; `commission` — для расчёта; `process` — для проведения. Все реализации `final`.

**LSP.** Все реализации ведут себя **одинаково**: принимают `Money`, возвращают `boolean`. Никакая не бросает `UnsupportedOperationException`. LSP соблюдён.

**ISP.** Три метода — **не «толстый»** интерфейс. Клиенту, которому нужен только `commission`, — нужны все три (потому что `name` нужен для регистрации, а `process` — для проведения). Если бы у нас был **отдельный** интерфейс только для `commission` — это было бы **overengineering**: методы **всегда** используются вместе.

### Возврат (ISP)

```java
interface Refundable {
    boolean refund(Money amount);
}

final class CardPayment implements PaymentMethod, Refundable {
    // ...
    public boolean refund(Money amount) { return true; }
}

final class SbpPayment implements PaymentMethod, Refundable {
    // ...
    public boolean refund(Money amount) { return true; }
}

final class YooMoneyPayment implements PaymentMethod, Refundable {
    // ...
    public boolean refund(Money amount) { return true; }
}

final class CryptoPayment implements PaymentMethod, Refundable {
    // ...
    public boolean refund(Money amount) { return true; }
}

// BonusPayment НЕ реализует Refundable — возврат бонусов невозможен
```

**Решения.** `Refundable` — **отдельный** интерфейс. `BonusPayment` его **не реализует** — и это **правильно**: возврат бонусов **невозможен**, и клиент **не сможет** случайно вызвать `refund` у `BonusPayment` (компилятор не даст). ISP соблюдён.

### Сервис (DIP, OCP)

```java
class PaymentService {
    private final Map<String, PaymentMethod> methods;
    private final NotificationSender notifier;
    private final Logger logger;
    private static final int MAX_ATTEMPTS = 3;

    PaymentService(Map<String, PaymentMethod> methods,
                   NotificationSender notifier,
                   Logger logger) {
        if (methods == null || notifier == null || logger == null) {
            throw new IllegalArgumentException("Все зависимости обязательны");
        }
        this.methods = methods;
        this.notifier = notifier;
        this.logger = logger;
    }

    PaymentResult pay(Order order, String methodName, Money amount) {
        PaymentMethod method = methods.get(methodName);
        if (method == null) {
            logger.log("Неизвестный способ: " + methodName);
            return PaymentResult.failed("Неизвестный способ: " + methodName);
        }

        Payment payment = new Payment(UUID.randomUUID().toString(), order, amount, method);

        while (payment.getAttempts() < MAX_ATTEMPTS) {
            payment.incrementAttempts();
            logger.log("Попытка " + payment.getAttempts() + " через " + methodName);

            boolean success = method.process(amount);
            if (success) {
                payment.markSuccess();
                notifier.send(order.getCustomer().getEmail(), "Оплата успешна");
                return PaymentResult.success(payment);
            }
            logger.log("Попытка " + payment.getAttempts() + " неуспешна");
        }

        payment.markFailed();
        notifier.send(order.getCustomer().getEmail(), "Оплата не прошла");
        return PaymentResult.failed("Превышено количество попыток");
    }

    PaymentResult refund(Payment payment, Money amount) {
        if (!(payment.getMethod() instanceof Refundable refundable)) {
            return PaymentResult.failed("Возврат невозможен для " + payment.getMethod().name());
        }
        boolean success = refundable.refund(amount);
        if (success) {
            payment.markRefunded();
            logger.log("Возврат " + amount + " по платежу " + payment.getId());
            return PaymentResult.success(payment);
        }
        return PaymentResult.failed("Возврат не прошёл");
    }
}
```

**Решения.** `PaymentService` зависит от `Map<String, PaymentMethod>` (DIP), `NotificationSender` (DIP), `Logger` (DIP). Не знает **конкретных** способов — только `PaymentMethod`.

**Попытки.** `MAX_ATTEMPTS = 3` — константа. Если нужно **разное** количество для разных способов — это **не** «свойство сервиса», а «свойство способа». Можно добавить в `PaymentMethod` метод `maxAttempts()` с `default`-реализацией (3), и переопределить в `CryptoPayment` (1). Это **лучше**, но **не обязательно** для учебной задачи.

**Возврат.** `if (!(payment.getMethod() instanceof Refundable refundable))` — **явное** `instanceof`. Это **оправдано**? С одной стороны — да, потому что `Refundable` — это **опциональная** способность, а не **часть** контракта `PaymentMethod`. С другой стороны — **можно** сделать лучше: **отдельный** метод в `PaymentService` (не в `PaymentMethod`), который принимает `Refundable` явно. Но тогда клиент **должен** знать, что ему нужен `Refundable`. Оба варианта — **рабочие**; выбор — **по контексту**.

**Альтернатива без `instanceof`:**

```java
PaymentResult refund(Payment payment, Money amount) {
    return methods.get(payment.getMethod().name())
        .refundable()
        .map(r -> r.refund(amount) ? PaymentResult.success(payment) : PaymentResult.failed("Возврат не прошёл"))
        .orElseGet(() -> PaymentResult.failed("Возврат невозможен"));
}
```

Где `PaymentMethod` имеет `default Optional<Refundable> refundable() { return Optional.empty(); }`, а `CardPayment` переопределяет: `return Optional.of(this);`. Это **убирает** `instanceof`, но **добавляет** `Optional` в интерфейс. **Не факт, что лучше** — оба варианта **имеют** свои плюсы.

**Мораль.** `instanceof` — **не всегда** плохо. Если способность **опциональна** (`Refundable`), — `instanceof` **оправдан**: он **явно** говорит «проверяю, есть ли способность». **Альтернативы** (Optional в интерфейсе, отдельный метод) — тоже **работают**, но **не всегда** проще.

### Логирование (DIP)

```java
interface Logger {
    void log(String message);
}

final class ConsoleLogger implements Logger {
    public void log(String message) { System.out.println("[LOG] " + message); }
}

final class FileLogger implements Logger {
    private final String path;
    FileLogger(String path) { this.path = path; }
    public void log(String message) {
        // ... запись в файл ...
    }
}
```

`PaymentService` **зависит** от `Logger` (абстракции), а не от `ConsoleLogger`/`FileLogger`. **DIP** соблюдён.

**Логирование всех операций.** В `PaymentService` **логируются** ключевые операции (попытка, результат). Если нужно **больше** — **декоратор**:

```java
final class LoggingPaymentMethod implements PaymentMethod {
    private final PaymentMethod delegate;
    private final Logger logger;

    LoggingPaymentMethod(PaymentMethod delegate, Logger logger) {
        this.delegate = delegate;
        this.logger = logger;
    }

    public String name() { return delegate.name(); }
    public Money commission(Money amount) { return delegate.commission(amount); }

    public boolean process(Money amount) {
        logger.log("process(" + amount + ") через " + delegate.name());
        boolean result = delegate.process(amount);
        logger.log("Результат: " + result);
        return result;
    }
}
```

Собирается в `main`:

```java
PaymentMethod card = new CardPayment();
PaymentMethod loggedCard = new LoggingPaymentMethod(card, logger);
```

Теперь **каждый** `process` логируется, хотя `CardPayment` **ничего не знает** про логирование. **Декоратор** — паттерн, о котором будем говорить в модуле 7.

### Сборка в `main`

```java
public class Main {
    public static void main(String[] args) {
        Logger logger = new ConsoleLogger();
        NotificationSender notifier = new EmailSender("smtp.example.com");

        Map<String, PaymentMethod> methods = Map.of(
            "card",     new CardPayment(),
            "sbp",      new SbpPayment(),
            "yoomoney", new YooMoneyPayment(),
            "crypto",   new CryptoPayment(),
            "bonus",    new BonusPayment()
        );

        PaymentService service = new PaymentService(methods, notifier, logger);

        Order order1 = new Order(/* ... */);
        PaymentResult r1 = service.pay(order1, "card", new Money(new BigDecimal("1000"), "RUB"));
        System.out.println("Результат: " + r1.status());

        Order order2 = new Order(/* ... */);
        PaymentResult r2 = service.pay(order2, "crypto", new Money(new BigDecimal("150000"), "RUB"));
        System.out.println("Результат: " + r2.message());   // Превышено количество попыток

        Order order3 = new Order(/* ... */);
        PaymentResult r3 = service.pay(order3, "bonus", new Money(new BigDecimal("10000"), "RUB"));
        System.out.println("Результат: " + r3.message());   // Превышено количество попыток
    }
}
```

**Решения.** `main` — **единственное** место, где **все** конкретные реализации. Все остальные классы **зависят** только от абстракций.

### Ответы на вопросы

**1. Добавить SMS.** Новый класс `SmsChannel` (или `SmsNotificationSender`), одна строчка в `main` (или `CompositeSender` для двух каналов). `PaymentService` **не меняется**.

**2. Разное количество попыток для разных способов.** Добавить `default int maxAttempts() { return 3; }` в `PaymentMethod`, переопределить в `CryptoPayment` (`return 1;`). `PaymentService` **меняется** — потому что **логика** попыток становится **зависимой** от способа. Это **небольшое** изменение — в одном месте. Или вынести `maxAttempts` в **отдельный** интерфейс `LimitedAttempts` (для тех, кто его имеет), а в `PaymentService` — проверять через `instanceof`. **Оба** варианта — **рабочие**.

**3. Логирование всех операций.** Через **декоратор** `LoggingPaymentMethod` (или `LoggingPaymentService`). `PaymentService` **не меняется**, `PaymentMethod` **не меняется**. **Композиция** рулит.

**4. Частичный возврат.** В `Refundable` добавить `default boolean refundPartially(Money amount, Money total)`, либо **отдельный** интерфейс `PartialRefundable`. `refund(amount)` остаётся «полный возврат». `refundPartially(amount, total)` — **частичный**. `CardPayment` реализует **оба**, `BonusPayment` — **ни одного**.

**5. Два способа с одинаковым именем.** `Map.of` **не даст** (бросит `IllegalArgumentException` при дубликате). Если использовать `HashMap` — **второй** способ **перезапишет** первый. **Лучше** — проверять при регистрации: `if (methods.containsKey(name)) throw ...`. Или использовать `Map<String, List<PaymentMethod>>` — **явно** разрешить несколько с одним именем (но тогда `pay` должен **выбирать** один, что **усложняет**).

### Что можно улучшить

**Первое.** `MAX_ATTEMPTS` — константа. Лучше — **параметр** `PaymentService` (например, `int maxAttempts`), чтобы **настраивать** без перекомпиляции.

**Второе.** `refund` с `instanceof` — **работает**, но **не идеально**. Альтернатива — **отдельный** сервис `RefundService`, который **принимает** `Refundable` **явно**:

```java
class RefundService {
    PaymentResult refund(Refundable refundable, Money amount) { /* ... */ }
}
```

Тогда `PaymentService` **не знает** про возврат вообще. Это **лучше** с точки зрения SRP: `PaymentService` — про оплату, `RefundService` — про возврат.

**Третье.** `Payment` **неизменяем** по составу, но **изменяем** по статусу и попыткам. Это **нормально**: платёж **живёт** во времени, у него **есть** жизненный цикл. Но если нужно **полностью** неизменяемый платёж — **пришлось** бы создавать **новый** при каждом изменении статуса. Для учебной задачи — **не нужно**, для реальной — **зависит**.

**Четвёртое.** `NotificationSender` **не различает** «успех» и «неуспех». В реальной системе — **разные** шаблоны. Можно добавить `enum NotificationType` и **отдельный** метод `send(type, ...)`. Но это уже **за** пределами учебной задачи.
 
Все эти замечания — **не «ошибки»** учебного решения, а **точки роста**. Хорошее учебное решение — то, которое **работает** и **понятно**. Понимание того, **что** можно улучшить, — **уже** следующий шаг.