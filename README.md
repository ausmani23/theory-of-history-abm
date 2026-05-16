# In Defense of the Theory of History 

An agent-based model of historical materialism: societies inhabit one of three modes (HG, Ag, Cap), with two stochastic rules.

## The rules

- Modes m ∈ {HG, Ag, Cap}, ordered by FoP. Initial: all m_i = HG.
- **Rule 1.** P(m_i → m_i ± 1) = p
- **Rule 2.** P(higher-FoP wins | contact) = ½ + a
- **Claim.** p > 0, a > 0 ⟹ FoP develop.

Set `a = 0` and the world drifts to uniform thirds (no direction). Set `p = 0` and the world stays all-HG forever. Any positive `p` and any positive `a` and the arc emerges.

## Running

It's static HTML/CSS/JS — open `index.html` in a browser. For local development:

```
python -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying

Static site; works on GitHub Pages, Netlify, or any static host. For GitHub Pages, enable Pages on `main` branch, root, and the demo will be live at `https://<user>.github.io/<repo>/`.

## Files

- `index.html` — page structure
- `styles.css` — dark theme matching the slide deck
- `sim.js` — the agent-based simulation
- `ui.js` — canvas rendering, sliders, controls
