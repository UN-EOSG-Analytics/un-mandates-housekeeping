Login with UN email + “single sign-on every time”

You’re describing magic link / email OTP style auth (passwordless). Typical flow:

Officer enters UN email

System emails a one-time sign-in link or code

On verification, create/update users row and set session cookie

On Vercel/Next.js, the easiest best-practice route is:

use an auth provider that supports email magic links (and ideally enterprise options later)

store user email + internal user id

authorize by email domain / allowlist
