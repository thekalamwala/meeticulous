// isInternalPath — true only for a same-origin app path that is safe to navigate
// to after login. Rejects protocol-relative URLs in every spelling a browser
// accepts: "//evil.com", "/\evil.com", and a tab/newline hidden between the
// slashes (browsers strip those, turning "/\t/evil.com" into "//evil.com").
// eslint-disable-next-line no-control-regex
const INTERNAL_PATH = /^\/(?![/\\])[^\\\x00-\x1f]*$/;

export const isInternalPath = (path) => typeof path === 'string' && INTERNAL_PATH.test(path);
