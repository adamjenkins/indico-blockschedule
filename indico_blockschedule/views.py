# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

from flask_pluginengine import current_plugin
from flask_webpackext.errors import ManifestKeyNotFoundError

from indico.core.plugins import WPJinjaMixinPlugin
from indico.modules.events.contributions.views import WPContributionsDisplayBase
from indico.modules.events.management.views import WPEventManagement


def _bundle_files(*names):
    # webpack may or may not split a shared `common.js`/`common.css` chunk out of the
    # entry-specific bundles depending on how much code the `management`/`display` entries
    # have in common — only include it if it actually exists in this build's manifest.
    # (pywebpack's Manifest has no __contains__, and its __iter__ yields entries rather
    # than names, so `name in manifest` silently never matches — use __getitem__ + except.)
    manifest = current_plugin.manifest
    files = []
    for name in ('common.js', 'common.css', *names):
        try:
            files.append(manifest[name])
        except ManifestKeyNotFoundError:
            pass
    return files


class WPManageBlockSchedule(WPJinjaMixinPlugin, WPEventManagement):
    sidemenu_option = 'blockschedule'

    @property
    def additional_bundles(self):
        return {
            'screen': _bundle_files('management.js', 'management.css'),
            'print': (),
        }


class WPDisplayBlockSchedule(WPJinjaMixinPlugin, WPContributionsDisplayBase):
    menu_entry_name = 'blockschedule'

    @property
    def additional_bundles(self):
        return {
            'screen': _bundle_files('display.js', 'display.css'),
            'print': (),
        }


class WPManageTrackColors(WPJinjaMixinPlugin, WPEventManagement):
    """The track-colour settings page.

    Deliberately not full-width: it is a short list of tracks and swatches, and
    the standard management column keeps it looking like every other settings
    page in the event rather than like a second workspace.
    """

    sidemenu_option = 'blockschedule'

    @property
    def additional_bundles(self):
        return {
            'screen': _bundle_files('management.js', 'management.css'),
            'print': (),
        }
