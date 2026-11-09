---
title: Собираем всё вместе
description: "Как спроектировать систему заказов в доставке с нуля — применяя инкапсуляцию, наследование, полиморфизм, композицию, DI и SOLID осознанно, а не механически"
outline: [2, 3]
---

# 7. Собираем всё вместе

## Где вы это уже видели

Шесть модулей мы изучали инструменты по отдельности. Инкапсуляция, наследование, полиморфизм, композиция, DI, SOLID — каждый принцип и каждая техника разбирались на маленьких примерах, где было ясно, что к чему. Пора собрать всё в одном разборе: спроектировать систему с нуля, принимая решения осознанно и объясняя, почему именно так.

Этот урок — не «ещё одна порция теории». Это попытка показать, как все инструменты работают вместе на задаче, которая ближе к реальной работе, чем отдельные упражнения. Мы будем проектировать систему заказов в службе доставки. Небольшую, но с достаточным количеством деталей, чтобы увидеть, где какой принцип применяется.

**Ситуация первая.** Вы приходите на собеседование, и вам говорят: «Спроектируйте систему заказов в доставке». Вы знаете все принципы SOLID по отдельности, но не понимаете, с чего начать и как двигаться. Этот урок — про то, как двигаться.

**Ситуация вторая.** Вы работаете над проектом, и коллега говорит: «Здесь надо применить SRP». Вы соглашаетесь, но не понимаете, где именно проходит граница. Этот урок — про то, как находить границы.

**Ситуация третья.** Вы читаете чужой код и видите красивые паттерны: стратегии, фасады, DI. Всё на месте. Но что-то не так: код работает, но ощущение, что паттерны применены ради паттернов, а не ради задачи. Этот урок — про то, как применять паттерны осознанно.

**Ситуация четвёртая.** Вы пишете код сами, и через полгода он превращается в кашу. Принципы вы знаете, но применить их к своему коду не получается: слишком много деталей, слишком много связей, непонятно, что менять. Этот урок — про то, как видеть структуру в хаосе.

**Ситуация пятая.** Вы спорите с коллегой, нужен ли интерфейс. Он говорит «overengineering», вы говорите «нужен для тестов». Никто не может обосновать. Этот урок — про то, как обосновывать решения, а не спорить вкусами.

**Ситуация шестая.** Вы видите код, где класс на 500 строк, и понимаете, что он «делает слишком много». Но как разделить — не понимаете. И начинаете дробить на мелкие классы, которые всегда используются вместе, и становится не лучше, а хуже. Этот урок — про то, как разделять осмысленно.

Если хотя бы одна из этих ситуаций вам знакома — урок для вас.

## Что мы будем собирать

Задача: служба доставки, которая принимает заказы, рассчитывает стоимость, проводит оплату, назначает доставку и уведомляет клиента. У заказа есть товары, адрес доставки, клиент, способ оплаты и способ доставки. Система должна быть расширяемой: завтра может появиться новый способ оплаты, новый способ доставки, новая скидка.

Мы будем двигаться по шагам, как при реальном проектировании: сначала модель, потом сервисы, потом расширения, потом сборка. На каждом шаге будем принимать решения и объяснять, какой принцип за них отвечает.

## Шаг 1. Модель

Начинаем с модели. Это самое важное: если модель неправильная, никакие принципы не спасут. Модель — это «что» есть в системе, независимо от того, «как» с ним работают.

Заказ — это:

- номер заказа, дата создания, клиент, адрес доставки;
- список товаров;
- способ оплаты и способ доставки;
- статус (новый, оплачен, отправлен, доставлен).

Начинаем с классов, которые представляют эти сущности.

```java
final class Order {
    private final String id;
    private final LocalDateTime createdAt;
    private final Customer customer;
    private final Address shippingAddress;
    private final List<OrderItem> items;
    private OrderStatus status;

    Order(String id, Customer customer, Address shippingAddress, List<OrderItem> items) {
        if (id == null || id.isEmpty()) throw new IllegalArgumentException("Номер заказа обязателен");
        if (customer == null) throw new IllegalArgumentException("Клиент обязателен");
        if (shippingAddress == null) throw new IllegalArgumentException("Адрес доставки обязателен");
        if (items == null || items.isEmpty()) throw new IllegalArgumentException("Заказ не может быть пустым");

        this.id = id;
        this.createdAt = LocalDateTime.now();
        this.customer = customer;
        this.shippingAddress = shippingAddress;
        this.items = List.copyOf(items);
        this.status = OrderStatus.NEW;
    }

    String getId() { return id; }
    Customer getCustomer() { return customer; }
    Address getShippingAddress() { return shippingAddress; }
    List<OrderItem> getItems() { return items; }
    OrderStatus getStatus() { return status; }

    void markPaid() {
        if (status != OrderStatus.NEW) throw new IllegalStateException("Оплатить можно только новый заказ");
        status = OrderStatus.PAID;
    }

    void markShipped() {
        if (status != OrderStatus.PAID) throw new IllegalStateException("Отправить можно только оплаченный заказ");
        status = OrderStatus.SHIPPED;
    }

    Money total() {
        return items.stream()
            .map(OrderItem::subtotal)
            .reduce(Money.ZERO, Money::plus);
    }
}
```

Несколько решений, которые стоит проговорить.

Заказ неизменяем по составу (поля `id`, `customer`, `items` — `final`). Это инкапсуляция и неизменяемость из модуля 2: заказ не должен меняться после создания. Список товаров копируется через `List.copyOf`, чтобы снаружи не могли его изменить.

Статус — изменяемое поле, но менять его можно только через методы `markPaid` и `markShipped`, которые проверяют допустимость перехода. Это валидация из модуля 2 и инкапсуляция: снаружи нельзя «просто так» поставить любой статус.

`Money` — отдельный класс-значение для денег, а не `double`. Это из модуля 2: деньги на `double` — плохо. Сделаем его простым:

```java
final class Money {
    static final Money ZERO = new Money(BigDecimal.ZERO, "RUB");

    private final BigDecimal amount;
    private final String currency;

    Money(BigDecimal amount, String currency) {
        if (amount == null || currency == null) throw new IllegalArgumentException();
        this.amount = amount;
        this.currency = currency;
    }

    Money plus(Money other) {
        if (!currency.equals(other.currency)) throw new IllegalArgumentException("Разные валюты");
        return new Money(amount.add(other.amount), currency);
    }

    Money multiply(BigDecimal factor) {
        return new Money(amount.multiply(factor), currency);
    }

    @Override
    public String toString() { return amount + " " + currency; }
}
```

`OrderItem` и `Address` — простые неизменяемые классы-значения. `Customer` содержит имя, email и, возможно, признак VIP. Детали опустим — они не важны для разбора.

Что мы применили на этом шаге: инкапсуляцию (приватные поля, доступ через методы), неизменяемость (`final`, `List.copyOf`), валидацию (проверки в конструкторе и в методах), классы-значения (`Money`, `Address`).

## Шаг 2. Сервисы

Модель готова. Теперь — «что с ней делают». Создание заказа, расчёт стоимости, оплата, доставка, уведомление. Каждое действие — отдельный сервис. Это SRP из урока 2: у каждого сервиса одна причина для изменения.

Начнём с самого простого — сервиса создания заказа.

```java
class OrderService {
    private final OrderRepository repository;

    OrderService(OrderRepository repository) {
        this.repository = repository;
    }

    Order create(Customer customer, Address address, List<OrderItem> items) {
        Order order = new Order(UUID.randomUUID().toString(), customer, address, items);
        repository.save(order);
        return order;
    }
}
```

`OrderRepository` — интерфейс для сохранения заказов. Конкретная реализация — `JpaOrderRepository` или `InMemoryOrderRepository` — подставляется снаружи. Это DI из модуля 5 и DIP из урока 6.

Сервис расчёта стоимости:

```java
class PricingService {
    private final DiscountStrategy discount;

    PricingService(DiscountStrategy discount) {
        this.discount = discount;
    }

    Money calculate(Order order) {
        Money base = order.total();
        return base.plus(discount.apply(base));
    }
}
```

Здесь `DiscountStrategy` — интерфейс, конкретные реализации — `NoDiscount`, `VipDiscount`, `PromoDiscount` и т. д. Это полиморфизм из модуля 4 и паттерн «Стратегия» из урока 7 того же модуля. И это OCP из урока 3: новый тип скидки — новый класс, `PricingService` не меняется.

Сервис оплаты:

```java
class PaymentService {
    private final PaymentProcessor processor;

    PaymentService(PaymentProcessor processor) {
        this.processor = processor;
    }

    boolean pay(Order order, Money amount) {
        boolean success = processor.process(order.getId(), amount);
        if (success) {
            order.markPaid();
        }
        return success;
    }
}
```

`PaymentProcessor` — интерфейс. `StripeProcessor`, `SbpProcessor`, `CryptoProcessor` — реализации. Полиморфизм и стратегия. И DIP: `PaymentService` зависит от абстракции, не от Stripe.

Сервис доставки:

```java
class DeliveryService {
    private final ShippingStrategy strategy;

    DeliveryService(ShippingStrategy strategy) {
        this.strategy = strategy;
    }

    Money cost(Order order) {
        return strategy.cost(order);
    }

    int estimatedDays(Order order) {
        return strategy.estimatedDays(order);
    }
}
```

`ShippingStrategy` — интерфейс. `CourierShipping`, `PostShipping`, `PickupShipping` — реализации. Та же идея: полиморфизм, стратегия, OCP.

Сервис уведомлений:

```java
class NotificationService {
    private final NotificationSender sender;

    NotificationService(NotificationSender sender) {
        this.sender = sender;
    }

    void notifyOrderCreated(Order order) {
        sender.send(order.getCustomer().getEmail(), "Заказ " + order.getId() + " создан");
    }
}
```

`NotificationSender` — интерфейс. `EmailSender`, `SmsSender`, `PushSender` — реализации. Если нужно отправить во все каналы — `CompositeSender`, который содержит список и вызывает каждый. Это композиция из модуля 5.

Что мы применили на этом шаге: SRP (каждый сервис — одна ответственность), DI (зависимости через конструктор), DIP (зависимости от интерфейсов), полиморфизм (стратегии), композиция (в `CompositeSender`). И всё это — на основе модели из шага 1.

## Шаг 3. Полиморфизм и стратегии

Разберём подробнее, как устроены стратегии. Это ядро расширяемости системы.

`DiscountStrategy`:

```java
interface DiscountStrategy {
    Money apply(Money base);
}

class NoDiscount implements DiscountStrategy {
    public Money apply(Money base) { return Money.ZERO; }
}

class VipDiscount implements DiscountStrategy {
    public Money apply(Money base) {
        return base.multiply(new BigDecimal("0.15")).negate();
    }
}

class PromoDiscount implements DiscountStrategy {
    private final String promoCode;

    PromoDiscount(String promoCode) { this.promoCode = promoCode; }

    public Money apply(Money base) {
        if (promoCode.equals("SAVE10")) {
            return base.multiply(new BigDecimal("0.10")).negate();
        }
        return Money.ZERO;
    }
}
```

Обратите внимание: `apply` возвращает скидку (отрицательную сумму), а не итоговую стоимость. Это позволяет `PricingService` просто сложить базовую стоимость и скидку. Такое разделение — про ясность: скидка — это отдельная величина, а не «стоимость минус что-то».

`PaymentProcessor`:

```java
interface PaymentProcessor {
    boolean process(String orderId, Money amount);
}

class StripeProcessor implements PaymentProcessor {
    private final String apiKey;

    StripeProcessor(String apiKey) { this.apiKey = apiKey; }

    public boolean process(String orderId, Money amount) {
        // ... вызов Stripe API ...
        return true;
    }
}

class SbpProcessor implements PaymentProcessor {
    public boolean process(String orderId, Money amount) {
        // ... вызов СБП ...
        return true;
    }
}
```

`ShippingStrategy`:

```java
interface ShippingStrategy {
    Money cost(Order order);
    int estimatedDays(Order order);
}

class CourierShipping implements ShippingStrategy {
    public Money cost(Order order) {
        if (order.getShippingAddress().isWithinMkad()) {
            return new Money(new BigDecimal("200"), "RUB");
        }
        return new Money(new BigDecimal("400"), "RUB");
    }

    public int estimatedDays(Order order) { return 1; }
}

class PostShipping implements ShippingStrategy {
    public Money cost(Order order) {
        return new Money(new BigDecimal("150"), "RUB");
    }

    public int estimatedDays(Order order) { return 5; }
}

class PickupShipping implements ShippingStrategy {
    public Money cost(Order order) {
        return new Money(new BigDecimal("50"), "RUB");
    }

    public int estimatedDays(Order order) { return 0; }
}
```

Всё это — уже знакомые нам паттерны. Ничего нового, но теперь они работают вместе.

## Шаг 4. Композиция и DI

Сервисы готовы, стратегии готовы. Пора собрать систему. Это шаг, где композиция и DI из модуля 5 проявляются в полной мере.

Фасад для типичных сценариев (из урока 6 модуля 5):

```java
final class CheckoutFacade {
    private final OrderService orders;
    private final PricingService pricing;
    private final PaymentService payments;
    private final DeliveryService delivery;
    private final NotificationService notifications;

    CheckoutFacade(OrderService orders, PricingService pricing,
                   PaymentService payments, DeliveryService delivery,
                   NotificationService notifications) {
        if (orders == null || pricing == null || payments == null
                || delivery == null || notifications == null) {
            throw new IllegalArgumentException("Все зависимости обязательны");
        }
        this.orders = orders;
        this.pricing = pricing;
        this.payments = payments;
        this.delivery = delivery;
        this.notifications = notifications;
    }

    Order placeOrder(Customer customer, Address address, List<OrderItem> items) {
        Order order = orders.create(customer, address, items);
        notifications.notifyOrderCreated(order);
        return order;
    }

    PaymentResult checkout(Order order) {
        Money total = pricing.calculate(order);
        Money deliveryCost = delivery.cost(order);
        Money grandTotal = total.plus(deliveryCost);

        boolean paid = payments.pay(order, grandTotal);
        if (!paid) {
            return PaymentResult.failed("Оплата не прошла");
        }
        return PaymentResult.success(order, grandTotal);
    }
}
```

`CheckoutFacade` не знает, какая скидка, какой платёжный процессор, какая доставка. Он работает с абстракциями. Всё конкретное — снаружи, в `main`.

Сборка в `main`:

```java
public class Main {
    public static void main(String[] args) {
        // Модель и инфраструктура
        OrderRepository orderRepository = new InMemoryOrderRepository();

        // Стратегии
        DiscountStrategy discount = new VipDiscount();
        PaymentProcessor payment = new StripeProcessor(System.getenv("STRIPE_KEY"));
        ShippingStrategy shipping = new CourierShipping();
        NotificationSender notifier = new EmailSender("smtp.example.com");

        // Сервисы
        OrderService orderService = new OrderService(orderRepository);
        PricingService pricingService = new PricingService(discount);
        PaymentService paymentService = new PaymentService(payment);
        DeliveryService deliveryService = new DeliveryService(shipping);
        NotificationService notificationService = new NotificationService(notifier);

        // Фасад
        CheckoutFacade checkout = new CheckoutFacade(
            orderService, pricingService, paymentService,
            deliveryService, notificationService
        );

        // Использование
        Customer alice = new Customer("alice@example.com", "Алиса", CustomerType.VIP);
        Address address = new Address("Москва", "Тверская", "1");
        List<OrderItem> items = List.of(new OrderItem("Книга", new Money(new BigDecimal("1000"), "RUB"), 1));

        Order order = checkout.placeOrder(alice, address, items);
        PaymentResult result = checkout.checkout(order);

        System.out.println(result.isSuccess() ? "Оплачено" : "Ошибка: " + result.message());
    }
}
```

Обратите внимание: `main` — это единственное место, где собраны конкретные классы. Всё остальное работает с абстракциями. Если завтра нужно заменить Stripe на СБП — одна строчка в `main`. Если завтра нужно заменить VIP-скидку на промокод — тоже одна строчка. Это и есть сила DI и композиции.

## Шаг 5. SOLID в действии

Теперь пройдёмся по SOLID и покажем, где какой принцип применён.

**SRP.** У каждого класса одна причина для изменения. `Order` — модель, `OrderService` — создание заказов, `PricingService` — расчёт стоимости, `PaymentService` — оплата, `DeliveryService` — доставка, `NotificationService` — уведомления. Каждый меняется по своей причине.

**OCP.** Новый способ оплаты — новый класс `PaymentProcessor`, `PaymentService` не меняется. Новый способ доставки — новый `ShippingStrategy`. Новая скидка — новый `DiscountStrategy`. Система открыта для расширения и закрыта для изменения.

**LSP.** Все реализации `PaymentProcessor` ведут себя как `PaymentProcessor`: принимают `orderId` и `amount`, возвращают `boolean`. Никакая реализация не «врёт» и не бросает `UnsupportedOperationException`. То же — для `ShippingStrategy`, `DiscountStrategy`, `NotificationSender`.

**ISP.** Интерфейсы маленькие. `PaymentProcessor` — один метод. `DiscountStrategy` — один. `ShippingStrategy` — два (стоимость и срок). `NotificationSender` — один. Клиент зависит только от того, что использует. Если бы мы сделали «толстый» интерфейс `OrderOperations` со всеми операциями сразу, клиенты зависели бы от лишнего.

**DIP.** Все зависимости направлены к абстракциям. `PaymentService` зависит от `PaymentProcessor`, а не от `StripeProcessor`. `PricingService` — от `DiscountStrategy`, а не от `VipDiscount`. `DeliveryService` — от `ShippingStrategy`. `CheckoutFacade` — от сервисов (которые сами абстракции по своим интерфейсам). `main` — единственное место, где выбраны конкретные реализации.

**Инкапсуляция.** Поля приватные, доступ через методы. `Order` не даёт изменить состав после создания. `Money` неизменяем. `OrderRepository` возвращает копию списка, а не сам список.

**Наследование.** Мы его почти не использовали — и это правильно. В этой системе почти нет «is-a». Есть «has-a» и «реализует интерфейс». Наследование было бы уместно, например, для `Customer` (если бы у нас были `Person` и `Company` как разные типы клиентов), но мы этого не делали — не было необходимости.

**Полиморфизм.** Работает везде, где есть интерфейсы. `processor.process(orderId, amount)` — вызывается разная реализация. `strategy.cost(order)` — то же. `discount.apply(base)` — то же. И клиент не знает, какая именно.

**Композиция.** `CheckoutFacade` содержит сервисы. `OrderService` содержит репозиторий. `PricingService` содержит стратегию. Всё — через композицию, не через наследование.

**DI.** Все зависимости передаются через конструктор. Никто не создаёт зависимости сам, кроме `main`.

## Шаг 6. Расширение

Проверим, как система ведёт себя при расширении. Три сценария.

**Сценарий 1.** Завтра появляется новый способ оплаты — ЮMoney. Добавляем класс `YooMoneyProcessor implements PaymentProcessor`. В `main` меняем одну строчку. `PaymentService` не трогаем. Другие сервисы не трогаем.

**Сценарий 2.** Завтра появляется новая скидка — «студенческая». Добавляем `StudentDiscount implements DiscountStrategy`. В `main` меняем одну строчку. `PricingService` не трогаем.

**Сценарий 3.** Завтра нужна отправка уведомлений в Telegram. Добавляем `TelegramSender implements NotificationSender`. В `main` — или, если нужно несколько каналов сразу, — `CompositeSender` со списком. `NotificationService` не трогаем.

В каждом случае расширение — это добавление нового класса и одной строчки в `main`. Существующий код не меняется. Это и есть OCP в действии.

Проверим, что будет, если нужно изменить поведение. Например, добавить «бесплатную доставку при заказе от 5000». Это не «новый способ доставки», а «новое правило». Скорее всего, оно живёт в `CourierShipping` или в `PricingService`. Это изменение — и оно правильно, что происходит в одном месте.

## Микрозадача 1

В системе выше `CheckoutFacade.checkout` выполняет несколько шагов: расчёт стоимости, оплата, возврат результата. Определите, не нарушает ли этот метод SRP. И если нарушает — как разделить.

### Разбор

С одной стороны, `checkout` делает «одно» — проводит оплату заказа. С другой — внутри два шага: расчёт (`pricing.calculate` + `delivery.cost`) и собственно оплата (`payments.pay`).

С точки зрения SRP «одна причина для изменения» — у `checkout` две причины: «изменились правила расчёта стоимости» и «изменились правила оплаты». Формально — две ответственности.

Но здесь есть нюанс. `CheckoutFacade` — это фасад (модуль 5). Его ответственность — собрать типичный сценарий. Он делегирует и расчёт, и оплату сервисам. Сам он не «считает» и не «платит». Он только собирает.

С точки зрения SRP это нормально: у фасада одна причина для изменения — «изменился сценарий оформления заказа». Если правила расчёта поменяются — фасад не меняется, меняется `PricingService`. Если правила оплаты — тоже.

**Мораль.** SRP — это про «причины для изменения», а не «количество вызовов внутри метода». Фасад может вызывать десять сервисов, но если у него одна причина для изменения (сценарий), — SRP соблюдается.

## Микрозадача 2

В системе выше `CourierShipping.cost` содержит `if (order.getShippingAddress().isWithinMkad())`. Это `if` по «типу» или по «значению»? И нарушает ли это OCP?

### Разбор

Это `if` по значению (адрес внутри МКАД или нет), а не по типу (не «если это курьерская доставка, то...», а «если адрес внутри МКАД, то...»).

OCP — про типы: «при добавлении нового типа не меняй код». Здесь новый тип не добавляется — меняется значение адреса. Это не расширение, это вариация внутри одного типа. OCP не нарушается.

Если бы мы сделали «доставка внутри МКАД» и «доставка за МКАД» как отдельные типы (`InsideMkadCourierShipping`, `OutsideMkadCourierShipping`), — это было бы странно: оба типа — «курьерская доставка», различие — в значении адреса, а не в типе доставки. Такое дробление было бы overengineering.

**Мораль.** OCP — про типы, а не про значения. `if` по значению — нормально. `if` по типу — кандидат на стратегию.

## Самостоятельная задача

Возьмите систему из этого урока и расширьте её двумя способами.

**Первое.** Добавьте новую скидку: «первый заказ — скидка 10%». Она должна работать только для клиентов, у которых ещё не было заказов. Подумайте, как это выразить: нужен ли доступ к истории заказов? Если да — где он должен жить? В `DiscountStrategy`? В отдельном сервисе? В `OrderRepository`?

**Второе.** Добавьте возможность отправлять уведомления в два канала сразу — email и SMS. Не меняя `NotificationService`. Подумайте, как это выразить через композицию: `CompositeSender`, который содержит список и вызывает каждый. Или через `Map<Channel, Sender>`, как в одном из уроков модуля 4.

Подумайте:

- какие классы придётся добавить?
- какие классы придётся изменить? Почему именно они?
- если изменение затрагивает много классов — возможно, что-то не так с дизайном. Что именно?
- если изменение затрагивает один класс плюс `main` — это хороший знак. Почему?

Затем ответьте на вопрос: если завтра появится третий канал уведомлений — Telegram, — сколько файлов придётся изменить? А если четвёртый — WhatsApp? Есть ли предел, после которого текущий дизайн перестаёт быть удобным? Как бы вы изменили дизайн, чтобы он оставался удобным и при двадцати каналах?

Готового ответа не будет. Это ваша честная проверка на понимание: видите ли вы, как принципы работают вместе, и умеете ли расширять систему без боли.

## Что дальше

Мы закончили модуль про проектирование и SOLID. Разобрали пять принципов по отдельности и собрали их в одной системе. Увидели, что принципы — не догма, а инструменты, которые работают вместе.

На этом основная часть курса по ООП заканчивается. Дальше — практикум по модулю 6 и переход к другим разделам: многопоточности, работе с коллекциями, функциональному программированию в Java. Всё, что мы прошли — инкапсуляция, наследование, полиморфизм, композиция, DI, SOLID — будет использоваться в каждом из них.

А пока — маленькое упражнение на наблюдательность. Откройте любой свой проект (или открытый проект на Java) и найдите класс, который вы писали давно и который сейчас кажется вам плохим. Прочитайте его и попробуйте ответить на вопрос: какой принцип здесь нарушен? Один? Несколько? Если несколько — какой из них «главный»? Если ни один — возможно, код просто кажется плохим, потому что вы выросли как программист. И это тоже хороший результат: значит, вы стали лучше видеть.