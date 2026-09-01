---
outline: deep
---

# 宿主嵌入

Stilla 生来就是为宿主集成设计的。Zig 或 C 宿主链接静态库（`zig-out/lib/libstilla.a`），并驱动两个入口点：`frontend.compile`（源码 → CFG AIR）和解释器（`interpreter.runWithHostAndLoader` / 分两阶段的 `buildProgram` + `runProgram` 路径）。宿主模块就是普通的 Zig 结构体；`builtin` 模块的输出钩子（尤其是 `builtin.print`）没有运行时默认实现——由嵌入方提供。

## 编译并运行的路径

```zig
const stilla = @import("stilla");

// 编译：入口模块 → CFG AIR。诊断信息以 `compilation.diag(s)`
// （file:line:col）的形式返回。
var compilation = try stilla.frontend.compile(allocator, .{ .entry = "app.st" });
defer compilation.deinit();
const program = &(compilation.program orelse return error.CompileFailed);

// 降级为逐模块的 LLIR 产物，并从入口导出开始运行。
// `term` 是一个 `Termination`：`.normal`（根的返回单元）或
// `.panic`（一条供上报的归属消息）。
var bundle = try stilla.artifact_bundle.ArtifactBundle.build(allocator, program);
var term = try stilla.interpreter.runWithHostAndLoader(allocator, &bundle.root, .{}, bundle.loaderHandle());
defer term.deinit(allocator);
```

## 定义宿主函数

可运行的示例是 `examples/embed/random_demo.zig`（`zig build embed` 会构建它、运行它并报告往返结果）。嵌入方给 Stilla 提供一个 `random` 宿主模块：每个成员一个 `pub fn`，模块状态以开头的 `*Rng` 参数注入（绝不是一个 Stilla 参数）：

```zig
/// 模块的状态：作为每个成员开头的 `*Rng` 参数注入。
const Rng = struct { prng: std.Random.DefaultPrng, io: std.Io, ... };

/// 宿主模块：`pub const symbol` 命名模块；每个 `pub fn` 都是一个成员绑定。
const random = struct {
    pub const symbol = "random";

    pub fn next(rng: *Rng) i32 {
        const v = rng.prng.random().int(i32);
        rng.record(v);
        return v;
    }

    /// 在 [0, max) 内均匀抽取。
    pub fn int(rng: *Rng, max: i32) i32 {
        const v = rng.prng.random().intRangeLessThan(i32, 0, max);
        rng.record(v);
        return v;
    }

    /// 重新为模块的 PRNG 播种——状态由 Stilla 修改。
    pub fn seed(rng: *Rng, s: i32) void {
        rng.prng = std.Random.DefaultPrng.init(@as(u64, @bitCast(@as(i64, s))));
    }

    /// 宿主时间（Unix 纪元以来的秒数）——宿主信息流入程序，
    /// 通过嵌入的 Io 读取。
    pub fn time(rng: *Rng) i32 { ... }
};
const random_desc: host_bind.ModuleDesc = host_bind.register(random);
const random_iface = host_bind.interfaceOf(random, "");
```

`register` 会派生一张排序、做签名检查的成员表；**接口**——即前端用来检查程序调用点的 `.st` 文本——由 `interfaceOf` 从同一套 Zig 签名派生，因此二者不可能漂移。Stilla 把它当作一个普通导入模块来访问：

```stilla
const random = import("random");
const builtin = import("builtin");
fn main() -> int32 {
    random.seed(random.time());
    let a = random.next();
    let b = random.int(6);
    builtin.print("draw a");
    builtin.print(builtin.str(a));
    a + b
}
```

## 分两阶段的嵌入路径

`buildProgram` 构建源码/接口映射、编译、降级并把模块合并进默认宿主注册表；`runProgram` 执行构建好的程序，因此一次构建可以运行多次：

```zig
var failed: stilla.frontend.Compilation = undefined;
var built = try stilla.interpreter.buildProgram(arena, .{
    .entry = "app",
    .sources = &.{.{ .specifier = "app", .text = APP }},
    .ifaces  = &.{.{ .specifier = "random", .text = random_iface }},
    .modules = &.{.{ .desc = &random_desc, .userdata = &rng }},
    .entry_fn = "main",
    .print = .{ .userdata = &print_sink, .invoke = appPrint },
}, &failed);
const term = try stilla.interpreter.runProgram(arena, &built);
```

`builtin.print` 没有运行时默认实现——由嵌入方提供输出钩子（上面的 `appPrint` 把消息加换行写到 stdout）。程序的 `main` 返回 `a + b`，示例随后把它与宿主观察到的抽取结果核对。

## 作为 C 嵌入方

静态库产物（`libstilla.a`）是为用其他语言编写的宿主提供的链接接口；目前公共 Zig API 是权威来源。

## 实现文档在哪里

完整细节位于 stilla 仓库：

- [host-bindings.md](https://github.com/zoltrazig/stilla/blob/main/docs/host-bindings.md)——类型化宿主绑定层：comptime 注册表、签名检查、嵌入（`random` 走查见 §3.4）
- [interpreter-vm.md](https://github.com/zoltrazig/stilla/blob/main/docs/interpreter-vm.md)——LLIR 解释器 VM：指令镜像、执行循环、宿主适配器、销毁
- [architecture.md](https://github.com/zoltrazig/stilla/blob/main/docs/architecture.md)——宿主嵌入接口与组件边界

*浓缩自 [stilla README](https://github.com/zoltrazig/stilla#readme)
和 `examples/embed/random_demo.zig`。*
