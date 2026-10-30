# Google Analytics MCP — setup

The repo ships a project-scoped [`.mcp.json`](../.mcp.json) that registers the
[Google Analytics MCP server](https://github.com/googleanalytics/google-analytics-mcp)
(`analytics-mcp` on PyPI) so anyone on the team can query our GA4 data from
Claude Code (or any MCP client). The config is committed; **credentials are
per-developer** and never checked in — each dev points two env vars at their own
Application Default Credentials (ADC).

```jsonc
// .mcp.json
"analytics-mcp": {
  "command": "pipx",
  "args": ["run", "analytics-mcp"],
  "env": {
    "GOOGLE_APPLICATION_CREDENTIALS": "${GA_MCP_ADC_PATH}",       // your ADC file
    "GOOGLE_CLOUD_PROJECT": "${GA_MCP_GCP_PROJECT:-meeticulous-513107}"
  }
}
```

## One-time setup

### 1. Install the runner
Install [`pipx`](https://pipx.pypa.io/stable/#install-pipx) (the server runs via
`pipx run analytics-mcp`). `uvx analytics-mcp` works too if you prefer `uv`.

### 2. Enable the APIs
In Google Cloud project **`meeticulous-513107`**, enable:
- **Google Analytics Admin API**
- **Google Analytics Data API**

### 3. Create credentials (ADC)
> ⚠️ ADC's `--client-id-file` needs a **Desktop** OAuth client — **not** the
> *web* OAuth client the app uses for host login. Either create a new Desktop
> OAuth client in `meeticulous-513107`, or use service-account impersonation.

**User credentials (Desktop OAuth client):**
```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform \
  --client-id-file=PATH_TO_DESKTOP_CLIENT.json
```

**Or service-account impersonation:**
```bash
gcloud auth application-default login \
  --impersonate-service-account=SA_EMAIL \
  --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
```

Either way, the account must have **read access to our GA4 property**.

### 4. Point the env vars at your ADC file
Copy the path from the `Credentials saved to file: [...]` line the login prints,
then set (shell profile, or Claude Code project `.env`):
```bash
export GA_MCP_ADC_PATH="/absolute/path/to/application_default_credentials.json"
# optional — only to override the default project:
export GA_MCP_GCP_PROJECT="meeticulous-513107"
```

### 5. Reload
Restart Claude Code / reopen the project so the new MCP server is picked up.

## Notes
- **Read-only by default.** To enable write tools, add `"--allow-write"` to
  `args` in `.mcp.json` and include the `https://www.googleapis.com/auth/analytics.edit`
  scope when creating ADC.
- If the server doesn't appear, check `GA_MCP_ADC_PATH` points at a file that
  exists and the two APIs are enabled on the project.
