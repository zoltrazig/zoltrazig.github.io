---
outline: deep
---

# Host Embedding

Stilla is designed for host integration. A Zig or C host links the static
library (`zig-out/lib/libstilla.a`) and drives two entry points:
`frontend.compile` (source → CFG AIR) and the interpreter
(`interpreter.runWithHostAndLoader` / the two-stage `buildProgram` +
`runProgram` path). Host modules are plain Zig structs; the `builtin`
module's output hooks (notably `builtin.print`) have no runtime default —
the embedder supplies them.

## The compile-and-run path

```zig
const stilla = @import("stilla");

// Compile: entry module → CFG AIR. Diagnostics arrive as
// `compilation.diag(s)` (file:line:col).
var compilation = try stilla.frontend.compile(allocator, .{ .entry = "app.st" });
defer compilation.deinit();
const program = &(compilation.program orelse return error.CompileFailed);

// Lower to per-module LLIR artifacts and run from the entry export.
// `term` is a `Termination`: `.normal` (the root's return cell) or
// `.panic` (an owned message to report).
var bundle = try stilla.artifact_bundle.ArtifactBundle.build(allocator, program);
var term = try stilla.interpreter.runWithHostAndLoader(allocator, &bundle.root, .{}, bundle.loaderHandle());
defer term.deinit(allocator);
```

## Defining host functions

The runnable example is `examples/embed/random_demo.zig` (`zig build
embed` builds it, runs it, and reports the round trip). The embedder gives
Stilla a `random` host module: one `pub fn` per member, module state
injected as the leading `*Rng` parameter (never a Stilla parameter):

```zig
/// The module's state: injected as the leading `*Rng` parameter of
/// every member.
const Rng = struct { prng: std.Random.DefaultPrng, io: std.Io, ... };

/// The host module: `pub const symbol` names the module; every `pub fn`
/// is a member binding.
const random = struct {
    pub const symbol = "random";

    pub fn next(rng: *Rng) i32 {
        const v = rng.prng.random().int(i32);
        rng.record(v);
        return v;
    }

    /// Uniform draw in [0, max).
    pub fn int(rng: *Rng, max: i32) i32 {
        const v = rng.prng.random().intRangeLessThan(i32, 0, max);
        rng.record(v);
        return v;
    }

    /// Reseed the module's PRNG — state mutated from Stilla.
    pub fn seed(rng: *Rng, s: i32) void {
        rng.prng = std.Random.DefaultPrng.init(@as(u64, @bitCast(@as(i64, s))));
    }

    /// Host time (seconds since the Unix epoch) — host information
    /// flowing into the program, read through the embedding's Io.
    pub fn time(rng: *Rng) i32 { ... }
};
const random_desc: host_bind.ModuleDesc = host_bind.register(random);
const random_iface = host_bind.interfaceOf(random, "");
```

`register` derives a sorted, signature-checked member table; the
**interface** — the `.st` text the frontend checks the program's call
sites against — is derived from the same Zig signatures by `interfaceOf`,
so the two cannot drift. Stilla accesses it as an ordinary imported
module:

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

## Two-stage embed path

`buildProgram` builds the source/interface maps, compiles, lowers, and
merges the module into the default host registry; `runProgram` executes
the built program, so one build can run many times:

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

`builtin.print` has no runtime default — the embedder supplies the output
hook (`appPrint` above writes message + newline to stdout). The program's
`main` returns `a + b`, which the example then verifies against the draws
the host observed.

## As a C embedder

The static library artifact (`libstilla.a`) is the linking surface for
hosts written in other languages; the public Zig API is the source of
truth for now.

## Where the implementation docs live

The full detail lives in the stilla repository:

- [host-bindings.md](https://github.com/zoltrazig/stilla/blob/main/docs/host-bindings.md) — the typed host-binding layer: comptime registry, signature checks, embedding (the `random` walkthrough is §3.4)
- [interpreter-vm.md](https://github.com/zoltrazig/stilla/blob/main/docs/interpreter-vm.md) — the LLIR interpreter VM: instruction image, execution loop, host adapters, destruction
- [architecture.md](https://github.com/zoltrazig/stilla/blob/main/docs/architecture.md) — the host-embedding surface and component boundaries

*Condensed from the [stilla README](https://github.com/zoltrazig/stilla#readme)
and `examples/embed/random_demo.zig`.*
