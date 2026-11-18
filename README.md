# QLess: College Food Court

Students order food from their phone, pay the canteen by UPI, and collect it when their token is called.
Staff verify payments, run the token queue, manage the menu, and see sales.

One app, two logins (Student and Staff), **one shared server and database**, so every phone and laptop sees the same live orders.

---

## Start QLess on a laptop (easiest, no coding)

1. **Install Node.js** (one time): go to <https://nodejs.org>, download the **LTS** version, and install it with the default options.
2. **Unzip** the QLess folder.
3. **Windows:** double-click **`START-QLESS.bat`**.
   **Mac:** double-click **`start-qless.command`** (if macOS blocks it: right-click › Open).
4. Your browser opens QLess at **http://localhost:4000**.
   - If Windows asks about the firewall, tick **Private networks** and click **Allow**.
5. **Keep the black window open** while you use QLess. Closing it stops QLess. All data is saved, so start it again any time.

### Open QLess on phones

The black window shows a line like:

```
On phones (same Wi-Fi): http://192.168.1.20:4000
```

Open **that address** in the phone's browser (Chrome or Safari). The phone must be on the **same Wi-Fi** as the laptop.

> **College Wi-Fi blocking phones?** Some college networks don't let devices see each other.
> Turn on your **phone's mobile hotspot**, connect the laptop to it, then use the new address shown in the black window.

---

## Demo logins

| Role | Login | Password / PIN |
|---|---|---|
| Student | `aarav@college.edu` | `student123` |
| Staff 1 | `STAFF01` | `1234` |
| Staff 2 | `STAFF02` | `kitchen99` |

The demo student's security question is *"What is your favourite canteen dish?"* and the answer is **dosa**.

New students sign up in the app. Sign-up checks the email with a 6-digit code.

---

## Features

**Students:** sign up with email code · menu with search, categories, veg / non-veg and sold-out badges · cart with notes · UPI payment (button opens GPay / PhonePe / Paytm; QR for laptops; copy UPI ID) · live token, people ahead and estimated wait · "Your order is ready!" alert · order history · receipt PDF · change password · security question · forgot password (email code, security question, or a one-time code from staff) · stay logged in.

**Staff:** open / pause orders · live board (Pending Payment, Preparing, Ready, Completed) · confirm or reject payments (with screenshot) · Call Next / Skip · add, edit and delete food with photos and daily stock · canteen UPI ID settings with QR preview · analytics (peak hours, revenue, best sellers, service time) · kitchen ticket PDF (58/80 mm) · daily sales report PDF (A4) · student password reset codes · change PIN.

---

## Settings

### Change the canteen UPI ID

Staff › Profile › **Payment settings**. Enter the UPI ID (e.g. `9876543210@ybl`), check the preview QR with your own UPI app, and save. All new orders pay to this ID.

### Send real email codes (optional, free)

Without email set up, the 6-digit code appears on screen in a yellow box. To email it instead:

1. Sign up at <https://www.emailjs.com> (free: 200 emails a month).
2. **Email Services › Add New Service › Gmail**, connect the Gmail account the codes should come from, and note the **Service ID**.
3. **Email Templates › Create New Template**:
   - **To Email:** `{{to_email}}`
   - **Subject:** `Your QLess code: {{otp}}`
   - **Body:** `Hi {{to_name}}, your code to {{purpose}} is {{otp}}. It expires in 10 minutes.`

   Note the **Template ID**.
4. **Account › General:** copy the **Public Key** and **Private Key**. **Account › Security:** turn on **"Allow EmailJS API for non-browser applications"**.
5. Create the file `server/email-config.json`:
   ```json
   { "service_id": "service_xxx", "template_id": "template_xxx", "public_key": "xxx", "private_key": "xxx" }
   ```
6. Restart QLess.

### Start fresh

To delete all orders and accounts and restore the demo data: close QLess, delete the folder `server/data`, then start QLess again.

---

## Put QLess online (optional)

To get a public link that works without your laptop, use **Render** (free):

1. Put this project in a GitHub repository.
2. Sign in at <https://render.com> with GitHub › **New** › **Blueprint** › pick the repository. Render reads `render.yaml` and deploys.
3. You get a link like `https://qless.onrender.com`.

**Free plan limits:**
- QLess sleeps after about 15 minutes with no visitors, and the first visit afterwards takes about a minute.
- Saved data is **reset when it sleeps or redeploys**.

To keep data permanently, add a Render **Persistent Disk** (paid) mounted at `/opt/render/project/src/server/data`.

---

## For developers

```
qless/
├─ START-QLESS.bat / start-qless.command   one-click start
├─ server/            Node.js server, no npm dependencies
│  ├─ src/index.js      HTTP server, serves the app and /api
│  ├─ src/routes.js     every API endpoint (auth, OTP, orders, queue, menu, settings, analytics)
│  ├─ src/services.js   tokens, stock, wait time, UPI links
│  ├─ src/auth.js       scrypt password hashing, JWT, role checks, login throttling
│  ├─ src/db.js         SQLite schema (node:sqlite) + migrations
│  ├─ src/email.js      email codes via EmailJS
│  └─ src/seed.js       demo data
├─ client/            React + Tailwind screens
│  ├─ src/              source
│  ├─ build.mjs         builds everything into one file
│  └─ dist/index.html   the built app (already included)
└─ scripts/
   ├─ api-smoke-test.mjs   64 API checks
   └─ browser-test.mjs     multi-device browser test (Playwright)
```

- **Requirements:** Node.js 22.13+. The database is SQLite (`server/data/qless.db`), built into Node.
- **Commands:**
  - `npm start`: start
  - `npm run build`: rebuild the screens after editing `client/src`
  - `npm run dev`: rebuild, then run with auto-restart
  - `npm run seed`: reset the demo data
  - `npm run test:api`: run the API tests against a freshly seeded server
- **Environment variables:**
  - `PORT` (default 4000)
  - `JWT_SECRET` (auto-generated and stored in `server/data`)
  - `TZ_NAME` (default `Asia/Kolkata`)
  - `COLLEGE_EMAIL_DOMAIN` (only allow sign-ups from that email domain)
  - `DB_PATH`
- **Security:**
  - Passwords and answers are stored as salted scrypt hashes.
  - JWT sessions last 14 days.
  - Every request is checked for student or staff role.
  - Totals are calculated on the server from database prices.
  - Order creation runs in a transaction, with a UNIQUE token per day.
  - Logins and password resets are rate-limited.
  - Every request body is validated.
