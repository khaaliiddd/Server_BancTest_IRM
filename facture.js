// Configuration initiale
document.addEventListener("DOMContentLoaded", function () {
  // Initialiser les graphiques
  initPowerChart();
  initConsumptionChart();

  // Gestion des onglets
  setupTabs();

  // Calcul initial
  calculateInvoice();

  // Événements
  document.querySelectorAll(".consumption-input").forEach((input) => {
    input.addEventListener("change", calculateInvoice);
    input.addEventListener("input", calculateInvoice);
  });

  document
    .getElementById("generate-pdf")
    .addEventListener("click", generatePDF);
  document
    .getElementById("print-invoice")
    .addEventListener("click", printInvoice);

  // Charger l'historique si disponible
  loadHistory();
});

// Variables globales
let powerChart, consumptionChart;
const tariffRates = [1.05, 1.2, 1.35, 1.55, 1.75, 1.95];
const tariffLimits = [100, 100, 300, 500, 1000, Infinity];

// Fonction principale de calcul
function calculateInvoice() {
  // 1. Calcul de la consommation
  let totalKwh = 0;
  let consumptionTotal = 0;

  for (let i = 0; i < 6; i++) {
    const inputId = `tranche${i + 1}`;
    const amountId = `montant${i + 1}`;
    const consumption = parseFloat(document.getElementById(inputId).value) || 0;
    const amount = consumption * tariffRates[i];

    document.getElementById(amountId).textContent = amount.toFixed(2);
    totalKwh += consumption;
    consumptionTotal += amount;
  }

  // 2. Calcul des paramètres électriques
  const cosPhi = 0.8; // Valeur typique pour un IRM
  const s = 45; // kVA
  const p = s * cosPhi;
  const q = Math.sqrt(s * s - p * p);
  const tanPhi = q / p;

  document.getElementById("p-value").textContent = p.toFixed(2);
  document.getElementById("q-value").textContent = q.toFixed(2);
  document.getElementById("s-value").textContent = s.toFixed(2);
  document.getElementById("tan-phi-value").textContent = tanPhi.toFixed(2);

  // 3. Calcul des pénalités
  const subscription = 45 * 120; // 45kVA × 120 DH
  const reactivePenalty = tanPhi > 0.4 ? consumptionTotal * 0.05 : 0;

  // Mise à jour de l'affichage des pénalités
  const penaltyElement = document.getElementById("reactive-status");
  if (tanPhi > 0.4) {
    penaltyElement.className = "badge badge-danger";
    penaltyElement.innerHTML =
      '<i class="fas fa-exclamation-triangle"></i> Pénalité énergie réactive applicable';
  } else {
    penaltyElement.className = "badge badge-success";
    penaltyElement.innerHTML =
      '<i class="fas fa-check-circle"></i> Pas de pénalité énergie réactive';
  }

  // 4. Calcul des totaux
  const totalHT = consumptionTotal + subscription + reactivePenalty;
  const tva = totalHT * 0.1;
  const totalTTC = totalHT + tva;

  // Mise à jour de l'interface
  document.getElementById("total-consumption").textContent =
    consumptionTotal.toFixed(2) + " DH";
  document.getElementById("abonnement").textContent =
    subscription.toFixed(2) + " DH";
  document.getElementById("penalite").textContent =
    reactivePenalty.toFixed(2) + " DH";
  document.getElementById("total-ht").textContent = totalHT.toFixed(2) + " DH";
  document.getElementById("tva").textContent = tva.toFixed(2) + " DH";
  document.getElementById("total-ttc").textContent =
    totalTTC.toFixed(2) + " DH";

  // Mettre à jour les graphiques
  updatePowerChart(p, q, s);

  // Sauvegarder dans l'historique
  saveToHistory(totalKwh, totalTTC);
}

// Graphique du triangle des puissances
function initPowerChart() {
  const ctx = document.getElementById("power-chart").getContext("2d");
  powerChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Puissance Active (P)", "Puissance Réactive (Q)"],
      datasets: [
        {
          data: [36, 27],
          backgroundColor: ["#28a745", "#e74c3c"],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw} kVA`;
            },
          },
        },
      },
    },
  });
}

// Mise à jour du graphique des puissances
function updatePowerChart(p, q, s) {
  powerChart.data.datasets[0].data = [p, q];
  powerChart.update();
}

// Graphique de l'historique de consommation
function initConsumptionChart() {
  const ctx = document.getElementById("consumption-chart").getContext("2d");
  consumptionChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Consommation (kWh)",
          data: [],
          borderColor: "#0056b3",
          backgroundColor: "rgba(0, 86, 179, 0.1)",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Montant (DH)",
          data: [],
          borderColor: "#28a745",
          backgroundColor: "rgba(40, 167, 69, 0.1)",
          fill: true,
          tension: 0.3,
          yAxisID: "y1",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "kWh" },
        },
        y1: {
          beginAtZero: true,
          position: "right",
          title: { display: true, text: "DH" },
          grid: { drawOnChartArea: false },
        },
      },
    },
  });
}

// Gestion des onglets
function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", function () {
      // Désactiver tous les onglets
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      // Activer l'onglet sélectionné
      this.classList.add("active");
      const tabId = this.getAttribute("data-tab");
      document.getElementById(`${tabId}-tab`).classList.add("active");
    });
  });
}

// Sauvegarde de l'historique
function saveToHistory(kwh, amount) {
  const today = new Date();
  const monthYear = today.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });

  let history = JSON.parse(
    localStorage.getItem("irm-electricity-history") || "[]"
  );

  // Vérifier si le mois existe déjà
  const existingIndex = history.findIndex((item) => item.month === monthYear);

  if (existingIndex >= 0) {
    history[existingIndex] = { month: monthYear, kwh, amount };
  } else {
    history.push({ month: monthYear, kwh, amount });
  }

  // Garder seulement les 12 derniers mois
  if (history.length > 12) history = history.slice(-12);

  localStorage.setItem("irm-electricity-history", JSON.stringify(history));
  updateHistoryChart();
}

// Chargement de l'historique
function loadHistory() {
  const history = JSON.parse(
    localStorage.getItem("irm-electricity-history") || "[]"
  );
  if (history.length > 0) updateHistoryChart();
}

// Mise à jour du graphique d'historique
function updateHistoryChart() {
  const history = JSON.parse(
    localStorage.getItem("irm-electricity-history") || "[]"
  );

  const labels = history.map((item) => item.month);
  const kwhData = history.map((item) => item.kwh);
  const amountData = history.map((item) => item.amount);

  consumptionChart.data.labels = labels;
  consumptionChart.data.datasets[0].data = kwhData;
  consumptionChart.data.datasets[1].data = amountData;
  consumptionChart.update();
}

// Génération PDF
async function generatePDF() {
  const { jsPDF } = window.jspdf;

  // Masquer les éléments non nécessaires
  const noPrintElements = document.querySelectorAll(".no-print");
  noPrintElements.forEach((el) => (el.style.display = "none"));

  // Générer le PDF
  const canvas = await html2canvas(document.getElementById("invoice-content"), {
    scale: 2,
    logging: false,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);

  // Restaurer l'affichage
  noPrintElements.forEach((el) => (el.style.display = ""));

  // Sauvegarder le PDF
  const today = new Date();
  pdf.save(`Facture_IRM_${today.toISOString().slice(0, 10)}.pdf`);
}

// Impression directe
function printInvoice() {
  window.print();
}
