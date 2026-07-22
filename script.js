/* =====================================================================
   EXPENSE TRACKER - SCRIPT.JS
   All application logic lives in this single file, organized into
   clearly labeled sections. No frameworks, no build tools - just
   Vanilla JavaScript (ES6+) working with the DOM and localStorage.

   SECTIONS:
   1. Constants & DOM References
   2. Application State
   3. Local Storage Functions
   4. Utility / Helper Functions
   5. Render Functions (Dashboard, Stats, Table)
   6. Chart Functions (Pie + Bar)
   7. CRUD Functions (Add / Edit / Delete)
   8. Filter, Search & Sort
   9. Dark Mode
   10. CSV Export
   11. Event Listeners (wires everything together)
   ===================================================================== */


/* =====================================================================
   1. CONSTANTS & DOM REFERENCES
   ===================================================================== */

// Key used to store/retrieve data in localStorage.
// Using a constant instead of typing the string everywhere avoids typos.
const STORAGE_KEY = "expenseTrackerTransactions";
const THEME_KEY = "expenseTrackerTheme";

// The fixed list of categories offered in the form.
// Kept in one place so the filter dropdown and any validation
// can reuse the same list instead of duplicating it.
const CATEGORIES = [
  "Food", "Transport", "Shopping", "Bills",
  "Entertainment", "Health", "Salary", "Other"
];

// Dashboard summary elements
const totalBalanceEl = document.getElementById("totalBalance");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");

// Statistics elements
const statTotalTransactionsEl = document.getElementById("statTotalTransactions");
const statHighestExpenseEl = document.getElementById("statHighestExpense");
const statHighestIncomeEl = document.getElementById("statHighestIncome");

// Chart canvases + their "no data" messages
const categoryPieCanvas = document.getElementById("categoryPieChart");
const monthlyBarCanvas = document.getElementById("monthlyBarChart");
const pieEmptyMsg = document.getElementById("pieEmptyMsg");
const barEmptyMsg = document.getElementById("barEmptyMsg");

// Filter / search / sort controls
const searchInput = document.getElementById("searchInput");
const filterTypeSelect = document.getElementById("filterType");
const filterCategorySelect = document.getElementById("filterCategory");
const sortBySelect = document.getElementById("sortBy");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");

// Table + empty state
const transactionTableBody = document.getElementById("transactionTableBody");
const emptyState = document.getElementById("emptyState");

// Add/Edit modal + form fields
const transactionModalEl = document.getElementById("transactionModal");
const transactionModalLabel = document.getElementById("transactionModalLabel");
const transactionForm = document.getElementById("transactionForm");
const transactionIdInput = document.getElementById("transactionId");
const titleInput = document.getElementById("titleInput");
const amountInput = document.getElementById("amountInput");
const typeInput = document.getElementById("typeInput");
const categoryInput = document.getElementById("categoryInput");
const dateInput = document.getElementById("dateInput");
const saveTransactionBtn = document.getElementById("saveTransactionBtn");

// Delete confirmation modal
const deleteModalEl = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");

// Misc controls
const addTransactionBtn = document.getElementById("addTransactionBtn");
const darkModeToggleBtn = document.getElementById("darkModeToggle");
const exportCsvBtn = document.getElementById("exportCsvBtn");

// Toast (small popup message for feedback)
const appToastEl = document.getElementById("appToast");
const appToastBody = document.getElementById("appToastBody");

// Bootstrap component instances (created once, reused every time
// we need to show/hide them). getOrCreateInstance avoids creating
// duplicate modal/toast objects for the same element.
const transactionModal = bootstrap.Modal.getOrCreateInstance(transactionModalEl);
const deleteModal = bootstrap.Modal.getOrCreateInstance(deleteModalEl);
const appToast = bootstrap.Toast.getOrCreateInstance(appToastEl, { delay: 2200 });


/* =====================================================================
   2. APPLICATION STATE
   Why: instead of reading/writing localStorage on every tiny change,
   we keep transactions in a normal JavaScript array in memory. We
   only read localStorage once (on page load) and write to it every
   time the array changes. This is faster and simpler to reason about.
   ===================================================================== */

let transactions = [];          // array of transaction objects
let editingTransactionId = null; // holds the id of the transaction being edited, or null when adding
let transactionIdPendingDelete = null; // holds the id waiting for delete confirmation
let pieChartInstance = null;    // reference to the current Chart.js pie chart (so we can destroy/redraw it)
let barChartInstance = null;    // reference to the current Chart.js bar chart


/* =====================================================================
   3. LOCAL STORAGE FUNCTIONS
   ===================================================================== */

/**
 * loadTransactionsFromStorage
 * WHY: Reads whatever was saved previously so data survives a page
 * refresh. This is what makes the app "persistent" without a backend.
 * HOW: localStorage only stores strings, so we JSON.parse the saved
 * string back into a real array of objects. If nothing was saved yet
 * (first visit), we return an empty array instead of crashing.
 */
function loadTransactionsFromStorage() {
  const savedData = localStorage.getItem(STORAGE_KEY);
  if (!savedData) {
    return [];
  }
  return JSON.parse(savedData);
}

/**
 * saveTransactionsToStorage
 * WHY: Persists the current in-memory `transactions` array so it is
 * not lost on refresh.
 * HOW: JSON.stringify converts our array of objects into a string
 * (localStorage can only hold strings), then we save it under our
 * STORAGE_KEY.
 */
function saveTransactionsToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}


/* =====================================================================
   4. UTILITY / HELPER FUNCTIONS
   ===================================================================== */

/**
 * generateId
 * WHY: Every transaction needs a unique identifier so we can find,
 * edit, or delete the exact right one later.
 * HOW: Date.now() gives the current timestamp in milliseconds, which
 * is unique enough for a single-user, browser-only app. We add a
 * random suffix just in case two transactions are created in the
 * same millisecond.
 */
function generateId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000);
}

/**
 * formatCurrency
 * WHY: Raw numbers like 1500 aren't friendly to read. We want ₹1,500.00.
 * HOW: toLocaleString formats the number with commas and a fixed
 * number of decimal places using Indian number formatting.
 */
function formatCurrency(amount) {
  const formattedNumber = Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return "₹" + formattedNumber;
}

/**
 * formatDateForDisplay
 * WHY: Dates are stored as "2026-07-22" (from the <input type="date">)
 * which is fine for sorting but not friendly to read in a table.
 * HOW: We convert it into a JavaScript Date object, then use
 * toLocaleDateString to print something like "22 Jul 2026".
 */
function formatDateForDisplay(dateString) {
  const dateObj = new Date(dateString);
  return dateObj.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/**
 * escapeHtml
 * WHY: Transaction titles are typed by the user and later inserted
 * into the page using innerHTML. If we insert them raw, a title like
 * "<img src=x onerror=alert(1)>" would actually execute as HTML -
 * this is called an XSS (Cross-Site Scripting) attack.
 * HOW: We replace special HTML characters with their safe text
 * equivalents before inserting the string into the page.
 * INTERVIEW NOTE: This is a very common question - "how do you
 * prevent XSS when rendering user input?"
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * showToast
 * WHY: Gives the user quick visual feedback after an action
 * (saved, updated, deleted) without an intrusive alert() popup.
 * HOW: We update the toast's text and background color class, then
 * ask Bootstrap's Toast component to show it. It disappears on its
 * own after the delay set when we created the toast instance.
 */
function showToast(message, type = "success") {
  appToastBody.textContent = message;
  // Remove any previous color class, then add the correct one
  appToastEl.classList.remove("bg-success", "bg-danger");
  appToastEl.classList.add(type === "success" ? "bg-success" : "bg-danger");
  appToast.show();
}


/* =====================================================================
   5. RENDER FUNCTIONS (Dashboard, Stats, Table)
   ===================================================================== */

/**
 * calculateTotals
 * WHY: The dashboard needs Total Income, Total Expense, and Balance.
 * Rather than repeating this math in multiple places, one function
 * computes it and returns an object.
 * HOW: We loop through every transaction with a simple for...of loop.
 * If it's income, we add its amount to `income`. If it's expense, we
 * add it to `expense`. Balance is just income minus expense.
 */
function calculateTotals() {
  let income = 0;
  let expense = 0;

  for (const transaction of transactions) {
    if (transaction.type === "income") {
      income += transaction.amount;
    } else {
      expense += transaction.amount;
    }
  }

  const balance = income - expense;
  return { income, expense, balance };
}

/**
 * renderDashboardSummary
 * WHY: Updates the three big numbers at the top of the page (Balance,
 * Income, Expense) so they always reflect the current data.
 * HOW: Calls calculateTotals() to get the numbers, then writes them
 * into the correct DOM elements using formatCurrency for a clean look.
 */
function renderDashboardSummary() {
  const { income, expense, balance } = calculateTotals();
  totalBalanceEl.textContent = formatCurrency(balance);
  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
}

/**
 * renderStatistics
 * WHY: Shows three extra insights - total number of transactions, the
 * single highest expense, and the single highest income.
 * HOW: `.length` gives the transaction count directly. For the highest
 * expense/income, we filter transactions by type, then use
 * Math.max(...amounts) to find the largest amount. If there are no
 * transactions of that type, we default to 0 instead of -Infinity.
 */
function renderStatistics() {
  statTotalTransactionsEl.textContent = transactions.length;

  const expenseAmounts = transactions
    .filter(transaction => transaction.type === "expense")
    .map(transaction => transaction.amount);

  const incomeAmounts = transactions
    .filter(transaction => transaction.type === "income")
    .map(transaction => transaction.amount);

  const highestExpense = expenseAmounts.length ? Math.max(...expenseAmounts) : 0;
  const highestIncome = incomeAmounts.length ? Math.max(...incomeAmounts) : 0;

  statHighestExpenseEl.textContent = formatCurrency(highestExpense);
  statHighestIncomeEl.textContent = formatCurrency(highestIncome);
}

/**
 * buildTransactionRowHtml
 * WHY: Separates "how one row looks" from "how the table is built",
 * keeping renderTransactionTable() easier to read.
 * HOW: Returns an HTML string for one <tr>, using escapeHtml on the
 * title to stay safe from XSS, and a data-id attribute on each action
 * button so we know which transaction to edit/delete when clicked.
 */
function buildTransactionRowHtml(transaction) {
  const amountSign = transaction.type === "income" ? "+" : "-";
  const amountColorClass = transaction.type === "income" ? "text-income" : "text-expense";

  return `
    <tr>
      <td>${escapeHtml(transaction.title)}</td>
      <td><span class="category-badge">${escapeHtml(transaction.category)}</span></td>
      <td>${formatDateForDisplay(transaction.date)}</td>
      <td class="text-end fw-semibold ${amountColorClass}">
        ${amountSign} ${formatCurrency(transaction.amount)}
      </td>
      <td class="text-center">
        <span class="type-badge ${transaction.type}">${transaction.type}</span>
      </td>
      <td class="text-end">
        <button class="row-action-btn edit-btn" data-id="${transaction.id}" title="Edit">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="row-action-btn delete-btn" data-id="${transaction.id}" title="Delete">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `;
}

/**
 * renderTransactionTable
 * WHY: This is the main "draw the table" function. It respects
 * whatever search/filter/sort options are currently selected, and
 * shows the empty-state illustration when there's nothing to show.
 * HOW: Gets the processed list from getFilteredAndSortedTransactions(),
 * then either shows the empty state or builds all row HTML at once
 * (joining an array of strings is faster than repeated DOM inserts)
 * and drops it into the table body in a single line.
 */
function renderTransactionTable() {
  const visibleTransactions = getFilteredAndSortedTransactions();

  if (visibleTransactions.length === 0) {
    transactionTableBody.innerHTML = "";
    emptyState.classList.remove("d-none");
    return;
  }

  emptyState.classList.add("d-none");
  transactionTableBody.innerHTML = visibleTransactions
    .map(transaction => buildTransactionRowHtml(transaction))
    .join("");
}

/**
 * populateCategoryFilterOptions
 * WHY: The "Filter by category" dropdown should list every category
 * from our fixed CATEGORIES list, without us typing each <option> by
 * hand in the HTML (which would risk the two lists going out of sync).
 * HOW: Loop through CATEGORIES and append a new <option> element for
 * each one. Runs once on page load.
 */
function populateCategoryFilterOptions() {
  for (const category of CATEGORIES) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    filterCategorySelect.appendChild(option);
  }
}

/**
 * renderAll
 * WHY: Almost every action in this app (add, edit, delete, filter)
 * needs to refresh multiple parts of the page. Instead of remembering
 * to call 5 functions every time, we call this one function.
 * HOW: Simply calls each render function in order.
 */
function renderAll() {
  renderDashboardSummary();
  renderStatistics();
  renderTransactionTable();
  renderCategoryPieChart();
  renderMonthlyBarChart();
}


/* =====================================================================
   6. CHART FUNCTIONS (Chart.js)
   ===================================================================== */

/**
 * renderCategoryPieChart
 * WHY: Gives a quick visual answer to "where is my money going?" by
 * category.
 * HOW: We only look at "expense" transactions. We build a plain
 * object like { Food: 500, Transport: 200 } by adding up amounts per
 * category, then split that object into a labels array and a data
 * array (the format Chart.js expects). If a chart already exists on
 * this canvas, we destroy it first - otherwise Chart.js throws an
 * error about reusing a canvas that's already in use.
 */
function renderCategoryPieChart() {
  const expenseTransactions = transactions.filter(t => t.type === "expense");

  // Build a { categoryName: totalAmount } object
  const totalsByCategory = {};
  for (const transaction of expenseTransactions) {
    const category = transaction.category;
    totalsByCategory[category] = (totalsByCategory[category] || 0) + transaction.amount;
  }

  const labels = Object.keys(totalsByCategory);
  const data = Object.values(totalsByCategory);

  // Show the "no data" message instead of an empty chart
  if (labels.length === 0) {
    pieEmptyMsg.classList.remove("d-none");
    categoryPieCanvas.classList.add("d-none");
    if (pieChartInstance) {
      pieChartInstance.destroy();
      pieChartInstance = null;
    }
    return;
  }

  pieEmptyMsg.classList.add("d-none");
  categoryPieCanvas.classList.remove("d-none");

  // Destroy the previous chart instance before drawing a new one
  if (pieChartInstance) {
    pieChartInstance.destroy();
  }

  pieChartInstance = new Chart(categoryPieCanvas, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          "#2f5d50", "#3ddc97", "#e5533d", "#f2b134",
          "#4a90d9", "#9b59b6", "#e67e22", "#7f8c8d"
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}

/**
 * renderMonthlyBarChart
 * WHY: Shows expense trends over time - is spending going up or down
 * month over month?
 * HOW: Similar approach to the pie chart, but we group expenses by
 * "year-month" (e.g. "2026-07") instead of category. We sort the keys
 * chronologically before turning them into readable labels like
 * "Jul 2026", so the bars appear in the right time order.
 */
function renderMonthlyBarChart() {
  const expenseTransactions = transactions.filter(t => t.type === "expense");

  // Build a { "2026-07": totalAmount } object
  const totalsByMonth = {};
  for (const transaction of expenseTransactions) {
    const dateObj = new Date(transaction.date);
    const monthKey = dateObj.getFullYear() + "-" + String(dateObj.getMonth() + 1).padStart(2, "0");
    totalsByMonth[monthKey] = (totalsByMonth[monthKey] || 0) + transaction.amount;
  }

  // Sort month keys chronologically ("2026-01" before "2026-07")
  const sortedMonthKeys = Object.keys(totalsByMonth).sort();

  // Convert "2026-07" into a friendly label like "Jul 2026"
  const labels = sortedMonthKeys.map(key => {
    const [year, month] = key.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1);
    return dateObj.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  });

  const data = sortedMonthKeys.map(key => totalsByMonth[key]);

  if (labels.length === 0) {
    barEmptyMsg.classList.remove("d-none");
    monthlyBarCanvas.classList.add("d-none");
    if (barChartInstance) {
      barChartInstance.destroy();
      barChartInstance = null;
    }
    return;
  }

  barEmptyMsg.classList.add("d-none");
  monthlyBarCanvas.classList.remove("d-none");

  if (barChartInstance) {
    barChartInstance.destroy();
  }

  barChartInstance = new Chart(monthlyBarCanvas, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Expenses",
        data: data,
        backgroundColor: "#e5533d",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}


/* =====================================================================
   7. CRUD FUNCTIONS (Add / Edit / Delete)
   ===================================================================== */

/**
 * openAddTransactionModal
 * WHY: Prepares a clean, empty form whenever the user wants to add a
 * NEW transaction (as opposed to editing an existing one).
 * HOW: Resets the form, clears the hidden id field (this is how the
 * save function knows it's an "add", not an "edit"), sets the modal
 * title, and defaults the date field to today for convenience.
 */
function openAddTransactionModal() {
  transactionForm.reset();
  transactionForm.classList.remove("was-validated");
  transactionIdInput.value = "";
  editingTransactionId = null;
  transactionModalLabel.textContent = "Add Transaction";

  // Default the date picker to today's date (format: YYYY-MM-DD)
  const today = new Date().toISOString().split("T")[0];
  dateInput.value = today;
}

/**
 * openEditTransactionModal
 * WHY: Lets the user modify an existing transaction instead of
 * deleting and re-adding it.
 * HOW: Finds the matching transaction by id using Array.find(), then
 * fills every form field with its current values. Storing the id in
 * both `editingTransactionId` and the hidden input lets saveTransaction
 * know which record to update.
 */
function openEditTransactionModal(id) {
  const transaction = transactions.find(t => t.id === id);
  if (!transaction) return;

  editingTransactionId = id;
  transactionIdInput.value = id;
  transactionModalLabel.textContent = "Edit Transaction";

  titleInput.value = transaction.title;
  amountInput.value = transaction.amount;
  typeInput.value = transaction.type;
  categoryInput.value = transaction.category;
  dateInput.value = transaction.date;

  transactionModal.show();
}

/**
 * handleSaveTransaction
 * WHY: This single function handles BOTH adding a new transaction and
 * updating an existing one - avoiding two nearly-identical functions.
 * HOW:
 *  1. Run the browser's built-in form validation (required fields,
 *     min amount, etc.) using Bootstrap's validation styling.
 *  2. Read the current values out of each input.
 *  3. If `editingTransactionId` is set, find that transaction in the
 *     array and overwrite its fields (update). Otherwise, push a
 *     brand new transaction object onto the array (create).
 *  4. Save to localStorage, re-render the whole UI, close the modal,
 *     and show a success toast.
 */
function handleSaveTransaction() {
  // Trigger native HTML validation (required, min, type="number", etc.)
  if (!transactionForm.checkValidity()) {
    transactionForm.classList.add("was-validated");
    return;
  }

  const title = titleInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const type = typeInput.value;
  const category = categoryInput.value;
  const date = dateInput.value;

  if (editingTransactionId) {
    // UPDATE: find the existing transaction and overwrite its fields
    const transaction = transactions.find(t => t.id === editingTransactionId);
    transaction.title = title;
    transaction.amount = amount;
    transaction.type = type;
    transaction.category = category;
    transaction.date = date;
  } else {
    // CREATE: build a new transaction object and add it to the array
    const newTransaction = {
      id: generateId(),
      title,
      amount,
      type,
      category,
      date
    };
    transactions.push(newTransaction);
  }

  saveTransactionsToStorage();
  renderAll();
  transactionModal.hide();
  showToast(editingTransactionId ? "Transaction updated." : "Transaction added.");
  editingTransactionId = null;
}

/**
 * handleDeleteButtonClick
 * WHY: We don't delete immediately on click - we ask for confirmation
 * first, so a misclick doesn't destroy data permanently.
 * HOW: Remembers which transaction id is being considered for
 * deletion, then opens the confirmation modal.
 */
function handleDeleteButtonClick(id) {
  transactionIdPendingDelete = id;
  deleteModal.show();
}

/**
 * handleConfirmDelete
 * WHY: Runs only after the user explicitly confirms in the modal.
 * HOW: Array.filter() creates a NEW array containing every
 * transaction EXCEPT the one matching transactionIdPendingDelete -
 * this is the standard, non-mutating way to "remove" an item from
 * an array in JavaScript.
 */
function handleConfirmDelete() {
  transactions = transactions.filter(t => t.id !== transactionIdPendingDelete);
  transactionIdPendingDelete = null;

  saveTransactionsToStorage();
  renderAll();
  deleteModal.hide();
  showToast("Transaction deleted.", "danger");
}


/* =====================================================================
   8. FILTER, SEARCH & SORT
   ===================================================================== */

/**
 * getFilteredAndSortedTransactions
 * WHY: The table should reflect the search box, the two filter
 * dropdowns, and the sort dropdown all at once. Centralizing this
 * logic in one function means the table always shows an accurate,
 * consistent result no matter which control the user just changed.
 * HOW:
 *  1. Start from the full `transactions` array.
 *  2. Filter step-by-step: text search -> type -> category.
 *     (Array.filter always returns a new array, so we can chain calls.)
 *  3. Sort the filtered result based on the chosen sort option, using
 *     a copy of the array ([...array]) so we never accidentally
 *     reorder the original `transactions` array in memory.
 */
function getFilteredAndSortedTransactions() {
  const searchText = searchInput.value.trim().toLowerCase();
  const typeFilter = filterTypeSelect.value;
  const categoryFilter = filterCategorySelect.value;
  const sortOption = sortBySelect.value;

  let result = transactions.filter(transaction => {
    const matchesSearch = transaction.title.toLowerCase().includes(searchText);
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || transaction.category === categoryFilter;
    return matchesSearch && matchesType && matchesCategory;
  });

  // Copy before sorting so we don't mutate the filtered array while
  // it's still being referenced elsewhere.
  result = [...result].sort((a, b) => {
    if (sortOption === "date-desc") return new Date(b.date) - new Date(a.date);
    if (sortOption === "date-asc") return new Date(a.date) - new Date(b.date);
    if (sortOption === "amount-desc") return b.amount - a.amount;
    if (sortOption === "amount-asc") return a.amount - b.amount;
    return 0;
  });

  return result;
}


/* =====================================================================
   9. DARK MODE
   ===================================================================== */

/**
 * applyTheme
 * WHY: One place that actually changes the theme, so both the toggle
 * button and the "load saved preference on startup" logic can reuse it.
 * HOW: Sets a `data-theme` attribute on the <html> element - our CSS
 * file has rules like `html[data-theme="dark"] { ... }` that override
 * the default color variables when this attribute is present. Also
 * swaps the toggle button's icon and remembers the choice for next time.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);

  const icon = darkModeToggleBtn.querySelector("i");
  icon.className = theme === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

/**
 * toggleDarkMode
 * WHY: Called when the user clicks the moon/sun button.
 * HOW: Reads the current theme attribute, flips it, and applies it.
 */
function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
}

/**
 * loadSavedTheme
 * WHY: Without this, dark mode would reset to light every time the
 * page is refreshed - defeating the purpose of a "preference".
 * HOW: Reads the saved theme from localStorage (defaulting to
 * "light" if nothing was saved yet) and applies it immediately on load.
 */
function loadSavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
}


/* =====================================================================
   10. CSV EXPORT
   ===================================================================== */

/**
 * exportTransactionsToCSV
 * WHY: A simple but genuinely useful feature - lets the user download
 * their data as a spreadsheet-compatible file, all from the browser
 * with no backend involved.
 * HOW:
 *  1. Build a header row, then one row of comma-separated values per
 *     transaction.
 *  2. Wrap the whole string in a Blob (a file-like object) with a CSV
 *     mime type.
 *  3. Create a temporary, invisible <a> tag pointing to that Blob and
 *     "click" it programmatically - this is the standard way to
 *     trigger a client-side file download without a server.
 */
function exportTransactionsToCSV() {
  if (transactions.length === 0) {
    showToast("No transactions to export.", "danger");
    return;
  }

  const header = ["Title", "Amount", "Type", "Category", "Date"];
  const rows = transactions.map(t => [t.title, t.amount, t.type, t.category, t.date]);

  const csvContent = [header, ...rows]
    .map(row => row.map(value => `"${value}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const downloadUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "expense-tracker-transactions.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);

  showToast("Transactions exported to CSV.");
}


/* =====================================================================
   11. EVENT LISTENERS
   Why here, last: by the time this code runs, every function above
   already exists, so it's safe to reference them all.
   ===================================================================== */

// Open the "Add" modal in create-mode whenever it's about to open.
// (Bootstrap's own data-bs-toggle already opens the modal; this just
// makes sure the form is reset first.)
addTransactionBtn.addEventListener("click", openAddTransactionModal);

// Save button inside the modal (works for both add and edit)
saveTransactionBtn.addEventListener("click", handleSaveTransaction);

// Confirm delete button inside the delete modal
confirmDeleteBtn.addEventListener("click", handleConfirmDelete);

/**
 * Event delegation for Edit/Delete buttons.
 * WHY: Table rows are created and destroyed dynamically, so attaching
 * a click listener to each individual button would mean re-attaching
 * listeners every time we re-render (easy to forget, easy to leak).
 * HOW: We attach ONE listener to the table body (which always exists).
 * Because of event bubbling, a click on any button inside it also
 * fires here. We check which button was actually clicked using
 * `.closest()` and read its `data-id` attribute to know which
 * transaction to act on. This is a classic, important JS interview
 * concept: "event delegation".
 */
transactionTableBody.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-btn");
  const deleteButton = event.target.closest(".delete-btn");

  if (editButton) {
    openEditTransactionModal(editButton.dataset.id);
  } else if (deleteButton) {
    handleDeleteButtonClick(deleteButton.dataset.id);
  }
});

// Search box: re-render the table on every keystroke
searchInput.addEventListener("input", renderTransactionTable);

// Filter/sort dropdowns: re-render the table whenever selection changes
filterTypeSelect.addEventListener("change", renderTransactionTable);
filterCategorySelect.addEventListener("change", renderTransactionTable);
sortBySelect.addEventListener("change", renderTransactionTable);

// Clear filters button: reset all controls back to default, then re-render
clearFiltersBtn.addEventListener("click", () => {
  searchInput.value = "";
  filterTypeSelect.value = "all";
  filterCategorySelect.value = "all";
  sortBySelect.value = "date-desc";
  renderTransactionTable();
});

// Dark mode toggle
darkModeToggleBtn.addEventListener("click", toggleDarkMode);

// CSV export
exportCsvBtn.addEventListener("click", exportTransactionsToCSV);


/* =====================================================================
   INITIALIZATION
   Runs once, immediately, when script.js loads (it's placed at the
   end of <body>, so the DOM already exists by this point - no need
   for a DOMContentLoaded wrapper).
   ===================================================================== */
loadSavedTheme();
transactions = loadTransactionsFromStorage();
populateCategoryFilterOptions();
renderAll();
