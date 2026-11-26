# Design Patterns, Made Simple

[Open the interactive site](https://software-design-patterns.pages.dev/)

**Follow one call from start to finish.** See which object receives it, what that
object delegates, and what changes when the call returns. This open-source
learning site explains common software design patterns with interactive Three.js
animations and short Java examples.

Start with [Strategy](https://software-design-patterns.pages.dev/#strategy).
Watch a checkout calculate 100, swap the pricing strategy, then follow the same
call to a different implementation and get 90. The animation and step
explanation advance together. Pause, replay, step backward, or change playback
speed to inspect the part that matters.

## Pattern index

| Category | Demo | What to watch |
| --- | --- | --- |
| Behavioral | [Strategy](https://software-design-patterns.pages.dev/#strategy) | The same checkout call follows a different pricing strategy. |
| Behavioral | [Observer](https://software-design-patterns.pages.dev/#observer) | One event reaches multiple subscribers. Unsubscribing changes who receives the next event. |
| Behavioral | [State](https://software-design-patterns.pages.dev/#state) | An order delegates payment to its current state and handles a repeat request differently. |
| Behavioral | [Chain of Responsibility](https://software-design-patterns.pages.dev/#chain) | One handler stops a request. Another request passes through the chain. |
| Creational | [Factory Method](https://software-design-patterns.pages.dev/#factory) | A base workflow calls a subclass factory to create the appropriate writer. |
| Creational | [Builder](https://software-design-patterns.pages.dev/#builder) | Options accumulate before the builder creates the result. |
| Creational | [Singleton](https://software-design-patterns.pages.dev/#singleton) | Two callers receive the same instance reference. |
| Structural | [Adapter](https://software-design-patterns.pages.dev/#adapter) | A payment adapter translates a shared request and a provider-specific response. |
| Structural | [Decorator](https://software-design-patterns.pages.dev/#decorator) | Timing and logging layers add behavior around the same read operation. |
| Structural | [Facade](https://software-design-patterns.pages.dev/#facade) | One order operation coordinates several subsystems. |
| Structural | [Proxy](https://software-design-patterns.pages.dev/#proxy) | An access check blocks one request and forwards an authorized one through the same interface. |
| Structural | [Composite](https://software-design-patterns.pages.dev/#composite) | Files and folders expose the same operation. Folders delegate recursively and aggregate the results. |

Each demo includes guidance on when to use the pattern, what it costs, and what
the call looks like in Java. The Java excerpts illustrate the design. They are
not standalone applications.

## Run locally

```sh
git clone https://github.com/kain26/software-design-patterns.git
cd software-design-patterns
python3 -m http.server 8184 --bind 127.0.0.1
```

Open [http://127.0.0.1:8184/](http://127.0.0.1:8184/). The site is static
HTML, CSS and JavaScript with a bundled Three.js dependency. There is no install
or build step. A WebGL 2 browser shows the 3D scene. Other browsers can still use
the text explanations and step controls.

Use **Space** to play or pause, **← / →** to step, and **R** to reset when
focus is outside a control. The page respects reduced-motion preferences.

## Source guide for contributors and agents

| File | Where to look |
| --- | --- |
| [`patterns.mjs`](patterns.mjs) | Canonical pattern catalog, scene objects, ordered calls, step explanations and Java excerpts. Search by stable `id`, such as `proxy` or `composite`. |
| [`app.mjs`](app.mjs) | Navigation, URL fragments, step selection, playback timing and state replay. |
| [`scene.mjs`](scene.mjs) | Three.js models, camera, diagram layout, connections, moving call markers and text fallback. |
| [`index.html`](index.html), [`style.css`](style.css) | Page structure, accessibility labels and responsive styling. |

A pattern's `id` is its public URL fragment. Keep existing IDs stable.
Every call is a `[sourceId, targetId, label]` tuple. Both IDs refer to entries
in the same pattern's `nodes` map. A step may reveal an object and update
node role labels. Those changes replay when the reader jumps backward or
forward, so describe the whole interaction as ordered steps.

To add a pattern, start in `patterns.mjs`. Give it a unique ID, choose its
category, use existing shapes, and keep labels short. Explain one interaction
and one practical trade-off. Then open its direct URL, try every step, and
check playback, rewind, reset and narrow-screen labels.

## License

The project is available under the [MIT License](LICENSE). Bundled Three.js
files retain their [upstream MIT notice](vendor/LICENSE).
