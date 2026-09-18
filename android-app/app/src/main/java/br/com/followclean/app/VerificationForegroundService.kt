package br.com.followclean.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class VerificationForegroundService : Service() {
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val message = intent.getStringExtra(EXTRA_MESSAGE)
                    ?: "Verificação do Instagram em andamento"
                startForeground(NOTIFICATION_ID, buildNotification(message))
                acquireWakeLock()
            }
            else -> {
                val message = intent?.getStringExtra(EXTRA_MESSAGE)
                    ?: "Verificação do Instagram em andamento"
                startForeground(NOTIFICATION_ID, buildNotification(message))
                acquireWakeLock()
            }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        runCatching {
            if (wakeLock?.isHeld == true) wakeLock?.release()
        }
        wakeLock = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return

        val powerManager = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "FollowClean:Verification"
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Verificação contínua",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Mantém a verificação do FollowClean ativa em segundo plano."
            setShowBadge(false)
        }

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(message: String): Notification {
        val launchIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(this, CHANNEL_ID)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(this)
            }

        return builder
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("FollowClean verificando perfis")
            .setContentText(message)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    companion object {
        const val ACTION_START = "br.com.followclean.app.START_VERIFICATION"
        const val ACTION_UPDATE = "br.com.followclean.app.UPDATE_VERIFICATION"
        const val ACTION_STOP = "br.com.followclean.app.STOP_VERIFICATION"
        const val EXTRA_MESSAGE = "message"

        private const val CHANNEL_ID = "followclean_verification"
        private const val NOTIFICATION_ID = 1207
    }
}
