import React from 'react';
export function Icon({ name, size = 20, color, style, className, label }) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={'mt-icon' + (className ? ' ' + className : '')} style={{ width: size, height: size, color, '--_src': `url('https://unpkg.com/lucide-static@0.460.0/icons/${name}.svg')`, ...style }} />;
}
