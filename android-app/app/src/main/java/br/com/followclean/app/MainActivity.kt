package br.com.followclean.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.ClipboardManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.TextView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

class MainActivity : Activity() {
    private lateinit var mainWebView: WebView
    private lateinit var scannerWebView: WebView
    private lateinit var statusView: TextView

    private val handler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("followclean_android", MODE_PRIVATE) }

    private var queue: List<String> = emptyList()
    private var running = false
    private var currentIndex = 0
    private var processedThisRun = 0
    private var currentUsername: String? = null
    private var extractionAttempts = 0
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var oauthRedeemAttempts = 0

    private val maxProfilesPerRun = 30
    private val betweenProfilesMs = 12_000L
    private val extractionDelayMs = 2_000L
    private val secondExtractionDelayMs = 3_000L

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        statusView = TextView(this).apply {
            setBackgroundColor(Color.rgb(15, 23, 42))
            setTextColor(Color.WHITE)
            textSize = 12f
            setPadding(24, 12, 24, 12)
            text = "FollowClean Android · pronto"
        }

        mainWebView = WebView(this)
        scannerWebView = WebView(this).apply {
            alpha = 0.01f
        }

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(
                statusView,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            )
            addView(
                mainWebView,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0,
                    1f
                )
            )
            addView(scannerWebView, LinearLayout.LayoutParams(1, 1))
        }
        setContentView(root)

        configureMainWebView()
        configureScannerWebView()
        restoreState()

        if (!handleIncomingIntent(intent)) {
            mainWebView.loadUrl("https://followclean.netlify.app/limpeza")
        }
    }

    override fun onResume() {
        super.onResume()

        if (
            ::mainWebView.isInitialized &&
            prefs.getBoolean("oauth_pending", false)
        ) {
            handler.postDelayed({
                if (!tryCompleteOAuthFromClipboard()) {
                    updateStatus(
                        "Autorização pendente. No Chrome, toque em 'Copiar autorização e abrir FollowClean'."
                    )
                }
            }, 500L)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureMainWebView() {
        mainWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            // O site possui um fluxo especial para navegadores Android comuns que
            // força abertura no Chrome. No APK usamos UA de navegador desktop para
            // receber o OAuth direto na própria WebView.
            userAgentString =
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 " +
                "FollowCleanAndroid/0.3.7"
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(mainWebView, true)
        }

        mainWebView.webChromeClient = object : WebChromeClient() {
            override fun onCreateWindow(
                view: WebView,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: android.os.Message
            ): Boolean {
                val popup = WebView(this@MainActivity).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.javaScriptCanOpenWindowsAutomatically = true
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            popupView: WebView,
                            request: WebResourceRequest
                        ): Boolean {
                            handleMainNavigation(mainWebView, request.url.toString())
                            popupView.destroy()
                            return true
                        }

                        @Deprecated("Legacy WebView callback")
                        override fun shouldOverrideUrlLoading(
                            popupView: WebView,
                            url: String
                        ): Boolean {
                            handleMainNavigation(mainWebView, url)
                            popupView.destroy()
                            return true
                        }

                        override fun onPageFinished(popupView: WebView, url: String) {
                            super.onPageFinished(popupView, url)
                            if (url.isNotBlank() && url != "about:blank") {
                                handleMainNavigation(mainWebView, url)
                                popupView.destroy()
                            }
                        }
                    }
                }

                val transport = resultMsg.obj as? WebView.WebViewTransport ?: return false
                transport.webView = popup
                resultMsg.sendToTarget()
                return true
            }

            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "application/zip"
                    putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        arrayOf("application/zip", "application/x-zip-compressed")
                    )
                }

                startActivityForResult(intent, FILE_CHOOSER_REQUEST)
                return true
            }
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                mainWebView,
                "FollowCleanAndroid",
                setOf("https://followclean.netlify.app")
            ) { _, message, sourceOrigin, isMainFrame, _ ->
                if (!isMainFrame || sourceOrigin.toString() != "https://followclean.netlify.app") {
                    return@addWebMessageListener
                }
                val payload = message.data ?: return@addWebMessageListener
                handleWebCommand(payload)
            }
        }

        mainWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                return handleMainNavigation(view, request.url.toString())
            }

            @Deprecated("Legacy WebView callback")
            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                return handleMainNavigation(view, url)
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)

                if (url.contains("/conectar?status=connected")) {
                    prefs.edit().putBoolean("oauth_pending", false).apply()
                    oauthRedeemAttempts = 0
                    updateStatus("Instagram conectado com sucesso.")
                }

                if (url.startsWith("https://followclean.netlify.app")) {
                    sendReadyToWeb()
                    sendResultsToWeb()
                }
            }
        }
    }

    private fun handleMainNavigation(view: WebView, rawUrl: String): Boolean {
        val uri = runCatching { Uri.parse(rawUrl) }.getOrNull() ?: return true
        val scheme = uri.scheme.orEmpty().lowercase()

        if (scheme == "intent") {
            val fallback = runCatching {
                Intent.parseUri(rawUrl, Intent.URI_INTENT_SCHEME)
                    .getStringExtra("browser_fallback_url")
            }.getOrNull()

            val httpsFallback = when {
                !fallback.isNullOrBlank() &&
                    (fallback.startsWith("https://") || fallback.startsWith("http://")) -> fallback
                rawUrl.startsWith("intent://") -> {
                    val base = rawUrl.substringBefore("#Intent;")
                    base.replaceFirst("intent://", "https://")
                }
                else -> null
            }

            if (!httpsFallback.isNullOrBlank()) {
                view.loadUrl(httpsFallback)
                updateStatus("Continuando autorização do Instagram...")
            } else {
                updateStatus("Não foi possível abrir a autorização do Instagram.")
            }
            return true
        }

        if (scheme == "instagram") {
            val host = uri.host.orEmpty()
            val path = uri.encodedPath.orEmpty()
            val query = uri.encodedQuery?.let { "?$it" }.orEmpty()
            val httpsUrl = "https://www.instagram.com/$host$path$query"
            view.loadUrl(httpsUrl)
            updateStatus("Abrindo autorização no navegador interno...")
            return true
        }

        val host = uri.host.orEmpty().lowercase()

        if (
            (scheme == "https" || scheme == "http") &&
            host == "followclean.netlify.app" &&
            uri.path.orEmpty() == "/api/instagram/connect"
        ) {
            val connectUrl =
                "https://followclean.netlify.app/api/instagram/android-connect"
            view.loadUrl(connectUrl)
            updateStatus("Preparando conexão segura com o Instagram...")
            return true
        }

        if (
            (scheme == "https" || scheme == "http") &&
            (host == "instagram.com" || host.endsWith(".instagram.com")) &&
            uri.path.orEmpty().startsWith("/oauth/authorize")
        ) {
            openOAuthInBrowser(uri)
            return true
        }

        val allowedHost =
            host == "followclean.netlify.app" ||
            host == "instagram.com" ||
            host.endsWith(".instagram.com") ||
            host == "facebook.com" ||
            host.endsWith(".facebook.com")

        if ((scheme == "https" || scheme == "http") && allowedHost) {
            return false
        }

        if (scheme == "about" || scheme == "data" || scheme == "blob") {
            return false
        }

        // Durante o OAuth não entregamos a navegação a outro app/navegador,
        // porque isso separa os cookies da WebView e quebra a validação de state.
        if (
            rawUrl.contains("instagram", ignoreCase = true) ||
            rawUrl.contains("facebook", ignoreCase = true) ||
            rawUrl.contains("oauth", ignoreCase = true)
        ) {
            updateStatus("Mantendo a autorização dentro do FollowClean...")
            return true
        }

        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        }.onFailure {
            updateStatus("Link externo não pôde ser aberto.")
        }
        return true
    }

    private fun openOAuthInBrowser(uri: Uri) {
        oauthRedeemAttempts = 0
        prefs.edit().putBoolean("oauth_pending", true).apply()

        val chromeIntent = Intent(Intent.ACTION_VIEW, uri).apply {
            setPackage("com.android.chrome")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val opened = runCatching {
            startActivity(chromeIntent)
            true
        }.getOrDefault(false)

        if (!opened) {
            runCatching {
                startActivity(
                    Intent(Intent.ACTION_VIEW, uri).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
        }

        updateStatus("Autorize no navegador. Depois você voltará automaticamente ao FollowClean.")
    }

    private fun handleIncomingIntent(sourceIntent: Intent?): Boolean {
        val data = sourceIntent?.data ?: return false
        val isCustomReturn =
            data.scheme == "followclean" &&
            data.host == "oauth"

        val isHttpsReturn =
            data.scheme == "https" &&
            data.host == "followclean.netlify.app" &&
            data.path.orEmpty().startsWith("/app/oauth/complete")

        if (!isCustomReturn && !isHttpsReturn) {
            return false
        }

        val handoff = data.getQueryParameter("handoff")
        if (handoff.isNullOrBlank()) {
            if (!tryCompleteOAuthFromClipboard()) {
                updateStatus(
                    "Abra o Chrome, copie a autorização e volte ao FollowClean."
                )
            }
            return true
        }

        completeOAuthHandoff(handoff)
        return true
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    private fun completeOAuthHandoff(handoff: String) {
        if (handoff.isBlank()) return

        updateStatus("Finalizando conexão do Instagram...")
        val redeemUrl =
            "https://followclean.netlify.app/api/instagram/android-complete?handoff=" +
                Uri.encode(handoff)
        mainWebView.loadUrl(redeemUrl)
    }

    private fun tryCompleteOAuthFromClipboard(): Boolean {
        if (!prefs.getBoolean("oauth_pending", false)) return false

        val clipboard =
            getSystemService(CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
        val clip = clipboard.primaryClip ?: return false
        if (clip.itemCount <= 0) return false

        val text = clip.getItemAt(0).coerceToText(this)?.toString()?.trim().orEmpty()
        if (!text.startsWith("FCAUTH:")) return false

        val handoff = text.removePrefix("FCAUTH:").trim()
        if (handoff.isBlank()) return false

        // Apaga o token do clipboard assim que o APK o recebe.
        runCatching { clipboard.clearPrimaryClip() }
        completeOAuthHandoff(handoff)
        return true
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureScannerWebView() {
        scannerWebView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            cacheMode = WebSettings.LOAD_NO_CACHE
            loadsImagesAutomatically = false
            blockNetworkImage = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString FollowCleanScanner/0.1"
        }

        CookieManager.getInstance().setAcceptThirdPartyCookies(scannerWebView, true)

        scannerWebView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                val host = request.url.host.orEmpty()
                return !(host == "www.instagram.com" || host == "instagram.com")
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (!running) return

                if (isChallengeUrl(url)) {
                    pauseBatch("Instagram solicitou login/verificação. Lote pausado.")
                    return
                }

                extractionAttempts = 0
                handler.postDelayed({ extractFollowers() }, extractionDelayMs)
            }
        }
    }

    private fun handleWebCommand(raw: String) {
        runCatching {
            val json = JSONObject(raw)
            when (json.optString("type")) {
                "PING" -> sendReadyToWeb()
                "GET_RESULTS" -> sendResultsToWeb()
                "START_OAUTH" -> startInstagramOAuth()
                "PAUSE_BATCH" -> pauseBatch("Pausado pelo usuário.")
                "START_BATCH" -> {
                    val usernames = json.optJSONArray("usernames") ?: JSONArray()
                    startBatch(jsonArrayToUsernames(usernames))
                }
            }
        }.onFailure {
            updateStatus("Comando inválido recebido do FollowClean.")
        }
    }

    private fun startInstagramOAuth() {
        oauthRedeemAttempts = 0
        prefs.edit().putBoolean("oauth_pending", true).apply()

        val connectUrl =
            "https://followclean.netlify.app/api/instagram/android-connect"

        updateStatus("Preparando conexão segura com o Instagram...")
        mainWebView.loadUrl(connectUrl)
    }

    private fun startBatch(usernames: List<String>) {
        if (usernames.isEmpty()) {
            sendBatchStatus("Nenhum perfil pendente para verificar.")
            return
        }

        queue = usernames.distinct()
        currentIndex = 0
        processedThisRun = 0
        running = true
        currentUsername = null
        persistState()
        sendBatchStatus("Verificação iniciada. Até $maxProfilesPerRun perfis por lote.")
        processNext()
    }

    private fun pauseBatch(message: String) {
        running = false
        currentUsername = null
        handler.removeCallbacksAndMessages(null)
        persistState()
        updateStatus(message)
        sendBatchStatus(message)
        sendResultsToWeb()
    }

    private fun processNext() {
        if (!running) return

        if (processedThisRun >= maxProfilesPerRun) {
            pauseBatch("Lote concluído: $processedThisRun perfis verificados.")
            return
        }

        val results = readResults()
        while (currentIndex < queue.size && results.has(queue[currentIndex])) {
            currentIndex++
        }

        if (currentIndex >= queue.size) {
            pauseBatch("Fila concluída.")
            return
        }

        currentUsername = queue[currentIndex]
        val username = currentUsername ?: return
        persistState()

        val message = "Verificando @$username · ${processedThisRun + 1}/$maxProfilesPerRun"
        updateStatus(message)
        sendBatchStatus(message)

        scannerWebView.loadUrl("https://www.instagram.com/${Uri.encode(username)}/")
    }

    private fun extractFollowers() {
        if (!running) return
        val expected = currentUsername ?: return

        scannerWebView.evaluateJavascript(EXTRACT_SCRIPT) { raw ->
            val decoded = decodeJavascriptString(raw)
            val json = runCatching { JSONObject(decoded) }.getOrNull()

            if (json == null) {
                retryOrSkip(expected)
                return@evaluateJavascript
            }

            if (json.optBoolean("blocked", false)) {
                pauseBatch("Instagram exibiu login/verificação. Lote pausado.")
                return@evaluateJavascript
            }

            val username = json.optString("username").lowercase()
            val followersCount =
                if (json.has("followersCount") && !json.isNull("followersCount")) {
                    json.optInt("followersCount", -1)
                } else {
                    -1
                }

            if (username != expected.lowercase() || followersCount < 0) {
                retryOrSkip(expected)
                return@evaluateJavascript
            }

            saveResult(username, followersCount)
            processedThisRun++
            currentIndex++
            currentUsername = null
            persistState()

            val message = "@$username: $followersCount seguidores"
            updateStatus(message)
            sendResultsToWeb()
            sendBatchStatus(message)

            handler.postDelayed({ processNext() }, betweenProfilesMs)
        }
    }

    private fun retryOrSkip(username: String) {
        extractionAttempts++
        if (extractionAttempts < 2) {
            handler.postDelayed({ extractFollowers() }, secondExtractionDelayMs)
            return
        }

        processedThisRun++
        currentIndex++
        currentUsername = null
        persistState()

        val message = "Não foi possível ler @$username. Seguindo."
        updateStatus(message)
        sendBatchStatus(message)
        handler.postDelayed({ processNext() }, betweenProfilesMs)
    }

    private fun saveResult(username: String, followersCount: Int) {
        val results = readResults()
        results.put(
            username,
            JSONObject()
                .put("username", username)
                .put("followersCount", followersCount)
                .put("dataSource", "android")
                .put("updatedAt", Instant.now().toString())
        )
        prefs.edit().putString("results", results.toString()).apply()
    }

    private fun readResults(): JSONObject {
        val raw = prefs.getString("results", null)
        return runCatching {
            if (raw.isNullOrBlank()) JSONObject() else JSONObject(raw)
        }.getOrDefault(JSONObject())
    }

    private fun sendReadyToWeb() {
        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "READY")
                .put("version", "0.3.7")
        )
    }

    private fun sendResultsToWeb() {
        val resultsObject = readResults()
        val resultsArray = JSONArray()
        val keys = resultsObject.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            resultsArray.put(resultsObject.getJSONObject(key))
        }

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "RESULTS")
                .put("results", resultsArray)
                .put("batch", batchJson())
        )
    }

    private fun sendBatchStatus(message: String) {
        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "BATCH_STATUS")
                .put("batch", batchJson().put("lastMessage", message))
        )
    }

    private fun batchJson(): JSONObject {
        return JSONObject()
            .put("running", running)
            .put("currentUsername", currentUsername)
            .put("processedThisRun", processedThisRun)
            .put("maxPerRun", maxProfilesPerRun)
    }

    private fun sendToWeb(payload: JSONObject) {
        val script = "window.postMessage(${payload}, '*');"
        mainWebView.post {
            mainWebView.evaluateJavascript(script, null)
        }
    }

    private fun updateStatus(message: String) {
        statusView.post { statusView.text = "FollowClean Android · $message" }
    }

    private fun persistState() {
        prefs.edit()
            .putString("queue", JSONArray(queue).toString())
            .putInt("currentIndex", currentIndex)
            .putInt("processedThisRun", processedThisRun)
            .putBoolean("running", running)
            .putString("currentUsername", currentUsername)
            .apply()
    }

    private fun restoreState() {
        val rawQueue = prefs.getString("queue", null)
        queue = runCatching {
            if (rawQueue.isNullOrBlank()) emptyList()
            else jsonArrayToUsernames(JSONArray(rawQueue))
        }.getOrDefault(emptyList())

        currentIndex = prefs.getInt("currentIndex", 0)
        processedThisRun = prefs.getInt("processedThisRun", 0)
        running = false
        currentUsername = null
        persistState()
    }

    private fun jsonArrayToUsernames(array: JSONArray): List<String> {
        val result = mutableListOf<String>()
        for (i in 0 until array.length()) {
            val username = array.optString(i)
                .trim()
                .lowercase()
                .removePrefix("@")
            if (username.isNotBlank()) result.add(username)
        }
        return result
    }

    private fun isChallengeUrl(url: String): Boolean {
        val lowered = url.lowercase()
        return lowered.contains("/accounts/login") ||
            lowered.contains("/challenge") ||
            lowered.contains("/checkpoint")
    }

    private fun decodeJavascriptString(value: String?): String {
        if (value.isNullOrBlank() || value == "null") return ""
        return runCatching {
            JSONArray("[$value]").getString(0)
        }.getOrDefault("")
    }

    @Deprecated("Deprecated in Android SDK; kept for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onBackPressed() {
        if (mainWebView.canGoBack()) {
            mainWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        mainWebView.destroy()
        scannerWebView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val FILE_CHOOSER_REQUEST = 9012
        private val EXTRACT_SCRIPT = """
            (() => {
              function parseHumanCount(raw) {
                if (!raw) return null;
                const text = String(raw)
                  .trim()
                  .toLowerCase()
                  .replace(/\\u00a0/g, " ")
                  .replace(/\\s+/g, " ");

                let multiplier = 1;
                if (/\\b(k|mil|thousand)\\b/.test(text)) multiplier = 1000;
                if (/\\b(m|mi|million|millions|milhão|milhoes|milhões)\\b/.test(text)) multiplier = 1000000;
                if (/\\b(b|billion|billions|bilhão|bilhoes|bilhões)\\b/.test(text)) multiplier = 1000000000;

                const token = text.match(/[\\d.,]+/)?.[0];
                if (!token) return null;

                if (multiplier > 1) {
                  let normalized = token;
                  if (normalized.includes(",") && normalized.includes(".")) {
                    const lastComma = normalized.lastIndexOf(",");
                    const lastDot = normalized.lastIndexOf(".");
                    const decimal = lastComma > lastDot ? "," : ".";
                    normalized = normalized
                      .replace(decimal === "," ? /\\./g : /,/g, "")
                      .replace(decimal, ".");
                  } else if (normalized.includes(",")) {
                    normalized = normalized.replace(",", ".");
                  }

                  const value = Number.parseFloat(normalized);
                  return Number.isFinite(value) ? Math.round(value * multiplier) : null;
                }

                const digits = token.replace(/\\D/g, "");
                if (!digits) return null;
                const value = Number.parseInt(digits, 10);
                return Number.isFinite(value) ? value : null;
              }

              const path = location.pathname.toLowerCase();
              const blocked =
                path.startsWith("/accounts/login") ||
                path.startsWith("/challenge") ||
                path.startsWith("/checkpoint");

              const username =
                location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";

              let followersCount = null;

              const meta =
                document.querySelector('meta[property="og:description"]') ||
                document.querySelector('meta[name="description"]');
              const content = meta?.getAttribute("content") || "";
              const metaMatch = content.match(
                /([\\d.,]+(?:\\s*(?:k|m|b|mil|mi|thousand|million|millions|milhão|milhoes|milhões))?)\\s+(?:followers|seguidores)/i
              );
              if (metaMatch) followersCount = parseHumanCount(metaMatch[1]);

              if (followersCount === null) {
                const links = [
                  ...document.querySelectorAll(
                    'a[href*="/followers/"], a[href$="/followers"]'
                  )
                ];

                for (const link of links) {
                  const title =
                    link.querySelector("[title]")?.getAttribute("title") ||
                    link.getAttribute("title");
                  followersCount = parseHumanCount(title) ?? parseHumanCount(link.textContent || "");
                  if (followersCount !== null) break;
                }
              }

              if (followersCount === null) {
                for (const node of document.querySelectorAll("header li, header span")) {
                  const text = (node.textContent || "").trim();
                  if (!/(followers|seguidores)/i.test(text)) continue;
                  followersCount = parseHumanCount(text);
                  if (followersCount !== null) break;
                }
              }

              return JSON.stringify({
                username,
                followersCount,
                blocked
              });
            })();
        """.trimIndent()
    }
}
