---
outline: deep
---

# The Stilla Language

Stilla is a small, statically typed language for embedded scripting —
game engines, device firmware, config and rule engines. It runs inside a
C/C++/Zig host via the [Stilla Runtime](https://github.com/zoltrazig/stilla)
(a compiler + interpreter VM written in Zig); this page is about the
language itself.

One principle drives everything: **what you read is what the machine
does.** No hidden GC threads, no implicitly running constructors, no
compiler silently reordering your evaluation.

## Your first program

```stilla
const builtin = import("builtin");

fn fib(n: int32) -> int32 {
    if (n < 2) { n } else { fib(n - 1) + fib(n - 2) }
}

fn main() -> void {
    builtin.print(builtin.str(fib(10)));
}
```

Note what's *missing*: no `return`, no loops, no implicit `print`. A
function body is an expression — the last expression's value is the
return value. Repetition is recursion. Every name comes in through an
explicit `import`. These omissions are design decisions, not gaps.

## Familiar territory

If you know Rust, Kotlin, or Swift, most of Stilla will feel like home.

**Everything is an expression.** `if`, `match`, and blocks all produce
values:

```stilla
let sign = if (value >= 0) { 1 } else { -1 };
```

Conditions take parentheses — that's what tells the parser a control-flow
`if` apart from a struct construction.

**Bindings are immutable.** `let` rebinds by shadowing, which keeps the
source naturally SSA-friendly:

```stilla
let x = 10;
let x = x + 1;   // the right-hand x refers to the old binding
```

**Data is structs and tagged unions.** No classes, no inheritance, no
method syntax:

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

`match` must cover every variant. `let` accepts only irrefutable patterns,
so bindings never introduce a hidden runtime failure. Recursive types must
break the storage cycle through indirection (`box[T]`, `list[T]`, or a
function type).

**Generics are compile-time templates.** Every specialization is expanded
and type-checked at compile time; nothing generic survives to runtime:

```stilla
fn identity[T](move value: T) -> T {
    move value
}

let x = identity::[int32](42);   // explicit specialization
let y = identity(7);             // T inferred from the argument
```

No traits, no constraints, no generic function types. Each specialization
costs code size — the trade for a minimal implementation and simple
inference.

## The different bits

The rest is where Stilla departs from what you're used to. Each departure
is a deliberate trade for determinism or embeddability.

### No loops — recursion and combinators

The core language has no loop constructs. Repetition is recursion, and the
`iter` module provides `fold` / `each` combinators. The optimizer rewrites
tail recursion back into real loops: no loops in the source, loops in the
machine code.

```stilla
const builtin = import("builtin");
const lists = import("list");
const iter = import("iter");

fn go(n: int32, acc: int32) -> int32 {        // tail call
    if (n == 0) { acc } else { go(n - 1, acc + n) }
}

fn main() -> void {
    builtin.assert(go(10, 0) == 55, "recursion sums 0 + 1 + … + 10");
    let total = iter.fold[int32, int32](lists.range(0, 10), 0,
        fn(move acc: int32, borrow x: int32) -> int32 { acc + x });
    builtin.assert(total == 55, "fold sums 0 + 1 + … + 10");
}
```

Both walk the same boundary `[0, 10]`: `go(10, 0)` counts `n` down from
10 to 0, and `list.range` is inclusive, so `range(0, 10)` covers the same
eleven elements. Both sum to 55 — and the optimizer rewrites `go` into a
real loop.

### No GC — explicit ownership

Values come in two classes:

- **copy** — implicitly copyable, destruction is a no-op: the numeric
  scalars (`byte`, `int32`, `uint32`, `int64`, `uint64`, `float32`,
  `float64`),
  `bool`, `str`, and function values.
- **unique** — cannot be implicitly copied; moved at most once, destroyed
  exactly once, borrowable many times. Any struct with a `drop` hook or a
  unique component is unique.

A struct may declare at most one destruction hook — and declaring one is
exactly what makes the struct unique:

```stilla
struct Token {
    id: int32;

    drop(token) {                      // runs exactly once, when the value dies
        builtin.print("drop token " + builtin.str(token.id));
    }
}
```

The hook fires exactly once, wherever the value dies — at scope end, at
an explicit `drop`, or inside a callee the value was `move`d into.
Borrowing never runs it.

On normal control flow, destruction order is fully deterministic: the
user `drop` hook first, then unique fields in reverse declaration order,
then the value is marked destroyed. Locals are destroyed in reverse
creation order at scope end. Structs are *not* classes: no constructors,
no visibility control.

Three explicit operations, all checked statically:

```stilla
fn show(borrow t: Token) -> int32 {   // borrow: read-only view, ownership stays
    t.id
}

fn consume(move t: Token) -> void {   // move: ownership enters the function
    drop t;                           // explicit destruction
}

fn main() -> void {
    let a = Token { id: 1 };
    builtin.print(builtin.str(show(a)));   // borrow: a stays alive
    consume(move a);                       // move: ownership leaves
    let b = Token { id: 2 };
    drop b;                                // drop: explicit destruction
    let c = Token { id: 3 };               // no explicit drop: destroyed at scope end
}
```

Using a moved value is a compile error. A binding freed on only some
branches becomes **maybe-unique**: the compiler destroys it on every
branch that did not free it, so it is uniformly dead after the join —
no runtime bookkeeping. The payoff: no GC pauses, no background
collector, release timing predictable at compile time.

### No closures — two compensations

Functions and lambdas cannot capture surrounding local bindings. In
exchange, function values are dead-simple monomorphic code references: no
heap-allocated closure environments, no capture analysis for code
generators. Two compensations:

1. **Function-value fields** — structs can store function values, with
   explicit receivers (no `receiver.method()` sugar).
2. **Context threading** — the `iter` module's `*_with` combinators accept
   a borrowed context passed to the operation on every call — here a
   struct value, the very thing a closure would have captured:

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

`fold_with` threads the borrowed `Scale` value into the step on every
call; the lambda never touches anything outside its own parameters.

### One evaluation rule, defined failures

The whole language has one evaluation-order rule: subexpressions evaluate
exactly once, left-to-right in source order; `and` / `or` short-circuit.
Runtime failures come in two classes:

- **Defined numeric behavior, not traps.** Integer arithmetic wraps
  modulo 2³² / 2⁶⁴ — overflow never traps; `div` / `rem` by zero traps
  (`int32_min div -1` wraps, `int64_min div -1` traps). Floats follow
  IEEE 754 — division by zero yields `±inf` / NaN, never traps, and NaN
  payloads round-trip losslessly (`float32` and `float64`). Shifts mask their count mod 32 / 64. Numeric `as`
  conversions never trap: float→int truncates and saturates (NaN
  becomes 0).
- **Deterministic traps.** Invalid `any` recovery, a consuming
  destructure of a short list, out-of-range `array.get` / `array.set`,
  and malformed `string` operations (bad offsets, invalid UTF-8) trap —
  never undefined behavior — terminating exactly like `builtin.panic`.

### Panic: terminate, don't unwind

`builtin.panic` or any trap **terminates the whole execution context**: no
stack unwinding, no pending destructors run (locals, temporaries, module
teardown — none of it). Control returns to the embedding host, which owns
cleanup. There is no `try`/`catch` — error handling is `Option`/`Result`
values, `builtin.assert`, and terminating panics.

```stilla
const builtin = import("builtin");

fn divide(a: int32, b: int32) -> int32 {
    builtin.assert(b != 0, "division by zero");
    a / b
}
```

`assert` fails loudly at the boundary instead of letting the trap happen
deeper in — a precondition check, not an exception mechanism.

### Files are modules, modules are values

Each `.st` source file is an implicit, immutable module struct. `calc.add(20, 22)`
is plain member access — the same `.` model as structs, not a static
function lookup. `import("...")` appears only in module-level `const`
initializers, resolves statically, and cyclic imports are forbidden. Each
module is instantiated at most once per execution context.

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

Every top-level declaration of `calc.st` is a member of the module value;
there is no export list to keep in sync.

### The embedding boundary

Host integration is a first-class goal, so the language has two boundary
types plus one host-declared type:

- **`any`** — the top type, carrying a runtime type tag. Recovery must
  name the type explicitly (`a as int32`, trapping on mismatch) or use a
  `match` type-test arm (`int32 n => …`) — because the tag space is open,
  a `match` over `any` must include a `_` wildcard arm. `any` itself is
  unique.
- **`hostdata`** — an opaque, type-erased host payload. Only the host can
  construct it; Stilla can move, borrow, store, and pass it back, but
  never inspect or convert it. It has no type identity and cannot enter
  `any`.
- **Opaque host types** — `opaque type Array[T];`, declared only in
  stdlib/host module interfaces. Unlike `hostdata` they keep normal
  nominal type identity: the compiler knows this is an `Array[int32]`,
  just not its internals. They can enter `any`, be generic, and be
  recovered with `as`/`match`.

The standard library's collections are opaque host types: `array` is a
host-implemented contiguous buffer, `hashmap` a contiguous-bucket hash
table. They are unique by declaration, so `set`/`insert`/`remove` are
**consuming updates** — `move` in, updated value out — letting the host
mutate the same buffer in place while source semantics stay functional:

```stilla
let m = hm.empty::[int32, str]();
let m = hm.insert(move m, 1, "one");
let m = hm.insert(move m, 2, "two");
```

No aliasing means no partial mutation: the old value is dead, the new one
owns the continuation, and the language needs no mutable variables to get
near-mutable-container runtime performance.

### Standard library

`builtin` (print, str, box/unbox, panic, assert, hash, and the
`Option[T]` type member), `list`, `math`, `string` (operates on Unicode
code points, never byte offsets), `iter` (each / fold / try_fold, plus
their `*_with` and `consume_*` variants), `array`, `hashmap`. All are
ordinary importable modules — no implicitly injected `print()`, no
implicit numeric conversions. The core stays tiny: only `list[T]` is an
abstract built-in type; `array`/`hashmap` are library types and could be
replaced without changing the language.

## What it's for (and not for)

**Good fit:** embedded scripting layers (game engines, device firmware,
config/rule engines) that want a clean boundary to a C/C++/Rust host;
systems with hard determinism requirements (reproducible tests, replay,
audit); machine-generated code targets; teaching ownership, ADTs, and a
functional core in a minimal language.

**Poor fit:** large application development (no closures, traits, dynamic
dispatch, or concurrency); heavy numeric work (scalar types only); domains
needing graceful recovery (errors terminate); ecosystems needing plugins
(no reflection-style extension points).

## Status

Stilla is at **v1.3 Draft**. Syntax, features, and the compiler are
unstable and evolving. The normative documents live in the
[stilla repository](https://github.com/zoltrazig/stilla/tree/main/spec):
Core Language, Types & Ownership, Runtime, Standard Library, and
Intrinsics specifications, plus a normative ABNF grammar. Where Core and
Runtime disagree about execution, the Runtime specification governs.
