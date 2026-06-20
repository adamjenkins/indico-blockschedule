// This file is part of the Block Schedule plugin for Indico.
// Copyright (C) 2026 Adam Jenkins
//
// The Block Schedule plugin is free software; you can redistribute
// it and/or modify it under the terms of the MIT License;
// see the LICENSE file for more details.

import {Translate} from 'indico/react/i18n';
import React, {useEffect, useState} from 'react';
import {Icon} from 'semantic-ui-react';

import './FullscreenButton.module.scss';

interface FullscreenButtonProps {
  targetRef: React.RefObject<HTMLElement>;
}

export function FullscreenButton({targetRef}: FullscreenButtonProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === targetRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [targetRef]);

  const toggle = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      targetRef.current?.requestFullscreen();
    }
  };

  return (
    <Icon
      name={isFullscreen ? 'compress' : 'expand'}
      styleName="fullscreen-button"
      title={
        isFullscreen
          ? Translate.string('Exit fullscreen')
          : Translate.string('View fullscreen')
      }
      onClick={toggle}
    />
  );
}
