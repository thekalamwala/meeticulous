import { Children, isValidElement } from 'react';

// Flatten the text of an <option>'s children (string, number, or an array like
// {flag} {code}) into one label string.
const text = (c) =>
  Array.isArray(c) ? c.map(text).join('')
    : c == null || c === false || c === true ? ''
    : String(c);

// Convert native <option>/<optgroup> children into MeetDropdown `options`.
// Values are stringified to mirror a native <select> (whose value is always a
// string), so a caller that does `e.target.value` keeps working unchanged.
// <optgroup> is flattened — its label becomes each option's sublabel.
export function optionsFromChildren(children) {
  const out = [];
  const pushOption = (o, sublabel) => {
    if (!isValidElement(o) || o.type !== 'option') return;
    const label = text(o.props.children);
    out.push({
      // A valueless <option> submits its text content natively — match that.
      value: o.props.value == null ? label : String(o.props.value),
      label,
      ...(sublabel ? { sublabel } : {}),
      ...(o.props.disabled ? { disabled: true } : {}),
    });
  };
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'optgroup') {
      Children.forEach(child.props.children, (o) => pushOption(o, child.props.label));
    } else {
      pushOption(child);
    }
  });
  return out;
}
