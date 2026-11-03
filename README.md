# NimmaSsathi

It helps the people to solve their problems in easy way.

## GitHub Portfolio Showcase

A free, static website that turns any GitHub username into a clean portfolio of public projects. Type a username, see the projects. No login, no token, no backend, no build step.

**Live site (once Pages is enabled):** `https://shankaraling-b.github.io/NimmaSsathi/`

Share a portfolio by adding the username to the address: `https://shankaraling-b.github.io/NimmaSsathi/?user=octocat`

### What it does

- **Profile header:** avatar, name, bio, location, followers, link to the GitHub profile.
- **Project cards:** name, description, main language, stars, forks, topics, last updated, and links to the repository and the homepage/live demo when one is set. Forks are hidden by default, with a toggle to include them.
- **Filters and sorting:** by language, by topic, by keyword; sort by stars, recently updated, or name. Clicking a topic chip on a card filters by it.
- **Project details:** a dialog with the README (rendered and sanitised) and a language breakdown bar. A project can be linked directly with `?user=octocat&repo=Hello-World`.
- **Featured projects and customisation** through an optional `portfolio.json` (see below).
- **Friendly errors:** user not found, GitHub rate limit (with the reset time), network problems, and users with no public repositories.
- **Fast and polite to the API:** responses are cached in the browser for 10 minutes. Loading skeletons, light/dark mode, mobile-first layout, keyboard navigation.

### Enable GitHub Pages

1. Push this repository to GitHub (the `docs/` folder must be on the `main` branch).
2. Open the repository on GitHub, then **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose branch **main** and folder **/docs**, then click **Save**.
5. Wait a minute or two. The site appears at `https://<your-github-username>.github.io/<repository-name>/`. For this repository that is `https://shankaraling-b.github.io/NimmaSsathi/`.

GitHub Pages is free for public repositories.

### Customise a portfolio with `portfolio.json`

Anyone can optionally control how their own portfolio looks by adding a `portfolio.json` file to the **root of the default branch** of one of these repositories:

1. The profile repository named exactly like the user, e.g. `octocat/octocat` (checked first).
2. Otherwise, up to three of the user's own (non-fork) repositories with `portfolio` in the name, e.g. `octocat/my-portfolio`.

Only repositories already in the user's public list are checked, and the file is read from `raw.githubusercontent.com`, so looking for it does not use the GitHub API quota. If the file is missing, invalid, or larger than 64 KB, the site silently falls back to the normal view.

| Field | Type | What it does |
| --- | --- | --- |
| `headline` | string, max 140 chars | Short tagline shown under the name. |
| `bio` | string, max 500 chars | Replaces the bio from the GitHub profile. |
| `themeColor` | hex colour such as `#7c3aed` | Accent colour for buttons, stripes and highlights. Text colour on top of it is chosen automatically for readability. |
| `featured` | array of repository names (max 12) | Pinned in a "Featured" section above the other projects, in the order given. Names that do not exist are ignored. Forks may be featured. |

Sample `portfolio.json`:

```json
{
  "headline": "Maker of tiny cats and big ideas",
  "bio": "I build friendly tools that help people solve everyday problems.",
  "themeColor": "#7c3aed",
  "featured": ["hello-world", "my-portfolio", "spoon-knife"]
}
```

All fields are optional. Unknown fields are ignored.

### API usage and the rate limit

The site calls only GitHub's public, unauthenticated REST API from the visitor's browser:

| Purpose | Request |
| --- | --- |
| Profile | `GET https://api.github.com/users/{username}` |
| Repositories | `GET https://api.github.com/users/{username}/repos?per_page=100&sort=updated` |
| README (rendered as HTML by GitHub, then sanitised) | `GET https://api.github.com/repos/{owner}/{repo}/readme` |
| Language breakdown | `GET https://api.github.com/repos/{owner}/{repo}/languages` |

**Rate limit:** unauthenticated requests are limited to **60 per hour per IP address**, shared by everyone on the same network. Showing a portfolio costs 2 requests, and opening a project's details costs 2 more. Results are cached for 10 minutes, so revisiting the same portfolio or project costs nothing. When the limit is reached, the site shows the time at which it resets.

Known limits: only the 100 most recently updated public repositories are shown (the page says so when a user has more), and the site never asks for or stores a personal access token.

### Privacy and security

- Only public data is used. There is no login, no token, no server and no tracking.
- The only thing stored on the visitor's device is the 10-minute response cache and the chosen light/dark theme (`localStorage`).
- README HTML is rebuilt through an allow-list sanitiser: scripts, iframes, forms, SVG, event handlers, inline styles and `javascript:`/`data:` links are removed, and only HTTPS images are kept.
- All other text from GitHub (names, descriptions, topics) is inserted as plain text, never as HTML.

### Project structure

```
docs/
  index.html   page structure
  style.css    all styling (light and dark)
  app.js       all behaviour (vanilla JS, no dependencies)
README.md
```

### Run it locally

There is no build step. Any static file server works:

```
cd docs
python -m http.server 8000
```

Then open `http://localhost:8000/?user=octocat`. (Opening `index.html` directly with `file://` also works in most browsers, but a local server is closer to how Pages serves it.)
