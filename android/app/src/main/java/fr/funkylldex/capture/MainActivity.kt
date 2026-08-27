package fr.funkylldex.capture

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

/**
 * L'ecran d'accueil : trois autorisations a obtenir, puis on n'y revient plus.
 *
 * Il y a un piege dans l'ordre. Depuis Android 11, une application qui capture
 * deja l'ecran recoit la permission de superposition automatiquement — mais la
 * doc precise dans la meme phrase qu'elle la PERD des que la capture s'arrete.
 * S'appuyer dessus ferait donc disparaitre la bulle au moment exact ou elle
 * servirait a relancer la capture. On demande donc la permission normalement,
 * une bonne fois, par les Reglages.
 */
class MainActivity : ComponentActivity() {

    private lateinit var etat: TextView

    private val demandeNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { rafraichir() }

    private val demandeSuperposition =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { rafraichir() }

    /**
     * Le consentement de capture. Il n'est pas memorisable : depuis Android 14,
     * rejouer un ancien resultat leve une SecurityException. Cet aller-retour
     * se refait donc a chaque session, et c'est normal.
     */
    private val demandeCapture =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { resultat ->
            if (resultat.resultCode != Activity.RESULT_OK || resultat.data == null) {
                Toast.makeText(this, "Lecture d'écran refusée.", Toast.LENGTH_SHORT).show()
                return@registerForActivityResult
            }
            val service = Intent(this, ServiceCapture::class.java).apply {
                putExtra(ServiceCapture.EXTRA_CODE, resultat.resultCode)
                putExtra(ServiceCapture.EXTRA_DONNEES, resultat.data)
            }
            ContextCompat.startForegroundService(this, service)
            // On s'efface : la suite se passe dans Pokemon HOME.
            moveTaskToBack(true)
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val marge = (resources.displayMetrics.density * 24).toInt()
        val colonne = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(marge, marge, marge, marge)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        colonne.addView(TextView(this).apply {
            text = "Funkylldex — lecture d'écran"
            textSize = 22f
        })

        etat = TextView(this).apply {
            textSize = 15f
            setPadding(0, marge / 2, 0, marge)
        }
        colonne.addView(etat)

        colonne.addView(Button(this).apply {
            text = "Autoriser les notifications"
            setOnClickListener {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    demandeNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    rafraichir()
                }
            }
        })

        colonne.addView(Button(this).apply {
            text = "Autoriser la bulle par-dessus HOME"
            setOnClickListener {
                demandeSuperposition.launch(
                    Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                )
            }
        })

        colonne.addView(Button(this).apply {
            text = "Démarrer la lecture"
            setOnClickListener { demarrer() }
        })

        colonne.addView(TextView(this).apply {
            text = "Dans la boîte de dialogue d'Android, choisis « Écran entier ». " +
                "Le mode « une seule application » retire les barres système " +
                "et décale toute la grille : la reconnaissance ne s'y retrouverait plus.\n\n" +
                "Ensuite : ouvre Pokémon HOME, appuie sur la bulle à chaque boîte, " +
                "puis reste appuyé pour envoyer la série à Funkylldex."
            textSize = 13f
            setPadding(0, marge, 0, 0)
        })

        setContentView(colonne)
    }

    override fun onResume() {
        super.onResume()
        rafraichir()
    }

    private fun demarrer() {
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Autorise d'abord la bulle.", Toast.LENGTH_SHORT).show()
            return
        }
        val gestionnaire = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        demandeCapture.launch(gestionnaire.createScreenCaptureIntent())
    }

    private fun rafraichir() {
        val bulle = if (Settings.canDrawOverlays(this)) "accordée" else "manquante"
        val notifs = if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
            android.content.pm.PackageManager.PERMISSION_GRANTED
        ) "accordées" else "manquantes"

        etat.text = "Bulle : $bulle\nNotifications : $notifs"
    }
}
