import { useState } from 'react';
import { ink, line, radius, surface, type } from '../theme';

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Avatar({
  src,
  name = '',
  size = 40,
  square = false,
  style,
  ...rest
}) {
  const [imgError, setImgError] = useState(false);
  const initials = getInitials(name);

  const borderRadius = square ? radius.md : '50%';
  const hasImage = src && !imgError;

  if (hasImage) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: 'cover',
          border: `1px solid ${line.hair}`,
          background: 'var(--gradient-dark-warm)',
          flexShrink: 0,
          ...style,
        }}
        {...rest}
      />
    );
  }

  return (
    <div
      aria-label={name}
      style={{
        width: size,
        height: size,
        borderRadius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gradient-dark-warm)',

        color: ink.strong,
        border: `1px solid ${line.hair}`,
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.38)),
        letterSpacing: '0.02em',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
      {...rest}
    >
      {initials}
    </div>
  );
}
