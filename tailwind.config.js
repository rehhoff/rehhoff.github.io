/* Tailwind-opsætning. CSS'en bygges til css/tailwind.css med: python tools/byg_css.py */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: { extend: {
    colors: { bg:'var(--bg)', panel:'var(--panel)', raised:'var(--raised)', ink:'var(--ink)', muted:'var(--muted)', line:'var(--line)', accent:'var(--accent)', crit:'var(--crit)' },
    fontFamily: {
      display:['"Barlow Condensed"','"Arial Narrow"','sans-serif'],
      sans:['"IBM Plex Sans"','system-ui','sans-serif'],
      mono:['"IBM Plex Mono"','ui-monospace','Menlo','monospace']
    }
  } }
};
