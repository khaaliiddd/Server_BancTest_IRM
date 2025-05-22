// alarms-worker.js
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// self.addEventListener("message", (event) => {
//   if (event.data === "startMonitoring") {
//     // initializeFirebase();
//     startMonitoring();
//   }
// });

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD5lTweTgeQdG6XU2PtxjFTpRwfDUpjctc",
  authDomain: "banc-de-test-588bb.firebaseapp.com",
  databaseURL: "https://banc-de-test-588bb-default-rtdb.firebaseio.com",
  projectId: "banc-de-test-588bb",
  storageBucket: "banc-de-test-588bb.firebasestorage.app",
  messagingSenderId: "1085872542530",
  appId: "1:1085872542530:web:3432fadb3a49bdca316edb",
  measurementId: "G-W8DC2XRW47",
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Stockage des alarmes
var activeAlarms = [];
var alarmHistory = [];

// Seuils critiques pour le système triphasé
const CRITICAL_THRESHOLDS = {
  MDP: {
    U1: { min: 350, max: 400 },
    U2: { min: 350, max: 400 },
    U3: { min: 350, max: 400 },
    I1: { min: 0, max: 100 },
    I2: { min: 50, max: 100 },
    I3: { min: 50, max: 100 },
    COS1: { min: 0.4, max: 0.9 },
    COS2: { min: 0.4, max: 0.9 },
    COS3: { min: 0.4, max: 0.9 },
    COST: { min: 0.4, max: 0.9 },
    P: { min: 5000, max: 20000 }, // puissance active (W)
    Q: { min: 1000, max: 10000 }, // puissance réactive (VAR)
    S: { min: 5000, max: 25000 }, // puissance apparente (VA)
    FREQ: { min: 49.5, max: 50.5 }, // fréquence (Hz)
  },

  PDU: {
    V1: { min: 190, max: 250 },
    V2: { min: 190, max: 250 },
    V3: { min: 190, max: 250 },
    U1: { min: 350, max: 400 },
    U2: { min: 350, max: 400 },
    U3: { min: 350, max: 400 },
    I1: { min: 40, max: 80 },
    I2: { min: 40, max: 80 },
    I3: { min: 40, max: 80 },
    COS1: { min: 0.4, max: 0.9 },
    COS2: { min: 0.4, max: 0.9 },
    COS3: { min: 0.4, max: 0.9 },
    COST: { min: 0.4, max: 0.9 },
    FREQ: { min: 49.5, max: 50.5 },
    P: { min: 5000, max: 20000 }, // puissance active (W)
    Q: { min: 1000, max: 10000 }, // puissance réactive (VAR)
    S: { min: 5000, max: 25000 }, // puissance apparente (VA)
  },

  CHILLER: {
    V1: { min: 215, max: 230 },
    V2: { min: 215, max: 230 },
    V3: { min: 215, max: 230 },
    I1: { min: 0, max: 100 },
    I2: { min: 50, max: 100 },
    I3: { min: 50, max: 100 },
    HUMI: { min: 50, max: 100 }, // humidity
    TEMP: { min: 18, max: 25 }, // température de l’eau (°C)
    PRESS: { min: 1.5, max: 2.5 }, // pression fluide (bar)
  },

  F50H: {
    V1: { min: 215, max: 230 },
    V2: { min: 215, max: 230 },
    V3: { min: 215, max: 230 },
    I1: { min: 0, max: 100 },
    I2: { min: 50, max: 100 },
    I3: { min: 50, max: 100 },
    HUMI: { min: 50, max: 100 }, // humidity
    TEMP: { min: 18, max: 25 }, // température de l’eau (°C)
    PRESS: { min: 1.5, max: 2.5 }, // pression fluide (bar)
  },

  COOLING: {
    V1: { min: 215, max: 230 },
    V2: { min: 215, max: 230 },
    V3: { min: 215, max: 230 },
    I1: { min: 0, max: 100 },
    I2: { min: 50, max: 100 },
    I3: { min: 50, max: 100 },
    HUMI: { min: 50, max: 100 }, // humidity
    TEMP: { min: 18, max: 25 }, // température de l’eau (°C)
    PRESS: { min: 1.5, max: 2.5 }, // pression fluide (bar)
  },
};

// Démarrer la surveillance au chargement
document.addEventListener("DOMContentLoaded", async function () {
  await loadAlarmHistory(); // Charge l'historique avant tout
  updateAlarmDisplay(); // Affiche les données chargées
  startMonitoring(); // Démarre la surveillance en temps réel
});

// Surveillance en temps réel

function startMonitoring() {
  // ================= MDP  =================//
  // ================= MDP  =================//
  database.ref("mdp").on("value", (snapshot) => {
    const mdpData = snapshot.val();
    if (!mdpData) return;

    // Vérification des tensions triphasées U1, U2, U3
    ["u1", "u2", "u3"].forEach((u, idx) => {
      const phase = `U${idx + 1}`;
      const value = mdpData[u];
      if (
        value < CRITICAL_THRESHOLDS.MDP[phase].min ||
        value > CRITICAL_THRESHOLDS.MDP[phase].max
      ) {
        triggerAlarm(
          "MDP",
          phase,
          value,
          `Tension ${phase} hors limites (${value}V)`,
          value < 300 || value > 420 ? "critical" : "warning"
        );
      }
    });

    // Vérification des courants triphasés I1, I2, I3
    ["i1", "i2", "i3"].forEach((i, idx) => {
      const current = `I${idx + 1}`;
      const value = mdpData[i];
      if (
        value < CRITICAL_THRESHOLDS.MDP[current].min ||
        value > CRITICAL_THRESHOLDS.MDP[current].max
      ) {
        triggerAlarm(
          "MDP",
          current,
          value,
          `Courant ${current} hors limites (${value}A)`,
          value < 0 || value > 120 ? "critical" : "warning"
        );
      }
    });

    // Vérification des facteurs de puissance
    ["cos1", "cos2", "cos3", "cosT"].forEach((cosParam, idx) => {
      const cosKey = `COS${idx < 3 ? idx + 1 : "T"}`;
      const value = mdpData[cosParam];
      if (
        value < CRITICAL_THRESHOLDS.MDP[cosKey].min ||
        value > CRITICAL_THRESHOLDS.MDP[cosKey].max
      ) {
        triggerAlarm(
          "MDP",
          cosKey,
          value,
          `Facteur de puissance ${cosKey} anormal (${value.toFixed(2)})`,
          value < 0.3 || value > 1 ? "critical" : "warning"
        );
      }
    });

    // Vérification des puissances
    if (
      mdpData.p_tot < CRITICAL_THRESHOLDS.MDP.P.min ||
      mdpData.p_tot > CRITICAL_THRESHOLDS.MDP.P.max
    ) {
      triggerAlarm(
        "MDP",
        "P",
        mdpData.p_tot,
        `Puissance active anormale (${mdpData.p_tot}W)`,
        mdpData.p_tot < 4000 || mdpData.p_tot > 22000 ? "critical" : "warning"
      );
    }

    if (
      mdpData.q_tot < CRITICAL_THRESHOLDS.MDP.Q.min ||
      mdpData.q_tot > CRITICAL_THRESHOLDS.MDP.Q.max
    ) {
      triggerAlarm(
        "MDP",
        "Q",
        mdpData.q_tot,
        `Puissance réactive anormale (${mdpData.q_tot}VAR)`,
        mdpData.q_tot < 500 || mdpData.q_tot > 12000 ? "critical" : "warning"
      );
    }

    if (
      mdpData.s_tot < CRITICAL_THRESHOLDS.MDP.S.min ||
      mdpData.s_tot > CRITICAL_THRESHOLDS.MDP.S.max
    ) {
      triggerAlarm(
        "MDP",
        "S",
        mdpData.s_tot,
        `Puissance apparente anormale (${mdpData.s_tot}VA)`,
        mdpData.s_tot < 4000 || mdpData.s_tot > 27000 ? "critical" : "warning"
      );
    }

    // Vérification de la fréquence (si disponible)
    if (
      mdpData.freq &&
      (mdpData.freq < CRITICAL_THRESHOLDS.MDP.FREQ.min ||
        mdpData.freq > CRITICAL_THRESHOLDS.MDP.FREQ.max)
    ) {
      triggerAlarm(
        "MDP",
        "FREQ",
        mdpData.freq,
        `Fréquence hors limites (${mdpData.freq}Hz)`,
        mdpData.freq < 49 || mdpData.freq > 51 ? "critical" : "warning"
      );
    }

    // Calcul du déséquilibre de tension
    const avgVoltage = (mdpData.u1 + mdpData.u2 + mdpData.u3) / 3;
    const imbalance = Math.max(
      Math.abs(mdpData.u1 - avgVoltage),
      Math.abs(mdpData.u2 - avgVoltage),
      Math.abs(mdpData.u3 - avgVoltage)
    );

    if (imbalance > 20) {
      triggerAlarm(
        "MDP",
        "UNBALANCE",
        imbalance,
        `Déséquilibre de tension (${imbalance.toFixed(1)}V)`,
        imbalance > 30 ? "critical" : "warning"
      );
    }

    // Calcul du déséquilibre de courant
    const avgCurrent = (mdpData.i1 + mdpData.i2 + mdpData.i3) / 3;
    const currentImbalance =
      avgCurrent > 0
        ? (Math.max(
            Math.abs(mdpData.i1 - avgCurrent),
            Math.abs(mdpData.i2 - avgCurrent),
            Math.abs(mdpData.i3 - avgCurrent)
          ) /
            avgCurrent) *
          100
        : 0;

    if (currentImbalance > 20) {
      // 20% de déséquilibre
      triggerAlarm(
        "MDP",
        "CURRENT_UNBALANCE",
        currentImbalance,
        `Déséquilibre de courant (${currentImbalance.toFixed(1)}%)`,
        currentImbalance > 30 ? "critical" : "warning"
      );
    }
  });
  // ================= PDU  =================//
  // ================= PDU  =================//
  database.ref("pdu").on("value", (snapshot) => {
    const pduData = snapshot.val();
    if (!pduData) return;

    // Vérification des tensions d'entrée triphasées V1, V2, V3
    ["v1", "v2", "v3"].forEach((v, idx) => {
      const phase = `V${idx + 1}`;
      const value = pduData[v];
      if (
        value < CRITICAL_THRESHOLDS.PDU[phase].min ||
        value > CRITICAL_THRESHOLDS.PDU[phase].max
      ) {
        triggerAlarm(
          "PDU",
          phase,
          value,
          `Tension entrée ${phase} hors limites (${value}V)`,
          value < 180 || value > 260 ? "critical" : "warning"
        );
      }
    });

    // Vérification des tensions de sortie triphasées U1, U2, U3
    ["u1", "u2", "u3"].forEach((u, idx) => {
      const phase = `U${idx + 1}`;
      const value = pduData[u];
      if (
        value < CRITICAL_THRESHOLDS.PDU[phase].min ||
        value > CRITICAL_THRESHOLDS.PDU[phase].max
      ) {
        triggerAlarm(
          "PDU",
          phase,
          value,
          `Tension sortie ${phase} hors limites (${value}V)`,
          value < 330 || value > 420 ? "critical" : "warning"
        );
      }
    });

    // Vérification des courants triphasés I1, I2, I3
    ["i1", "i2", "i3"].forEach((i, idx) => {
      const current = `I${idx + 1}`;
      const value = pduData[i];
      if (
        value < CRITICAL_THRESHOLDS.PDU[current].min ||
        value > CRITICAL_THRESHOLDS.PDU[current].max
      ) {
        triggerAlarm(
          "PDU",
          current,
          value,
          `Courant ${current} hors limites (${value}A)`,
          value < 30 || value > 90 ? "critical" : "warning"
        );
      }
    });

    // Vérification des facteurs de puissance
    ["cos1", "cos2", "cos3", "cosT"].forEach((cosParam, idx) => {
      const cosKey = `COS${idx < 3 ? idx + 1 : "T"}`;
      const value = pduData[cosParam];
      if (
        value < CRITICAL_THRESHOLDS.PDU[cosKey].min ||
        value > CRITICAL_THRESHOLDS.PDU[cosKey].max
      ) {
        triggerAlarm(
          "PDU",
          cosKey,
          value,
          `Facteur de puissance ${cosKey} anormal (${value.toFixed(2)})`,
          value < 0.3 || value > 1 ? "critical" : "warning"
        );
      }
    });

    // Vérification des puissances
    if (
      pduData.p_tot < CRITICAL_THRESHOLDS.PDU.P.min ||
      pduData.p_tot > CRITICAL_THRESHOLDS.PDU.P.max
    ) {
      triggerAlarm(
        "PDU",
        "P",
        pduData.p_tot,
        `Puissance active anormale (${pduData.p_tot}W)`,
        pduData.p_tot < 4000 || pduData.p_tot > 22000 ? "critical" : "warning"
      );
    }

    if (
      pduData.q_tot < CRITICAL_THRESHOLDS.PDU.Q.min ||
      pduData.q_tot > CRITICAL_THRESHOLDS.PDU.Q.max
    ) {
      triggerAlarm(
        "PDU",
        "Q",
        pduData.q_tot,
        `Puissance réactive anormale (${pduData.q_tot}VAR)`,
        pduData.q_tot < 500 || pduData.q_tot > 12000 ? "critical" : "warning"
      );
    }

    if (
      pduData.s_tot < CRITICAL_THRESHOLDS.PDU.S.min ||
      pduData.s_tot > CRITICAL_THRESHOLDS.PDU.S.max
    ) {
      triggerAlarm(
        "PDU",
        "S",
        pduData.s_tot,
        `Puissance apparente anormale (${pduData.s_tot}VA)`,
        pduData.s_tot < 4000 || pduData.s_tot > 27000 ? "critical" : "warning"
      );
    }

    // Calcul du déséquilibre de tension (entrée)
    const avgVoltageIn = (pduData.v1 + pduData.v2 + pduData.v3) / 3;
    const voltageImbalanceIn = Math.max(
      Math.abs(pduData.v1 - avgVoltageIn),
      Math.abs(pduData.v2 - avgVoltageIn),
      Math.abs(pduData.v3 - avgVoltageIn)
    );

    if (voltageImbalanceIn > 20) {
      triggerAlarm(
        "PDU",
        "UNBALANCE_IN",
        voltageImbalanceIn,
        `Déséquilibre tension entrée (${voltageImbalanceIn.toFixed(1)}V)`,
        voltageImbalanceIn > 30 ? "critical" : "warning"
      );
    }

    // Calcul du déséquilibre de tension (sortie)
    const avgVoltageOut = (pduData.u1 + pduData.u2 + pduData.u3) / 3;
    const voltageImbalanceOut = Math.max(
      Math.abs(pduData.u1 - avgVoltageOut),
      Math.abs(pduData.u2 - avgVoltageOut),
      Math.abs(pduData.u3 - avgVoltageOut)
    );

    if (voltageImbalanceOut > 15) {
      // Tolérance plus stricte en sortie
      triggerAlarm(
        "PDU",
        "UNBALANCE_OUT",
        voltageImbalanceOut,
        `Déséquilibre tension sortie (${voltageImbalanceOut.toFixed(1)}V)`,
        voltageImbalanceOut > 25 ? "critical" : "warning"
      );
    }

    // Calcul du déséquilibre de courant
    const avgCurrent = (pduData.i1 + pduData.i2 + pduData.i3) / 3;
    const currentImbalance =
      avgCurrent > 0
        ? (Math.max(
            Math.abs(pduData.i1 - avgCurrent),
            Math.abs(pduData.i2 - avgCurrent),
            Math.abs(pduData.i3 - avgCurrent)
          ) /
            avgCurrent) *
          100
        : 0;

    if (currentImbalance > 15) {
      // 15% de déséquilibre
      triggerAlarm(
        "PDU",
        "CURRENT_UNBALANCE",
        currentImbalance,
        `Déséquilibre de courant (${currentImbalance.toFixed(1)}%)`,
        currentImbalance > 25 ? "critical" : "warning"
      );
    }

    // Vérification du rendement (si les données sont disponibles)
  });
  // ================= CHILLER  =================//
  // ================= CHILLER  =================//
  database.ref("chiller").on("value", (snapshot) => {
    const chillerData = snapshot.val();
    if (!chillerData) return;

    // Vérification des tensions triphasées
    ["v1", "v2", "v3"].forEach((v, idx) => {
      const phase = `V${idx + 1}`;
      const value = chillerData[v];
      if (
        value < CRITICAL_THRESHOLDS.CHILLER[phase].min ||
        value > CRITICAL_THRESHOLDS.CHILLER[phase].max
      ) {
        triggerAlarm(
          "CHILLER",
          phase,
          value,
          `Tension ${phase} hors limites (${value}V)`,
          value < 200 || value > 240 ? "critical" : "warning"
        );
      }
    });

    // Vérification des courants triphasés
    ["i1", "i2", "i3"].forEach((i, idx) => {
      const current = `I${idx + 1}`;
      const value = chillerData[i];
      if (
        value < CRITICAL_THRESHOLDS.CHILLER[current].min ||
        value > CRITICAL_THRESHOLDS.CHILLER[current].max
      ) {
        triggerAlarm(
          "CHILLER",
          current,
          value,
          `Courant ${current} hors limites (${value}A)`,
          value < 40 || value > 110 ? "critical" : "warning"
        );
      }
    });

    // Vérification température eau
    if (
      chillerData.temp < CRITICAL_THRESHOLDS.CHILLER.TEMP.min ||
      chillerData.temp > CRITICAL_THRESHOLDS.CHILLER.TEMP.max
    ) {
      triggerAlarm(
        "CHILLER",
        "TEMP",
        chillerData.temp,
        `Température eau anormale (${chillerData.temp}°C)`,
        chillerData.temp < 15 || chillerData.temp > 30 ? "critical" : "warning"
      );
    }

    // Vérification pression fluide
    if (
      chillerData.pression < CRITICAL_THRESHOLDS.CHILLER.PRESS.min ||
      chillerData.pression > CRITICAL_THRESHOLDS.CHILLER.PRESS.max
    ) {
      triggerAlarm(
        "CHILLER",
        "PRESS",
        chillerData.pression,
        `Pression fluide anormale (${chillerData.pression}bar)`,
        chillerData.pression < 1.2 || chillerData.pression > 2.8
          ? "critical"
          : "warning"
      );
    }

    // Vérification humidité
    if (
      chillerData.humidity &&
      (chillerData.humidity < CRITICAL_THRESHOLDS.CHILLER.HUMI.min ||
        chillerData.humidity > CRITICAL_THRESHOLDS.CHILLER.HUMI.max)
    ) {
      triggerAlarm(
        "CHILLER",
        "HUMI",
        chillerData.humidity,
        `Humidité anormale (${chillerData.humidity}%)`,
        chillerData.humidity < 40 || chillerData.humidity > 90
          ? "critical"
          : "warning"
      );
    }

    // Calcul déséquilibre de tension
    const avgVoltage = (chillerData.v1 + chillerData.v2 + chillerData.v3) / 3;
    const voltageImbalance = Math.max(
      Math.abs(chillerData.v1 - avgVoltage),
      Math.abs(chillerData.v2 - avgVoltage),
      Math.abs(chillerData.v3 - avgVoltage)
    );

    if (voltageImbalance > 15) {
      triggerAlarm(
        "CHILLER",
        "VOLT_UNBALANCE",
        voltageImbalance,
        `Déséquilibre tension (${voltageImbalance.toFixed(1)}V)`,
        voltageImbalance > 25 ? "critical" : "warning"
      );
    }

    // Calcul déséquilibre de courant
    const avgCurrent = (chillerData.i1 + chillerData.i2 + chillerData.i3) / 3;
    const currentImbalance =
      avgCurrent > 0
        ? (Math.max(
            Math.abs(chillerData.i1 - avgCurrent),
            Math.abs(chillerData.i2 - avgCurrent),
            Math.abs(chillerData.i3 - avgCurrent)
          ) /
            avgCurrent) *
          100
        : 0;

    if (currentImbalance > 20) {
      triggerAlarm(
        "CHILLER",
        "CURRENT_UNBALANCE",
        currentImbalance,
        `Déséquilibre courant (${currentImbalance.toFixed(1)}%)`,
        currentImbalance > 30 ? "critical" : "warning"
      );
    }

    // Vérification niveau d'eau
    if (chillerData.lv_water === "non") {
      triggerAlarm(
        "CHILLER",
        "WATER_LEVEL",
        0,
        "Niveau d'eau trop bas!",
        "critical"
      );
    }
  });

  // ================= compressor  =================//
  // ================= compressor  =================//
  database.ref("f50h").on("value", (snapshot) => {
    const compData = snapshot.val();
    if (!compData) return;

    // Vérification des tensions triphasées
    ["v1", "v2", "v3"].forEach((v, idx) => {
      const phase = `V${idx + 1}`;
      const value = compData[v];
      if (
        value < CRITICAL_THRESHOLDS.F50H[phase].min ||
        value > CRITICAL_THRESHOLDS.F50H[phase].max
      ) {
        triggerAlarm(
          "F50H",
          phase,
          value,
          `Tension ${phase} hors limites (${value}V)`,
          value < 200 || value > 240 ? "critical" : "warning"
        );
      }
    });

    // Vérification des courants triphasés
    ["i1", "i2", "i3"].forEach((i, idx) => {
      const current = `I${idx + 1}`;
      const value = compData[i];
      if (
        value < CRITICAL_THRESHOLDS.F50H[current].min ||
        value > CRITICAL_THRESHOLDS.F50H[current].max
      ) {
        triggerAlarm(
          "F50H",
          current,
          value,
          `Courant ${current} hors limites (${value}A)`,
          value < 40 || value > 110 ? "critical" : "warning"
        );
      }
    });

    // Vérification température eau
    if (
      compData.temp < CRITICAL_THRESHOLDS.F50H.TEMP.min ||
      compData.temp > CRITICAL_THRESHOLDS.F50H.TEMP.max
    ) {
      triggerAlarm(
        "F50H",
        "TEMP",
        compData.temp,
        `Température eau anormale (${compData.temp}°C)`,
        compData.temp < 15 || compData.temp > 30 ? "critical" : "warning"
      );
    }

    // Vérification pression fluide
    if (
      compData.pression < CRITICAL_THRESHOLDS.F50H.PRESS.min ||
      compData.pression > CRITICAL_THRESHOLDS.F50H.PRESS.max
    ) {
      triggerAlarm(
        "F50H",
        "PRESS",
        compData.pression,
        `Pression fluide anormale (${compData.pression}bar)`,
        compData.pression < 1.2 || compData.pression > 2.8
          ? "critical"
          : "warning"
      );
    }

    // Vérification humidité
    if (
      compData.humidity &&
      (compData.humidity < CRITICAL_THRESHOLDS.F50H.HUMI.min ||
        compData.humidity > CRITICAL_THRESHOLDS.F50H.HUMI.max)
    ) {
      triggerAlarm(
        "F50H",
        "HUMI",
        compData.humidity,
        `Humidité anormale (${compData.humidity}%)`,
        compData.humidity < 40 || compData.humidity > 90
          ? "critical"
          : "warning"
      );
    }

    // Calcul déséquilibre de tension
    const avgVoltage = (compData.v1 + compData.v2 + compData.v3) / 3;
    const voltageImbalance = Math.max(
      Math.abs(compData.v1 - avgVoltage),
      Math.abs(compData.v2 - avgVoltage),
      Math.abs(compData.v3 - avgVoltage)
    );

    if (voltageImbalance > 15) {
      triggerAlarm(
        "F50H",
        "VOLT_UNBALANCE",
        voltageImbalance,
        `Déséquilibre tension (${voltageImbalance.toFixed(1)}V)`,
        voltageImbalance > 25 ? "critical" : "warning"
      );
    }

    // Calcul déséquilibre de courant
    const avgCurrent = (compData.i1 + compData.i2 + compData.i3) / 3;
    const currentImbalance =
      avgCurrent > 0
        ? (Math.max(
            Math.abs(compData.i1 - avgCurrent),
            Math.abs(compData.i2 - avgCurrent),
            Math.abs(compData.i3 - avgCurrent)
          ) /
            avgCurrent) *
          100
        : 0;

    if (currentImbalance > 20) {
      triggerAlarm(
        "F50H",
        "CURRENT_UNBALANCE",
        currentImbalance,
        `Déséquilibre courant (${currentImbalance.toFixed(1)}%)`,
        currentImbalance > 30 ? "critical" : "warning"
      );
    }

    // Vérification niveau d'eau
    if (compData.lv_water === "non") {
      triggerAlarm(
        "F50H",
        "WATER_LEVEL",
        0,
        "Niveau d'eau trop bas!",
        "critical"
      );
    }
  });
  // ================= COOLING UNIT  =================//
  // ================= COOLING UNIT  =================//
  database.ref("cooling").on("value", (snapshot) => {
    const coolingData = snapshot.val();
    if (!coolingData) return;

    // Vérification des tensions triphasées
    ["v1", "v2", "v3"].forEach((v, idx) => {
      const phase = `V${idx + 1}`;
      const value = coolingData[v];
      if (
        value < CRITICAL_THRESHOLDS.COOLING[phase].min ||
        value > CRITICAL_THRESHOLDS.COOLING[phase].max
      ) {
        triggerAlarm(
          "COOLING",
          phase,
          value,
          `Tension ${phase} hors limites (${value}V)`,
          value < 200 || value > 240 ? "critical" : "warning"
        );
      }
    });

    // Vérification des courants triphasés
    ["i1", "i2", "i3"].forEach((i, idx) => {
      const current = `I${idx + 1}`;
      const value = coolingData[i];
      if (
        value < CRITICAL_THRESHOLDS.COOLING[current].min ||
        value > CRITICAL_THRESHOLDS.COOLING[current].max
      ) {
        triggerAlarm(
          "COOLING",
          current,
          value,
          `Courant ${current} hors limites (${value}A)`,
          value < 40 || value > 110 ? "critical" : "warning"
        );
      }
    });

    // Vérification température eau
    if (
      coolingData.temp < CRITICAL_THRESHOLDS.COOLING.TEMP.min ||
      coolingData.temp > CRITICAL_THRESHOLDS.COOLING.TEMP.max
    ) {
      triggerAlarm(
        "COOLING",
        "TEMP",
        coolingData.temp,
        `Température eau anormale (${coolingData.temp}°C)`,
        coolingData.temp < 15 || coolingData.temp > 30 ? "critical" : "warning"
      );
    }

    // Vérification pression fluide
    if (
      coolingData.pression < CRITICAL_THRESHOLDS.COOLING.PRESS.min ||
      coolingData.pression > CRITICAL_THRESHOLDS.COOLING.PRESS.max
    ) {
      triggerAlarm(
        "COOLING",
        "PRESS",
        coolingData.pression,
        `Pression fluide anormale (${coolingData.pression}bar)`,
        coolingData.pression < 1.2 || coolingData.pression > 2.8
          ? "critical"
          : "warning"
      );
    }

    // Vérification humidité
    if (
      coolingData.humidity &&
      (coolingData.humidity < CRITICAL_THRESHOLDS.COOLING.HUMI.min ||
        coolingData.humidity > CRITICAL_THRESHOLDS.COOLING.HUMI.max)
    ) {
      triggerAlarm(
        "COOLING",
        "HUMI",
        coolingData.humidity,
        `Humidité anormale (${coolingData.humidity}%)`,
        coolingData.humidity < 40 || coolingData.humidity > 90
          ? "critical"
          : "warning"
      );
    }

    // Calcul déséquilibre de tension
    const avgVoltage = (coolingData.v1 + coolingData.v2 + coolingData.v3) / 3;
    const voltageImbalance = Math.max(
      Math.abs(coolingData.v1 - avgVoltage),
      Math.abs(coolingData.v2 - avgVoltage),
      Math.abs(coolingData.v3 - avgVoltage)
    );

    if (voltageImbalance > 15) {
      triggerAlarm(
        "COOLING",
        "VOLT_UNBALANCE",
        voltageImbalance,
        `Déséquilibre tension (${voltageImbalance.toFixed(1)}V)`,
        voltageImbalance > 25 ? "critical" : "warning"
      );
    }

    // Calcul déséquilibre de courant
    const avgCurrent = (coolingData.i1 + coolingData.i2 + coolingData.i3) / 3;
    const currentImbalance =
      avgCurrent > 0
        ? (Math.max(
            Math.abs(coolingData.i1 - avgCurrent),
            Math.abs(coolingData.i2 - avgCurrent),
            Math.abs(coolingData.i3 - avgCurrent)
          ) /
            avgCurrent) *
          100
        : 0;

    if (currentImbalance > 20) {
      triggerAlarm(
        "COOLINGH",
        "CURRENT_UNBALANCE",
        currentImbalance,
        `Déséquilibre courant (${currentImbalance.toFixed(1)}%)`,
        currentImbalance > 30 ? "critical" : "warning"
      );
    }

    // Vérification niveau d'eau
    if (coolingData.lv_water === "non") {
      triggerAlarm(
        "COOLING",
        "WATER_LEVEL",
        0,
        "Niveau d'eau trop bas!",
        "critical"
      );
    }
  });
}

//===================== FIN ALARMS ===================//
//===================== FIN ALRAMS ===================//

//  ============================== ===========================//
//=======================Configuration EmailJS================//
//  ============================== ===========================//
const EMAILJS_CONFIG = {
  SERVICE_ID: "service_w6j6iri", // À remplacer par votre Service ID
  TEMPLATE_ID: "template_ceg3qkj", // À remplacer par votre Template ID
  USER_ID: "WXP64zN4sMU2l6ZXO", // Votre Public Key
};

// Formatage de la date/heure
function formatDateTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
// Initialisation EmailJS
(function initEmailJS() {
  emailjs.init(EMAILJS_CONFIG.USER_ID);
  console.log("EmailJS initialisé");
})();
// Fonction d'envoi d'email pour les alarmes
async function sendAlarmEmail(alarm) {
  const emailParams = {
    to_email: "khalidsahnouny1234@gmail.com, morocofrance@gmail.com",
    equipment: alarm.equipment,
    parameter: alarm.param,
    value: alarm.value,
    message: alarm.message,
    severity: alarm.severity.toUpperCase(),
    timestamp:
      typeof alarm.timestamp === "string"
        ? alarm.timestamp
        : formatDateTime(alarm.timestamp),
    threshold: getThresholdText(alarm.equipment, alarm.param),
  };

  try {
    await emailjs.send(
      EMAILJS_CONFIG.SERVICE_ID,
      EMAILJS_CONFIG.TEMPLATE_ID,
      emailParams
    );
    console.log(`Email envoyé pour alarme ${alarm.id}`);
  } catch (error) {
    console.error("Erreur envoi email:", error);
    storePendingEmail(alarm);
  }
}

// Helper pour obtenir les seuils
function getThresholdText(equipment, param) {
  const thresholds = CRITICAL_THRESHOLDS[equipment]?.[param];
  return thresholds ? `${thresholds.min} - ${thresholds.max}` : "N/A";
}

// Stockage des emails en échec
function storePendingEmail(alarm) {
  const pendingEmails = JSON.parse(
    localStorage.getItem("pendingEmails") || "[]"
  );
  pendingEmails.push(alarm);
  localStorage.setItem("pendingEmails", JSON.stringify(pendingEmails));
}

// Réessayer les emails en échec (à appeler périodiquement)
function retryPendingEmails() {
  const pendingEmails = JSON.parse(
    localStorage.getItem("pendingEmails") || "[]"
  );
  if (pendingEmails.length > 0) {
    pendingEmails.forEach((alarm) => sendAlarmEmail(alarm));
    localStorage.removeItem("pendingEmails");
  }
}
// Exemple d'appel périodique pour réessayer les emails
//setInterval(retryPendingEmails, 3600000); // Toutes les heures
//  ============================== FIN  ===========================//
// ================Fonction modifiée triggerAlarm avec envoi d'email===//

function triggerAlarm(equipment, param, value, message, severity) {
  const now = new Date();
  const alarmId = `${equipment}-${param}-${now.getTime()}`;

  // Vérifie si l'alarme existe déjà
  const existingIndex = activeAlarms.findIndex(
    (a) => a.equipment === equipment && a.param === param
  );

  const newAlarm = {
    id: alarmId,
    equipment,
    param,
    value,
    message,
    severity,
    timestamp: now,
    acknowledged: false,
  };

  if (existingIndex === -1) {
    // Nouvelle alarme
    activeAlarms.push(newAlarm);
    alarmHistory.unshift(newAlarm); // Ajoute au début de l'historique
  } else {
    // Mise à jour de l'alarme existante
    activeAlarms[existingIndex] = newAlarm;
  }

  // Garde uniquement les 500 dernières alarmes historiques
  if (alarmHistory.length > 500) {
    alarmHistory = alarmHistory.slice(0, 500);
  }

  updateAlarmDisplay();

  // if (severity === "critical") {
  //   sendAlertSMS(newAlarm);
  // }
  //=================================================================

  // Envoi d'email pour les alarmes critiques
  if (severity === "critical") {
    sendAlarmEmail(newAlarm);
  }
}

// Fonction d'envoi SMS modifiée
async function sendAlertSMS(alarm) {
  try {
    const response = await fetch("http://localhost:3000/send-sms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ alarm }),
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error("Erreur d'envoi SMS:", err);
    throw err;
  }
}

// async function triggerCall() {
//   try {
//     const response = await fetch("http://localhost:3000/trigger-call", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//     });
//     const data = await response.json();
//     console.log("Appel Twilio déclenché !", data);
//   } catch (err) {
//     console.error("Erreur lors de l'appel :", err);
//   }
// }

function updateAlarmDisplay() {
  const activeContainer = document.getElementById("active-alarms-list");
  const historyContainer = document.getElementById("alarm-history-list");

  // Affiche les alarmes actives
  activeContainer.innerHTML = activeAlarms.length
    ? ""
    : '<div class="no-alarms">Aucune alarme active</div>';

  activeAlarms.forEach((alarm) => {
    const alarmElement = createAlarmElement(alarm, true);
    activeContainer.appendChild(alarmElement);
  });

  // Affiche tout l'historique
  historyContainer.innerHTML = "";
  alarmHistory.forEach((alarm) => {
    const alarmElement = createAlarmElement(alarm, false);
    historyContainer.appendChild(alarmElement);
  });
}

function createAlarmElement(alarm, isActive) {
  const template = document.getElementById("alarm-template");
  const clone = template.content.cloneNode(true);
  const alarmCard = clone.querySelector(".alarm-card");

  alarmCard.classList.add(alarm.severity);
  alarmCard.querySelector(".alarm-title").textContent = `${alarm.equipment} - ${
    alarm.param
  } (${alarm.severity.toUpperCase()})`;
  alarmCard.querySelector(".alarm-desc").textContent = alarm.message;
  alarmCard.querySelector(".alarm-time").textContent =
    alarm.timestamp.toLocaleString("fr-FR");

  if (isActive) {
    alarmCard
      .querySelector(".btn-ack")
      .addEventListener("click", () => acknowledgeAlarm(alarm.id));
    alarmCard
      .querySelector(".btn-clear")
      .addEventListener("click", () => clearAlarm(alarm.id));
  } else {
    alarmCard.querySelector(".alarm-actions").remove();
  }

  return clone;
}

function acknowledgeAlarm(alarmId) {
  const alarm = activeAlarms.find((a) => a.id === alarmId);
  if (alarm) alarm.acknowledged = true;
  updateAlarmDisplay();
}

async function loadInitialAlarms() {
  try {
    const response = await fetch("/api/alarms");
    if (response.ok) {
      const data = await response.json();
      activeAlarms = data.activeAlarms || [];
      alarmHistory = data.alarmHistory || [];
      updateAlarmDisplay();
    }
  } catch (err) {
    console.error("Erreur de chargement initial:", err);
  }
}

function clearAlarm(alarmId) {
  activeAlarms = activeAlarms.filter((a) => a.id !== alarmId);
  updateAlarmDisplay();
}

async function loadAlarmHistory() {
  try {
    const response = await fetch("http://localhost:3000/api/alarms");
    if (response.ok) {
      const data = await response.json();
      activeAlarms = data.activeAlarms || [];
      alarmHistory = data.alarmHistory || [];
      console.log(`Chargé ${alarmHistory.length} alarmes historiques`);
    }
  } catch (err) {
    console.error("Erreur de chargement de l'historique:", err);
  }
}

function saveAlarmHistory() {
  localStorage.setItem("alarmHistory", JSON.stringify(alarmHistory));
}

// À la fin de alarms.js
if (typeof updateAlarmDisplay === "function") {
  updateAlarmDisplay(); // Initialisation
}
