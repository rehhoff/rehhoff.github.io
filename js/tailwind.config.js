/* Tailwind-opsætning til CDN-scriptet. Indlæses lige efter cdn.tailwindcss.com. */
tailwind.config = { theme: { extend: {
  colors: { bg:'var(--bg)', panel:'var(--panel)', raised:'var(--raised)', ink:'var(--ink)', muted:'var(--muted)', line:'var(--line)', accent:'var(--accent)', crit:'var(--crit)' },
  fontFamily: {
    display:['"Barlow Condensed"','"Arial Narrow"','sans-serif'],
    sans:['"IBM Plex Sans"','system-ui','sans-serif'],
    mono:['"IBM Plex Mono"','ui-monospace','Menlo','monospace']
  }
} } };
