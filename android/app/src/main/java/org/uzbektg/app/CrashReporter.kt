package org.uzbektg.app

import android.app.Application
import android.content.Intent
import android.os.Build
import android.os.Process
import android.util.Log
import kotlin.system.exitProcess

/**
 * Process-wide uncaught-exception hook. A fatal JS error in a release build is
 * rethrown natively (JavascriptException), so this catches JS and native
 * crashes alike, opens CrashActivity with the stack trace, then lets the main
 * process die as it would have anyway.
 */
object CrashReporter {

  fun install(app: Application) {
    val previous = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        val report = buildString {
          append("Uzbek TG ").append(BuildConfig.VERSION_NAME)
          append(" (").append(BuildConfig.VERSION_CODE).append(")\n")
          append("Android ").append(Build.VERSION.RELEASE).append(", ")
          append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append("\n\n")
          append(Log.getStackTraceString(error))
        }.take(60_000) // Intent extras must stay well under the binder limit.
        app.startActivity(
          Intent(app, CrashActivity::class.java)
            .putExtra(CrashActivity.EXTRA_REPORT, report)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK),
        )
        Process.killProcess(Process.myPid())
        exitProcess(10)
      } catch (reportFailure: Throwable) {
        // Reporting must never mask the original crash.
        previous?.uncaughtException(thread, error)
      }
    }
  }

  /** True inside the ":crash" process, which must not start React Native. */
  fun isCrashProcess(app: Application): Boolean {
    val name = if (Build.VERSION.SDK_INT >= 28) {
      Application.getProcessName()
    } else {
      runCatching { java.io.File("/proc/self/cmdline").readText().trim('\u0000') }.getOrDefault("")
    }
    return name.endsWith(":crash")
  }
}
