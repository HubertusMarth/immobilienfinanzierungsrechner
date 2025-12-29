import { useMemo, useState } from "react";
import "./App.css";

// Zahl als Euro formatieren
function euro(value) {
  if (!isFinite(value)) return "–";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function App() {
  // ===============================
  // EINGABEN (State)
  // ===============================
  const [purchasePrice, setPurchasePrice] = useState(400000); // Kaufpreis €
  const [equity, setEquity] = useState(80000); // Eigenkapital €
  const [ancillaryPercent, setAncillaryPercent] = useState(10); // Nebenkosten %

  const [interestRate, setInterestRate] = useState(3.5); // Sollzins % p.a.
  const [repaymentRate, setRepaymentRate] = useState(2.0); // Anfangstilgung % p.a.
  const [fixedYears, setFixedYears] = useState(10); // Zinsbindung in Jahren

  const [specialRepayment, setSpecialRepayment] = useState(0); // Sondertilgung pro Jahr €

  // ===============================
  // BERECHNUNGEN (useMemo)
  // ===============================

  // Nebenkosten in Euro
  const ancillaryCosts = useMemo(() => {
    return purchasePrice * (ancillaryPercent / 100);
  }, [purchasePrice, ancillaryPercent]);

  // Darlehen
  const loanAmount = useMemo(() => {
    return purchasePrice + ancillaryCosts - equity;
  }, [purchasePrice, ancillaryCosts, equity]);

  // Monatsrate (Annuität nach Standard-Formel: Darlehen * (Zins+Tilgung) / 12)
  const monthlyPayment = useMemo(() => {
    const i = interestRate / 100;
    const t = repaymentRate / 100;
    const annualPayment = loanAmount * (i + t);
    return annualPayment / 12;
  }, [loanAmount, interestRate, repaymentRate]);

  // Laufzeit & Zinsen bis Volltilgung (Simulation monatlich, inkl. Sondertilgung)
  const payoffInfo = useMemo(() => {
    if (loanAmount <= 0) {
      return { months: 0, yearsText: "0 Monate", totalInterest: 0 };
    }

    let rest = loanAmount;
    const monthlyInterestRate = (interestRate / 100) / 12;

    let months = 0;
    let totalInterest = 0;

    // Schutz: max. 100 Jahre
    const maxMonths = 1200;

    while (rest > 0 && months < maxMonths) {
      const interestPart = rest * monthlyInterestRate;
      const repaymentPart = monthlyPayment - interestPart;

      // Rate deckt nicht einmal die Zinsen -> nicht abzahlbar
      if (repaymentPart <= 0) {
        return {
          months: Infinity,
          yearsText: "Nicht abzahlbar (Rate zu klein)",
          totalInterest: Infinity,
        };
      }

      totalInterest += interestPart;
      rest -= repaymentPart;

      // Sondertilgung am Jahresende (nach Monat 12, 24, 36, ...)
      if (specialRepayment > 0 && (months + 1) % 12 === 0 && rest > 0) {
        const extra = Math.min(specialRepayment, rest);
        rest -= extra;
      }

      months += 1;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    const yearsText =
      years === 0
        ? `${remainingMonths} Monate`
        : `${years} Jahr${years === 1 ? "" : "e"}${
            remainingMonths
              ? ` ${remainingMonths} Monat${remainingMonths === 1 ? "" : "e"}`
              : ""
          }`;

    return { months, yearsText, totalInterest };
  }, [loanAmount, interestRate, monthlyPayment, specialRepayment]);

  // Restschuld nach Zinsbindung (Simulation monatlich, inkl. Sondertilgung)
  const remainingDebtAtFixEnd = useMemo(() => {
    if (loanAmount <= 0) return 0;

    let rest = loanAmount;
    const monthlyInterestRate = (interestRate / 100) / 12;
    const months = Math.max(0, Math.round(fixedYears * 12));

    for (let m = 0; m < months; m++) {
      const interestPart = rest * monthlyInterestRate;
      const repaymentPart = monthlyPayment - interestPart;

      // Rate zu klein -> keine sinnvolle Tilgung
      if (repaymentPart <= 0) return rest;

      rest -= repaymentPart;

      // Sondertilgung am Jahresende
      if (specialRepayment > 0 && (m + 1) % 12 === 0 && rest > 0) {
        const extra = Math.min(specialRepayment, rest);
        rest -= extra;
      }

      if (rest <= 0) return 0;
    }

    return rest;
  }, [loanAmount, interestRate, fixedYears, monthlyPayment, specialRepayment]);

  // Gesamtrückzahlung (Darlehen + Zinsen)
  const totalPayment = useMemo(() => {
    if (!isFinite(payoffInfo.totalInterest) || loanAmount <= 0) return Infinity;
    return loanAmount + payoffInfo.totalInterest;
  }, [loanAmount, payoffInfo.totalInterest]);

  // Tilgungsplan (jährlich), inkl. Sondertilgung am Jahresende
  const amortizationSchedule = useMemo(() => {
    if (loanAmount <= 0) return [];

    let rest = loanAmount;
    const monthlyInterestRate = (interestRate / 100) / 12;

    const schedule = [];
    const maxMonths = 1200;
    let month = 0;

    while (rest > 0 && month < maxMonths) {
      const yearNumber = Math.floor(month / 12) + 1;

      let interestSum = 0;
      let repaymentSum = 0;
      const startDebt = rest;

      for (let i = 0; i < 12 && rest > 0 && month < maxMonths; i++) {
        const interestPart = rest * monthlyInterestRate;
        const repaymentPart = monthlyPayment - interestPart;

        if (repaymentPart <= 0) {
          return schedule;
        }

        interestSum += interestPart;
        repaymentSum += repaymentPart;

        rest -= repaymentPart;
        month += 1;
      }

      // Sondertilgung am Jahresende
      if (specialRepayment > 0 && rest > 0) {
        const extra = Math.min(specialRepayment, rest);
        rest -= extra;
        repaymentSum += extra;
      }

      schedule.push({
        year: yearNumber,
        startDebt,
        interestSum,
        repaymentSum,
        endDebt: Math.max(rest, 0),
      });
    }

    return schedule;
  }, [loanAmount, interestRate, monthlyPayment, specialRepayment]);

  // ===============================
  // UI
  // ===============================
  return (
    <div style={{ maxWidth: 820, margin: "40px auto", fontFamily: "system-ui" }}>
      <h1>Immobilienfinanzierungsrechner</h1>
      <p>
        Gib die Eckdaten deiner Finanzierung ein. Der Rechner berechnet Darlehen, Rate,
        Restschuld, Laufzeit, Zinsen sowie einen Tilgungsplan (jährlich).
      </p>

      {/* EINGABEN */}
      <div style={{ display: "grid", gap: 12 }}>
        <label>
          <div>Kaufpreis (€)</div>
          <input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Eigenkapital (€)</div>
          <input
            type="number"
            value={equity}
            onChange={(e) => setEquity(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Nebenkosten (% vom Kaufpreis)</div>
          <input
            type="number"
            step="0.1"
            value={ancillaryPercent}
            onChange={(e) => setAncillaryPercent(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Sollzins (% p.a.)</div>
          <input
            type="number"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Anfangstilgung (% p.a.)</div>
          <input
            type="number"
            step="0.01"
            value={repaymentRate}
            onChange={(e) => setRepaymentRate(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Zinsbindung (Jahre)</div>
          <input
            type="number"
            value={fixedYears}
            onChange={(e) => setFixedYears(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>

        <label>
          <div>Sondertilgung (€/Jahr)</div>
          <input
            type="number"
            value={specialRepayment}
            onChange={(e) => setSpecialRepayment(Number(e.target.value))}
            style={{ width: "100%", padding: 10, fontSize: 16 }}
          />
        </label>
      </div>

      {/* ERGEBNISSE */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
        }}
      >
        <h2>Ergebnis</h2>

        <p>
          Nebenkosten: <strong>{euro(ancillaryCosts)}</strong>
        </p>

        <p>
          Darlehen: <strong>{euro(loanAmount)}</strong>
        </p>

        <p style={{ fontSize: 22, marginTop: 8 }}>
          Monatsrate: <strong>{euro(monthlyPayment)}</strong>
        </p>

        <p>
          Restschuld nach {fixedYears} Jahren:{" "}
          <strong>{euro(remainingDebtAtFixEnd)}</strong>
        </p>

        <p>
          Kreditlaufzeit (bis Volltilgung):{" "}
          <strong>{payoffInfo.yearsText}</strong>
        </p>

        <p>
          Zinsen bis Volltilgung:{" "}
          <strong>
            {isFinite(payoffInfo.totalInterest) ? euro(payoffInfo.totalInterest) : "–"}
          </strong>
        </p>

        <p>
          Gesamtrückzahlung (Darlehen + Zinsen):{" "}
          <strong>{isFinite(totalPayment) ? euro(totalPayment) : "–"}</strong>
        </p>

        {payoffInfo.months === Infinity && (
          <p style={{ color: "crimson" }}>
            Achtung: Mit dieser Rate ist der Kredit nicht abzahlbar (Rate deckt nicht
            einmal die Zinsen).
          </p>
        )}
      </div>

      {/* TILGUNGSPLAN */}
      <div style={{ marginTop: 24 }}>
        <h2>Tilgungsplan (jährlich)</h2>

        {amortizationSchedule.length === 0 ? (
          <p>Kein Tilgungsplan verfügbar.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                    Jahr
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    Anfangsschuld
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    Zinsen
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    Tilgung
                  </th>
                  <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                    Restschuld
                  </th>
                </tr>
              </thead>
              <tbody>
                {amortizationSchedule.map((row) => (
                  <tr key={row.year}>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{row.year}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {euro(row.startDebt)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {euro(row.interestSum)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {euro(row.repaymentSum)}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid #eee", textAlign: "right" }}>
                      {euro(row.endDebt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}