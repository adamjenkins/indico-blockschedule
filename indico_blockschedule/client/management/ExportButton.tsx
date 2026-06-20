// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import exportURL from 'indico-url:plugin_blockschedule.manage_export';

import React from 'react';
import {Dropdown} from 'semantic-ui-react';

import {Translate} from 'indico/react/i18n';

interface ExportButtonProps {
  eventId: number;
  day: string;
}

export function ExportButton({eventId, day}: ExportButtonProps) {
  return (
    <Dropdown text={Translate.string('Export…')} icon="download" button>
      <Dropdown.Menu>
        <Dropdown.Item
          text="CSV"
          as="a"
          href={exportURL({event_id: eventId, fmt: 'csv', day})}
        />
        <Dropdown.Item
          text="Excel (XLSX)"
          as="a"
          href={exportURL({event_id: eventId, fmt: 'xlsx', day})}
        />
        <Dropdown.Item
          text="OpenDocument (ODS)"
          as="a"
          href={exportURL({event_id: eventId, fmt: 'ods', day})}
        />
      </Dropdown.Menu>
    </Dropdown>
  );
}
