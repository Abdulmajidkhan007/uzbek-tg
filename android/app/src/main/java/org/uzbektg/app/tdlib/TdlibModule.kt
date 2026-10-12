package org.uzbektg.app.tdlib

import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.drinkless.tdlib.JsonClient
import org.json.JSONObject
import org.uzbektg.app.BuildConfig
import java.io.File
import java.util.Locale

/**
 * TDLib JSON interfeysi (org.drinkless.tdlib.JsonClient) va JS orasidagi ko'prik.
 *
 * - JS `send(json)` bilan so'rov yuboradi; javoblar va update'lar "tdlib"
 *   event'i sifatida (JSON matn) qaytadi.
 * - setTdlibParameters shu yerda yuboriladi: api_id / api_hash BuildConfig'dan
 *   olinadi va JS'ga umuman chiqmaydi.
 */
class TdlibModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @Volatile private var clientId: Int = -1
  private var receiver: Thread? = null

  @ReactMethod
  fun start(promise: Promise) {
    synchronized(this) {
      if (clientId >= 0) {
        promise.resolve(true)
        return
      }
      if (BuildConfig.TG_API_ID == 0 || BuildConfig.TG_API_HASH.isEmpty()) {
        promise.reject("NO_API_KEYS", "TG_API_ID / TG_API_HASH build vaqtida berilmagan")
        return
      }
      try {
        JsonClient.execute("""{"@type":"setLogVerbosityLevel","new_verbosity_level":1}""")
        clientId = JsonClient.createClientId()
      } catch (e: UnsatisfiedLinkError) {
        promise.reject("NO_TDLIB", "libtdjsonjava.so APK ichida yo'q", e)
        return
      }
      val id = clientId
      receiver = Thread({ receiveLoop(id) }, "tdlib-receiver").apply {
        isDaemon = true
        start()
      }
      // TDLib birinchi so'rovgacha update yubormaydi.
      JsonClient.send(id, """{"@type":"getOption","name":"version"}""")
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun send(request: String) {
    val id = clientId
    if (id >= 0) JsonClient.send(id, request)
  }

  @ReactMethod
  fun execute(request: String, promise: Promise) {
    try {
      promise.resolve(JsonClient.execute(request))
    } catch (e: Throwable) {
      promise.reject("TDLIB_EXECUTE", e)
    }
  }

  // NativeEventEmitter talab qiladi.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Double) {}

  private fun receiveLoop(id: Int) {
    while (true) {
      val event = JsonClient.receive(RECEIVE_TIMEOUT) ?: continue
      // TDLib JSON'da "@type" doim birinchi keladi; xabar matnidagi so'zlarga
      // aldanmaslik uchun faqat updateAuthorizationState'ning o'zi tekshiriladi.
      val authState = if (event.startsWith(AUTH_UPDATE_PREFIX)) authStateType(event) else null
      if (authState == "authorizationStateWaitTdlibParameters") {
        sendTdlibParameters(id)
      }
      emit(event)
      if (authState == "authorizationStateClosed") {
        // logOut'dan keyin instance yopiladi; JS keyingi start() bilan yangisini ochadi.
        synchronized(this) { if (clientId == id) clientId = -1 }
        return
      }
    }
  }

  private fun authStateType(event: String): String? =
      runCatching {
        JSONObject(event).getJSONObject("authorization_state").getString("@type")
      }.getOrNull()

  private fun sendTdlibParameters(id: Int) {
    val dir = File(reactContext.filesDir, "tdlib")
    val params = JSONObject()
        .put("@type", "setTdlibParameters")
        .put("database_directory", dir.absolutePath)
        .put("files_directory", File(dir, "files").absolutePath)
        .put("use_file_database", true)
        .put("use_chat_info_database", true)
        .put("use_message_database", true)
        .put("use_secret_chats", false)
        .put("api_id", BuildConfig.TG_API_ID)
        .put("api_hash", BuildConfig.TG_API_HASH)
        .put("system_language_code", Locale.getDefault().language.ifEmpty { "en" })
        .put("device_model", "${Build.MANUFACTURER} ${Build.MODEL}")
        .put("system_version", "Android ${Build.VERSION.RELEASE}")
        .put("application_version", BuildConfig.VERSION_NAME)
    JsonClient.send(id, params.toString())
  }

  private fun emit(event: String) {
    if (!reactContext.hasActiveReactInstance()) return
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT, event)
  }

  companion object {
    const val NAME = "Tdlib"
    const val EVENT = "tdlib"
    private const val RECEIVE_TIMEOUT = 10.0
    private const val AUTH_UPDATE_PREFIX = "{\"@type\":\"updateAuthorizationState\""

  }
}
