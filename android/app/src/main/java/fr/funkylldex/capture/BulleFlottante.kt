package fr.funkylldex.capture

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import kotlin.math.abs

/**
 * Le bouton pose par-dessus Pokemon HOME.
 *
 * Il ne voit rien — c'est le point que toute la question escamote. Une fenetre
 * de superposition ne sait que dessiner ; la lecture, elle, vient entierement
 * de MediaProjection, dans [ServiceCapture]. La bulle n'est qu'une gachette.
 *
 * Elle se deplace au doigt : posee au mauvais endroit, elle masquerait une case
 * de la grille, et comme elle s'efface au moment de la prise ce serait sans
 * consequence sur l'image — mais tres genant a l'usage.
 */
@SuppressLint("ViewConstructor")
class BulleFlottante(
    private val contexte: Context,
    private val onCapture: () -> Unit,
    private val onTerminer: () -> Unit,
) {

    private val fenetres = contexte.getSystemService(WindowManager::class.java)
    private var vue: TextView? = null

    private val parametres = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        },
        // NOT_FOCUSABLE : sans ce drapeau, la bulle volerait le clavier et les
        // touches « retour » a Pokemon HOME, qui deviendrait inutilisable.
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        android.graphics.PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = 24
        y = 320
    }

    @SuppressLint("ClickableViewAccessibility", "SetTextI18n")
    fun montrer() {
        if (vue != null) return

        val bouton = TextView(contexte).apply {
            text = "0"
            setTextColor(Color.WHITE)
            textSize = 17f
            gravity = Gravity.CENTER
            val c = (contexte.resources.displayMetrics.density * 8).toInt()
            setPadding(c, c, c, c)
            minWidth = (contexte.resources.displayMetrics.density * 52).toInt()
            minHeight = (contexte.resources.displayMetrics.density * 52).toInt()
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#E03A3A"))
                setStroke((contexte.resources.displayMetrics.density * 2).toInt(), Color.WHITE)
            }
            contentDescription = "Capturer la boîte affichée"
        }

        // Un appui capture, un appui long termine la serie. Le glissement
        // deplace la bulle et ne doit surtout pas declencher de capture : d'ou
        // le seuil en pixels avant de considerer que le doigt a bouge.
        var departX = 0
        var departY = 0
        var doigtX = 0f
        var doigtY = 0f
        var aGlisse = false
        var appuiLong = false

        val minuteur = android.os.Handler(android.os.Looper.getMainLooper())
        val versTerminer = Runnable {
            appuiLong = true
            onTerminer()
        }

        bouton.setOnTouchListener { _, evenement ->
            when (evenement.action) {
                MotionEvent.ACTION_DOWN -> {
                    departX = parametres.x
                    departY = parametres.y
                    doigtX = evenement.rawX
                    doigtY = evenement.rawY
                    aGlisse = false
                    appuiLong = false
                    minuteur.postDelayed(versTerminer, 700)
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = evenement.rawX - doigtX
                    val dy = evenement.rawY - doigtY
                    if (abs(dx) > SEUIL || abs(dy) > SEUIL) {
                        aGlisse = true
                        minuteur.removeCallbacks(versTerminer)
                        parametres.x = departX + dx.toInt()
                        parametres.y = departY + dy.toInt()
                        vue?.let { fenetres.updateViewLayout(it, parametres) }
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    minuteur.removeCallbacks(versTerminer)
                    if (!aGlisse && !appuiLong) onCapture()
                    true
                }

                else -> false
            }
        }

        vue = bouton
        fenetres.addView(bouton, parametres)
    }

    /** Efface la bulle le temps d'une prise, sans la detruire. */
    fun cacher() {
        vue?.visibility = View.GONE
    }

    fun montrerDeNouveau() {
        vue?.visibility = View.VISIBLE
    }

    @SuppressLint("SetTextI18n")
    fun majCompteur(nombre: Int) {
        vue?.text = nombre.toString()
    }

    fun retirer() {
        vue?.let { runCatching { fenetres.removeView(it) } }
        vue = null
    }

    private companion object {
        const val SEUIL = 12f
    }
}
