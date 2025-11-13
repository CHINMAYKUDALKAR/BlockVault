# Theme Palette Audit

Documenting current dark-mode tokens and proposed light-mode counterparts while keeping the signature blue glow accents.

| Token | Dark (current) | Light (proposed) | Notes |
| --- | --- | --- | --- |
| `--background` | `hsl(0 0% 0%)` | `hsl(210 40% 96%)` | Light neutral backdrop with slight blue tint to complement glow |
| `--foreground` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | High-contrast text color |
| `--card` | `hsl(0 0% 17%)` | `hsl(0 0% 100%)` | Keep cards on white while relying on border/outline |
| `--card-foreground` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | Dark text on light cards |
| `--border` | `hsl(0 0% 24%)` | `hsl(214 32% 91%)` | Soft cool gray border |
| `--input` | `hsl(0 0% 20%)` | `hsl(210 40% 96%)` | Inputs blend with background but outlined |
| `--primary` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | Invert primary for light mode (dark text button) |
| `--primary-foreground` | `hsl(0 0% 0%)` | `hsl(0 0% 100%)` | Text/icon color on primary actions |
| `--secondary` | `hsl(0 0% 24%)` | `hsl(214 32% 91%)` | Soft gray secondary surfaces |
| `--secondary-foreground` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | Text color for secondary surfaces |
| `--muted` | `hsl(0 0% 24%)` | `hsl(214 32% 91%)` | Muted backgrounds |
| `--muted-foreground` | `hsl(0 0% 69%)` | `hsl(215 16% 47%)` | Muted text |
| `--accent` | `hsl(0 0% 24%)` | `hsl(210 40% 96%)` | Accent surfaces align with background |
| `--accent-foreground` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | Accent text |
| `--destructive` | `hsl(0 84% 60%)` | `hsl(0 84% 60%)` | Keep red consistent |
| `--destructive-foreground` | `hsl(0 0% 100%)` | `hsl(0 0% 100%)` | White on red |
| `--success` | `hsl(142 71% 45%)` | `hsl(142 76% 36%)` | Slightly darker green for light mode |
| `--warning` | `hsl(38 92% 50%)` | `hsl(31 95% 45%)` | Adjust for legibility |
| `--info` | `hsl(217 91% 60%)` | `hsl(217 91% 45%)` | Darken info blue on light background |
| `--accent-blue` | `hsl(217 91% 60%)` | `hsl(217 91% 60%)` | Keep signature blue |
| `--accent-blue-glow` | `hsl(217 91% 60% / 0.5)` | `hsl(217 91% 60% / 0.35)` | Slightly reduce glow intensity for light mode |
| `--sidebar-background` | `hsl(0 0% 12%)` | `hsl(210 40% 98%)` | Sidebar harmonizes with light theme |
| `--sidebar-foreground` | `hsl(0 0% 100%)` | `hsl(222 47% 11%)` | Text on sidebar |
| `--sidebar-accent` | `hsl(0 0% 17%)` | `hsl(214 32% 91%)` | Accent surfaces in sidebar |
| `--sidebar-border` | `hsl(0 0% 24%)` | `hsl(214 32% 91%)` | Border consistent with light neutrals |
| `--ring` | `hsl(0 0% 30%)` | `hsl(217 92% 45%)` | Focus ring remains vibrant blue |

These values serve as the baseline for implementing the light theme while keeping the glowy blue separator consistent across modes.




