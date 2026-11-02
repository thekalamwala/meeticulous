Renders the official Meeticulous logo files.
```jsx
<Logo />                         {/* full-colour wordmark, 28px */}
<Logo tone="inverse" />          {/* on maroon */}
<Logo kind="icon" height={24} /> {/* UI / favicon symbol */}
```
Min heights: wordmark 16px, icon 16px (use tone="small" under 24px). Clear space = ¼ of mark width. `assetBase` overrides the asset folder URL if assets are hosted elsewhere.
