#!/usr/bin/env python3
# This file is part of the Block Schedule plugin for Indico.
# Copyright (C) 2026 Adam Jenkins
#
# The Block Schedule plugin is free software; you can redistribute
# it and/or modify it under the terms of the MIT License;
# see the LICENSE file for more details.

"""Populate an existing Indico event with dummy contributions, for manual UI testing.

Usage (from the Indico checkout, with its venv active):

    INDICO_CONFIG=/path/to/indico.conf python3 populate-dummy-data.py <event_id> [user_email]

If user_email is omitted, the first admin user found is used as the actor
for the created/changed-by log entries.

Runs as a standalone script (building the app and pushing its context
directly, the same way `indico.cli.util._create_app` does) rather than via
`indico shell`: piping a multi-line script into that REPL is unreliable -
IPython's `code.interact` requires a blank line to close an indented block
(`for`/`if`/etc), and a script without one just hangs forever waiting for
more input, with no error.

Also commits after each individual operation rather than batching at the
end. Without that, in testing this hit Postgres lock pileups: some
operations (e.g. `update_event`) trigger secondary settings lookups that
open their own DB session/connection, and leaving the main one open and
uncommitted while doing more work let it block later statements (observed
as a hang on `UPDATE events.events SET last_friendly_contribution_id...`
waiting on a transactionid lock held by an idle-in-transaction connection).
"""
import sys
from datetime import timedelta

from indico.web.flask.app import make_app


app = make_app()
with app.test_request_context():
    from flask import session as flask_session

    from indico.core.db import db
    from indico.modules.events import Event
    from indico.modules.events.contributions.operations import create_contribution
    from indico.modules.events.operations import update_event
    from indico.modules.users import User

    event_id = int(sys.argv[1])
    event = Event.query.filter_by(id=event_id).one()

    if len(sys.argv) > 2:
        actor = User.query.filter_by(email=sys.argv[2]).one()
    else:
        actor = User.query.filter_by(is_admin=True).first()
    flask_session.set_session_user(actor)
    print('Event:', event.title, event.start_dt, event.end_dt)

    update_event(event, description='This conference brings together researchers to discuss dummy data, '
                                     'fixtures, and other entirely made-up but very important findings.')
    db.session.commit()

    talks = [
        ('Welcome and Opening Remarks', 'Kicking off the conference with an overview of the program.', 15),
        ('Towards a Unified Theory of Dummy Data', 'A deep dive into generating realistic placeholder content.', 30),
        ('Lorem Ipsum at Scale', 'Lessons learned from populating thousands of test events.', 25),
        ('Fixtures, Mocks, and You', 'Best practices for keeping test data maintainable.', 20),
        ('Closing Panel: The Future of Test Conferences', 'An open discussion among the speakers.', 30),
    ]

    start = event.start_dt
    created = []
    for title, description, minutes in talks:
        contrib = create_contribution(event, {
            'title': title,
            'description': description,
            'duration': timedelta(minutes=minutes),
            'start_dt': start,
        })
        db.session.commit()
        created.append(contrib)
        start += timedelta(minutes=minutes)

    print('Created contributions:')
    for c in created:
        print(' -', c.id, c.title, c.duration, c.timetable_entry.start_dt if c.timetable_entry else None)
