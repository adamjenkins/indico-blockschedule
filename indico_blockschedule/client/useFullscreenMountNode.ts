// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {RefObject, useEffect, useState} from 'react';

/**
 * The element Semantic UI portals (Popup, Modal, Confirm) must mount into so
 * they stay visible while `targetRef`'s element is fullscreen.
 *
 * Those components portal into `document.body` by default, and the Fullscreen
 * API only paints the fullscreened element's own subtree -- so a portal left
 * on <body> opens invisibly (and a Modal then traps focus in content the user
 * cannot see). Every portalled control rendered inside a fullscreenable
 * container must pass this as its `mountNode`.
 *
 * Kept in state rather than read off the ref during render: the ref is only
 * populated after the container's first render commits, and a component that
 * captured `undefined` as a prop would keep it until its parent re-renders.
 */
export function useFullscreenMountNode(targetRef: RefObject<HTMLElement>): HTMLElement | undefined {
  const [node, setNode] = useState<HTMLElement | undefined>(undefined);
  // No dependency array on purpose: this must observe the ref getting populated,
  // which is invisible to React (with `[targetRef]` the effect would run once,
  // while the ref is still null). The state setter bails out once it has a node.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setNode(targetRef.current ?? undefined);
  });
  return node;
}
