# shadcn/ui setup notes

`components.json` cannot hold comments (it is strict JSON), so the reasoning lives here.

| Field | Value | Why |
| --- | --- | --- |
| `tsx` | `false` | The CLI emits `.jsx`. This project is JavaScript, not TypeScript, per the stack decision. |
| `tailwind.cssVariables` | `true` | Generated components reference `var(--primary)` rather than inlined hex values. This is what makes `src/styles/tokens.css` the single point of theme swap. Setting it to `false` would bake colours into every component and defeat the theming strategy entirely. |
| `tailwind.baseColor` | `stone` | Warm neutral ramp, matching the warm-stone palette in `tokens.css`. `slate`/`zinc` are cool-toned and would fight the tokens. |
| `style` | `new-york` | Tighter spacing and smaller radii — reads as denser and more "operational tool" than the default style, which suits an ERP. |
| `aliases.components` | `@/components` | Must stay in sync with the `@` alias in `vite.config.js`, or the CLI writes imports that do not resolve. |

## Adding a component

```powershell
npx shadcn@latest add dialog --cwd client
```

Components land in `client/src/components/ui/`. They are **source code, not a dependency** —
edit them freely. That is the entire point of shadcn over a component library: no theme
override API to fight, no version pin to wait on. If a reviewer asks "what if you need to
change the Button?", the answer is "we open the file and change it."

## Components vendored so far

Vendored by hand rather than via the CLI (the CLI needs network access, and these are small
enough that hand-writing them is faster and gives us the commented version):

- `button.jsx`
- `input.jsx`
- `label.jsx`
- `card.jsx`
- `dropdown-menu.jsx`
