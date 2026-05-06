# FF&E Builder — API Worker

Cloudflare Worker built with [Hono](https://hono.dev/). Handles authentication, database access, and image storage. The React client communicates exclusively through this worker — it never touches Neon or R2 directly.

---

## Authorized Users

Access is controlled by the `AUTHORIZED_EMAILS` Worker secret — a comma-separated list of Firebase-authenticated email addresses that are allowed full API access. Any authenticated user whose email is **not** on this list receives `403 Forbidden`.

### Local source of truth

The file `api/.authorized-emails` (git-ignored) is the source of truth for the deployed list. Each line is one email address:

```
# api/.authorized-emails
alice@studio.com
bob@firm.com
```

All commands below should be run from the `api/` directory.

### Add a user

1. Open `.authorized-emails` and add the email on a new line.
2. Sync to Cloudflare:

```sh
# from api/
node -e "
const fs = require('fs');
const list = fs.readFileSync('.authorized-emails','utf8')
  .split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')).join(',');
require('child_process').execSync('echo '+JSON.stringify(list)+' | npx wrangler secret put AUTHORIZED_EMAILS',{stdio:'inherit'});
"
```

Or manually — copy all emails from the file as a comma-separated string and run:

```sh
# from api/
npx wrangler secret put AUTHORIZED_EMAILS
# paste when prompted: alice@studio.com,bob@firm.com,newuser@example.com
```

### Remove a user

1. Delete or comment out the email in `.authorized-emails`.
2. Re-sync using the same command above.

> **Note:** `wrangler secret put` always **replaces** the entire secret value. There is no append or patch operation — the full list must be provided every time.

### Verify the current list (local file)

```sh
# from api/
Get-Content .authorized-emails
```

The deployed secret cannot be read back from Cloudflare via Wrangler, so `.authorized-emails` is the only record of what is currently deployed. Keep it up to date.

### Local development

For local dev with `wrangler dev`, add the list to `.dev.vars` (also git-ignored):

```
AUTHORIZED_EMAILS=alice@studio.com,bob@firm.com
```
