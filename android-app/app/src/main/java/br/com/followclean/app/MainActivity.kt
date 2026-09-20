package br.com.followclean.app

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.ClipboardManager
import android.graphics.Color
import android.net.Uri
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
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
    private var pendingBackupFileContent: String? = null
    private var oauthRedeemAttempts = 0

    private val betweenProfilesMs = 12_000L
    private val extractionDelayMs = 2_500L
    private val maxExtractionAttempts = 3

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
                "FollowCleanAndroid/0.3.16"
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
                    sendAppSnapshotToWeb()
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
            userAgentString =
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 " +
                "FollowCleanScanner/0.2"
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

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
                if (running && request.isForMainFrame) {
                    pauseBatch("Falha de rede ao abrir o Instagram. Verificação pausada; perfil atual preservado para nova tentativa.")
                }
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                response: WebResourceResponse
            ) {
                super.onReceivedHttpError(view, request, response)
                if (running && request.isForMainFrame &&
                    (response.statusCode == 429 || response.statusCode >= 500)
                ) {
                    pauseBatch("Instagram respondeu HTTP ${response.statusCode}. Verificação pausada sem classificar o perfil.")
                }
            }

            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (!running) return
                if (!hasValidatedInternet()) {
                    pauseForConnection()
                    return
                }

                if (isChallengeUrl(url)) {
                    pauseBatch("Instagram solicitou login/verificação. Lote pausado.")
                    return
                }

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
                "RESET_ANDROID_FAILURES" -> resetAndroidFailures(json.optJSONArray("usernames"))
                "SAVE_SNAPSHOT" -> {
                    val snapshot = json.optJSONObject("snapshot")
                    if (snapshot != null) saveAppSnapshot(snapshot)
                }
                "GET_SNAPSHOT" -> sendAppSnapshotToWeb()
                "READ_BACKUP_CLIPBOARD" -> sendBackupFromClipboard()
                "SAVE_BACKUP_FILE" -> saveBackupFile(json.optString("content"))
                "OPEN_BACKUP_FILE" -> openBackupFile()
                "CLOUD_SYNCED" -> markCloudSynced()
                "START_OAUTH" -> startInstagramOAuth()
                "PAUSE_BATCH" -> pauseBatch("Pausado pelo usuário.")
                "OPEN_PROFILE" -> openInstagramProfile(json.optString("username"))
                "REVIEW_PROFILE" -> reviewProfile(json.optString("username"))
                "START_BATCH" -> {
                    val usernames = json.optJSONArray("usernames") ?: JSONArray()
                    startBatch(jsonArrayToUsernames(usernames))
                }
            }
        }.onFailure {
            updateStatus("Comando inválido recebido do FollowClean.")
        }
    }

    private fun openInstagramProfile(rawUsername: String) {
        val username = rawUsername.trim().lowercase().removePrefix("@")
        if (username.isBlank()) return

        val instagramIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("instagram://user?username=${Uri.encode(username)}")
        ).apply {
            setPackage("com.instagram.android")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val openedInstagram = runCatching {
            startActivity(instagramIntent)
            true
        }.getOrDefault(false)

        if (!openedInstagram) {
            val webIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://www.instagram.com/${Uri.encode(username)}/")
            ).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            runCatching {
                startActivity(webIntent)
            }.onFailure {
                updateStatus("Não foi possível abrir @$username.")
            }
        }
    }

    private fun reviewProfile(rawUsername: String) {
        val username = rawUsername.trim().lowercase().removePrefix("@")
        if (username.isBlank()) return

        clearFailure(username)
        clearResult(username)

        if (running) {
            val mutable = queue.toMutableList()
            mutable.removeAll { it == username }

            val insertAt =
                if (currentUsername != null) {
                    (currentIndex + 1).coerceAtMost(mutable.size)
                } else {
                    currentIndex.coerceAtMost(mutable.size)
                }

            mutable.add(insertAt, username)
            queue = mutable.distinct()
            persistState()

            val message = "@$username marcado para revisão na fila."
            updateStatus(message)
            sendBatchStatus(message)
        } else {
            startBatch(listOf(username))
        }
    }

    private fun clearResult(username: String) {
        val results = readResults()
        if (!results.has(username)) return
        results.remove(username)
        prefs.edit().putString("results", results.toString()).apply()
        refreshStoredSnapshotNativeData()
    }

    private fun startVerificationForeground(message: String) {
        val intent = Intent(this, VerificationForegroundService::class.java)
            .setAction(VerificationForegroundService.ACTION_START)
            .putExtra(VerificationForegroundService.EXTRA_MESSAGE, message)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun updateVerificationForeground(message: String) {
        val intent = Intent(this, VerificationForegroundService::class.java)
            .setAction(VerificationForegroundService.ACTION_UPDATE)
            .putExtra(VerificationForegroundService.EXTRA_MESSAGE, message)
        startService(intent)
    }

    private fun stopVerificationForeground() {
        stopService(Intent(this, VerificationForegroundService::class.java))
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
        startVerificationForeground("Preparando ${queue.size} perfis para verificação")
        sendBatchStatus("Verificação contínua iniciada. ${queue.size} perfis na fila.")
        processNext()
    }

    private fun pauseBatch(message: String) {
        running = false
        currentUsername = null
        handler.removeCallbacksAndMessages(null)
        persistState()
        stopVerificationForeground()
        updateStatus(message)
        sendBatchStatus(message)
        sendResultsToWeb()
    }

    private fun hasValidatedInternet(): Boolean {
        val connectivity = getSystemService(CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val active = connectivity.activeNetwork ?: return false
        val capabilities = connectivity.getNetworkCapabilities(active) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    private fun pauseForConnection() {
        if (running) {
            pauseBatch("Sem acesso à internet. Verificação pausada; nenhum perfil foi marcado como indisponível por esta falha.")
        }
    }

    private fun processNext() {
        if (!running) return
        if (!hasValidatedInternet()) {
            pauseForConnection()
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

        extractionAttempts = 0
        val message = "Verificando @$username · ${processedThisRun + 1}/${queue.size}"
        updateStatus(message)
        updateVerificationForeground(message)
        sendBatchStatus(message)

        scannerWebView.loadUrl("https://www.instagram.com/${Uri.encode(username)}/")
    }

    private fun extractFollowers() {
        if (!running) return
        if (!hasValidatedInternet()) {
            pauseForConnection()
            return
        }
        val expected = currentUsername ?: return

        scannerWebView.evaluateJavascript(EXTRACT_SCRIPT) { raw ->
            if (!running || currentUsername != expected) return@evaluateJavascript
            if (!hasValidatedInternet()) {
                pauseForConnection()
                return@evaluateJavascript
            }
            val decoded = decodeJavascriptString(raw)
            val json = runCatching { JSONObject(decoded) }.getOrNull()

            if (json == null) {
                retryOrSkip(expected)
                return@evaluateJavascript
            }

            if (json.optBoolean("blocked", false)) {
                pauseBatch("Instagram exibiu login/verificação. Verificação pausada.")
                return@evaluateJavascript
            }

            val username = json.optString("username").lowercase()
            val unavailable = json.optBoolean("unavailable", false)
            val followersCount =
                if (json.has("followersCount") && !json.isNull("followersCount")) {
                    json.optLong("followersCount", -1L)
                } else {
                    -1L
                }

            if (username != expected.lowercase()) {
                retryOrSkip(expected)
                return@evaluateJavascript
            }

            if (unavailable) {
                saveFailure(username, "unavailable")
                processedThisRun++
                currentIndex++
                currentUsername = null
                persistState()

                val message = "@$username indisponível. Movido para Indisponíveis."
                updateStatus(message)
                sendUnavailableToWeb(username, "unavailable")
                sendResultsToWeb()
                sendBatchStatus(message)
                handler.postDelayed({ processNext() }, betweenProfilesMs)
                return@evaluateJavascript
            }

            if (followersCount < 0L) {
                retryOrSkip(expected)
                return@evaluateJavascript
            }

            saveResult(username, followersCount)
            clearFailure(username)
            processedThisRun++
            currentIndex++
            currentUsername = null
            persistState()

            val message = "@$username: $followersCount seguidores"
            updateStatus(message)
            sendProfileResultToWeb(username, followersCount)
            sendResultsToWeb()
            sendBatchStatus(message)

            handler.postDelayed({ processNext() }, betweenProfilesMs)
        }
    }

    private fun retryOrSkip(username: String) {
        if (!running || currentUsername != username) return
        if (!hasValidatedInternet()) {
            pauseForConnection()
            return
        }
        extractionAttempts++
        if (extractionAttempts < maxExtractionAttempts) {
            val message =
                "Aguardando @$username carregar · tentativa ${extractionAttempts + 1}/$maxExtractionAttempts"
            updateStatus(message)
            updateVerificationForeground(message)
            sendBatchStatus(message)

            val delay = 2_500L + (extractionAttempts * 2_000L)
            handler.postDelayed({ extractFollowers() }, delay)
            return
        }

        if (!hasValidatedInternet()) {
            pauseForConnection()
            return
        }
        saveFailure(username, "no_response")
        processedThisRun++
        currentIndex++
        currentUsername = null
        persistState()

        val message =
            "Não houve resposta utilizável em @$username após $maxExtractionAttempts tentativas. Movido para Indisponíveis."
        updateStatus(message)
        sendUnavailableToWeb(username, "no_response")
        sendResultsToWeb()
        sendBatchStatus(message)
        handler.postDelayed({ processNext() }, betweenProfilesMs)
    }

    private fun resetAndroidFailures(requested: JSONArray?) {
        if (running) {
            sendBatchStatus("Pause a verificação antes de revisar os indisponíveis.")
            return
        }
        val oldFailures = readFailures()
        val clearedSet = mutableSetOf<String>()
        val keys = oldFailures.keys()
        while (keys.hasNext()) {
            clearedSet.add(keys.next().lowercase())
        }
        if (requested != null) {
            for (i in 0 until requested.length().coerceAtMost(20000)) {
                val username = requested.optString(i).trim().lowercase().removePrefix("@")
                if (username.matches(Regex("[a-z0-9._]{1,30}"))) {
                    clearedSet.add(username)
                }
            }
        }
        val cleared = JSONArray()
        for (username in clearedSet) cleared.put(username)
        prefs.edit().putString("failures", "{}").apply()
        val snapshotRaw = prefs.getString("app_snapshot", null)
        if (!snapshotRaw.isNullOrBlank()) {
            val snapshot = runCatching { JSONObject(snapshotRaw) }.getOrNull()
            if (snapshot != null) {
                val existing = snapshot.optJSONArray("failures") ?: JSONArray()
                val retained = JSONArray()
                for (i in 0 until existing.length()) {
                    val item = existing.optJSONObject(i) ?: continue
                    if (item.optString("username").lowercase() !in clearedSet) retained.put(item)
                }
                snapshot.put("failures", retained)
                snapshot.put("nativeFailures", JSONObject())
                snapshot.put("savedAt", Instant.now().toString())
                prefs.edit()
                    .putString("app_snapshot", snapshot.toString())
                    .putBoolean("cloud_sync_pending", true)
                    .apply()
            }
        }

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "FAILURES_RESET")
                .put("usernames", cleared)
                .put("batch", batchJson())
        )
        sendResultsToWeb()
        updateStatus("${cleared.length()} registros voltaram para Revisar.")
    }

    private fun saveResult(username: String, followersCount: Long) {
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
        refreshStoredSnapshotNativeData()
    }

    private fun saveFailure(username: String, reason: String) {
        val failures = readFailures()
        failures.put(
            username,
            JSONObject()
                .put("username", username)
                .put("reason", reason)
                .put("updatedAt", Instant.now().toString())
        )
        prefs.edit().putString("failures", failures.toString()).apply()
        refreshStoredSnapshotNativeData()
    }

    private fun clearFailure(username: String) {
        val failures = readFailures()
        if (!failures.has(username)) return
        failures.remove(username)
        prefs.edit().putString("failures", failures.toString()).apply()
        refreshStoredSnapshotNativeData()
    }

    private fun readFailures(): JSONObject {
        val raw = prefs.getString("failures", null)
        return runCatching {
            if (raw.isNullOrBlank()) JSONObject() else JSONObject(raw)
        }.getOrDefault(JSONObject())
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
                .put("version", "0.3.16")
                .put("snapshotSavedAt", prefs.getString("app_snapshot_saved_at", null))
                .put("cloudSyncPending", prefs.getBoolean("cloud_sync_pending", false))
                .put("lastCloudSyncAt", prefs.getString("last_cloud_sync_at", null))
        )
    }

    private fun sendBackupFromClipboard() {
        val clipboard =
            getSystemService(CLIPBOARD_SERVICE) as? ClipboardManager
        val clip = clipboard?.primaryClip
        val text =
            if (clip != null && clip.itemCount > 0) {
                clip.getItemAt(0).coerceToText(this)?.toString()?.trim().orEmpty()
            } else {
                ""
            }

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "BACKUP_CLIPBOARD")
                .put("value", text)
        )
    }

    private fun saveBackupFile(content: String) {
        if (content.isBlank()) {
            sendToWeb(
                JSONObject()
                    .put("source", "followclean-android")
                    .put("type", "BACKUP_FILE_SAVED")
                    .put("ok", false)
                    .put("message", "Não há conteúdo de backup para salvar.")
            )
            return
        }

        pendingBackupFileContent = content
        val date = Instant.now().toString().substringBefore("T")
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "text/plain"
            putExtra(Intent.EXTRA_TITLE, "FollowClean-backup-$date.fcb")
        }
        startActivityForResult(intent, BACKUP_SAVE_REQUEST)
    }

    private fun openBackupFile() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            putExtra(
                Intent.EXTRA_MIME_TYPES,
                arrayOf("text/plain", "application/octet-stream")
            )
        }
        startActivityForResult(intent, BACKUP_OPEN_REQUEST)
    }

    private fun saveAppSnapshot(input: JSONObject) {
        val snapshot = JSONObject(input.toString())
            .put("nativeResults", readResults())
            .put("nativeFailures", readFailures())

        val savedAt = Instant.now().toString()
        snapshot.put("savedAt", savedAt)

        prefs.edit()
            .putString("app_snapshot", snapshot.toString())
            .putString("app_snapshot_saved_at", savedAt)
            .putBoolean("cloud_sync_pending", true)
            .apply()

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "SNAPSHOT_SAVED")
                .put("savedAt", savedAt)
                .put("cloudSyncPending", true)
        )
    }

    private fun refreshStoredSnapshotNativeData() {
        val raw = prefs.getString("app_snapshot", null)
        if (raw.isNullOrBlank()) return

        val snapshot = runCatching { JSONObject(raw) }.getOrNull() ?: return
        val savedAt = Instant.now().toString()

        snapshot
            .put("nativeResults", readResults())
            .put("nativeFailures", readFailures())
            .put("savedAt", savedAt)

        prefs.edit()
            .putString("app_snapshot", snapshot.toString())
            .putString("app_snapshot_saved_at", savedAt)
            .putBoolean("cloud_sync_pending", true)
            .apply()
    }

    private fun sendAppSnapshotToWeb() {
        val raw = prefs.getString("app_snapshot", null)
        val snapshot =
            if (raw.isNullOrBlank()) null
            else runCatching { JSONObject(raw) }.getOrNull()

        val payload = JSONObject()
            .put("source", "followclean-android")
            .put("type", "APP_SNAPSHOT")
            .put("savedAt", prefs.getString("app_snapshot_saved_at", null))
            .put("cloudSyncPending", prefs.getBoolean("cloud_sync_pending", false))
            .put("lastCloudSyncAt", prefs.getString("last_cloud_sync_at", null))

        if (snapshot != null) {
            payload.put("snapshot", snapshot)
        }

        sendToWeb(payload)
    }

    private fun markCloudSynced() {
        val syncedAt = Instant.now().toString()
        prefs.edit()
            .putBoolean("cloud_sync_pending", false)
            .putString("last_cloud_sync_at", syncedAt)
            .apply()

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "CLOUD_SYNC_STATUS")
                .put("cloudSyncPending", false)
                .put("lastCloudSyncAt", syncedAt)
        )
    }

    private fun sendProfileResultToWeb(username: String, followersCount: Long) {
        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "PROFILE_RESULT")
                .put(
                    "result",
                    JSONObject()
                        .put("username", username)
                        .put("followersCount", followersCount)
                        .put("dataSource", "android")
                        .put("updatedAt", Instant.now().toString())
                )
                .put("batch", batchJson())
        )
    }

    private fun sendReviewNeededToWeb(username: String, reason: String) {
        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "PROFILE_REVIEW")
                .put(
                    "review",
                    JSONObject()
                        .put("username", username)
                        .put("reason", reason)
                        .put("updatedAt", Instant.now().toString())
                )
                .put("batch", batchJson())
        )
    }

    private fun sendUnavailableToWeb(username: String, reason: String) {
        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "PROFILE_UNAVAILABLE")
                .put(
                    "failure",
                    JSONObject()
                        .put("username", username)
                        .put("reason", reason)
                        .put("updatedAt", Instant.now().toString())
                )
                .put("batch", batchJson())
        )
    }

    private fun sendResultsToWeb() {
        val resultsObject = readResults()
        val resultsArray = JSONArray()
        val resultKeys = resultsObject.keys()
        while (resultKeys.hasNext()) {
            val key = resultKeys.next()
            resultsArray.put(resultsObject.getJSONObject(key))
        }

        val failuresObject = readFailures()
        val failuresArray = JSONArray()
        val failureKeys = failuresObject.keys()
        while (failureKeys.hasNext()) {
            val key = failureKeys.next()
            failuresArray.put(failuresObject.getJSONObject(key))
        }

        sendToWeb(
            JSONObject()
                .put("source", "followclean-android")
                .put("type", "RESULTS")
                .put("results", resultsArray)
                .put("failures", failuresArray)
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
            .put("queueTotal", queue.size)
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

        if (requestCode == BACKUP_SAVE_REQUEST) {
            val uri = data?.data
            val content = pendingBackupFileContent
            pendingBackupFileContent = null

            if (resultCode == RESULT_OK && uri != null && !content.isNullOrBlank()) {
                val result = runCatching {
                    contentResolver.openOutputStream(uri)?.bufferedWriter(Charsets.UTF_8)?.use {
                        it.write(content)
                    } ?: error("Não foi possível abrir o arquivo para escrita.")
                }

                sendToWeb(
                    JSONObject()
                        .put("source", "followclean-android")
                        .put("type", "BACKUP_FILE_SAVED")
                        .put("ok", result.isSuccess)
                        .put(
                            "message",
                            if (result.isSuccess) "Backup salvo em arquivo com sucesso."
                            else "Não foi possível salvar o arquivo de backup."
                        )
                )
            }
            return
        }

        if (requestCode == BACKUP_OPEN_REQUEST) {
            val uri = data?.data
            if (resultCode == RESULT_OK && uri != null) {
                val result = runCatching {
                    contentResolver.openInputStream(uri)?.bufferedReader(Charsets.UTF_8)?.use {
                        it.readText()
                    } ?: error("Não foi possível abrir o arquivo.")
                }

                sendToWeb(
                    JSONObject()
                        .put("source", "followclean-android")
                        .put("type", "BACKUP_FILE_LOADED")
                        .put("ok", result.isSuccess)
                        .put("value", result.getOrNull().orEmpty())
                        .put(
                            "message",
                            if (result.isSuccess) "Arquivo de backup carregado."
                            else "Não foi possível ler o arquivo de backup."
                        )
                )
            }
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
        private const val BACKUP_SAVE_REQUEST = 9013
        private const val BACKUP_OPEN_REQUEST = 9014
        private val EXTRACT_SCRIPT = """
            (() => {
              function normalizeText(value) {
                return String(value || "")
                  .trim()
                  .toLowerCase()
                  .replace(/\u00a0/g, " ")
                  .replace(/\s+/g, " ");
              }

              function hasScaleUnit(raw) {
                const text = normalizeText(raw);
                return /(?:^|\s|\d)(?:k|mil|milhao|milhão|milhoes|milhões|m|mi|million|millions|b|bilhao|bilhão|bilhoes|bilhões|billion|billions|thousand)(?:\s|$|\b)/i.test(text);
              }

              function detectMultiplier(raw) {
                const text = normalizeText(raw);
                if (/(?:\b|\d)(b|bilhao|bilhão|bilhoes|bilhões|billion|billions)\b/i.test(text)) {
                  return 1000000000;
                }
                if (/(?:\b|\d)(m|mi|milhao|milhão|milhoes|milhões|million|millions)\b/i.test(text)) {
                  return 1000000;
                }
                if (/(?:\b|\d)(k|mil|thousand)\b/i.test(text)) {
                  return 1000;
                }
                return 1;
              }

              function parseHumanCount(raw) {
                if (!raw) return null;
                const text = normalizeText(raw);
                const token = text.match(/[\d.,]+/)?.[0];
                if (!token) return null;

                const multiplier = detectMultiplier(text);
                let normalized = token.replace(/\s/g, "");

                if (multiplier === 1) {
                  const digits = normalized.replace(/\D/g, "");
                  if (!digits) return null;
                  const value = Number.parseInt(digits, 10);
                  return Number.isFinite(value) ? value : null;
                }

                if (normalized.includes(",") && normalized.includes(".")) {
                  const lastComma = normalized.lastIndexOf(",");
                  const lastDot = normalized.lastIndexOf(".");
                  const decimal = lastComma > lastDot ? "," : ".";
                  normalized = normalized
                    .replace(decimal === "," ? /\./g : /,/g, "")
                    .replace(decimal, ".");
                } else if (normalized.includes(",")) {
                  normalized = normalized.replace(",", ".");
                }

                const value = Number.parseFloat(normalized);
                return Number.isFinite(value)
                  ? Math.round(value * multiplier)
                  : null;
              }

              function detectUnavailable() {
                const text = normalizeText(
                  [document.title, document.body?.innerText || ""].join(" ")
                );

                const phrases = [
                  "sorry, this page isn't available",
                  "page isn't available",
                  "the link you followed may be broken",
                  "esta página não está disponível",
                  "esta pagina nao esta disponivel",
                  "página não disponível",
                  "pagina nao disponivel",
                  "usuário não encontrado",
                  "usuario nao encontrado",
                  "user not found"
                ];

                return phrases.some((phrase) => text.includes(phrase));
              }

              function fromMeta() {
                const meta =
                  document.querySelector('meta[property="og:description"]') ||
                  document.querySelector('meta[name="description"]');
                const content = meta?.getAttribute("content") || "";
                const match = content.match(
                  /([\d.,]+(?:\s*(?:k|m|b|mil|mi|milhao|milhão|milhoes|milhões|thousand|million|millions|billion|billions|bilhao|bilhão|bilhoes|bilhões))?)\s+(?:de\s+)?(?:followers|seguidores)/i
                );
                return match ? parseHumanCount(match[1]) : null;
              }

              function fromFollowerLinks() {
                const links = [
                  ...document.querySelectorAll(
                    'a[href*="/followers/"], a[href$="/followers"]'
                  )
                ];

                for (const link of links) {
                  const title =
                    link.querySelector("[title]")?.getAttribute("title") ||
                    link.getAttribute("title") ||
                    "";
                  const text = link.textContent || "";
                  const parsedTitle = parseHumanCount(title);
                  const parsedText = parseHumanCount(text);

                  if (hasScaleUnit(text) && typeof parsedText === "number") {
                    return parsedText;
                  }
                  if (typeof parsedTitle === "number") return parsedTitle;
                  if (typeof parsedText === "number") return parsedText;
                }

                return null;
              }

              function fromVisibleText() {
                const candidates = [
                  ...document.querySelectorAll("header li, header span, main span, main a")
                ];

                for (const node of candidates) {
                  const text = (node.textContent || "").trim();
                  if (!/(followers|seguidores)/i.test(text)) continue;
                  const value = parseHumanCount(text);
                  if (typeof value === "number") return value;
                }

                const bodyText = document.body?.innerText || "";
                const match = bodyText.match(
                  /([\d.,]+(?:\s*(?:k|m|b|mil|mi|milhao|milhão|milhoes|milhões|thousand|million|millions|billion|billions|bilhao|bilhão|bilhoes|bilhões))?)\s+(?:de\s+)?(?:followers|seguidores)/i
                );
                return match ? parseHumanCount(match[1]) : null;
              }

              function fromEmbeddedJson() {
                const scripts = [...document.scripts];
                const patterns = [
                  /"edge_followed_by"\s*:\s*\{[^{}]*"count"\s*:\s*(\d+)/i,
                  /"follower_count"\s*:\s*(\d+)/i,
                  /"followers_count"\s*:\s*(\d+)/i,
                  /"followerCount"\s*:\s*(\d+)/i
                ];

                for (const script of scripts) {
                  const text = script.textContent || "";
                  if (!text) continue;

                  for (const pattern of patterns) {
                    const match = text.match(pattern);
                    if (!match) continue;
                    const value = Number.parseInt(match[1], 10);
                    if (Number.isFinite(value)) return value;
                  }
                }

                return null;
              }

              const path = location.pathname.toLowerCase();
              const blocked =
                path.startsWith("/accounts/login") ||
                path.startsWith("/challenge") ||
                path.startsWith("/checkpoint");

              const username =
                location.pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";

              const unavailable = detectUnavailable();

              const followersCount = unavailable
                ? null
                : (
                    fromMeta() ??
                    fromFollowerLinks() ??
                    fromVisibleText() ??
                    fromEmbeddedJson()
                  );

              return JSON.stringify({
                username,
                followersCount,
                blocked,
                unavailable
              });
            })();
        """.trimIndent()
    }
}
