// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import groupsCreateURL from 'indico-url:plugin_blockschedule.groups_create';
import groupsUpdateURL from 'indico-url:plugin_blockschedule.groups_delete_update';

import {Translate} from 'indico/react/i18n';
import {indicoAxios, handleAxiosError} from 'indico/utils/axios';
import React, {useState} from 'react';
import {Button, Confirm, Dropdown, Icon, Input, Modal} from 'semantic-ui-react';

import {BSColumn, BSGroup} from '../types';

import './GroupManager.module.scss';

interface GroupManagerProps {
  eventId: number;
  columns: BSColumn[];
  groups: BSGroup[];
  /** Where the modal (and its delete confirmation) portal to -- inside the fullscreenable
   * container, or they would open invisibly whenever the workspace is fullscreen, dimming
   * and focus-trapping a page the user cannot see. */
  mountNode?: HTMLElement;
  onChanged: () => void;
}

/**
 * Create, rename, populate and delete room groups.
 *
 * Groups are only a way of naming a set of rooms ("9th Floor", "Plenary
 * Halls") so a wide schedule can be viewed and printed a slice at a time. A
 * room may sit in any number of them, so membership is edited as a plain
 * multi-select per group rather than a drag-and-drop partition.
 */
export function GroupManager({eventId, columns, groups, mountNode, onChanged}: GroupManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);
  // The group whose trash icon was clicked, held until the deletion is confirmed or
  // abandoned -- deleting is one click on a small icon and cannot be undone.
  const [pendingDelete, setPendingDelete] = useState<BSGroup | null>(null);

  const columnOptions = columns.map(column => ({key: column.id, value: column.id, text: column.title}));

  const create = async () => {
    const title = newTitle.trim();
    if (!title) {
      return;
    }
    setBusy(true);
    try {
      await indicoAxios.post(groupsCreateURL({event_id: eventId}), {title, column_ids: []});
      setNewTitle('');
      onChanged();
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setBusy(false);
    }
  };

  const update = async (group: BSGroup, data: {title?: string; column_ids?: number[]}) => {
    setBusy(true);
    try {
      await indicoAxios.patch(groupsUpdateURL({event_id: eventId, group_id: group.id}), data);
      onChanged();
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (group: BSGroup) => {
    setBusy(true);
    try {
      await indicoAxios.delete(groupsUpdateURL({event_id: eventId, group_id: group.id}));
      onChanged();
    } catch (error) {
      handleAxiosError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        size="tiny"
        basic
        icon="th"
        content={Translate.string('Room groups')}
        onClick={() => setOpen(true)}
      />
      <Modal open={open} onClose={() => setOpen(false)} closeIcon size="small" mountNode={mountNode}>
        <Modal.Header>{Translate.string('Room groups')}</Modal.Header>
        <Modal.Content>
          <p styleName="hint">
            {Translate.string(
              'Group rooms so a wide schedule can be viewed and printed a slice at a time — by floor, '
                + 'by building, or any other set that is useful. A room can belong to several groups. '
                + 'Tracks are offered as groups automatically and are not listed here.'
            )}
          </p>
          {groups.length === 0 && (
            <p styleName="empty">{Translate.string('No groups yet.')}</p>
          )}
          {groups.map(group => (
            <div key={group.id} styleName="group-row">
              <Input
                size="small"
                styleName="group-title"
                defaultValue={group.title}
                disabled={busy}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                  const title = e.target.value.trim();
                  if (title && title !== group.title) {
                    update(group, {title});
                  }
                }}
              />
              <Dropdown
                selection
                multiple
                search
                styleName="group-columns"
                placeholder={Translate.string('No rooms')}
                options={columnOptions}
                value={group.column_ids}
                disabled={busy}
                onChange={(_e, {value}) => update(group, {column_ids: value as number[]})}
              />
              <Icon
                name="trash"
                link
                title={Translate.string('Delete this group')}
                onClick={() => setPendingDelete(group)}
              />
            </div>
          ))}
          <div styleName="group-row">
            <Input
              size="small"
              styleName="group-title"
              placeholder={Translate.string('New group name')}
              value={newTitle}
              disabled={busy}
              onChange={(_e, {value}) => setNewTitle(value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && create()}
            />
            <Button
              size="small"
              icon="plus"
              content={Translate.string('Add group')}
              disabled={busy || !newTitle.trim()}
              onClick={create}
            />
          </div>
        </Modal.Content>
      </Modal>
      <Confirm
        open={pendingDelete !== null}
        size="mini"
        content={
          pendingDelete
            ? Translate.string(
                'Delete the group "{title}"? Its {count} room(s) are not affected.',
                {title: pendingDelete.title, count: pendingDelete.column_ids.length}
              )
            : undefined
        }
        cancelButton={Translate.string('Cancel')}
        confirmButton={Translate.string('Delete')}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            remove(pendingDelete);
          }
          setPendingDelete(null);
        }}
        mountNode={mountNode}
      />
    </>
  );
}
