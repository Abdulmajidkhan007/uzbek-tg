package org.uzbektg.app.nativeapi

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.media.MediaRecorder
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.location.Location
import android.location.LocationManager
import com.facebook.react.bridge.WritableArray
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.uzbektg.app.MainActivity
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

/**
 * Ilovaga kerakli kichik native imkoniyatlar (alohida kutubxonasiz):
 * ekran rasmi (mavzu almashish animatsiyasi), ovoz yozish, fayl tanlash,
 * bildirishnomalar, galereyaga saqlash, ulashish, tarmoq turi.
 */
class AppNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  override fun getName(): String = NAME

  init {
    reactContext.addActivityEventListener(this)
    instance = this
  }

  // -------------------------------------------------------------------------
  // Ekran rasmi
  // -------------------------------------------------------------------------

  @ReactMethod
  fun captureScreen(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity yo'q")
      return
    }
    activity.runOnUiThread {
      try {
        val view = activity.window.decorView.rootView
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.RGB_565)
        view.draw(Canvas(bitmap))
        val file = File(reactContext.cacheDir, "theme_snap_${System.currentTimeMillis()}.jpg")
        FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 75, it) }
        bitmap.recycle()
        // Eski suratlarni tozalash.
        reactContext.cacheDir.listFiles()?.filter {
          it.name.startsWith("theme_snap_") && it.name != file.name
        }?.forEach { it.delete() }
        promise.resolve("file://${file.absolutePath}")
      } catch (e: Throwable) {
        promise.reject("CAPTURE_FAILED", e.message, e)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Ovoz yozish
  // -------------------------------------------------------------------------

  private var recorder: MediaRecorder? = null
  private var recordFile: File? = null
  private var recordStart = 0L
  private var recordIsOgg = false
  private val amplitudes = ArrayList<Int>()

  @ReactMethod
  fun hasMicPermission(promise: Promise) {
    promise.resolve(
        ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED)
  }

  @ReactMethod
  fun requestMicPermission(promise: Promise) {
    requestPermission(Manifest.permission.RECORD_AUDIO, promise)
  }

  @ReactMethod
  fun startRecording(promise: Promise) {
    if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) !=
        PackageManager.PERMISSION_GRANTED) {
      promise.reject("NO_PERMISSION", "Mikrofon ruxsati yo'q")
      return
    }
    try {
      releaseRecorder()
      recordIsOgg = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
      val file = File(reactContext.cacheDir, "voice_${System.currentTimeMillis()}.${if (recordIsOgg) "ogg" else "m4a"}")
      val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(reactContext) else @Suppress("DEPRECATION") MediaRecorder()
      r.setAudioSource(MediaRecorder.AudioSource.MIC)
      if (recordIsOgg) {
        r.setOutputFormat(MediaRecorder.OutputFormat.OGG)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.OPUS)
        r.setAudioSamplingRate(48000)
        r.setAudioEncodingBitRate(32000)
      } else {
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioSamplingRate(44100)
        r.setAudioEncodingBitRate(64000)
      }
      r.setAudioChannels(1)
      r.setOutputFile(file.absolutePath)
      r.prepare()
      r.start()
      recorder = r
      recordFile = file
      recordStart = System.currentTimeMillis()
      amplitudes.clear()
      promise.resolve(true)
    } catch (e: Throwable) {
      releaseRecorder()
      promise.reject("RECORD_FAILED", e.message, e)
    }
  }

  /** 0..1 oralig'ida joriy ovoz balandligi (waveform uchun ham saqlanadi). */
  @ReactMethod
  fun getAmplitude(promise: Promise) {
    val amp = try { recorder?.maxAmplitude ?: 0 } catch (_: Throwable) { 0 }
    amplitudes.add(amp)
    promise.resolve(amp / 32767.0)
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    val r = recorder
    val file = recordFile
    if (r == null || file == null) {
      promise.reject("NOT_RECORDING", "Yozilmayapti")
      return
    }
    val duration = ((System.currentTimeMillis() - recordStart) / 1000.0)
    try {
      r.stop()
    } catch (_: Throwable) {
      releaseRecorder()
      file.delete()
      promise.reject("TOO_SHORT", "Juda qisqa")
      return
    }
    releaseRecorder()
    val result = Arguments.createMap()
    result.putString("path", file.absolutePath)
    result.putDouble("duration", duration)
    result.putBoolean("isOgg", recordIsOgg)
    result.putString("waveform", encodeWaveform())
    promise.resolve(result)
  }

  @ReactMethod
  fun cancelRecording() {
    releaseRecorder()
    recordFile?.delete()
    recordFile = null
  }

  private fun releaseRecorder() {
    try { recorder?.release() } catch (_: Throwable) {}
    recorder = null
  }

  /** Telegram waveform formati: 100 ta 5-bitli qiymat, base64. */
  private fun encodeWaveform(): String {
    val n = 100
    val src = if (amplitudes.isEmpty()) listOf(0) else amplitudes
    val max = (src.maxOrNull() ?: 1).coerceAtLeast(1)
    val values = IntArray(n) { i ->
      val v = src[(i * src.size / n).coerceAtMost(src.size - 1)]
      (v * 31 / max).coerceIn(0, 31)
    }
    val bytes = ByteArray((n * 5 + 7) / 8)
    for (i in 0 until n) {
      val bit = i * 5
      for (b in 0 until 5) {
        if ((values[i] shr b) and 1 == 1) {
          val pos = bit + b
          bytes[pos / 8] = (bytes[pos / 8].toInt() or (1 shl (pos % 8))).toByte()
        }
      }
    }
    return android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
  }

  // -------------------------------------------------------------------------
  // Fayl tanlash (har qanday tur)
  // -------------------------------------------------------------------------

  private var pickPromise: Promise? = null

  @ReactMethod
  fun pickDocument(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Activity yo'q")
      return
    }
    pickPromise?.resolve(null)
    pickPromise = promise
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
    }
    try {
      activity.startActivityForResult(intent, REQ_PICK)
    } catch (e: Throwable) {
      pickPromise = null
      promise.reject("PICK_FAILED", e.message, e)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQ_PICK) return
    val promise = pickPromise ?: return
    pickPromise = null
    val uri = data?.data
    if (resultCode != Activity.RESULT_OK || uri == null) {
      promise.resolve(null)
      return
    }
    Thread {
      try {
        var name = "file"
        var size = 0L
        reactContext.contentResolver.query(uri, null, null, null, null)?.use { c ->
          if (c.moveToFirst()) {
            val ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val si = c.getColumnIndex(OpenableColumns.SIZE)
            if (ni >= 0) name = c.getString(ni) ?: name
            if (si >= 0) size = c.getLong(si)
          }
        }
        val dir = File(reactContext.cacheDir, "picked").apply { mkdirs() }
        val safe = name.replace(Regex("[/\\\\]"), "_")
        val out = File(dir, "${System.currentTimeMillis()}_$safe")
        reactContext.contentResolver.openInputStream(uri)?.use { input ->
          FileOutputStream(out).use { input.copyTo(it) }
        }
        val map = Arguments.createMap()
        map.putString("path", out.absolutePath)
        map.putString("name", name)
        map.putDouble("size", (if (size > 0) size else out.length()).toDouble())
        map.putString("mime", reactContext.contentResolver.getType(uri) ?: "application/octet-stream")
        promise.resolve(map)
      } catch (e: Throwable) {
        promise.reject("PICK_FAILED", e.message, e)
      }
    }.start()
  }

  override fun onNewIntent(intent: Intent) {
    handleIntent(intent)
  }

  // -------------------------------------------------------------------------
  // Bildirishnomalar
  // -------------------------------------------------------------------------

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL_ID) == null) {
      val ch = NotificationChannel(CHANNEL_ID, "Xabarlar", NotificationManager.IMPORTANCE_HIGH)
      ch.enableVibration(true)
      nm.createNotificationChannel(ch)
    }
  }

  @ReactMethod
  fun hasNotificationPermission(promise: Promise) {
    promise.resolve(NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
  }

  @ReactMethod
  fun requestNotificationPermission(promise: Promise) {
    if (Build.VERSION.SDK_INT < 33) {
      promise.resolve(NotificationManagerCompat.from(reactContext).areNotificationsEnabled())
      return
    }
    requestPermission(Manifest.permission.POST_NOTIFICATIONS, promise)
  }

  @ReactMethod
  fun showNotification(id: Double, chatId: String, title: String, body: String, silent: Boolean) {
    ensureChannel()
    val intent = Intent(reactContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra(EXTRA_CHAT_ID, chatId)
    }
    val pending = PendingIntent.getActivity(
        reactContext, id.toInt(), intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val n = NotificationCompat.Builder(reactContext, CHANNEL_ID)
        .setSmallIcon(org.uzbektg.app.R.mipmap.ic_launcher_monochrome)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setAutoCancel(true)
        .setSilent(silent)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
        .setContentIntent(pending)
        .build()
    try {
      NotificationManagerCompat.from(reactContext).notify(id.toInt(), n)
    } catch (_: SecurityException) {
      // Ruxsat berilmagan.
    }
  }

  @ReactMethod
  fun cancelNotification(id: Double) {
    NotificationManagerCompat.from(reactContext).cancel(id.toInt())
  }

  @ReactMethod
  fun cancelAllNotifications() {
    NotificationManagerCompat.from(reactContext).cancelAll()
  }

  /** Bildirishnoma bosilib ochilgan bo'lsa — chat id. */
  @ReactMethod
  fun getLaunchChatId(promise: Promise) {
    val id = reactContext.currentActivity?.intent?.getStringExtra(EXTRA_CHAT_ID)
    reactContext.currentActivity?.intent?.removeExtra(EXTRA_CHAT_ID)
    promise.resolve(id)
  }

  fun handleIntent(intent: Intent?) {
    val chatId = intent?.getStringExtra(EXTRA_CHAT_ID) ?: return
    intent.removeExtra(EXTRA_CHAT_ID)
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("appNativeOpenChat", chatId)
  }

  // -------------------------------------------------------------------------
  // Galereyaga saqlash va ulashish
  // -------------------------------------------------------------------------

  @ReactMethod
  fun saveToGallery(path: String, mime: String, promise: Promise) {
    Thread {
      try {
        val src = File(path.removePrefix("file://"))
        val isVideo = mime.startsWith("video")
        val isImage = mime.startsWith("image")
        val collection = when {
          isVideo -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
          isImage -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
          else -> MediaStore.Files.getContentUri("external")
        }
        val values = ContentValues().apply {
          put(MediaStore.MediaColumns.DISPLAY_NAME, src.name)
          put(MediaStore.MediaColumns.MIME_TYPE, mime)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val dir = when {
              isVideo -> Environment.DIRECTORY_MOVIES
              isImage -> Environment.DIRECTORY_PICTURES
              else -> Environment.DIRECTORY_DOWNLOADS
            }
            put(MediaStore.MediaColumns.RELATIVE_PATH, "$dir/Uzbek TG")
          }
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(reactContext, Manifest.permission.WRITE_EXTERNAL_STORAGE) !=
                PackageManager.PERMISSION_GRANTED) {
          promise.reject("NO_PERMISSION", "Xotiraga yozish ruxsati yo'q")
          return@Thread
        }
        val uri = reactContext.contentResolver.insert(collection, values)
            ?: throw IllegalStateException("MediaStore insert")
        reactContext.contentResolver.openOutputStream(uri)?.use { out ->
          FileInputStream(src).use { it.copyTo(out) }
        }
        promise.resolve(true)
      } catch (e: Throwable) {
        promise.reject("SAVE_FAILED", e.message, e)
      }
    }.start()
  }

  @ReactMethod
  fun shareFile(path: String, mime: String, promise: Promise) {
    try {
      val file = File(path.removePrefix("file://"))
      val uri: Uri = FileProvider.getUriForFile(
          reactContext, "${reactContext.packageName}.fileprovider", file)
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mime
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(chooser)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("SHARE_FAILED", e.message, e)
    }
  }

  /** Faylni boshqa ilovada ochish (hujjatlar uchun). */
  @ReactMethod
  fun openFile(path: String, mime: String, promise: Promise) {
    try {
      val file = File(path.removePrefix("file://"))
      val uri: Uri = FileProvider.getUriForFile(
          reactContext, "${reactContext.packageName}.fileprovider", file)
      val view = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, mime)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(view)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("OPEN_FAILED", e.message, e)
    }
  }

  // -------------------------------------------------------------------------
  // Tarmoq turi (TDLib setNetworkType va avto-yuklash uchun)
  // -------------------------------------------------------------------------

  @ReactMethod
  fun getNetworkType(promise: Promise) {
    val cm = reactContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val caps = cm.getNetworkCapabilities(cm.activeNetwork)
    val type = when {
      caps == null -> "none"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
          caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "wifi"
      caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ->
          if (!caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_ROAMING)) "roaming" else "mobile"
      else -> "other"
    }
    promise.resolve(type)
  }

  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Galereya (Telegram'dagi kabi biriktirish oynasi uchun)
  // -------------------------------------------------------------------------

  private fun mediaPermissions(): Array<String> =
      if (Build.VERSION.SDK_INT >= 33)
          arrayOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
      else arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)

  private fun hasAll(perms: Array<String>): Boolean =
      perms.all { ContextCompat.checkSelfPermission(reactContext, it) == PackageManager.PERMISSION_GRANTED }

  @ReactMethod
  fun hasMediaPermission(promise: Promise) {
    // Android 14+: foydalanuvchi faqat ba'zi rasmlarga ruxsat bergan bo'lishi mumkin.
    val partial = Build.VERSION.SDK_INT >= 34 &&
        ContextCompat.checkSelfPermission(reactContext, "android.permission.READ_MEDIA_VISUAL_USER_SELECTED") ==
            PackageManager.PERMISSION_GRANTED
    promise.resolve(hasAll(mediaPermissions()) || partial)
  }

  @ReactMethod
  fun requestMediaPermission(promise: Promise) {
    val perms = if (Build.VERSION.SDK_INT >= 34)
        mediaPermissions() + "android.permission.READ_MEDIA_VISUAL_USER_SELECTED"
    else mediaPermissions()
    requestPermissions(perms, promise)
  }

  /** Oxirgi rasm va videolar (yangi → eski). */
  @ReactMethod
  fun getRecentMedia(limit: Double, promise: Promise) {
    Thread {
      try {
        val out: WritableArray = Arguments.createArray()
        val uri = MediaStore.Files.getContentUri("external")
        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.WIDTH,
            MediaStore.Files.FileColumns.HEIGHT,
            MediaStore.Files.FileColumns.DATE_ADDED,
            MediaStore.Video.VideoColumns.DURATION,
        )
        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?"
        val args = arrayOf(
            MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
            MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString())
        val order = "${MediaStore.Files.FileColumns.DATE_ADDED} DESC"
        reactContext.contentResolver.query(uri, projection, selection, args, order)?.use { c ->
          var n = 0
          val max = limit.toInt()
          while (c.moveToNext() && n < max) {
            val id = c.getLong(0)
            val isVideo = c.getInt(1) == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
            val base = if (isVideo) MediaStore.Video.Media.EXTERNAL_CONTENT_URI else MediaStore.Images.Media.EXTERNAL_CONTENT_URI
            val m = Arguments.createMap()
            m.putString("uri", Uri.withAppendedPath(base, id.toString()).toString())
            m.putString("id", id.toString())
            m.putBoolean("isVideo", isVideo)
            m.putString("mime", c.getString(2) ?: if (isVideo) "video/mp4" else "image/jpeg")
            m.putInt("width", c.getInt(3))
            m.putInt("height", c.getInt(4))
            m.putDouble("date", c.getLong(5).toDouble())
            m.putDouble("duration", if (isVideo) c.getLong(6) / 1000.0 else 0.0)
            out.pushMap(m)
            n++
          }
        }
        promise.resolve(out)
      } catch (e: Throwable) {
        promise.reject("MEDIA_FAILED", e.message, e)
      }
    }.start()
  }

  /** content:// URI'ni kesh papkaga nusxalaydi (TDLib fayl yo'li bilan ishlaydi). */
  @ReactMethod
  fun copyToCache(uriStr: String, promise: Promise) {
    Thread {
      try {
        val uri = Uri.parse(uriStr)
        var name = "media"
        reactContext.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
          if (c.moveToFirst()) name = c.getString(0) ?: name
        }
        val dir = File(reactContext.cacheDir, "picked").apply { mkdirs() }
        val out = File(dir, "${System.currentTimeMillis()}_${name.replace(Regex("[/\\\\]"), "_")}")
        reactContext.contentResolver.openInputStream(uri)?.use { input ->
          FileOutputStream(out).use { input.copyTo(it) }
        }
        val map = Arguments.createMap()
        map.putString("path", out.absolutePath)
        map.putString("name", name)
        map.putDouble("size", out.length().toDouble())
        map.putString("mime", reactContext.contentResolver.getType(uri) ?: "application/octet-stream")
        promise.resolve(map)
      } catch (e: Throwable) {
        promise.reject("COPY_FAILED", e.message, e)
      }
    }.start()
  }

  // -------------------------------------------------------------------------
  // Joylashuv (xabar sifatida yuborish uchun)
  // -------------------------------------------------------------------------

  @ReactMethod
  fun requestLocationPermission(promise: Promise) {
    requestPermissions(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), promise)
  }

  @ReactMethod
  fun getCurrentLocation(promise: Promise) {
    val fine = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    val coarse = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
        PackageManager.PERMISSION_GRANTED
    if (!fine && !coarse) {
      promise.reject("NO_PERMISSION", "Joylashuv ruxsati yo'q")
      return
    }
    val lm = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val providers = lm.getProviders(true)
    var best: Location? = null
    try {
      for (p in providers) {
        @Suppress("MissingPermission")
        val l = lm.getLastKnownLocation(p) ?: continue
        if (best == null || l.time > best.time) best = l
      }
    } catch (_: SecurityException) {}
    val fresh = best != null && System.currentTimeMillis() - best.time < 2 * 60 * 1000
    if (fresh || Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      if (best == null) {
        promise.reject("NO_LOCATION", "Joylashuv aniqlanmadi")
        return
      }
      promise.resolve(locationMap(best))
      return
    }
    val provider = when {
      providers.contains(LocationManager.GPS_PROVIDER) && fine -> LocationManager.GPS_PROVIDER
      providers.contains(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
      providers.isNotEmpty() -> providers[0]
      else -> null
    }
    if (provider == null) {
      if (best != null) promise.resolve(locationMap(best)) else promise.reject("NO_LOCATION", "Joylashuv o'chirilgan")
      return
    }
    val fallback = best
    try {
      @Suppress("MissingPermission")
      lm.getCurrentLocation(provider, null, ContextCompat.getMainExecutor(reactContext)) { l ->
        val r = l ?: fallback
        if (r != null) promise.resolve(locationMap(r)) else promise.reject("NO_LOCATION", "Joylashuv aniqlanmadi")
      }
    } catch (e: SecurityException) {
      promise.reject("NO_PERMISSION", e.message, e)
    }
  }

  private fun locationMap(l: Location) = Arguments.createMap().apply {
    putDouble("latitude", l.latitude)
    putDouble("longitude", l.longitude)
    putDouble("accuracy", l.accuracy.toDouble())
  }

  private fun requestPermissions(perms: Array<String>, promise: Promise) {
    if (hasAll(perms)) {
      promise.resolve(true)
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    pendingPermission = perms[0] to promise
    ActivityCompat.requestPermissions(activity, perms, REQ_PERMISSION)
  }

  private fun requestPermission(permission: String, promise: Promise) {
    if (ContextCompat.checkSelfPermission(reactContext, permission) == PackageManager.PERMISSION_GRANTED) {
      promise.resolve(true)
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.resolve(false)
      return
    }
    pendingPermission = permission to promise
    ActivityCompat.requestPermissions(activity, arrayOf(permission), REQ_PERMISSION)
  }

  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}

  companion object {
    const val NAME = "AppNative"
    private const val REQ_PICK = 4201
    const val REQ_PERMISSION = 4202
    private const val CHANNEL_ID = "messages"
    const val EXTRA_CHAT_ID = "uzbektg_chat_id"

    @Volatile var instance: AppNativeModule? = null
    @Volatile var pendingPermission: Pair<String, Promise>? = null

    /** MainActivity.onRequestPermissionsResult dan chaqiriladi. */
    fun onPermissionResult(requestCode: Int, grantResults: IntArray) {
      if (requestCode != REQ_PERMISSION) return
      val pending = pendingPermission ?: return
      pendingPermission = null
      pending.second.resolve(grantResults.any { it == PackageManager.PERMISSION_GRANTED })
    }
  }
}
