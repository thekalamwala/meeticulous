// server/services/whatsappTemplateService.js
'use strict';
/**
 * whatsappTemplateService — turns a stored AiSensy template + a contact's data
 * into the ordered templateParams array AiSensy expects ({{1}}..{{n}}).
 * The mapping is named (variable_map: { "1": "first_name", ... }) so the
 * positional order is derived, never hand-authored in code.
 */
function buildParams(template, contactData = {}) {
  const n = template.param_count || 0;
  const map = template.variable_map || {};
  const out = [];
  for (let i = 1; i <= n; i++) {
    const field = map[i] ?? map[String(i)];
    const v = field ? contactData[field] : '';
    out.push(v == null ? '' : String(v));
  }
  return out;
}
module.exports = { buildParams };
