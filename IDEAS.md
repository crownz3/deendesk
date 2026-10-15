# 💡 DeenDesk Ideas & Feature Tracker

A clean tracking document reserved exclusively for your feature ideas, implementation progress, and roadmap.

---

## 📌 Status Legend

| Status | Description |
|:---:|:---|
| 💡 **Idea / Backlog** | Planned idea, not yet started |
| 🚀 **In Progress** | Currently being implemented |
| 🧪 **In Review** | Built, currently being tested / verified |
| ✅ **Completed** | Finished, tested, and implemented |
| ⏸️ **On Hold** | Paused or saved for a later phase |

---

## 💡 Ideas List

### 1. 🕒 Staff & Incharge Check-In / Check-Out & Monitoring System
- **Status:** 💡 Backlog
- **Access:** Org Admin (all madrasas) | Madrasa Incharge (own madrasa staff only)

#### What it does:
Digital Check-In and Check-Out system for all Staff, Madrasa Incharges, and Coordinators, with a real-time Monitoring Page:
- **Org Admin:** Monitors check-in/out status, times, and work hours for all staff across all madrasas.
- **Madrasa Incharge:** Only sees the check-in/out status for staff in their own madrasa and class groups.

#### Checklist to implement:
- [ ] **Check-In / Out Button:** Add easy Check-In / Check-Out buttons on staff dashboard with time tracking
- [ ] **Data Model:** Create `staffAttendance` records (userId, madrasaId, shift, date, checkIn, checkOut, totalHours)
- [ ] **Monitoring Page:** Build dedicated monitor page with live status chips (Checked In, Checked Out, Absent)
- [ ] **Filters:** Filter by Date, Madrasa, Shift, Role, and Status
- [ ] **Permissions:** Ensure Org Admin sees all, while Madrasa Incharge is strictly scoped to their madrasa
- [ ] **CSV Export:** Export staff attendance and logged hours to CSV

---

## ✅ Completed Features Log

- [x] **Compliance Monitor: Shift-Wise Class Group Filtering & Badges** *(Completed: 2026-10-15)*
  - Resolved shifts from Firestore `shifts` collection with keyword fallbacks.
  - Added Shift dropdown selector to filters row.
  - Displayed shift badges in grouped & flat tables and mobile cards.
  - Added shift column to CSV export.

- [x] **Compliance Monitor: Evaluation Entered Summary Card & Direct Filters** *(Completed: 2026-10-15)*
  - Added dedicated Evaluation Entered summary card with live progress bar.
  - Fixed summary card clicks to filter directly by `attendance-entered` and `evaluation-entered`.
  - Added `Att Entered` and `Eval Entered` quick filter buttons to status tabs.

- [x] **Dashboard: User-Configurable Shortcuts** *(Completed: 2026-10-15)*
  - Added customizable shortcut menu tiles per user on dashboard.

- [x] **Compliance Monitor: 90vh Responsive Dialog & Mobile Layout** *(Completed: 2026-10-15)*
  - 90vh dialog container with simplified header shortcuts and close button.
  - Responsive mobile cards view for $\le$ 768px screens.

---

## 📝 Idea Template

When adding a new idea, you can use this format:

```markdown
### [Idea Title]
- **Category:** [Compliance / Classroom / Dashboard / Reports / Mobile / Other]
- **Status:** 💡 Idea / Backlog
- **Description:** [Brief summary of the idea and how it should work]
- **Tasks / Checklist:**
  - [ ] [Step 1]
  - [ ] [Step 2]
- **Notes / Progress:** [Any notes or updates as we work on it]
```
