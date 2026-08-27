package fr.funkylldex.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

/**
 * Prend des captures de l'ecran pendant que Pokemon HOME est au premier plan,
 * puis remet la serie a Funkylldex par la feuille de partage.
 *
 * L'ordre des appels n'est pas negociable, et c'est l'erreur numero un sur ce
 * sujet : `startForeground()` DOIT preceder `getMediaProjection()`, qui doit
 * lui-meme preceder `createVirtualDisplay()`. Depuis Android 14, s'y prendre
 * autrement leve une SecurityException seche.
 *
 * De meme `registerCallback` est obligatoire avant toute creation de surface :
 * sans lui, une IllegalStateException au message peu bavard.
 */
class ServiceCapture : Service() {

    private var projection: MediaProjection? = null
    private var lecteur: ImageReader? = null
    private var ecranVirtuel: VirtualDisplay? = null
    private var bulle: BulleFlottante? = null

    private val prises = mutableListOf<File>()
    private val main = Handler(Looper.getMainLooper())

    /**
     * Android exige de relacher la projection quand le systeme l'interrompt —
     * verrouillage de l'ecran, autre application qui prend la main.
     */
    private val rappel = object : MediaProjection.Callback() {
        override fun onStop() {
            Log.i(TAG, "Projection arretee par le systeme.")
            arreter()
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @Suppress("DEPRECATION")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_ARRET) {
            arreter()
            return START_NOT_STICKY
        }

        val code = intent?.getIntExtra(EXTRA_CODE, 0) ?: 0
        val donnees: Intent? = intent?.getParcelableExtra(EXTRA_DONNEES)
        if (donnees == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        demarrerAuPremierPlan()

        val gestionnaire = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projection = gestionnaire.getMediaProjection(code, donnees).also {
            it.registerCallback(rappel, main)
        }

        ouvrirEcranVirtuel()

        bulle = BulleFlottante(this, onCapture = ::capturer, onTerminer = ::terminer)
            .also { it.montrer() }

        return START_NOT_STICKY
    }

    /* --------------------------------------------------------- mise en route */

    private fun demarrerAuPremierPlan() {
        getSystemService(NotificationManager::class.java).createNotificationChannel(
            NotificationChannel(CANAL, "Lecture d'écran", NotificationManager.IMPORTANCE_LOW)
        )

        val arret = PendingIntent.getService(
            this, 0,
            Intent(this, ServiceCapture::class.java).setAction(ACTION_ARRET),
            PendingIntent.FLAG_IMMUTABLE
        )

        val notification: Notification = NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Funkylldex lit l'écran")
            .setContentText("Appuie sur la bulle pour capturer une boîte.")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setOngoing(true)
            .addAction(0, "Terminer", arret)
            .build()

        startForeground(ID_NOTIF, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
    }

    /**
     * L'ecran entier, a sa resolution native, barres systeme comprises.
     *
     * Ce n'est pas un detail de confort : la reconnaissance de Funkylldex a ete
     * calibree sur des captures systeme, et elle cherche le haut de la grille a
     * une fraction de la hauteur totale. Capturer une seule application retire
     * les barres et decale tout — il faudrait recalibrer.
     */
    private fun ouvrirEcranVirtuel() {
        val (largeur, hauteur) = tailleEcran()

        // Deux images en attente : une seule suffirait, mais la marge evite de
        // manquer une trame juste apres la disparition de la bulle.
        lecteur = ImageReader.newInstance(largeur, hauteur, PixelFormat.RGBA_8888, 2)
        ecranVirtuel = projection?.createVirtualDisplay(
            "funkylldex",
            largeur, hauteur, resources.displayMetrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            lecteur?.surface, null, null
        )
    }

    @Suppress("DEPRECATION")
    private fun tailleEcran(): Pair<Int, Int> {
        val fenetres = getSystemService(WindowManager::class.java)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bornes = fenetres.currentWindowMetrics.bounds
            bornes.width() to bornes.height()
        } else {
            val m = DisplayMetrics()
            fenetres.defaultDisplay.getRealMetrics(m)
            m.widthPixels to m.heightPixels
        }
    }

    /* -------------------------------------------------------------- capture */

    /**
     * La bulle disparait avant la prise, et revient apres.
     *
     * Sans cela elle se photographierait elle-meme : l'ecran virtuel voit la
     * meme composition que l'utilisateur, surcouches comprises. Un bouton pose
     * sur une case de la grille en ferait un Pokemon meconnaissable — et la
     * reconnaissance, elle, n'aurait aucun moyen de s'en apercevoir.
     *
     * Le delai laisse au compositeur le temps de produire une trame sans elle.
     */
    private fun capturer() {
        bulle?.cacher()
        main.postDelayed({
            val fichier = prendreUneTrame()
            bulle?.montrerDeNouveau()
            if (fichier != null) {
                prises += fichier
                bulle?.majCompteur(prises.size)
                Toast.makeText(this, "Boîte ${prises.size} capturée", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Capture manquée, réessaie", Toast.LENGTH_SHORT).show()
            }
        }, DELAI_SANS_BULLE)
    }

    private fun prendreUneTrame(): File? {
        val image = lecteur?.acquireLatestImage() ?: return null
        try {
            val plan = image.planes[0]
            val largeur = image.width
            val hauteur = image.height

            // Le tampon est aligne sur `rowStride`, qui depasse presque toujours
            // `largeur * pixelStride`. Le copier sans en tenir compte produit
            // une image cisaillee en diagonale — le grand classique du sujet.
            val bourrage = plan.rowStride - plan.pixelStride * largeur
            val large = Bitmap.createBitmap(
                largeur + bourrage / plan.pixelStride,
                hauteur,
                Bitmap.Config.ARGB_8888
            )
            large.copyPixelsFromBuffer(plan.buffer)

            val exact = Bitmap.createBitmap(large, 0, 0, largeur, hauteur)
            large.recycle()

            val dossier = File(cacheDir, "captures").apply { mkdirs() }
            val fichier = File(dossier, "boite-%03d.png".format(prises.size))
            FileOutputStream(fichier).use { exact.compress(Bitmap.CompressFormat.PNG, 100, it) }
            exact.recycle()
            return fichier
        } catch (e: Exception) {
            Log.e(TAG, "Trame illisible.", e)
            return null
        } finally {
            image.close()
        }
    }

    /* --------------------------------------------------------------- remise */

    /**
     * Remet la serie a Funkylldex, dans l'ordre.
     *
     * L'ordre compte : c'est de lui que la reconnaissance tire sa contrainte de
     * numero de dex croissant, celle qui rattrape la plupart de ses hesitations.
     */
    private fun terminer() {
        if (prises.isEmpty()) {
            arreter()
            return
        }

        val uris = ArrayList(prises.map {
            FileProvider.getUriForFile(this, "$packageName.fichiers", it)
        })

        val partage = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = "image/png"
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        startActivity(
            Intent.createChooser(partage, "Envoyer à Funkylldex")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        arreter()
    }

    private fun arreter() {
        bulle?.retirer()
        bulle = null
        ecranVirtuel?.release()
        ecranVirtuel = null
        lecteur?.close()
        lecteur = null
        projection?.let {
            it.unregisterCallback(rappel)
            it.stop()
        }
        projection = null
        prises.clear()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val TAG = "Funkylldex"
        private const val CANAL = "lecture-ecran"
        private const val ID_NOTIF = 1
        private const val DELAI_SANS_BULLE = 140L

        const val ACTION_ARRET = "fr.funkylldex.capture.ARRET"
        const val EXTRA_CODE = "code"
        const val EXTRA_DONNEES = "donnees"
    }
}
