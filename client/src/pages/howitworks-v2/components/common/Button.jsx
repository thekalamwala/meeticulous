import React from 'react';

// Reusable button component.
// variant: primary | secondary | outline
// size: sm | md | lg
const Button = ({ children, variant = 'primary', size = 'md', onClick, type = 'button', className = '', disabled = false, style }) => {
    const classes = ['btn', `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(' ');

    return (
        <button type={type} onClick={onClick} className={classes} disabled={disabled} style={style}>
            {children}
        </button>
    );
};

export default Button;
