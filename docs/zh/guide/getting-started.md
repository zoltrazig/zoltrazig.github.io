---
outline: deep
---

# 快速开始

[Stilla Runtime](https://github.com/zoltrazig/stilla) 是 Stilla v1.3 运行时及其工具链的 Zig 实现：前端编译器（模块图 → 类型检查的 CFG AIR → LLIR 汇编与二进制）、执行它的解释器 VM，以及宿主嵌入接口。

> **状态：** 编译器前端、LLIR 后端和 LLIR 解释器 VM 都可以构建、测试并运行示例。执行遵循运行时规范；解释器是当前的执行引擎。

## 环境要求

**Zig 0.16.0**（参见仓库中的 `build.zig.zon`）。

## 构建与测试

```sh
zig build            # 构建并安装两个产物：
                     #   zig-out/bin/stilla      — 编译器/解释器 CLI
                     #   zig-out/lib/libstilla.a — 可嵌入的静态库
zig build examples   # 把每个 examples/*.st 编译为 AIR、LLIR asm 与 LLIR bin，输出到 zig-out/examples/
zig build embed      # 运行宿主嵌入示例（examples/embed/random_demo.zig）
zig build test       # 运行单元测试
```

对于链接静态库的消费方（C、C++ 等）：

```sh
zig build -Doptimize=ReleaseSafe -p <prefix>   # 把 libstilla.a 安装到 <prefix>
```

## `stilla` 可执行文件

一个可执行文件（`src/main.zig`）同时充当**前端编译器**和**解释器**：它解析一个 Stilla 源文件（连同其导入，导入按内嵌的 `std/` 包解析），把内嵌包的 intrinsic 展开为普通 AIR，并打印程序的 **CFG AIR** 文本形式：

```sh
zig build run -- app.st              # 编译 app.st，把 CFG AIR 打印到 stdout
zig-out/bin/stilla --output app.ir app.st
```

```text
module "app" {
    func @app.main() -> int32 {
    entry:
        %0: int32 = const 42
        ret %0
    }
}
```

### CLI 选项

| 选项 | 含义 |
| --- | --- |
| `--output <file>` | 把结果写入文件而不是 stdout |
| `--module <spec>` | 入口模块指定符（默认：文件的模块名） |
| `--entry-fn <name>` / `--no-entry-fn` | 选择 / 抑制入口函数 |
| `-I <dir>` | 添加一个导入搜索目录 |
| `--emit-asm` | 输出 LLIR 汇编文本 |
| `--emit-bin <file>` | 输出 LLIR 二进制镜像 |
| `--run` | 编译**并**执行 |

诊断信息格式为 `<file>:<line>:<col>: error: <message>`。

## 一个最小程序

```stilla
fn main() -> int32 {
    42
}
```

把它编译成 CFG AIR：

```sh
zig build run -- app.st
```

## 仓库结构

| 路径 | 内容 |
| --- | --- |
| `spec/` | 规范文档（核心语言、运行时、标准库、内建函数、ABNF 语法）——当 Core 与 Runtime 不一致时，以 Runtime 为准 |
| `docs/` | 实现文档：入门、架构、pass 清单、各阶段文档、优化器、LLIR、解释器 VM、宿主绑定 |
| `src/` | 实现：词法/语法分析器、模块图、检查器、CFG 降级、优化器、LLIR 后端、解释器、宿主绑定 |
| `std/` | 内嵌的标准库包（`.st` 源码） |
| `examples/` | 示例程序，包括宿主嵌入演示 |
| `probes/` | 针对规范的符合性探针 |

## 下一步

- [语言入门](/zh/guide/intro)——这门语言及其设计。
- [宿主嵌入](/zh/guide/embedding)——在 Zig 或 C 宿主中嵌入 Stilla。

*浓缩自 [stilla README](https://github.com/zoltrazig/stilla#readme)。*
