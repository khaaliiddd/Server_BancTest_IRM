const express = require("express");
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");
const twilio = require("twilio");
const cors = require("cors");
require("dotenv").config(); // Nouveau: pour gérer les variables d'environnement

const app = express();
const PORT = process.env.PORT || 3000;
const ALARMS_FILE = "alarms.json";

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(__dirname));

// Configuration sécurisée de Twilio avec variables d'environnement
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

let alarmStore = {
  activeAlarms: [],
  alarmHistory: [],
};

// Amélioration de la gestion des alarmes
function initAlarms() {
  try {
    if (fs.existsSync(ALARMS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ALARMS_FILE, "utf8"));
      alarmStore = {
        activeAlarms: data.activeAlarms || [],
        alarmHistory: data.alarmHistory || [],
      };
    }
    // Sauvegarde initiale pour créer le fichier si inexistant
    saveAlarms();
  } catch (err) {
    console.error("Erreur de chargement des alarmes:", err);
    // Crée un fichier vide en cas d'erreur
    saveAlarms();
  }
}

function saveAlarms() {
  try {
    const tempFile = ALARMS_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(alarmStore, null, 2));
    fs.renameSync(tempFile, ALARMS_FILE); // Écriture atomique
  } catch (err) {
    console.error("Erreur de sauvegarde:", err);
  }
}

initAlarms();

// Gestion améliorée des SMS
app.post("/send-sms", async (req, res) => {
  try {
    const { alarm } = req.body;
    if (!alarm) {
      return res.status(400).json({ error: "Alarme manquante" });
    }

    // Validation des données d'alarme
    if (!alarm.severity || !alarm.equipment || !alarm.param) {
      return res.status(400).json({ error: "Données d'alarme incomplètes" });
    }

    const smsBody = `🚨 ALARME ${alarm.severity.toUpperCase()} 🚨
Équipement: ${alarm.equipment}
Paramètre: ${alarm.param}
Valeur: ${alarm.value || "N/A"}
Message: ${alarm.message || "Aucun message"}
Date: ${new Date(alarm.timestamp || Date.now()).toLocaleString("fr-FR")}`;

    const result = await client.messages.create({
      body: smsBody,
      from: process.env.TWILIO_PHONE_NUMBER, // Numéro depuis les variables d'environnement
      to: process.env.DESTINATION_PHONE_NUMBER, // Numéro de destination sécurisé
    });

    // Ajout à l'historique
    alarmStore.alarmHistory.unshift({
      ...alarm,
      timestamp: alarm.timestamp || Date.now(),
      smsSent: true,
      smsId: result.sid,
    });

    saveAlarms();

    res.json({ success: true, sid: result.sid });
  } catch (err) {
    console.error("Erreur d'envoi SMS:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoints API sécurisés
app.get("/api/alarms", (req, res) => {
  res.json(alarmStore);
});

app.post("/api/update-alarms", (req, res) => {
  try {
    // Ne met à jour que les champs nécessaires
    if (req.body.activeAlarms) {
      alarmStore.activeAlarms = req.body.activeAlarms;
    }
    if (req.body.alarmHistory) {
      alarmStore.alarmHistory = req.body.alarmHistory;
    }
    saveAlarms();
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur de mise à jour:", err);
    res.status(500).json({ error: err.message });
  }
});

// Gestion améliorée de Puppeteer
async function initPuppeteer() {
  try {
    const browser = await puppeteer.launch({
      executablePath:
        process.env.CHROME_PATH ||
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(`http://localhost:${PORT}/alarms.html`); // Utilise le serveur local plutôt que le fichier

    await page.exposeFunction("saveAlarmsToServer", (alarms) => {
      alarmStore = { ...alarmStore, ...alarms };
      saveAlarms();
    });

    await page.addScriptTag({
      content: `
        (function() {
          window.activeAlarms = [];
          window.alarmHistory = [];
          
          const originalUpdate = window.updateAlarmDisplay || function(){};
          
          window.updateAlarmDisplay = function() {
            originalUpdate.apply(this, arguments);
            if (window.saveAlarmsToServer) {
              window.saveAlarmsToServer({
                activeAlarms: window.activeAlarms,
                alarmHistory: window.alarmHistory
              });
            }
          };
          
          async function loadAlarms() {
            try {
              const response = await fetch("/api/alarms");
              if (!response.ok) throw new Error("Erreur réseau");
              const data = await response.json();
              window.activeAlarms = data.activeAlarms || [];
              window.alarmHistory = data.alarmHistory || [];
              window.updateAlarmDisplay();
            } catch (err) {
              console.error("Erreur de chargement:", err);
            }
          }
          
          document.addEventListener('DOMContentLoaded', loadAlarms);
        })();
      `,
    });
  } catch (err) {
    console.error("Erreur Puppeteer:", err);
  }
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== "test") {
    initPuppeteer();
  }
});

module.exports = app;

// Démarrage local (ne s'exécutera pas sur Vercel)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
    if (process.env.NODE_ENV !== "test") {
      initPuppeteer(); // À supprimer si vous gardez Puppeteer
    }
  });
}
