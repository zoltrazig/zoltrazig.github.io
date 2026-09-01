---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Stilla"
  text: "A programming language for embedded scripting"
  tagline: Static, Small, Safe, Simple — no GC, no hidden state, no surprises
  image:
    ./logo.png
  actions:
    - theme: brand
      text: Language Intro
      link: /guide/intro
    - theme: alt
      text: Getting Started
      link: /guide/getting-started
    - theme: alt
      text: Host Embedding
      link: /guide/embedding

features:
  - title: Built to be embedded
    details: hostdata, host modules, and a typed host-binding layer for C/C++/Zig hosts.
  - title: Deterministic execution
    details: One left-to-right evaluation rule, fixed destruction order, no GC pauses.
  - title: Explicit ownership
    details: Immutable bindings, explicit borrow / move / drop — frees known at compile time.
  - title: Tiny language surface
    details: No closures, loops, inheritance, or macros. ADTs, pattern matching, monomorphized generics.
  - title: Machine-generable
    details: A small, unambiguous grammar — a safe target for code generators, including LLMs.
  - title: Panic, don't unwind
    details: Traps terminate the execution context without unwinding; cleanup is the host's job.
---
