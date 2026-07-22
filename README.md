# 💰 Expense Tracker

A responsive, SaaS-style expense tracking web application built entirely with **HTML5, CSS3, Bootstrap 5, and vanilla JavaScript (ES6+)**. No backend, no frameworks, no build tools — just open `index.html` in a browser and it works.

## 🔗 Live Demo

**Live App:** https://expense-tracker-rust-three-42.vercel.app/

**Repository:** https://github.com/Kanhaiya1729/expense-tracker

## ✨ Features

- **Dashboard summary** — total balance, total income, total expense, updated live
- **Full transaction CRUD** — add, edit, and delete transactions with confirmation
- **Search, filter & sort** — search by title, filter by type/category, sort by date or amount
- **Data visualization** — category-wise expense pie chart and monthly expense bar chart (Chart.js)
- **Statistics** — total transactions, highest expense, highest income
- **Dark / light mode** — theme preference saved across visits
- **CSV export** — download your transactions as a spreadsheet-ready file
- **Data persistence** — everything is saved in the browser via `localStorage`, no backend required
- **Responsive design** — works cleanly on desktop, tablet, and mobile using Bootstrap's grid

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 |
| Styling | CSS3 (custom properties for theming), Bootstrap 5 |
| Logic | Vanilla JavaScript (ES6+) |
| Charts | Chart.js |
| Storage | Browser Local Storage |
| Icons | Bootstrap Icons |

## 📁 Project Structure

```
ExpenseTracker/
├── index.html   # Page structure & layout
├── style.css    # Design tokens, components, dark mode, responsiveness
├── script.js    # All application logic (storage, CRUD, filters, charts, etc.)
└── README.md
```

## 🚀 Getting Started

No installation, no dependencies, no build step.

1. Clone the repo:
   ```bash
   git clone https://github.com/Kanhaiya1729/expense-tracker.git
   ```
2. Open `index.html` in your browser (double-click it, or use an extension like VS Code's Live Server).

That's it — the app runs entirely client-side.

## 🧠 Key Implementation Details

- **Single form for Add + Edit** — a hidden transaction ID field determines whether the app creates a new record or updates an existing one, avoiding duplicate form logic.
- **Event delegation** — one click listener on the transaction table handles Edit/Delete for all rows, including ones added after the initial page load.
- **CSS custom properties for theming** — dark mode is a single attribute toggle (`data-theme="dark"` on `<html>`); every component reads its colors from CSS variables, so no component-level dark mode overrides were needed.
- **XSS-safe rendering** — user-entered text (transaction titles) is escaped before being inserted into the DOM to prevent script injection.

## 📌 Possible Future Improvements

- Pagination for large transaction lists
- CSV import
- Income vs. expense trend line chart
- Multi-currency support

## 📄 License

This project is open source and available for learning purposes.
