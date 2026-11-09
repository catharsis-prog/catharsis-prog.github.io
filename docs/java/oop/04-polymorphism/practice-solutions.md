---
title: Разбор практикума — Полиморфизм
description: Решения семи задач четвёртого модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Полиморфизм

## Как читать этот разбор

Решения ниже — не единственно правильные. В полиморфизме многое зависит от контекста: интерфейс или абстрактный класс, `default` или абстрактный метод, стратегия или `if/else`. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и обосновано — оно тоже правильное.

Обращайте внимание не столько на код, сколько на **обоснования**. В полиморфизме «почему интерфейс, а не абстрактный класс» — не менее важный вопрос, чем «как написать код».

## Задача 1. Фигуры через интерфейс

```java
interface Shape {
    double area();
    double perimeter();
}

class Circle implements Shape {
    private final double radius;

    Circle(double radius) {
        if (radius <= 0) {
            throw new IllegalArgumentException("Радиус должен быть положительным");
        }
        this.radius = radius;
    }

    @Override
    public double area() {
        return Math.PI * radius * radius;
    }

    @Override
    public double perimeter() {
        return 2 * Math.PI * radius;
    }
}

class Rectangle implements Shape {
    private final double width;
    private final double height;

    Rectangle(double width, double height) {
        if (width <= 0 || height <= 0) {
            throw new IllegalArgumentException("Стороны должны быть положительными");
        }
        this.width = width;
        this.height = height;
    }

    @Override
    public double area() {
        return width * height;
    }

    @Override
    public double perimeter() {
        return 2 * (width + height);
    }
}

class Triangle implements Shape {
    private final double a, b, c;

    Triangle(double a, double b, double c) {
        if (a <= 0 || b <= 0 || c <= 0) {
            throw new IllegalArgumentException("Стороны должны быть положительными");
        }
        if (a + b <= c || a + c <= b || b + c <= a) {
            throw new IllegalArgumentException("Не выполняется неравенство треугольника");
        }
        this.a = a;
        this.b = b;
        this.c = c;
    }

    @Override
    public double area() {
        double p = perimeter() / 2;
        return Math.sqrt(p * (p - a) * (p - b) * (p - c));
    }

    @Override
    public double perimeter() {
        return a + b + c;
    }
}
```

Использование:

```java
List<Shape> shapes = List.of(
    new Circle(5),
    new Rectangle(4, 6),
    new Triangle(3, 4, 5)
);

for (Shape shape : shapes) {
    System.out.printf("Площадь: %.2f, периметр: %.2f%n",
        shape.area(), shape.perimeter());
}
```

**На что обратить внимание.** Код цикла **не знает**, с каким именно типом фигуры он работает. Он видит `Shape` и вызывает `area()` и `perimeter()`. Какой именно метод выполнится — решается динамически, по фактическому типу объекта. Это и есть полиморфизм в чистом виде.

Если завтра появится `Square` или `Ellipse`, — цикл менять не придётся. Достаточно добавить новый класс, реализующий `Shape`, и положить его в список. Это и есть «открытость для расширения, закрытость для изменения» (принцип OCP), о котором будем говорить в модуле 6.

Обратите внимание на проверки в конструкторах: `Triangle` проверяет неравенство треугольника. Без этого `area()` вернул бы `NaN` для невозможного треугольника, и ошибка всплыла бы только в момент вычисления. Валидация в конструкторе — это ответственность класса, о которой мы говорили в модуле 2.

**Что можно улучшить.** Для реальной геометрии стоило бы использовать `BigDecimal` или хотя бы `double` с фиксированной точностью — но для учебной задачи `double` нормально. Если бы фигур было много, имело бы смысл добавить `toString()`, чтобы проще было печатать. Если бы понадобилось «масштабирование» фигуры, — можно было бы добавить в интерфейс `default`-метод `scale(double factor)`, который возвращает новую фигуру, — но это уже выходит за рамки задачи.

## Задача 2. Животные и подвохи

```java
class Animal {
    String name = "Животное";

    void speak() {
        System.out.println("...");
    }

    String getName() {
        return name;
    }
}

class Cat extends Animal {
    String name = "Кошка";

    @Override
    void speak() {
        System.out.println("Мяу");
    }

    @Override
    String getName() {
        return name;
    }
}

class Dog extends Animal {
    String name = "Собака";

    @Override
    void speak() {
        System.out.println("Гав");
    }

    @Override
    String getName() {
        return name;
    }
}
```

Что выведется:

```java
Animal a = new Cat();
a.speak();                    // Мяу — метод по фактическому типу
System.out.println(a.name);   // Животное — поле по типу переменной

Animal b = new Dog();
b.speak();                    // Гав
System.out.println(b.name);   // Животное

Animal c = new Cat();
System.out.println(c.getName());  // Кошка — метод по фактическому типу
```

**На что обратить внимание.** Здесь два ключевых момента.

**Первый: методы полиморфны, поля — нет.** Когда мы вызываем `a.speak()`, — метод выбирается по **фактическому типу объекта** (`Cat`), и вызывается `Cat.speak()`. Когда мы обращаемся к `a.name`, — поле выбирается по **типу переменной** (`Animal`), и берётся `Animal.name = "Животное"`. Это «сокрытие полей» (field hiding), и оно сбивает с толку почти всех, кто впервые с этим сталкивается.

**Второй: `getName()` даёт правильный результат.** Потому что это **метод**, и он полиморфен. `Cat.getName()` возвращает `Cat.name = "Кошка"`. `Animal.getName()` — не вызывается, потому что `a` фактически `Cat`.

**Почему это плохо.** Перекрытие поля `name` в наследниках — это **антипаттерн**. У `Cat` фактически **два** поля `name`: одно в `Animal`, одно в `Cat`. Они не связаны. `Animal`-методы видят `Animal.name`, `Cat`-методы видят `Cat.name`. Это источник багов: вы меняете `cat.name = "Барсик"` через `Cat`-переменную, а `Animal`-метод видит старое значение.

**Как исправить.** Не перекрывать поле. Оставить одно `name` в `Animal`, а в наследниках задавать его через конструктор:

```java
class Animal {
    protected String name;

    Animal(String name) {
        this.name = name;
    }

    String getName() {
        return name;
    }
}

class Cat extends Animal {
    Cat(String name) {
        super(name);
    }
}
```

Теперь `name` одно, и путаницы не возникает. Полиморфизм работает только для методов — это и есть причина, почему поля лучше не перекрывать.

**Что можно улучшить.** `protected` поле — компромисс: оно видно наследникам, но не снаружи. В реальном коде часто делают `private` и дают `protected`-геттер или `setName`, чтобы контролировать доступ. Но для учебной задачи `protected` — нормально.

## Задача 3. Платёжные системы — интерфейс или абстрактный класс

**Вариант А (интерфейс):**

```java
interface PaymentProcessor {
    double commission();
    void pay(double amount);
}

class CardPayment implements PaymentProcessor {
    @Override public double commission() { return 2.0; }

    @Override public void pay(double amount) {
        System.out.println("Оплата " + amount + " через карту, комиссия 2.0%");
    }
}

class SbpPayment implements PaymentProcessor {
    @Override public double commission() { return 0.5; }

    @Override public void pay(double amount) {
        System.out.println("Оплата " + amount + " через СБП, комиссия 0.5%");
    }
}

class CryptoPayment implements PaymentProcessor {
    @Override public double commission() { return 5.0; }

    @Override public void pay(double amount) {
        System.out.println("Оплата " + amount + " через криптовалюту, комиссия 5.0%");
    }
}
```

**Вариант Б (абстрактный класс):**

```java
abstract class PaymentProcessor {
    abstract double commission();
    abstract void pay(double amount);

    double totalWithCommission(double amount) {
        return amount + amount * commission() / 100;
    }
}

class CardPayment extends PaymentProcessor {
    @Override double commission() { return 2.0; }

    @Override void pay(double amount) {
        System.out.println("Оплата " + amount + " через карту, комиссия 2.0%");
    }
}

class SbpPayment extends PaymentProcessor {
    @Override double commission() { return 0.5; }

    @Override void pay(double amount) {
        System.out.println("Оплата " + amount + " через СБП, комиссия 0.5%");
    }
}

class CryptoPayment extends PaymentProcessor {
    @Override double commission() { return 5.0; }

    @Override void pay(double amount) {
        System.out.println("Оплата " + amount + " через криптовалюту, комиссия 5.0%");
    }
}
```

**Какой вариант лучше.** В этой задаче — **вариант Б**, потому что есть **общая логика**: `totalWithCommission` одинакова для всех способов (считается по `commission()`). Если бы этой общей логики не было, — вариант А был бы лучше.

Разница принципиальная:

- **Интерфейс** — это **контракт без реализации**. «Умей это, а как — твоё дело». Идеален для «чистых способностей».
- **Абстрактный класс** — это **контракт с общей реализацией**. «Умей это, и вот тебе каркас, чтобы не писать одно и то же в каждом наследнике». Идеален для «семейства классов с общим поведением».

В нашем случае `totalWithCommission` — общая логика. Она не должна дублироваться в каждом наследнике. Значит — абстрактный класс.

**Что теряем в каждом варианте.**

**Вариант А (интерфейс):**
- Теряем общую логику `totalWithCommission` — её пришлось бы дублировать в каждом наследнике или выносить в утилитный класс.
- Зато **можем реализовать несколько интерфейсов** — если завтра появится `Refundable` или `Recurring`, — `CardPayment` может реализовать оба, оставаясь `PaymentProcessor`.

**Вариант Б (абстрактный класс):**
- Получаем общую логику — `totalWithCommission` пишется один раз.
- Теряем множественное наследование — `CardPayment` не может ещё от чего-то наследоваться.
- Если `totalWithCommission` окажется не нужен какой-то реализации (например, у `BonusPayment` комиссия 0%), — придётся переопределять или мириться.

**Идеальный вариант** — **комбинация**: интерфейс `PaymentProcessor` для контракта + абстрактный класс `AbstractPaymentProcessor`, который реализует интерфейс и даёт общую логику. Это стандартный паттерн в стандартной библиотеке Java (`List` + `AbstractList`, `Map` + `AbstractMap`). Мы будем говорить о нём в модуле 5.

**Мораль.** «Интерфейс или абстрактный класс» — это не «что лучше», а «что уместно». Есть общая реализация — абстрактный класс. Нужна множественность или чистый контракт — интерфейс. Часто — и то, и другое вместе.

## Задача 4. default-методы в Shape

```java
interface Shape {
    double area();
    double perimeter();

    default void describe() {
        System.out.printf("Фигура: площадь %.2f, периметр %.2f%n",
            area(), perimeter());
    }

    default boolean isLargerThan(Shape other) {
        if (other == null) {
            return true;
        }
        return this.area() > other.area();
    }

    static Shape max(Shape a, Shape b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.area() >= b.area() ? a : b;
    }
}
```

Использование:

```java
Shape circle = new Circle(5);
Shape rectangle = new Rectangle(4, 6);
Shape triangle = new Triangle(3, 4, 5);

circle.describe();     // Фигура: площадь 78.54, периметр 31.42
rectangle.describe();  // Фигура: площадь 24.00, периметр 20.00
triangle.describe();   // Фигура: площадь 6.00, периметр 12.00

System.out.println(circle.isLargerThan(rectangle));  // true
System.out.println(Shape.max(circle, triangle).getClass().getSimpleName());  // Circle
```

Переопределение `describe()` в `Circle`:

```java
class Circle implements Shape {
    private final double radius;

    Circle(double radius) {
        this.radius = radius;
    }

    @Override
    public double area() { return Math.PI * radius * radius; }

    @Override
    public double perimeter() { return 2 * Math.PI * radius; }

    @Override
    public void describe() {
        System.out.printf("Круг: радиус %.2f, площадь %.2f%n", radius, area());
    }
}
```

Теперь у `Circle` — своё описание, у остальных — `default`.

**На что обратить внимание.** Здесь три важных момента.

**Первый: `describe()` как `default` — это то, что даёт гибкость.** Мы могли бы сделать его **абстрактным** — тогда все реализации обязаны его реализовать. Но `describe()` — это «общее поведение», которое подходит **почти всем** (кроме `Circle`). Сделав его `default`, мы:

- не заставляем каждую реализацию его писать;
- даём возможность переопределить, если нужно;
- получаем «мягкое» расширение — можно добавить `describe()` в интерфейс, не ломая существующие реализации.

**Второй: `isLargerThan` — тоже `default`, и это правильно.** Сравнение «по площади» — общее для всех фигур. Не нужен доступ к внутренностям — только к `area()`. Значит, `default` идеален.

**Третий: `max()` — `static`, и это тоже правильно.** Он не работает с конкретным объектом (`this`), а с двумя аргументами. Это «утилитный» метод, привязанный к интерфейсу. `default` не подходит, потому что у него нет «текущего объекта» — он не может быть вызван как `circle.max(a, b)`. Только `Shape.max(a, b)`.

**Почему `max` не может быть `default`.** Технически — мог бы: `default Shape max(Shape other) { return this.area() >= other.area() ? this : other; }`. Но тогда логика «сравнить два» и «сравнить себя с другим» смешалась бы, и метод вызывался бы через объект, хотя по смыслу он «ничей». `static` честнее: `max` — это операция над двумя фигурами, а не метод одной.

**Что можно улучшить.** `Shape.max` можно было бы обобщить до `static <T extends Shape> T max(T a, T b)`, чтобы возвращался конкретный тип. Но это уже generics, которые мы не проходили. Для нашей задачи `Shape` — нормально.

**Мораль.** `default`-метод — это способ сказать «общее поведение, которое можно переопределить». Это **не** «реализация по умолчанию для всех» (как `speak()` в уроке 4 давал бессмысленный `"..."`). `describe()` действительно подходит всем (кроме `Circle`, где его хочется уточнить), поэтому `default` уместен.

## Задача 5. Коллекция обработчиков

```java
interface EventHandler {
    void handle(String event);
}

class LogHandler implements EventHandler {
    @Override public void handle(String event) {
        System.out.println("[LOG] " + event);
    }
}

class EmailHandler implements EventHandler {
    @Override public void handle(String event) {
        System.out.println("[EMAIL] Уведомление: " + event);
    }
}

class SmsHandler implements EventHandler {
    @Override public void handle(String event) {
        System.out.println("[SMS] " + event);
    }
}

class EventBus {
    private final List<EventHandler> handlers = new ArrayList<>();

    void subscribe(EventHandler handler) {
        if (handler == null) {
            throw new IllegalArgumentException("Обработчик не может быть null");
        }
        handlers.add(handler);
    }

    void publish(String event) {
        if (event == null) {
            return;
        }
        for (EventHandler handler : handlers) {
            handler.handle(event);
        }
    }
}
```

Использование:

```java
EventBus bus = new EventBus();
bus.subscribe(new LogHandler());
bus.subscribe(new EmailHandler());
bus.subscribe(new SmsHandler());

bus.publish("Заказ создан");
// [LOG] Заказ создан
// [EMAIL] Уведомление: Заказ создан
// [SMS] Заказ создан

bus.subscribe(new LogHandler());   // второй логгер
bus.publish("Заказ отправлен");
// [LOG] Заказ отправлен
// [EMAIL] Уведомление: Заказ отправлен
// [SMS] Заказ отправлен
// [LOG] Заказ отправлен  — от второго логгера
```

**На что обратить внимание.** `EventBus` знает только про `EventHandler` — он не знает, какие именно обработчики у него в списке. Он просто вызывает `handle(event)` у каждого. Это позволяет добавлять новые типы обработчиков без изменения `EventBus`.

**Почему `EventBus` не нужно менять при добавлении `PushHandler`.** Потому что `EventBus` работает с **контрактом** (`EventHandler`), а не с конкретными классами. `PushHandler` реализует `EventHandler`, значит, он «является» `EventHandler` и может быть добавлен в `List<EventHandler>`. Всё остальное — уже работает.

**Обработка `null`.** В `subscribe` мы бросаем `IllegalArgumentException`, если передали `null`. Это правильно: `null` в списке обработчиков — это ошибка программиста, её надо видеть сразу, а не ловить `NullPointerException` через полчаса. В `publish` мы «мягко» игнорируем `null`-событие: это не ошибка, это просто «нечего публиковать».

**Что произойдёт, если в `EventBus` заменить `List` на `Set`.** Обработчики будут уникальными — повторный `subscribe` того же объекта не добавит его второй раз. Это может быть как хорошо (не дублировать обработчики), так и плохо (если нужны два одинаковых логгера для разных файлов — как в нашей задаче). В нашем случае `List` правильнее.

**Как подменить настоящий `EmailHandler` в тестах.** Создать «заглушку» — класс, реализующий `EventHandler`, который не отправляет письма, а записывает вызовы в список:

```java
class FakeEmailHandler implements EventHandler {
    List<String> handled = new ArrayList<>();

    @Override public void handle(String event) {
        handled.add(event);
    }
}
```

В тесте:

```java
FakeEmailHandler fake = new FakeEmailHandler();
bus.subscribe(fake);
bus.publish("тест");
assertEquals(List.of("тест"), fake.handled);
```

Работает потому, что `EventBus` работает с `EventHandler`, а какой именно — не важно. Это и есть полиморфизм: «настоящий» или «заглушка» — с точки зрения `EventBus` они одинаковы.

**Мораль.** Полиморфизм в коллекциях — это основа «открытых» систем. `EventBus` не меняется при добавлении новых обработчиков. Это и есть OCP — «открыт для расширения, закрыт для изменения».

## Задача 6. Рефакторинг instanceof в стратегию

**Интерфейс стратегии:**

```java
interface PaymentMethod {
    void pay();
}

class Card implements PaymentMethod {
    private final double amount;

    Card(double amount) {
        this.amount = amount;
    }

    @Override
    public void pay() {
        System.out.println("Списание с карты: " + amount);
    }
}

class Sbp implements PaymentMethod {
    private final double amount;

    Sbp(double amount) {
        this.amount = amount;
    }

    @Override
    public void pay() {
        System.out.println("Перевод через СБП: " + amount);
    }
}

class Crypto implements PaymentMethod {
    private final double amount;

    Crypto(double amount) {
        this.amount = amount;
    }

    @Override
    public void pay() {
        System.out.println("Криптоплатёж: " + amount);
    }
}
```

**Контекст:**

```java
class PaymentService {
    void process(PaymentMethod payment) {
        if (payment == null) {
            throw new IllegalArgumentException("Способ оплаты не указан");
        }
        payment.pay();
    }
}
```

**Использование:**

```java
PaymentService service = new PaymentService();
service.process(new Card(1000));
service.process(new Sbp(2000));
service.process(new Crypto(5000));
```

Добавление `YooMoney`:

```java
class YooMoney implements PaymentMethod {
    private final double amount;

    YooMoney(double amount) {
        this.amount = amount;
    }

    @Override
    public void pay() {
        System.out.println("ЮMoney: " + amount);
    }
}
```

— и ничего в `PaymentService` менять не нужно. Работает сразу.

**На что обратить внимание.** Мы убрали **все** `instanceof` и **все** `if/else` по типу. Раньше `PaymentService.process` знал про `Card`, `Sbp`, `Crypto` и что с ними делать. Теперь он знает только, что у него есть `PaymentMethod`, у которого можно вызвать `pay()`. Всё остальное — не его забота.

Обратите внимание на сигнатуру: раньше было `process(Object payment)`, теперь `process(PaymentMethod payment)`. Это **важное улучшение**: тип `Object` говорил «я не знаю, что мне пришлют, и буду проверять». Тип `PaymentMethod` говорит «я принимаю только то, что умеет платить». Компилятор теперь проверяет корректность **за нас**, и `instanceof` уже не нужен.

**Когда `instanceof` всё-таки уместен.** Два примера из стандартной библиотеки Java.

**`equals(Object)`.** Параметр типа `Object` — потому что метод переопределяет `Object.equals`. Мы вынуждены проверять `if (!(o instanceof Point p)) return false;` — потому что не знаем, с чем нас сравнивают. Если бы параметр был `Point`, — `instanceof` не был бы нужен. Но сигнатура зафиксирована `Object`.

**`toString(Object)`** в утилитных классах. Если у нас есть метод, который принимает `Object` и печатает его по-разному в зависимости от типа (например, `String` в кавычках, `List` как `[...]`, `null` как `null`), — мы вынуждены проверять `instanceof`, потому что тип неизвестен заранее.

**Общее правило:** `instanceof` оправдан, когда **тип не под нашим контролем**. `equals` — потому что сигнатура `Object`. JSON-парсер — потому что на вход приходит «что угодно». Событие от внешней системы — потому что мы не знаем его тип. Во всех остальных случаях — лучше полиморфизм.

**Мораль.** Если вы пишете `instanceof` и `if/else` по типу — задайте вопрос: **этот тип под моим контролем?** Если да — полиморфизм. Если нет — `instanceof` оправдан.

## Задача 7. Проект — платёжная система интернет-магазина

Покажу один из разумных вариантов.

### PaymentMethod

```java
interface PaymentMethod {
    String name();
    double commission(double amount);
    boolean process(double amount);

    default double totalWithCommission(double amount) {
        return amount + commission(amount);
    }
}
```

**Решения.** `default` для `totalWithCommission` — потому что формула общая. `commission` и `process` — абстрактные, потому что каждая реализация считает по-своему и решает по-своему, успешен ли платёж.

### Конкретные реализации

```java
final class CardPayment implements PaymentMethod {
    @Override public String name() { return "Карта"; }
    @Override public double commission(double amount) { return amount * 0.02; }
    @Override public boolean process(double amount) { return true; }
}

final class SbpPayment implements PaymentMethod {
    @Override public String name() { return "СБП"; }
    @Override public double commission(double amount) { return amount * 0.005; }
    @Override public boolean process(double amount) { return true; }
}

final class CryptoPayment implements PaymentMethod {
    @Override public String name() { return "Крипта"; }
    @Override public double commission(double amount) { return amount * 0.05; }
    @Override public boolean process(double amount) { return amount <= 100_000; }
}

final class BonusPayment implements PaymentMethod {
    @Override public String name() { return "Бонусы"; }
    @Override public double commission(double amount) { return 0; }
    @Override public boolean process(double amount) { return amount <= 5000; }
}
```

**Решения.** Все `final` — потому что наследоваться от них не планируется, и `final` защищает от неожиданных наследников. `commission` возвращает сумму в рублях (не проценты), потому что так удобнее: `totalWithCommission` просто складывает `amount + commission(amount)`. `process` — простой, но с лимитами для крипты и бонусов.

**Что можно улучшить.** В реальном коде `process` возвращал бы какой-то результат (например, `PaymentResult` с кодом ошибки и сообщением), а не просто `boolean`. Но для учебной задачи `boolean` достаточно.

### PaymentProcessor

```java
class PaymentProcessor {
    private final List<PaymentMethod> methods = new ArrayList<>();

    void addMethod(PaymentMethod method) {
        if (method == null) {
            throw new IllegalArgumentException("Способ оплаты не может быть null");
        }
        methods.add(method);
    }

    boolean pay(double amount, String methodName) {
        if (methodName == null) {
            return false;
        }
        PaymentMethod method = findByName(methodName);
        if (method == null) {
            System.out.println("Способ оплаты не найден: " + methodName);
            return false;
        }
        try {
            if (method.process(amount)) {
                System.out.printf("Оплата %.2f через %s успешна, комиссия %.2f%n",
                    amount, methodName, method.commission(amount));
                return true;
            } else {
                System.out.println("Оплата через " + methodName + " не удалась");
                return false;
            }
        } catch (Exception e) {
            System.out.println("Ошибка при оплате через " + methodName + ": " + e.getMessage());
            return false;
        }
    }

    void printAvailableMethods() {
        System.out.println("=== Доступные способы оплаты ===");
        for (PaymentMethod method : methods) {
            System.out.printf("%s: комиссия %.2f для суммы 1000%n",
                method.name(), method.commission(1000));
        }
    }

    private PaymentMethod findByName(String name) {
        for (PaymentMethod method : methods) {
            if (method.name().equalsIgnoreCase(name)) {
                return method;
            }
        }
        return null;
    }
}
```

**Решения.** `PaymentProcessor` **не знает** о конкретных способах — он работает только с `PaymentMethod`. В нём нет `instanceof` и `if/else` по типу. `findByName` ищет по имени (регистронезависимо), возвращает `null`, если не нашёл, — и `pay` обрабатывает `null` как «способ не найден».

`try/catch` вокруг `process` — на случай, если какая-то реализация бросит исключение. Это защита от «сюрпризов»: `PaymentProcessor` устойчив к ошибкам в реализациях. В учебной задаче это не обязательно, но полезно: клиентский код должен получать `false`, а не падать.

**Что можно улучшить.** `findByName` можно было бы заменить на `Map<String, PaymentMethod>` — это было бы эффективнее для большого числа способов. Но `Map` накладывает ограничения (например, требует уникальности ключей), а `List` проще. Для 4 способов разница несущественна.

Если бы хотели **логировать все попытки** (успешные и неуспешные) без изменения `PaymentMethod`, — можно было бы добавить в `PaymentProcessor` поле `Logger` и логировать в `pay`. Или сделать «обёртку» — `LoggingPaymentMethod implements PaymentMethod`, которая делегирует настоящему и логирует. Это паттерн «Декоратор», о котором будем говорить позже.

### Сценарий проверки

```java
public class Main {
    public static void main(String[] args) {
        PaymentProcessor processor = new PaymentProcessor();
        processor.addMethod(new CardPayment());
        processor.addMethod(new SbpPayment());
        processor.addMethod(new CryptoPayment());
        processor.addMethod(new BonusPayment());

        processor.printAvailableMethods();

        processor.pay(10_000, "Карта");       // успешно
        processor.pay(10_000, "СБП");         // успешно
        processor.pay(150_000, "Крипта");     // не удалась (лимит)
        processor.pay(3_000, "Бонусы");       // успешно
        processor.pay(1_000, "YooMoney");     // способ не найден
    }
}
```

Ожидаемый вывод:

```
=== Доступные способы оплаты ===
Карта: комиссия 20.00 для суммы 1000
СБП: комиссия 5.00 для суммы 1000
Крипта: комиссия 50.00 для суммы 1000
Бонусы: комиссия 0.00 для суммы 1000
Оплата 10000.00 через Карта успешна, комиссия 200.00
Оплата 10000.00 через СБП успешна, комиссия 50.00
Оплата через Крипта не удалась
Оплата 3000.00 через Бонусы успешна, комиссия 0.00
Способ оплаты не найден: YooMoney
```

### Ответы на вопросы

**1. Что произойдёт, если появится `YooMoneyPayment`?** Придётся добавить **один** класс — `YooMoneyPayment`. `PaymentProcessor` и `PaymentMethod` менять не нужно. Это и есть главное преимущество полиморфизма — расширение без изменения.

**2. Что если понадобится частичный возврат?** Это зависит от того, как устроен возврат. Если он универсален (для всех способов одинаково) — можно добавить в `PaymentMethod` метод `refund(double amount)` и реализовать в каждой. Если он **опционален** (не все способы поддерживают) — вынести в отдельный интерфейс `Refundable`:

```java
interface Refundable {
    boolean refund(double amount);
}

final class CardPayment implements PaymentMethod, Refundable {
    @Override public boolean refund(double amount) { return true; }
}
```

Тогда `PaymentProcessor` может проверять `if (method instanceof Refundable r) { r.refund(amount); }` — но это уже `instanceof`. Сделать красиво без `instanceof` можно, но это уже отдельный паттерн, о котором будем говорить в модуле 5.

**3. Логирование всех попыток без изменения `PaymentMethod`.** Два подхода.

**Первый — `Logger` в `PaymentProcessor`.** Поле `Logger logger`, и `pay` пишет в него до и после вызова `process`. Просто, но логика логирования размазывается по `PaymentProcessor`.

**Второй — «обёртка».** Класс `LoggingPaymentMethod implements PaymentMethod`, который **делегирует** настоящему методу и логирует:

```java
class LoggingPaymentMethod implements PaymentMethod {
    private final PaymentMethod delegate;
    private final Logger logger;

    LoggingPaymentMethod(PaymentMethod delegate, Logger logger) {
        this.delegate = delegate;
        this.logger = logger;
    }

    @Override public String name() { return delegate.name(); }
    @Override public double commission(double amount) { return delegate.commission(amount); }

    @Override public boolean process(double amount) {
        logger.log("Попытка оплаты через " + name() + ": " + amount);
        boolean result = delegate.process(amount);
        logger.log("Результат: " + result);
        return result;
    }
}
```

Это паттерн «Декоратор». `PaymentProcessor` не меняется: он работает с `PaymentMethod`, а `LoggingPaymentMethod` — тоже `PaymentMethod`. Просто одна реализация оборачивает другую.

**4. Оплата несколькими способами сразу.** Это уже не «выбор одного способа», а «комбинация». Можно сделать:

```java
class CombinedPaymentMethod implements PaymentMethod {
    private final List<PaymentMethod> methods;

    CombinedPaymentMethod(List<PaymentMethod> methods) {
        this.methods = methods;
    }

    @Override public String name() {
        return methods.stream().map(PaymentMethod::name)
            .collect(Collectors.joining(" + "));
    }

    @Override public double commission(double amount) {
        return methods.stream().mapToDouble(m -> m.commission(amount)).sum();
    }

    @Override public boolean process(double amount) {
        return methods.stream().allMatch(m -> m.process(amount));
    }
}
```

Тогда `processor.pay(1000, "Карта + Бонусы")` — если такой способ зарегистрирован, — выполнит оба. Но это уже композиция, о которой будем говорить в модуле 5.

**5. Два способа с одинаковым именем.** `findByName` вернёт **первый** найденный. Второй будет «невидимым» — его нельзя выбрать по имени. Это нежелательно. Лучше — при `addMethod` проверять, что имя уникально:

```java
void addMethod(PaymentMethod method) {
    if (method == null) throw new IllegalArgumentException("...");
    if (findByName(method.name()) != null) {
        throw new IllegalArgumentException("Способ с именем " + method.name() + " уже добавлен");
    }
    methods.add(method);
}
```

Или использовать `Map<String, PaymentMethod>` — тогда уникальность гарантируется структурой.

### Что можно улучшить

**Первое.** `try/catch (Exception)` в `pay` — слишком широкий. Лучше ловить конкретные исключения (`PaymentException`, `IllegalStateException`), а `RuntimeException` пробрасывать. Но для учебной задачи широкий `catch` — компромисс.

**Второе.** `printAvailableMethods` использует сумму 1000 «вшитой». Лучше передавать сумму параметром: `printAvailableMethods(double amount)`. Но для учебной задачи — нормально.

**Третье.** В реальной системе `process` должен возвращать не `boolean`, а `PaymentResult` с кодом ошибки и сообщением. Тогда `PaymentProcessor` мог бы печатать осмысленное сообщение, а не общее «не удалась».

**Четвёртое.** `PaymentProcessor` — `final`? Если нет планов наследоваться — стоит сделать `final`. Но в задаче не сказано; решение за вами.

**Пятое.** Если завтра понадобится **частичный возврат** или **повторная оплата**, — интерфейс `PaymentMethod` придётся расширять. Это признак того, что интерфейс «не доработал»: возможно, стоит разделить на `PaymentMethod` (основной) + отдельные интерфейсы для опциональных возможностей (`Refundable`, `Recurring`). Это уже проектирование, о котором будем говорить в модуле 6.

Все эти замечания — не «ошибки» учебного решения, а **точки роста**. Хорошее учебное решение — то, которое работает и понятно. Понимание того, что можно улучшить, — уже следующий шаг.