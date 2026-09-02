---
outline: deep
---

# Stilla 语言

Stilla 是一种用于嵌入式脚本的小型静态类型语言——游戏引擎、设备固件、配置与规则引擎都是它的用武之地。它通过 [Stilla Runtime](https://github.com/zoltrazig/stilla)（一个用 Zig 编写的编译器和解释器 VM）运行在 C/C++/Zig 宿主内部；本页只讨论这门语言本身。

一切设计都围绕一条原则：**你读到什么，机器就做什么。** 没有隐藏的 GC 线程、没有隐式运行的构造函数、没有编译器悄悄改变你的求值顺序。

## 你的第一个程序

```stilla
const builtin = import("builtin");

fn fib(n: int32) -> int32 {
    if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
}

fn main() -> void {
    builtin.print(builtin.str(fib(10)));
}
```

注意这里*缺少*了什么：没有 `return`、没有循环、没有隐式的 `print`。函数体是一个表达式——最后一个表达式的值就是返回值。重复靠递归。每个名字都要通过显式的 `import` 引入。这些省略都是刻意的设计决定，而不是缺陷。

## 熟悉的地盘

如果你熟悉 Rust、Kotlin 或 Swift，Stilla 的大部分会让你觉得似曾相识。

**一切皆表达式。** `if`、`match` 和代码块都会产生值：

```stilla
let sign = if (value >= 0) { 1 } else { -1 };
```

条件需要加括号——这是让解析器区分控制流 `if` 和结构体构造的关键。

**绑定是不可变的。** `let` 通过遮蔽（shadowing）来重新绑定，这让源码天然贴近 SSA 风格：

```stilla
let x = 10;
let x = x + 1;   // 右侧的 x 指代旧的绑定
```

**数据是结构体和带标签联合（tagged union）。** 没有类、没有继承、没有方法语法：

```stilla
union Shape {
    circle(int32), rect(int32, int32)
}

fn area(s: Shape) -> int32 {
    match (s) {
        Shape::circle(r) => r * r * 3,
        Shape::rect(w, h) => w * h,
    }
}
```

`match` 必须覆盖每个变体。`let` 只接受不可反驳（irrefutable）的模式，因此绑定永远不会引入隐藏的运行时失败。递归类型必须通过间接层（`box[T]`、`list[T]` 或函数类型）来打破存储环。

**泛型是编译期模板。** 每个特化都在编译期被展开并完成类型检查；没有任何泛型会残留到运行时：

```stilla
fn identity[T](move value: T) -> T {
    move value
}

let x = identity::[int32](42);   // 显式特化
let y = identity(7);             // T 由实参推断
```

没有 trait、没有约束、没有泛型函数类型。每个特化都会增加代码体积——这是为了换取极简的实现和简单的类型推断。

## 不同之处

其余的正是 Stilla 与你熟悉的东西分道扬镳的地方。每一处偏离，都是为了确定性或可嵌入性而做的刻意的权衡。

### 没有循环——递归与组合子

核心语言没有循环结构。重复靠递归，`iter` 模块提供 `fold` / `each` 组合子。优化器会把尾递归改写成真正的循环：源码里没有循环，机器码里有。

```stilla
const builtin = import("builtin");
const lists = import("list");
const iter = import("iter");

fn go(n: int32, acc: int32) -> int32 {        // 尾调用
    if (n == 0) { acc } else { go(n - 1, acc + n) }
}

fn main() -> void {
    builtin.assert(go(10, 0) == 55, "递归求和 0 + 1 + … + 10");
    let total = iter.fold[int32, int32](lists.range(0, 10), 0,
        fn(move acc: int32, borrow x: int32) -> int32 { acc + x });
    builtin.assert(total == 55, "fold 求和 0 + 1 + … + 10");
}
```

两者遍历的是同一个边界 `[0, 10]`：`go(10, 0)` 把 `n` 从 10 一路数到 0；`list.range` 是闭区间，所以 `range(0, 10)` 覆盖同样的十一个元素。两者都得到 55——而优化器会把 `go` 改写成真正的循环。

### 无 GC——显式所有权

值分为两类：

- **copy（可复制）**——可隐式复制，销毁是无操作：数值标量（`byte`、`int32`、`uint32`、`int64`、`uint64`、`float32`、`float64`）、`bool`、`str`、函数值。
- **unique（唯一）**——不能被隐式复制；最多移动一次，恰好销毁一次，可被多次借用。任何带 `drop` 钩子、或包含 unique 组件的结构体都是 unique。

一个结构体最多声明一个销毁钩子——而声明钩子正是让结构体成为 unique 的原因：

```stilla
struct Token {
    id: int32;

    drop(token) {                      // 值消亡时恰好执行一次
        builtin.print("drop token " + builtin.str(token.id));
    }
}
```

无论值在哪里消亡——作用域结束、显式 `drop`、或是被 `move` 进被调函数——钩子都恰好执行一次。借用永远不会触发它。

在正常控制流下，销毁顺序是完全确定的：先执行用户 `drop` 钩子，再按声明顺序的逆序销毁 unique 字段，最后将值标记为已销毁。局部变量在作用域结束时按创建顺序的逆序销毁。结构体*不是*类：没有构造函数、没有可见性控制。

三个显式操作，全部静态检查：

```stilla
fn show(borrow t: Token) -> int32 {   // borrow（借用）：只读视图，所有权不转移
    t.id
}

fn consume(move t: Token) -> void {   // move（移动）：所有权进入函数
    drop t;                           // 显式销毁
}

fn main() -> void {
    let a = Token { id: 1 };
    builtin.print(builtin.str(show(a)));   // borrow：a 仍然存活
    consume(move a);                       // move：所有权离开
    let b = Token { id: 2 };
    drop b;                                // drop：显式销毁
    let c = Token { id: 3 };               // 没有显式 drop：作用域结束时销毁
}
```

使用已移动的值是编译错误。只在部分分支上被释放的绑定会变成 **maybe-unique**：编译器会在每个没有释放它的分支上补上析构，汇合之后它统一处于已释放状态——不需要任何运行时记录。回报是：没有 GC 停顿、没有后台回收器、释放时机在编译期即可预测。

### 没有闭包——两种补偿

函数和 lambda 不能捕获周围的局部绑定。作为交换，函数值只是简单的单态化代码引用：没有堆分配的闭包环境、没有面向代码生成器的捕获分析。有两种补偿方式：

1. **函数值字段**——结构体可以存函数值，配合显式接收者（没有 `receiver.method()` 这种语法糖）。
2. **上下文穿线（context threading）**——`iter` 模块的 `*_with` 组合子接受一个被借用的上下文，在每次调用时传给操作——这里是一个结构体值，正是闭包原本会捕获的东西：

```stilla
struct Scale {
    factor: int32;
}

let scale = Scale { factor: 3 };

let sum = iter.fold_with[int32, int32, Scale](lists.range(1, 10), 0, scale,
    fn(move acc: int32, borrow ctx: Scale, borrow x: int32) -> int32 {
        acc + x * ctx.factor
    });
```

`fold_with` 在每次调用时都把被借用的 `Scale` 值穿线传给 step；lambda 从不接触自身参数以外的任何东西。

### 单一求值规则，确定的失败行为

整个语言只有一条求值顺序规则：子表达式按源码顺序从左到右、恰好求值一次；`and` / `or` 会短路。运行时的失败分为两类：

- **数值行为是规定好的，而不是陷阱。** 整数运算按 2³² / 2⁶⁴ 取模回绕——溢出永不陷阱；`div` / `rem` 除以零会陷阱（`int32_min div -1` 回绕，`int64_min div -1` 陷阱）。浮点遵循 IEEE 754——除以零得到 `±inf` / NaN，永不陷阱，NaN 载荷无损往返（类型名是 `float32` 和 `float64`）。移位把计数按 32 / 64 取模。数值 `as` 转换永不陷阱：浮点转整数截断并向目标范围饱和（NaN 变为 0）。
- **确定性的陷阱。** 非法的 `any` 恢复、对短列表的消耗式解构、越界的 `array.get` / `array.set`、非法的 `string` 操作（越界偏移、非法 UTF-8）都会陷阱——绝不是未定义行为——终止方式与 `builtin.panic` 完全相同。

### 恐慌（panic）：终止，而不解栈

`builtin.panic` 或任何陷阱都会**终止整个执行上下文**：没有栈展开、没有待执行的析构（局部变量、临时值、模块拆除——统统不会执行）。控制权交回嵌入宿主，由宿主负责清理。没有 `try`/`catch`——错误处理靠 `Option`/`Result` 值、`builtin.assert` 和终止性恐慌。

```stilla
const builtin = import("builtin");

fn divide(a: int32, b: int32) -> int32 {
    builtin.assert(b != 0, "division by zero");
    a / b
}
```

`assert` 在边界处就响亮地失败，而不是让陷阱在更深处发生——这是前置条件检查，不是异常机制。

### 文件即模块，模块即值

每个 `.st` 源文件都是一个隐式、不可变的模块结构体。`calc.add(20, 22)` 就是普通的成员访问——和结构体共用同一个 `.` 模型，而不是静态函数查找。`import("...")` 只出现在模块级的 `const` 初始化器中，静态解析，禁止循环导入。每个模块在每个执行上下文中至多实例化一次。

```stilla
// calc.st
fn add(a: int32, b: int32) -> int32 { a + b }

// main.st
const calc = import("calc");
const builtin = import("builtin");

fn main() -> void {
    builtin.print(builtin.str(calc.add(20, 22)));   // 42
}
```

`calc.st` 的每个顶层声明都是模块值的成员；没有需要同步维护的导出清单。

### 嵌入边界

宿主集成是一等目标，因此语言有两种边界类型，外加一种宿主声明的类型：

- **`any`**——带运行时类型标签的顶层类型。恢复（recover）必须显式命名类型（`a as int32`，不匹配则陷阱），或使用 `match` 的类型测试分支（`int32 n => ...`）——由于标签空间是开放的，对 `any` 的 `match` 必须包含 `_` 通配臂。`any` 本身是 unique。
- **`hostdata`**——不透明、类型擦除的宿主载荷。只有宿主能构造它；Stilla 可以移动、借用、存储并把它传回，但永远无法检查或转换它。它没有类型身份，也不能进入 `any`。
- **不透明宿主类型**——`opaque type Array[T];`，只在 stdlib/宿主模块接口中声明。与 `hostdata` 不同，它们保留正常的标称类型身份：编译器知道这是 `Array[int32]`，只是不知道其内部实现。它们可以进入 `any`、作为泛型使用、并用 `as`/`match` 恢复。

标准库的集合类型就是不透明宿主类型：`array` 是宿主实现的连续缓冲区，`hashmap` 是连续桶的哈希表。它们声明即 unique，因此 `set`/`insert`/`remove` 都是**消耗式更新（consuming updates）**——`move` 进、更新后的值出——让宿主原地修改同一块缓冲区，同时源码语义保持函数式：

```stilla
let m = hm.empty::[int32, str]();
let m = hm.insert(move m, 1, "one");
let m = hm.insert(move m, 2, "two");
```

没有别名就没有部分修改：旧值已死，新值接管续体，语言不需要可变变量就能获得近乎可变容器的运行时性能。

### 标准库

`builtin`（print、str、box/unbox、panic、assert、hash，以及 `Option[T]` 类型成员）、`list`、`math`、`string`（按 Unicode 码点操作，绝不暴露字节偏移）、`iter`（each / fold / try_fold，以及各自的 `*_with` 与 `consume_*` 变体）、`array`、`hashmap`。全部都是普通的可导入模块——没有隐式注入的 `print()`、没有隐式数值转换。核心保持极小：只有 `list[T]` 是抽象内建类型；`array`/`hashmap` 是库类型，可以替换而不改变语言。

## 它适合做什么（以及不适合做什么）

**适合：** 嵌入式脚本层（游戏引擎、设备固件、配置/规则引擎），想要与 C/C++/Rust 宿主之间保持干净边界；对硬确定性有要求的系统（可复现测试、回放、审计）；机器生成代码的目标；在极简语言中讲授所有权、ADT 和函数式核心。

**不适合：** 大型应用开发（没有闭包、trait、动态分发或并发）；繁重的数值计算（只有标量类型）；需要优雅恢复的场景（错误会终止）；需要插件的生态系统（没有反射式的扩展点）。

## 状态

Stilla 目前是 **v1.3 草案**。语法、特性与编译器都在变化演进之中。规范文档位于 [stilla 仓库](https://github.com/zoltrazig/stilla/tree/main/spec)：核心语言、类型与所有权、运行时、标准库与内建函数规范，外加一份规范的 ABNF 语法。当 Core 与 Runtime 在执行细节上不一致时，以 Runtime 规范为准。
