# Основы потоков в Java

## Теория

**Поток (Thread)** — это независимая последовательность выполнения кода внутри программы. По умолчанию в Java-программе уже есть один поток — главный (`main`).

Чтобы создать свой поток, есть два основных способа:

1.  **Унаследовать класс `Thread`** и переопределить метод `run()`.
2.  **Реализовать интерфейс `Runnable`** и передать его в конструктор `Thread`. (Этот способ предпочтительнее, так как Java не поддерживает множественное наследование классов).

Вот как выглядит создание потока через `Runnable`:

```java
public class MyTask implements Runnable {
    @Override
    public void run() {
        System.out.println("Поток работает: " + Thread.currentThread().getName());
    }
}

// Где-то в коде:
Thread thread = new Thread(new MyTask());
thread.start(); // запускает поток
```

<div style="background-color: #251445; border-left: 4px solid #00E5D1; padding: 1rem; margin: 1.5rem 0;">
  <strong style="color: #00E5D1;">Важно:</strong> Всегда вызывайте <code>start()</code>, а не <code>run()</code> напрямую. Вызов <code>run()</code> просто выполнит код в текущем потоке, не создавая новый.
</div>

## Микрозадача: Сумма элементов массива

**Задача:** Напишите программу, которая в отдельном потоке вычисляет сумму всех элементов массива целых чисел.

**Решение:**

```java
import java.util.Arrays;

public class ArraySumTask implements Runnable {
    private final int[] array;

    public ArraySumTask(int[] array) {
        this.array = array;
    }

    @Override
    public void run() {
        int sum = 0;
        for (int value : array) {
            sum += value;
        }
        System.out.println("Сумма элементов: " + sum);
    }

    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        Thread sumThread = new Thread(new ArraySumTask(numbers));
        sumThread.start();
    }
}
```

## 🎯 Самостоятельная задача: Произведение элементов

А теперь попробуйте сами. Напишите программу, которая в отдельном потоке вычисляет **произведение** элементов массива. Используйте ту же структуру, что и в примере выше: создайте класс, реализующий `Runnable`, и запустите его в новом потоке.
