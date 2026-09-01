---
layout: default
---

**Stilla**: a small, statically typed language for embedded scripting.

**No hidden state. No surprises. Just your code.**

> **Status: v1.3 Draft** — not production-ready yet.

## Thirty seconds of Stilla

No `return`. No loops. A function body is one expression — its value is the result. Repetition is recursion. Names enter via `import`.

```stilla
const builtin = import("builtin");

fn fib(n: int32) -> int32 {
    if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
}

fn print_terms(i: int32, n: int32) -> void {
    if (i < n) {
        builtin.print(builtin.str(fib(i)));
        print_terms(i + 1, n);
    }
}

fn main() -> void {
    print_terms(0, 35);
}
```

From [`examples/fib.st`](https://github.com/zoltrazig/stilla/blob/main/examples/fib.st). Run it:

```sh
zig build examples
zig-out/bin/stilla --run examples/fib.st
```

## Design principles

- **Deterministic** — immutable bindings, fixed destruction order, strict left-to-right evaluation. No mutable global state.
- **No GC** — explicit `borrow` / `move`. Values move at most once, destroyed exactly once, with user `drop` hooks.
- **Values are first-class** — structs and tagged unions are values; a module is a value. No inheritance, no hidden receivers.
- **Expression-oriented** — no `return`, no loops. `if`, `match`, and blocks are expressions. Repetition is recursion or `iter`.
- **No closures** — functions can't capture locals; function values are monomorphic code references. Context threading (`iter`'s `*_with`) compensates.
- **Compile-time generics** — monomorphized at compile time. No traits, no constraints, no generic function values.
- **Panic terminates** — traps and `builtin.panic` stop execution without unwinding or running destructors. Cleanup belongs to the host.
- **Static modules** — `import("...")` resolves at compile time; cycles rejected; each module instantiates at most once per context.

## Implementation status

Implemented in **Zig 0.16.0**. Frontend, LLIR backend, and interpreter VM build, test, and run examples. The interpreter is the current engine.

- **Frontend** — module graph → type-checked CFG AIR → LLIR assembly and binary.
- **Interpreter VM** — executes LLIR; deterministic traps, host adapters, destruction.
- **Host embedding** — `libstilla.a`, a Zig/C embedding surface, and host bindings derived from the implementing Zig signatures.

## Build and use

Requires **Zig 0.16.0** (see `build.zig.zon`).

```sh
zig build            # build + install:
                     #   zig-out/bin/stilla      — compiler/interpreter CLI
                     #   zig-out/lib/libstilla.a — embeddable static library
zig build examples   # compile every examples/*.st
zig build embed      # run host-embedding example
zig build test       # run unit tests
```

Compile and print CFG AIR:

```sh
zig build run -- app.st
zig-out/bin/stilla --output app.ir app.st
```

Options: `--module <spec>`, `--entry-fn <name>`, `--emit-asm`, `--emit-bin <file>`, `--run`. Diagnostics: `file:line:col: error: message`.

## Documentation

### Specifications

- [Core Language Specification](https://github.com/zoltrazig/stilla/blob/main/spec/Stilla%20Core%20Language%20Specification.md) — syntax and compile-time constraints
- [Runtime Specification](https://github.com/zoltrazig/stilla/blob/main/spec/Stilla%20Runtime%20Specification.md) — execution model, traps, evaluation order, destruction
- [Standard Library](https://github.com/zoltrazig/stilla/blob/main/spec/Stilla%20Standard%20Library.md) — modules and contracts
- [Intrinsics Specification](https://github.com/zoltrazig/stilla/blob/main/spec/Stilla%20Intrinsics%20Specification.md) — frontend recognition and AIR expansion
- [Core Grammar (ABNF)](https://github.com/zoltrazig/stilla/blob/main/spec/Stilla%20Core%20Grammar%20Draft.abnf) — normative grammar
- [All specs…](https://github.com/zoltrazig/stilla/tree/main/spec)

### Implementation docs

- [stilla-intro](https://github.com/zoltrazig/stilla/blob/main/docs/stilla-intro.md) — the language and its design
- [architecture](https://github.com/zoltrazig/stilla/blob/main/docs/architecture.md) — artifacts, pipeline, boundaries, embedding
- [frontend](https://github.com/zoltrazig/stilla/blob/main/docs/frontend.md) — the compiler pipeline
- [host-bindings](https://github.com/zoltrazig/stilla/blob/main/docs/host-bindings.md) — typed host-binding layer
- [interpreter-vm](https://github.com/zoltrazig/stilla/blob/main/docs/interpreter-vm.md) — the LLIR interpreter
- [All docs…](https://github.com/zoltrazig/stilla/tree/main/docs)

### Examples

- [fib.st](https://github.com/zoltrazig/stilla/blob/main/examples/fib.st) — recursive fibonacci
- [ownership.st](https://github.com/zoltrazig/stilla/blob/main/examples/ownership.st) — borrow / move / drop
- [match.st](https://github.com/zoltrazig/stilla/blob/main/examples/match.st) — pattern matching
- [generics.st](https://github.com/zoltrazig/stilla/blob/main/examples/generics.st) — monomorphization
- [All examples…](https://github.com/zoltrazig/stilla/tree/main/examples)

## License

MIT — see [LICENSE](https://github.com/zoltrazig/stilla/blob/main/LICENSE).
