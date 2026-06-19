// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {readFileSync} from 'node:fs';
import path from 'path';
import process from 'process';

const config = JSON.parse(
  readFileSync(path.join(process.env.INDICO_PLUGIN_ROOT, 'webpack-build-config.json'))
);
const base = await import(path.join(config.build.indicoSourcePath, 'plugin.webpack.config.mjs'));

// Plugin builds disable a shared runtime chunk (`runtimeChunk: false` in core's
// webpack/base.mjs), but the default plugin config still applies a `common`
// splitChunks cache group whenever two of this plugin's own entries (here:
// `management`/`display`) end up sharing modules. With no shared runtime, code
// loaded from that split-out chunk can end up executing inside the wrong
// entry's `__webpack_require__` (observed as `__webpack_require__.nmd is not a
// function`, since core modules transitively pulled in get executed under our
// plugin's incompatible runtime instance). Disabling splitChunks for this
// plugin avoids the inconsistency — entries stay self-contained, at the minor
// cost of some duplicated code between the management and display bundles.
export default env => ({
  ...base.default(env),
  optimization: {
    ...base.default(env).optimization,
    splitChunks: false,
  },
});
