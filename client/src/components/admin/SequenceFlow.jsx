// SequenceFlow — view-only flowchart of a drip sequence.
//
// Renders the sequence's real data as a decision flow: the enrol trigger, each
// step as a channel-coloured node with its wait, the stop conditions the engine
// actually checks (stop_on_reply / stop_on_convert) as a YES/NO gate, and the
// terminal Stop Flow. Nothing here is editable and no branch is invented — it
// only draws the conditions that already run. Theme-aware via the --adm-* tokens.

const T = {
  ink1: 'var(--adm-text-1)', ink2: 'var(--adm-text-2)', ink3: 'var(--adm-text-3)',
  card: 'var(--adm-card)', border: 'var(--adm-border)',
  info: 'var(--adm-info)', infoBg: 'var(--adm-info-bg)',
  ok: 'var(--adm-ok)', okBg: 'var(--adm-ok-bg)',
  warn: 'var(--adm-warn)', warnBg: 'var(--adm-warn-bg)',
  danger: 'var(--adm-danger)', dangerBg: 'var(--adm-danger-bg)',
};

const Rail = ({ h = 18 }) => (
  <div style={{ width: 2, height: h, background: T.border }} />
);

function Node({ tone, icon, title, sub, wait, width = 340 }) {
  const color = tone?.color || T.ink2;
  const bg = tone?.bg || T.card;
  const bd = tone?.border || T.border;
  return (
    <div style={{
      width: `min(${width}px, 88vw)`, border: `1.5px solid ${bd}`, background: bg,
      borderRadius: 12, padding: '10px 13px', boxShadow: '0 1px 2px rgba(20,30,50,.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon && (
          <span style={{
            width: 26, height: 26, borderRadius: 7, flex: '0 0 auto', display: 'grid',
            placeItems: 'center', background: tone?.iconBg || 'transparent', color,
          }}>{icon}</span>
        )}
        <span style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.25, color: T.ink1 }}>{title}</span>
        {wait != null && (
          <span style={{
            marginLeft: 'auto', whiteSpace: 'nowrap', fontSize: 10.5, color: T.ink3,
            border: `1px solid ${T.border}`, borderRadius: 20, padding: '1px 8px',
            fontVariantNumeric: 'tabular-nums',
          }}>{wait}</span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.ink2, marginTop: 4, paddingLeft: icon ? 34 : 0 }}>{sub}</div>}
    </div>
  );
}

const ICON = {
  email: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>,
  whatsapp: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-4-1L3 20l1-5.5a8.5 8.5 0 1 1 17-3Z" /></svg>,
  stop: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="m5 5 14 14" /></svg>,
  flag: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></svg>,
};

const YN = ({ v }) => (
  <span style={{
    width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center',
    fontSize: 9.5, fontWeight: 700, color: '#fff', margin: '5px 0',
    fontFamily: 'ui-monospace, monospace', background: v === 'YES' ? T.ink1 : T.ink3,
  }}>{v}</span>
);

export default function SequenceFlow({ seq }) {
  const steps = [...(seq.crm_sequence_steps || [])].sort((a, b) => a.step_no - b.step_no);
  const stops = [seq.stop_on_reply && 'replies', seq.stop_on_convert && 'completes the goal'].filter(Boolean);
  const trigger = seq.description || `Enrolled into “${seq.name}”`;

  const emailTone = { color: T.info, bg: T.infoBg, border: T.info, iconBg: 'transparent' };
  const waTone = { color: T.ok, bg: T.okBg, border: T.ok, iconBg: 'transparent' };
  const stopTone = { color: T.danger, bg: T.dangerBg, border: T.danger, iconBg: 'transparent' };
  const trigTone = { color: T.ok, bg: T.okBg, border: T.ok, iconBg: 'transparent' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 0 6px' }}>
      {/* trigger */}
      <Node tone={trigTone} icon={ICON.flag} title="Trigger" sub={trigger} width={320} />
      <Rail />

      {/* global stop gate (checked before every send) */}
      {stops.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 'min(360px,90vw)' }}>
            <div style={{
              background: T.warnBg, border: `1.5px solid ${T.warn}`, color: T.warn, fontWeight: 700,
              fontSize: 12, borderRadius: 10, padding: '7px 13px', textAlign: 'center',
            }}>Before every send — has the contact {stops.join(' or ')}?</div>
            <div style={{ display: 'flex', width: '100%', justifyContent: 'space-around', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <YN v="YES" />
                <Node tone={stopTone} icon={ICON.stop} title="Stop Flow" width={150} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <YN v="NO" />
                <span style={{ fontSize: 10.5, color: T.ink3 }}>continue ↓</span>
              </div>
            </div>
          </div>
          <Rail />
        </>
      )}

      {/* steps */}
      {steps.map((st, i) => {
        const isWa = st.channel === 'whatsapp';
        const label = isWa
          ? `Send WhatsApp · ${st.template_key || 'template'}`
          : `Send Email · ${st.subject || '(no subject)'}`;
        const sub = isWa ? 'AiSensy template — does not count against the email cap' : null;
        return (
          <div key={st.id || st.step_no} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Node
              tone={isWa ? waTone : emailTone}
              icon={isWa ? ICON.whatsapp : ICON.email}
              title={label}
              sub={sub}
              wait={`+${st.delay_hours || 0}h`}
            />
            <Rail />
          </div>
        );
      })}

      {/* terminal */}
      <Node tone={stopTone} icon={ICON.stop} title="Stop Flow · sequence complete" width={240} />

      {/* legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 18, paddingTop: 12,
        borderTop: `1px solid ${T.border}`, fontSize: 11, color: T.ink2, justifyContent: 'center',
      }}>
        <Legend c={T.ok} label="Trigger" />
        <Legend c={T.info} label="Email (counts vs cap)" />
        <Legend c={T.ok} label="WhatsApp (free of cap)" />
        <Legend c={T.warn} label="Stop condition" />
        <Legend c={T.danger} label="Stop Flow" />
      </div>
    </div>
  );
}

const Legend = ({ c, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <i style={{ width: 11, height: 11, borderRadius: 3, background: c, display: 'inline-block' }} />{label}
  </span>
);
