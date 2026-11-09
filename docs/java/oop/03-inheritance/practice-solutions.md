---
title: Разбор практикума — Наследование
description: Решения семи задач третьего модуля с объяснениями и альтернативами
outline: [2, 3]
---

# Разбор практикума — Наследование

## Как читать этот разбор

Решения ниже — не единственно правильные. В наследовании особенно много «зависит от контекста»: одна и та же иерархия может быть хорошей для одной задачи и плохой для другой. Я показываю один из разумных вариантов и объясняю, почему он устроен именно так. Если ваше решение отличается, но работает и обосновано — оно тоже правильное.

Обращайте внимание не столько на код, сколько на **обоснования**. В наследовании «почему `extends`, а не композиция» — не менее важный вопрос, чем «как написать код».

## Задача 1. Кошки и собаки

```java
class Animal {
    String name;

    void speak() {
        System.out.println(name + " издаёт звук");
    }

    void eat() {
        System.out.println(name + " ест");
    }
}

class Cat extends Animal {
    @Override
    void speak() {
        System.out.println(name + " мяукает");
    }
}

class Dog extends Animal {
    @Override
    void speak() {
        System.out.println(name + " гавкает");
    }
}
```

Использование:

```java
Cat cat = new Cat();
cat.name = "Мурка";
cat.speak();     // Мурка мяукает
cat.eat();       // Мурка ест

Dog dog = new Dog();
dog.name = "Рекс";
dog.speak();     // Рекс гавкает
dog.eat();       // Рекс ест

Animal[] animals = { cat, dog, new Cat() };
animals[2].name = "Барсик";
for (Animal a : animals) {
    a.speak();   // Мурка мяукает / Рекс гавкает / Барсик мяукает
}
```

**На что обратить внимание.** Здесь важно увидеть, что `eat()` **не** переопределяется, а наследуется. В цикле по `Animal[]` вызывается `eat()` у всех без проблем — потому что реализация одна и она в `Animal`. А `speak()` переопределён в каждом наследнике, и в цикле вызывается та версия, которая соответствует **фактическому** типу объекта.

Если бы мы добавили в `Animal` метод `sleep()` с общей реализацией, — он тоже работал бы у всех наследников. Если бы добавили абстрактный метод `makeSound()` — наследники были бы обязаны его реализовать. Это три уровня «наследования поведения»: общая реализация, переопределяемая реализация, обязательная реализация. Все три — части одного инструмента.

## Задача 2. Сотрудники с конструкторами

```java
class Employee {
    private final String name;
    private final double baseSalary;

    Employee(String name, double baseSalary) {
        if (name == null || name.isEmpty()) {
            throw new IllegalArgumentException("Имя не может быть пустым");
        }
        if (baseSalary < 0) {
            throw new IllegalArgumentException("Зарплата не может быть отрицательной");
        }
        this.name = name;
        this.baseSalary = baseSalary;
    }

    String getName() { return name; }

    double getSalary() {
        return baseSalary;
    }

    void describe() {
        System.out.println("Сотрудник " + name + ", зарплата " + getSalary());
    }
}

class Manager extends Employee {
    private final double bonus;

    Manager(String name, double baseSalary, double bonus) {
        super(name, baseSalary);
        if (bonus < 0) {
            throw new IllegalArgumentException("Бонус не может быть отрицательным");
        }
        this.bonus = bonus;
    }

    @Override
    double getSalary() {
        return super.getSalary() + bonus;
    }
}

class Intern extends Employee {
    private final String mentor;

    Intern(String name, String mentor) {
        super(name, 30000);
        if (mentor == null || mentor.isEmpty()) {
            throw new IllegalArgumentException("Наставник не может быть пустым");
        }
        this.mentor = mentor;
    }

    @Override
    void describe() {
        System.out.println("Стажёр " + getName() + ", наставник " + mentor);
    }
}
```

Проверка:

```java
Employee employee = new Employee("Алиса", 100000);
System.out.println(employee.getSalary());   // 100000.0

Manager manager = new Manager("Боб", 150000, 50000);
System.out.println(manager.getSalary());    // 200000.0

Intern intern = new Intern("Кэрол", "Дмитрий");
intern.describe();                          // Стажёр Кэрол, наставник Дмитрий
```

**На что обратить внимание.** Ключевое решение здесь — `super.getSalary() + bonus` в `Manager.getSalary()`. Это **расширение**, а не **замена**: мы не пересчитываем зарплату с нуля, а берём базовую из родителя и добавляем бонус. Если завтра `Employee.getSalary()` начнёт учитывать что-то ещё (например, индексацию), — `Manager` автоматически это подхватит.

Второй момент — `Intern` вызывает `super(name, 30000)` с фиксированной стипендией. Это значит, что стажёр не может «договориться» о другой зарплате — она всегда 30 000. Если бы это было не так, — конструктор `Intern` принимал бы ещё и стипендию. Но в условии задачи фиксировано, и код это отражает.

Обратите внимание: `Manager` и `Intern` **не** переопределяют `getName()` — он им не нужен, они используют унаследованный. А вот `describe()` в `Intern` переопределён полностью (а не через `super.describe()`), потому что описание стажёра **не содержит** информацию о зарплате — она фиксирована и неинтересна. Это пример «замены», а не «расширения» — и здесь она уместна, потому что у стажёра действительно нет «зарплаты в том же смысле», что у сотрудника.

## Задача 3. Расширение через super

```java
class Document {
    private final String title;

    Document(String title) {
        this.title = title;
    }

    String getTitle() { return title; }

    void render() {
        System.out.println("=== " + title + " ===");
    }
}

class Report extends Document {
    private final String period;

    Report(String title, String period) {
        super(title);
        this.period = period;
    }

    @Override
    void render() {
        super.render();
        System.out.println("Период: " + period);
    }
}

class SignedReport extends Report {
    private final String signedBy;

    SignedReport(String title, String period, String signedBy) {
        super(title, period);
        this.signedBy = signedBy;
    }

    @Override
    void render() {
        super.render();
        System.out.println("Подписано: " + signedBy);
    }
}

class Invoice extends Document {
    private final double amount;

    Invoice(String title, double amount) {
        super(title);
        this.amount = amount;
    }

    @Override
    void render() {
        super.render();
        System.out.println("Сумма: " + amount);
    }
}
```

Проверка:

```java
new SignedReport("Итоги года", "2024", "Иванов").render();
// === Итоги года ===
// Период: 2024
// Подписано: Иванов
```

**На что обратить внимание.** Здесь важно увидеть, что `SignedReport.render()` вызывает `Report.render()`, который вызывает `Document.render()`. **Один вызов `render()` у `SignedReport` порождает три строки.** Это и есть «расширение через `super`»: каждый уровень иерархии добавляет свою строчку, и в итоге получается полное описание.

Если бы `SignedReport.render()` **не** вызывал `super.render()`, а печатал что-то своё, — мы бы потеряли и «Период», и заголовок. Тогда `SignedReport` перестал бы быть «расширением» `Report` и стал бы «чем-то другим».

**Тонкость.** `super.render()` в `SignedReport` вызывает **`Report.render()`**, а не `Document.render()`, — потому что `super` ссылается на **непосредственного** родителя. `Report.render()` уже сам вызовет `Document.render()`. Получается цепочка из трёх вызовов, и это то, что мы хотим.

**Что можно улучшить.** `Invoice` не является ни `Report`, ни `SignedReport` — он наследуется напрямую от `Document`. И это правильно: счёт — это документ, но не отчёт. Здесь нет глубокой иерархии, потому что она не нужна.

## Задача 4. final — где остановиться

Вариант А (всё как в задаче 2):

```java
class Employee {
    // ... поля, конструктор, геттер ...
    double getSalary() { return baseSalary; }
}
```

`Employee` не `final`, `getSalary()` не `final`. `Manager` переопределяет `getSalary()` и добавляет бонус.

**Плюсы.** Гибко: `Manager`, `Intern` и любой новый наследник могут переопределить `getSalary()` по-своему.

**Минусы.** Любой наследник может вернуть что угодно — например, отрицательное число или `-Infinity`. Инвариант «зарплата неотрицательна» не гарантируется для наследников.

Вариант Б (через шаблонный метод):

```java
class Employee {
    private final String name;
    private final double baseSalary;

    Employee(String name, double baseSalary) {
        // ... проверки ...
        this.name = name;
        this.baseSalary = baseSalary;
    }

    final double getSalary() {           // final — нельзя переопределить
        double salary = calculateSalary();
        if (salary < 0) {                // инвариант гарантирован здесь
            throw new IllegalStateException("Зарплата не может быть отрицательной");
        }
        return salary;
    }

    protected double calculateSalary() { // protected — можно переопределить
        return baseSalary;
    }
}

class Manager extends Employee {
    private final double bonus;

    Manager(String name, double baseSalary, double bonus) {
        super(name, baseSalary);
        this.bonus = bonus;
    }

    @Override
    protected double calculateSalary() {
        return super.calculateSalary() + bonus;
    }
}
```

**Плюсы.** `getSalary()` гарантирует инвариант «зарплата неотрицательна» для **всех** наследников. Наследники могут переопределить только `calculateSalary()`, и даже если они вернут отрицательное число, `getSalary()` это поймает.

**Минусы.** Больше кода: две ступени (`calculateSalary` и `getSalary`) вместо одной. И `calculateSalary()` — `protected`, что открывает его для переопределения. Это компромисс: мы разрешаем наследникам «изменять логику», но контролируем «что в итоге возвращается».

**Что я бы выбрал.** Вариант Б. В реальном коде с деньгами и инвариантами — это более надёжный подход. Он называется **шаблонный метод** (template method), и мы поговорим о нём в модуле 5.

**Мораль.** `final` — это не «на всякий случай». Это **сознательное решение**: «этот метод не для переопределения, потому что он обеспечивает что-то важное». В нашем случае `getSalary()` обеспечивает инвариант, и его `final` — оправдан.

## Задача 5. Абстрактная фигура

```java
abstract class Shape {
    private final String name;

    Shape(String name) {
        this.name = name;
    }

    String getName() { return name; }

    abstract double area();
    abstract double perimeter();

    void describe() {
        System.out.printf("%s: площадь %.2f, периметр %.2f%n",
            name, area(), perimeter());
    }
}

class Circle extends Shape {
    private final double radius;

    Circle(double radius) {
        super("Круг");
        this.radius = radius;
    }

    @Override
    double area() { return Math.PI * radius * radius; }

    @Override
    double perimeter() { return 2 * Math.PI * radius; }
}

class Rectangle extends Shape {
    private final double width;
    private final double height;

    Rectangle(double width, double height) {
        super("Прямоугольник");
        this.width = width;
        this.height = height;
    }

    @Override
    double area() { return width * height; }

    @Override
    double perimeter() { return 2 * (width + height); }
}

class Triangle extends Shape {
    private final double a, b, c;

    Triangle(double a, double b, double c) {
        super("Треугольник");
        if (a + b <= c || a + c <= b || b + c <= a) {
            throw new IllegalArgumentException("Не выполняется неравенство треугольника");
        }
        this.a = a;
        this.b = b;
        this.c = c;
    }

    @Override
    double area() {
        double p = perimeter() / 2;
        return Math.sqrt(p * (p - a) * (p - b) * (p - c));
    }

    @Override
    double perimeter() {
        return a + b + c;
    }
}
```

Проверка:

```java
List<Shape> shapes = List.of(
    new Circle(5),
    new Rectangle(4, 6),
    new Triangle(3, 4, 5)
);
for (Shape s : shapes) {
    s.describe();
}
// Круг: площадь 78.54, периметр 31.42
// Прямоугольник: площадь 24.00, периметр 20.00
// Треугольник: площадь 6.00, периметр 12.00
```

**На что обратить внимание.** `describe()` работает для всех фигур одинаково: он вызывает `area()` и `perimeter()`, которые **полиморфно** определены в каждом наследнике. Это и есть та самая «магия» абстрактного класса: базовая логика написана один раз, а конкретные реализации подставляются наследниками.

Обратите внимание на проверку в `Triangle` — «неравенство треугольника». Если её не делать, можно создать «треугольник» со сторонами 1, 1, 10, и `area()` вернёт `NaN` (потому что под корнем будет отрицательное число). Валидация в конструкторе — это ответственность класса, о которой мы говорили в модуле 2.

**Что можно улучшить.** `Circle`, `Rectangle`, `Triangle` — неизменяемые (все поля `final`). Можно было бы добавить `final` на классах — чтобы наследники не могли сломать неизменяемость. Но это уже решение проектировщика: хотите ли вы, чтобы от `Circle` можно было наследоваться (например, для «цветного круга»)? Если да — `final` не нужен. Если нет — добавьте.

## Задача 6. Диагностика

### Иерархия А (страус и птица)

**Проблема.** `Bird` обещает `fly()`, а `Ostrich` это обещание нарушает — бросает `UnsupportedOperationException`. Это **нарушение принципа подстановки Лисков**: если функция ожидает `Bird` и вызывает `fly()`, — с `Ostrich` она упадёт. Значит, `Ostrich` **не является** `Bird` в том смысле, в котором определён `Bird`.

**Исправление.** Вынести «умение летать» в отдельный контракт:

```java
class Bird {
    void eat() { /* ... */ }
}

interface Flying {
    void fly();
}

class Sparrow extends Bird implements Flying {
    @Override
    public void fly() { /* ... */ }
}

class Ostrich extends Bird {
    // не реализует Flying — и не обещает летать
}
```

Теперь `Bird` не обещает `fly()`, и `Ostrich` ничего не нарушает. А `Sparrow` реализует `Flying` — и **обязан** летать, потому что сам подписался под контрактом.

### Иерархия Б (валидатор и сервис)

**Проблема.** `UserService` **наследует** `Validator` ради одного метода `isValidEmail()`. Это «наследование ради переиспользования кода», а не ради отношения «is-a». `UserService` — **не** `Validator`; он **использует** валидатор.

Проблемы такого подхода:

- `UserService` тащит за собой все методы `Validator` (`isValidPhone`, `isValidAddress`), хотя они ему не нужны.
- `UserService` теперь **является** `Validator`, и его можно передать туда, где ожидается `Validator`. Это может привести к странному использованию.
- Изменения в `Validator` могут сломать `UserService`, даже если они не связаны с `isValidEmail`.

**Исправление.** Использовать композицию:

```java
class UserService {
    private final Validator validator = new Validator();

    void register(String email) {
        if (!validator.isValidEmail(email)) {
            throw new IllegalArgumentException("Некорректный email");
        }
        // ...
    }
}
```

Теперь `UserService` **содержит** `Validator` и **делегирует** ему проверку. Никакого «родства», только «использование».

### Иерархия В (квадрат и прямоугольник)

**Проблема.** Классическая. `Square` наследует `Rectangle`, но **не может** корректно выполнить контракт родителя: `Rectangle` обещает, что `setWidth` и `setHeight` можно менять независимо, а `Square` вынужден синхронизировать их, чтобы остаться квадратом.

Что не так:

- Если вызвать `square.setWidth(5)`, — `height` тоже станет 5. Это **не то**, что ожидает код, работающий с `Rectangle`.
- Если функция принимает `Rectangle` и вызывает `setWidth(5)` на «прямоугольнике 3×4», — она ожидает получить 5×4. А получит 5×5, если это на самом деле `Square`. Это нарушение подстановки.
- `Square` «расширяет» `Rectangle` технически, но **сужает** его контракт: не все операции `Rectangle` имеют смысл для `Square`.

**Исправление.** Есть несколько подходов.

**Первый — не наследовать.** `Square` — отдельный класс, не связанный с `Rectangle` через `extends`:

```java
final class Square {
    private final int side;

    Square(int side) { this.side = side; }
    int area() { return side * side; }
    int perimeter() { return 4 * side; }
}
```

**Второй — неизменяемый `Rectangle`.** Если `Rectangle` не имеет сеттеров, — `Square` может быть его частным случаем:

```java
final class Rectangle {
    private final int width;
    private final int height;

    Rectangle(int width, int height) {
        this.width = width;
        this.height = height;
    }

    int area() { return width * height; }
    int perimeter() { return 2 * (width + height); }
}

final class Square extends Rectangle {
    Square(int side) { super(side, side); }
}
```

Здесь `Square extends Rectangle` — нормально, потому что `Rectangle` **неизменяем** и его контракт не нарушается.

**Третий — интерфейс.** Общий интерфейс `Shape` с методами `area()` и `perimeter()`, а `Rectangle` и `Square` — независимые реализации:

```java
interface Shape {
    int area();
    int perimeter();
}

class Rectangle implements Shape { /* ... */ }
class Square implements Shape { /* ... */ }
```

Тогда нет проблемы «родитель и наследник», есть «два разных класса с общим контрактом».

**Мораль.** «Наследование, которое врёт» — это не всегда очевидно. В случае `Square extends Rectangle` код **компилируется** и даже **работает** в простых сценариях. Проблема вылезает, когда кто-то использует `Square` там, где ожидается `Rectangle`, — и получает не то поведение, которое ожидал. Это самый опасный тип ошибок: он не падает, а «тихо врёт».

## Задача 7. Проект — служба доставки

Покажу один из разумных вариантов. В комментариях — ключевые решения.

### Delivery (абстрактный класс)

```java
abstract class Delivery {
    private final String trackingNumber;
    private final String recipient;
    private final double weightKg;

    Delivery(String trackingNumber, String recipient, double weightKg) {
        if (trackingNumber == null || trackingNumber.isEmpty()) {
            throw new IllegalArgumentException("Номер отслеживания не может быть пустым");
        }
        if (recipient == null || recipient.isEmpty()) {
            throw new IllegalArgumentException("Получатель не может быть пустым");
        }
        if (weightKg <= 0) {
            throw new IllegalArgumentException("Вес должен быть положительным");
        }
        this.trackingNumber = trackingNumber;
        this.recipient = recipient;
        this.weightKg = weightKg;
    }

    String getTrackingNumber() { return trackingNumber; }
    String getRecipient() { return recipient; }
    double getWeightKg() { return weightKg; }

    abstract double calculateCost();
    abstract int estimatedDays();

    String describe() {
        return "Доставка " + trackingNumber + " для " + recipient
            + ": " + calculateCost() + " руб., ~" + estimatedDays() + " дн.";
    }
}
```

**Решения.** `abstract` на классе — потому что «просто доставка» — это абстракция, нет конкретного способа её выполнить. `abstract` на `calculateCost()` и `estimatedDays()` — потому что каждый способ доставки считает по-своему. `describe()` — общий, использует полиморфные методы.

### Конкретные типы

```java
final class StandardDelivery extends Delivery {
    StandardDelivery(String trackingNumber, String recipient, double weightKg) {
        super(trackingNumber, recipient, weightKg);
    }

    @Override
    double calculateCost() { return 100 + getWeightKg() * 10; }

    @Override
    int estimatedDays() { return 5; }
}

final class ExpressDelivery extends Delivery {
    ExpressDelivery(String trackingNumber, String recipient, double weightKg) {
        super(trackingNumber, recipient, weightKg);
    }

    @Override
    double calculateCost() { return 300 + getWeightKg() * 20; }

    @Override
    int estimatedDays() { return 1; }

    @Override
    String describe() {
        return super.describe() + " (экспресс)";
    }
}

final class PickupDelivery extends Delivery {
    PickupDelivery(String trackingNumber, String recipient, double weightKg) {
        super(trackingNumber, recipient, weightKg);
    }

    @Override
    double calculateCost() { return 50; }

    @Override
    int estimatedDays() { return 0; }
}

final class FreeDelivery extends Delivery {
    FreeDelivery(String trackingNumber, String recipient, double weightKg) {
        super(trackingNumber, recipient, weightKg);
    }

    @Override
    double calculateCost() { return 0; }

    @Override
    int estimatedDays() { return 7; }
}
```

**Решения.** Все конкретные классы `final` — потому что от них не планируется наследоваться, и `final` защищает от неожиданных наследников. `ExpressDelivery` переопределяет `describe()` и **расширяет** его через `super.describe() + " (экспресс)"` — не заменяет, а именно расширяет.

### DeliveryService

```java
class DeliveryService {
    private final List<Delivery> deliveries = new ArrayList<>();

    void add(Delivery delivery) {
        if (delivery == null) {
            throw new IllegalArgumentException("Доставка не может быть null");
        }
        deliveries.add(delivery);
    }

    double totalCost() {
        double total = 0;
        for (Delivery d : deliveries) {
            total += d.calculateCost();
        }
        return total;
    }

    Delivery findCheapest() {
        if (deliveries.isEmpty()) {
            return null;
        }
        Delivery cheapest = deliveries.get(0);
        for (Delivery d : deliveries) {
            if (d.calculateCost() < cheapest.calculateCost()) {
                cheapest = d;
            }
        }
        return cheapest;
    }

    void printAll() {
        for (Delivery d : deliveries) {
            System.out.println(d.describe());
        }
    }
}
```

**Решения.** `deliveries` — `private final` и инициализирован пустым списком. Все методы используют полиморфные `calculateCost()` и `describe()` — они не знают, какие именно доставки у них в списке, и это правильно. Завтра добавится `SameDayDelivery` — `DeliveryService` не придётся менять.

### Сценарий проверки

```java
public class Main {
    public static void main(String[] args) {
        DeliveryService service = new DeliveryService();

        service.add(new StandardDelivery("T-001", "Алиса", 2.0));
        service.add(new ExpressDelivery("T-002", "Боб", 2.0));
        service.add(new PickupDelivery("T-003", "Кэрол", 1.5));
        service.add(new FreeDelivery("T-004", "Дмитрий", 3.0));

        service.printAll();
        // Доставка T-001 для Алиса: 120.0 руб., ~5 дн.
        // Доставка T-002 для Боб: 340.0 руб., ~1 дн. (экспресс)
        // Доставка T-003 для Кэрол: 50.0 руб., ~0 дн.
        // Доставка T-004 для Дмитрий: 0.0 руб., ~7 дн.

        System.out.println("Итого: " + service.totalCost());   // 510.0

        Delivery cheapest = service.findCheapest();
        System.out.println("Самая дешёвая: " + cheapest.describe());
        // Самая дешёвая: Доставка T-004 для Дмитрий: 0.0 руб., ~7 дн.

        // Express дороже Standard при одинаковом весе
        Delivery standard = new StandardDelivery("X-1", "Тест", 2.0);
        Delivery express = new ExpressDelivery("X-2", "Тест", 2.0);
        System.out.println(express.calculateCost() > standard.calculateCost());   // true

        // Pickup дешевле всех
        Delivery pickup = new PickupDelivery("X-3", "Тест", 2.0);
        System.out.println(pickup.calculateCost() < standard.calculateCost());    // true
        System.out.println(pickup.calculateCost() < express.calculateCost());     // true
    }
}
```

### Ответы на вопросы

**1. Что произойдёт, если появится `SameDayDelivery`?** Придётся добавить **один** новый класс — `SameDayDelivery`. `DeliveryService` и `Delivery` менять не нужно: они работают с абстракцией. Это главное преимущество полиморфизма — расширение без изменения.

**2. Что если появится «стоимость страховки»?** Это зависит от того, как она устроена. Если страховка **зависит от типа доставки** — придётся добавить метод в `Delivery` и реализовать его в каждом наследнике. Если страховка **универсальна** (например, `weightKg * 5` для всех) — можно добавить в `Delivery` как общий метод. Если страховка — **опциональная** (есть только у некоторых доставок) — это отдельный интерфейс `Insurable`, реализуемый некоторыми наследниками. Выбор зависит от того, как в реальности устроена страховка.

**3. «Доставка с отслеживанием» и «без отслеживания»?** Это **два независимых свойства**: способ доставки (standard/express/pickup) и наличие отслеживания. Если выражать через наследование, — получится 4 класса (Standard, StandardTracked, Express, ExpressTracked...). Это комбинаторный взрыв. Правильно — вынести «отслеживание» в **отдельный интерфейс**:

```java
interface Trackable {
    void track();
}

class StandardDelivery extends Delivery { /* ... */ }
class TrackedStandardDelivery extends StandardDelivery implements Trackable { /* ... */ }
```

Но даже это не идеально — потому что комбинаций может быть много. Ещё лучше — **композиция**: `Delivery` содержит поле `Tracking tracking`, которое может быть `null` или реализацией. Тогда «отслеживание» — это не «наследование», а «свойство объекта». Об этом мы будем говорить в модуле 5.

**4. `new Delivery(...)` — почему невозможно?** Потому что `Delivery` — `abstract`. Компилятор не даст создать объект абстрактного класса. Это **хорошо**, потому что «просто доставка» — это абстракция; нет «способа доставки по умолчанию», всегда есть конкретный способ. Если бы `Delivery` был обычным классом, — кто-то мог бы создать `new Delivery(...)` и получить объект с `calculateCost()`, возвращающим что-то бессмысленное (например, `0`). Абстрактный класс это запрещает.

### Что можно улучшить

**Первое.** `DeliveryService.findCheapest()` возвращает `null`, если список пуст. Это некрасиво: вызывающий код должен проверять на `null`. Лучше вернуть `Optional<Delivery>` — но `Optional` мы ещё не проходили, и в учебной задаче `null` — приемлемо. В реальном коде — `Optional`.

**Второе.** `DeliveryService` использует `List`, но не возвращает его наружу. Если бы возвращал — нужно было бы возвращать `Collections.unmodifiableList`, чтобы снаружи не меняли. Здесь это не нужно, потому что список приватный и наружу не отдаётся.

**Третье.** `PickupDelivery` имеет `estimatedDays() = 0`. Это имеет смысл: «самовывоз» — можно забрать сразу. Но `0` может сбивать с толку: «за 0 дней» звучит странно. Может быть, лучше возвращать `1` («в течение дня»)? Это вопрос проектирования, и оба варианта допустимы. Главное — задокументировать выбор.

**Четвёртое.** Все классы `final` — но `Delivery` — `abstract`, и это правильно: `Delivery` для наследования, а конкретные классы — «конечные». Если завтра понадобится `TrackedStandardDelivery extends StandardDelivery`, — `final` на `StandardDelivery` помешает. Это компромисс: `final` защищает от нежелательного наследования, но ограничивает гибкость. Решение зависит от того, планируете ли вы расширять иерархию.

**Пятое.** `ExpressDelivery.describe()` переопределён — но если завтра появится ещё один «особый» тип (например, «хрупкая доставка»), — придётся переопределять `describe()` и в нём. Это **признак того, что `describe()` стоит вынести в отдельный метод или паттерн** (например, в `Delivery` добавить `getSuffix()` с пустой реализацией, а `describe()` вызывает его). Это уже за пределами нашего модуля, но полезно иметь в виду.

Все эти замечания — не «ошибки» учебного решения, а **точки роста**. Хорошее учебное решение — то, которое работает и понятно. Понимание того, что можно улучшить, — уже следующий шаг.