One time slot; compose in a CSS grid (gap var(--slot-gap)) for week views, pickers and marketing compositions.
```jsx
<div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'var(--slot-gap)'}}>
  <SlotCell /> <SlotCell state="booked" time="10:30" label="Priya" /> <SlotCell state="open" label="Open" onClick={book} /> <SlotCell state="busy" />
</div>
```
`compact` = 56px row variant for mobile pickers. `selected` adds the rose ring.
