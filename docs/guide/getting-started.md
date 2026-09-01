---
outline: deep
---

# Getting Started

The [Stilla Runtime](https://github.com/zoltrazig/stilla) is a Zig
implementation of the Stilla v1.3 runtime and its toolchain: the frontend
compiler (module graph → type-checked CFG AIR → LLIR assembly and binary),
the interpreter VM that executes it, and the host-embedding surface.

> **Status:** the compiler frontend, the LLIR backend, and the LLIR
> interpreter VM build, test, and run the examples. Execution follows the
> Runtime Specification; the interpreter is the current execution engine.

## Requirements

**Zig 0.16.0** (see `build.zig.zon` in the repository).

## Build and test

```sh
zig build            # build + install both artifacts:
                     #   zig-out/bin/stilla      — the compiler/interpreter CLI
                     #   zig-out/lib/libstilla.a — the embeddable static library
zig build examples   # compile every examples/*.st to AIR, LLIR asm, and LLIR bin under zig-out/examples/
zig build embed      # run the host-embedding example (examples/embed/random_demo.zig)
zig build test       # run unit tests
```

For consumers that link the static library (C, C++, …):

```sh
zig build -Doptimize=ReleaseSafe -p <prefix>   # install libstilla.a under <prefix>
```

## The `stilla` executable

A single executable (`src/main.zig`) that is both the **frontend
compiler** and the **interpreter**: it parses a Stilla source file (plus
its imports, resolved against the embedded `std/` bundle), expands the
embedded-bundle intrinsics into ordinary AIR, and prints the program's
**CFG AIR** text form:

```sh
zig build run -- app.st              # compile app.st, print CFG AIR to stdout
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

### CLI options

| Option | Meaning |
| --- | --- |
| `--output <file>` | write the result to a file instead of stdout |
| `--module <spec>` | entry module specifier (default: the file's module name) |
| `--entry-fn <name>` / `--no-entry-fn` | select / suppress the entry function |
| `-I <dir>` | add an import search directory |
| `--emit-asm` | emit LLIR assembly text |
| `--emit-bin <file>` | emit the LLIR binary image |
| `--run` | compile **and** execute |

Diagnostics are `<file>:<line>:<col>: error: <message>`.

## A minimal program

```stilla
fn main() -> int32 {
    42
}
```

Compile it to CFG AIR:

```sh
zig build run -- app.st
```

## Repository layout

| Path | Contents |
| --- | --- |
| `spec/` | the normative specifications (Core Language, Runtime, Standard Library, Intrinsics, ABNF grammar) — Runtime governs where Core and Runtime disagree |
| `docs/` | implementation documentation: intro, architecture, pass inventory, phase documents, optimizer, LLIR, interpreter VM, host bindings |
| `src/` | the implementation: lexer/parser, module graph, checker, CFG lowering, optimizer, LLIR backend, interpreter, host bindings |
| `std/` | the embedded standard-library bundle (`.st` sources) |
| `examples/` | example programs, including the host-embedding demo |
| `probes/` | conformance probes against the specifications |

## Next steps

- [Language intro](/guide/intro) — the language and its design.
- [Host embedding](/guide/embedding) — embed Stilla in a Zig or C host.

*Condensed from the [stilla README](https://github.com/zoltrazig/stilla#readme).*
