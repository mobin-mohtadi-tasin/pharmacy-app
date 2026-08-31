# PharmaCare — Pharmacy Billing System

A local-only web application for managing a retail pharmacy in Bangladesh.
Runs entirely on your computer — no internet required for core features.

---

## 🚀 Quick Start (Step-by-Step)

### Step 1 — Install Node.js

If you don't have Node.js installed:

1. Go to **https://nodejs.org**
2. Download the **LTS** version (green button)
3. Run the installer and follow the prompts
4. When done, open **Command Prompt** (search "cmd" in Start menu) and run:
   ```
   node --version
   ```
   You should see something like `v22.x.x`

---

### Step 2 — Open the App Folder

1. Open **File Explorer**
2. Navigate to the `pharmacy-app` folder
3. Click the address bar at the top of File Explorer
4. Type `cmd` and press **Enter**

This opens a Command Prompt already in the right folder.

---

### Step 3 — Install Dependencies (First Time Only)

In the Command Prompt, type:
```
npm install
```

Wait for it to finish (1–3 minutes on first run).

---

### Step 4 — Load Sample Data (First Time Only)

```
node src/lib/db/seed.js
```

This creates some sample medicine groups and medicines so the app isn't empty.

---

### Step 5 — Start the App

```
npm run dev
```

You'll see output like:
```
▲ Next.js 16.x.x
- Local: http://localhost:3000
```

---

### Step 6 — Open in Browser

Open your web browser and go to:
```
http://localhost:3000
```

**Default PIN: `1234`** (change in `.env.local` → `ADMIN_PIN=XXXX`)

---

## 📁 File Locations

| What | Where |
|---|---|
| Database file | `data/pharmacy.db` |
| Excel reports | `reports/` folder |
| Settings | `.env.local` |

---

## ⚙️ Configuration (.env.local)

Edit the `.env.local` file to change settings:

```
MEDICINE_SOURCE_URL=https://medex.com.bd   # External medicine search source
ADMIN_PIN=1234                              # Login PIN (change this!)
LOW_STOCK_THRESHOLD=10                      # Default low-stock alert level
DB_PATH=./data/pharmacy.db                 # Database file location
```

---

## 🔑 Keyboard Shortcuts (Billing Screen)

| Key | Action |
|---|---|
| `/` | Focus medicine search bar |
| `↑` / `↓` | Navigate search results |
| `Enter` | Select highlighted medicine |
| `Escape` | Close search dropdown |
| `F2` | Checkout (complete sale) |

---

## 💾 Backup Your Data

Click **"Backup DB"** in the sidebar to download a copy of your database file.
Save this file somewhere safe (USB drive, Google Drive, etc.).

To restore: replace `data/pharmacy.db` with your backup file and restart.

---

## 📊 Daily Reports

1. Click **Reports** in the sidebar
2. Select a date or date range
3. Click **⬇ Download Excel** to get a `.xlsx` file with:
   - Sales Detail (every line item)
   - Payment Summary (Cash / bKash / Nagad / Card / Bank)
   - Profit Summary (revenue, cost, margin)
   - Stock Snapshot (current inventory)

---

## 🛑 Stopping the App

In the Command Prompt where the app is running, press `Ctrl + C`.

To start again: run `npm run dev` in the `pharmacy-app` folder.

---

## 🩺 Features

- ✅ Medicine Groups (Antibiotic, Painkiller, etc.)
- ✅ Medicine Lookup from MedEx (Bangladeshi medicine database)
- ✅ Stock-In with weighted average cost tracking
- ✅ Billing / Point of Sale with fast typeahead search
- ✅ Multiple payment methods (Cash, bKash, Nagad, Card, Bank)
- ✅ Invoice history and printable receipts
- ✅ Daily and date-range profit reports (Excel export)
- ✅ Dashboard with today's stats and low-stock alerts
- ✅ Database backup (one-click download)

---

## ❓ Troubleshooting

**"Port 3000 already in use"**
Run: `npm run dev -- -p 3001` and open `http://localhost:3001`

**Medicine search shows no results (offline mode)**
The MedEx search requires internet. If offline, enter medicine details manually in Stock-In.

**Forgot PIN**
Open `.env.local` and change `ADMIN_PIN=` to your preferred PIN.

**Database corrupted**
Restore from your last backup by replacing `data/pharmacy.db`.
