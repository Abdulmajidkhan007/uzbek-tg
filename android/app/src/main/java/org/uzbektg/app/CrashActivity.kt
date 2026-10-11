package org.uzbektg.app

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast

/**
 * Shown instead of a silent close when the app crashes (see CrashReporter).
 * Runs in its own ":crash" process, so the crash that killed the main process
 * cannot take this screen down too. The owner tests from a phone with no
 * logcat — this text is the only way the real error reaches the developer.
 */
class CrashActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val report = intent.getStringExtra(EXTRA_REPORT) ?: "No details."

    val pad = (16 * resources.displayMetrics.density).toInt()
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(pad, pad * 2, pad, pad)
    }
    root.addView(TextView(this).apply {
      text = "Uzbek TG yopilib qoldi"
      textSize = 20f
      setTypeface(typeface, Typeface.BOLD)
    })
    root.addView(TextView(this).apply {
      text = "Quyidagi matnni nusxalab dasturchiga yuboring."
      setPadding(0, pad / 2, 0, pad / 2)
    })
    val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    buttons.addView(Button(this).apply {
      text = "Nusxa olish"
      setOnClickListener {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("Uzbek TG crash", report))
        Toast.makeText(this@CrashActivity, "Nusxa olindi", Toast.LENGTH_SHORT).show()
      }
    })
    buttons.addView(Button(this).apply {
      text = "Qayta ochish"
      setOnClickListener {
        startActivity(
          Intent(this@CrashActivity, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
        )
        finish()
      }
    })
    root.addView(buttons)
    root.addView(ScrollView(this).apply {
      addView(TextView(this@CrashActivity).apply {
        text = report
        textSize = 11f
        typeface = Typeface.MONOSPACE
        setTextIsSelectable(true)
      })
    }, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
    setContentView(root)
  }

  companion object {
    const val EXTRA_REPORT = "report"
  }
}
