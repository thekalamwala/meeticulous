// Tiny classNames joiner — flattens, drops falsy, joins with space.
export function cn(...args) {
  return args
    .flat(Infinity)
    .filter(Boolean)
    .join(' ');
}

export default cn;
