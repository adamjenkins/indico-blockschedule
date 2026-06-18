# Frontend Assets

The asset pipeline changed since `indico-plugin-example` was written.
**Do not use** `register_js_bundle`/`register_css_bundle`/`inject_css`/
`inject_js` from that example — they're obsolete. Use the webpack +
`inject_bundle()` pipeline described below.

## Declaring entry points

`webpack-bundles.json` in the plugin root:
```json
{"entry": {"main": "./indico_<pluginname>/client/index.js"}}
```

Build configuration is driven by indico core's
`plugin.webpack.config.mjs`, invoked with `INDICO_PLUGIN_ROOT` pointing at
the plugin directory; it merges in indico's own `webpack/base.mjs`. You
generally don't need to touch the webpack config itself — only
`webpack-bundles.json` and the entry file(s) it points to.

## Injecting the built bundle into pages

```python
def init(self):
    super().init()
    self.inject_bundle('main.js', WPEventDisplay)
    self.inject_bundle('main.css', WPEventDisplay)
```

`self.manifest` is read from `static/dist/manifest.json`, produced by the
webpack build — run the build before this will resolve to anything:
```bash
npx webpack --config ../indico/plugin.webpack.config.mjs
```

## Modern client code

Recent plugins (`vc_zoom`) write client code in TypeScript/TSX with
CSS-module-scoped styles:
```
indico_<pluginname>/client/
├── index.js
├── JoinButton.tsx
└── JoinButton.module.scss
```
This isn't mandatory — plain JS is fine for simple cases — but prefer TSX
+ CSS modules for anything beyond a few lines, to match current plugin
conventions.

## JS-side i18n

Python-side `_()`/`gettext()` calls are extracted via `babel-js.cfg` for
plain `$T(...)`-style usage. For React/JSX components, modern plugins use
a `messages-react.po`/`.json` pipeline, compiled with `react-jsx-i18n`
(wired into the shared `hatch_build.py` build hook — see
`.prompts/patterns/i18n.md`). Don't hardcode user-facing strings in client
code any more than you would in Python.

## Linting

```bash
npx eslint .
npx stylelint '**/*.scss'
```
Requires `npm ci` to have been run in the plugin directory first
(`eslint-config-indico` and `stylelint` config come from `package.json`
devDependencies — copy the shape from a reference plugin like `vc_zoom`
rather than writing config from scratch).
