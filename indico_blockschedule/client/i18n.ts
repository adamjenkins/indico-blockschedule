// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

/**
 * Translation components bound to this plugin's own catalog.
 *
 * The React mirror of what `indico_blockschedule/__init__.py` does on the
 * Python side with `make_bound_gettext('blockschedule')`, and it matters for
 * exactly the same reason: translations are looked up **by domain**, and this
 * plugin's strings live in the `blockschedule` domain rather than in `indico`.
 *
 * Importing `Translate` straight from `indico/react/i18n` gets the components
 * core binds to its own domain. Every lookup then misses — silently, falling
 * back to the English source string — so the interface stays English no matter
 * how correct the catalog is. There is no error and nothing in the console; the
 * translations are present in `window.REACT_TRANSLATIONS` and simply never
 * consulted.
 *
 * So: import `Translate` from here, never from `indico/react/i18n`.
 */
import {bindTranslateComponents} from 'indico/react/i18n';

export const {Translate, PluralTranslate} = bindTranslateComponents('blockschedule');
export {Param, Singular, Plural} from 'indico/react/i18n';
