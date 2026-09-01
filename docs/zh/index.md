---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Stilla"
  text: "一种用于嵌入式脚本的编程语言"
  tagline: 静态、小巧、安全、简单——无 GC、无隐藏状态、无意外
  image:
    ../logo.png
  actions:
    - theme: brand
      text: 语言入门
      link: /zh/guide/intro
    - theme: alt
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 宿主嵌入
      link: /zh/guide/embedding

features:
  - title: 为嵌入而生
    details: hostdata、宿主模块，以及面向 C/C++/Zig 宿主的类型化宿主绑定层。
  - title: 确定性执行
    details: 单一从左到右的求值规则、固定的销毁顺序、无 GC 停顿。
  - title: 显式所有权
    details: 不可变绑定、显式借用 / 移动 / 销毁——释放时机在编译期即可确定。
  - title: 极小的语言表面
    details: 没有闭包、循环、继承或宏。只有代数数据类型、模式匹配与单态化泛型。
  - title: 可机器生成
    details: 小巧、无歧义的语法——面向包括 LLM 在内的代码生成器的安全目标。
  - title: 恐慌（panic），而非栈展开
    details: 陷阱（trap）在不解栈的情况下终止执行上下文；清理交给宿主。
---
