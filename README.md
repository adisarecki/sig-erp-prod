# Sig ERP – Modern Financial Management

System do zarządzania finansami, projektami i CRM dla nowoczesnych firm.

## 🚀 Quick Start (Local Dev)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Copy `.env.example` to `.env` and configure your `DATABASE_URL`.

3. **Database Migration**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

5. **Open App**:
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🧠 AI Agent Guidance

Wszystkie kluczowe zasady systemu, schematy bazy danych oraz kontrakty API znajdują się w katalogu `docs/`. 

**Agent AI MUSI zapoznać się z dokumentem:**
👉 **[docs/SYSTEM_DNA.md](./docs/SYSTEM_DNA.md)**

Jest to jedyne źródło prawdy (Single Source of Truth) dotyczące logiki biznesowej, append-only ledger oraz modelu Contractor.
