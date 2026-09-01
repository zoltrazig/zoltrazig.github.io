# zoltrazig.github.io

GitHub Pages site for the **Zoltra Project**, featuring the **Stilla
Programming Language** (<https://github.com/zoltrazig/stilla>).

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Publishing

The site is plain static HTML (no Jekyll, no build step — see
`.nojekyll`). GitHub Pages serves it directly from the repository root
on the `main` branch:

1. Push changes to `main`.
2. If not already enabled: repository **Settings → Pages → Source →
   "Deploy from a branch" → branch `main`, folder `/ (root)` → Save**.

The site is then live at <https://zoltrazig.github.io/>.
