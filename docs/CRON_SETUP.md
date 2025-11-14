# Configuration Cron pour FitMyCv.ai

Ce document explique comment configurer les tâches planifiées (cron) pour le système d'abonnements.

## Tâches Cron Requises

### 1. Reset des compteurs de features expirés

**Script** : `scripts/reset-feature-counters.js`
**Fréquence** : Quotidienne (1x par jour)
**Objectif** : Supprimer les compteurs mensuels expirés pour libérer l'espace DB

---

## Configuration Cron (Linux/Ubuntu)

### Étape 1 : Ouvrir l'éditeur crontab

```bash
crontab -e
```

### Étape 2 : Ajouter la tâche quotidienne

Ajoutez cette ligne pour exécuter le script tous les jours à 3h du matin :

```bash
0 3 * * * cd /home/erickdesmet/Documents/fitmycv && /usr/bin/node scripts/reset-feature-counters.js >> /var/log/fitmycv-cron.log 2>&1
```

**Explication** :
- `0 3 * * *` : Tous les jours à 3h00
- `cd /home/erickdesmet/Documents/fitmycv` : Se placer dans le dossier du projet
- `/usr/bin/node scripts/reset-feature-counters.js` : Exécuter le script
- `>> /var/log/fitmycv-cron.log 2>&1` : Logger la sortie dans un fichier

### Étape 3 : Vérifier la configuration

```bash
# Lister les crons actifs
crontab -l

# Tester manuellement le script
cd /home/erickdesmet/Documents/fitmycv
node scripts/reset-feature-counters.js
```

### Étape 4 : Créer le fichier de log (optionnel)

```bash
sudo touch /var/log/fitmycv-cron.log
sudo chown $USER:$USER /var/log/fitmycv-cron.log
```

---

## Configuration Systemd Timer (Alternative moderne)

### Étape 1 : Créer le service

Créer `/etc/systemd/system/fitmycv-reset-counters.service` :

```ini
[Unit]
Description=FitMyCv - Reset feature counters
After=network.target

[Service]
Type=oneshot
User=erickdesmet
WorkingDirectory=/home/erickdesmet/Documents/fitmycv
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /home/erickdesmet/Documents/fitmycv/scripts/reset-feature-counters.js
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### Étape 2 : Créer le timer

Créer `/etc/systemd/system/fitmycv-reset-counters.timer` :

```ini
[Unit]
Description=FitMyCv - Reset counters daily
Requires=fitmycv-reset-counters.service

[Timer]
OnCalendar=daily
OnCalendar=03:00
Persistent=true

[Install]
WantedBy=timers.target
```

### Étape 3 : Activer et démarrer

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Activer le timer
sudo systemctl enable fitmycv-reset-counters.timer

# Démarrer le timer
sudo systemctl start fitmycv-reset-counters.timer

# Vérifier le statut
sudo systemctl status fitmycv-reset-counters.timer

# Voir les prochaines exécutions
sudo systemctl list-timers | grep fitmycv

# Tester manuellement le service
sudo systemctl start fitmycv-reset-counters.service

# Voir les logs
sudo journalctl -u fitmycv-reset-counters.service -f
```

---

## Configuration Production (PM2)

Si vous utilisez PM2 pour gérer votre application Next.js :

### Installer pm2-cron

```bash
npm install -g pm2-cron
```

### Créer le script PM2

Créer `ecosystem.config.js` à la racine :

```javascript
module.exports = {
  apps: [
    {
      name: 'fitmycv-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'fitmycv-reset-counters',
      script: 'scripts/reset-feature-counters.js',
      cron_restart: '0 3 * * *', // Tous les jours à 3h
      autorestart: false,
      watch: false,
    },
  ],
};
```

### Démarrer avec PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Monitoring et Logs

### Vérifier les logs cron

```bash
# Logs crontab
tail -f /var/log/fitmycv-cron.log

# Logs systemd
sudo journalctl -u fitmycv-reset-counters.service -f

# Logs PM2
pm2 logs fitmycv-reset-counters
```

### Alertes en cas d'échec (optionnel)

Modifier le script `reset-feature-counters.js` pour envoyer un email via Resend en cas d'erreur :

```javascript
const { Resend } = require('resend');

// En cas d'erreur
catch (error) {
  console.error('❌ Erreur:', error);

  // Envoyer email d'alerte
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'alerts@fitmycv.ai',
    to: 'admin@fitmycv.ai',
    subject: '🚨 Erreur cron reset compteurs',
    text: `Erreur: ${error.message}`,
  });

  process.exit(1);
}
```

---

## Fréquences Alternatives

Selon vos besoins, vous pouvez ajuster la fréquence :

```bash
# Toutes les heures
0 * * * * ...

# Tous les jours à minuit
0 0 * * * ...

# Tous les lundis à 3h
0 3 * * 1 ...

# Toutes les 6 heures
0 */6 * * * ...
```

---

## Troubleshooting

### Le cron ne s'exécute pas

1. Vérifier que cron est actif :
   ```bash
   sudo systemctl status cron
   ```

2. Vérifier les permissions :
   ```bash
   chmod +x scripts/reset-feature-counters.js
   ```

3. Vérifier les variables d'environnement :
   ```bash
   # Ajouter en début de cron
   SHELL=/bin/bash
   PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
   ```

### Erreurs de connexion DB

Vérifier que le fichier `.env.local` est accessible depuis le cron :

```bash
# Option 1: Charger explicitement
cd /path/to/project && export $(cat .env.local | xargs) && node scripts/reset-feature-counters.js

# Option 2: Utiliser un chemin absolu dans le script
require('dotenv').config({ path: '/path/to/project/.env.local' });
```

---

## Ressources

- [Crontab Guru](https://crontab.guru/) - Générateur de syntaxe cron
- [Systemd Timer Documentation](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/application-declaration/)
