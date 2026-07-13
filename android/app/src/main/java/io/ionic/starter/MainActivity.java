package io.ionic.starter;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Switch from splash theme to NoActionBar theme
        setTheme(R.style.AppTheme_NoActionBar);
        // Clear WebView cache on every launch so Firebase deploys show immediately
        WebView webView = new WebView(this);
        webView.clearCache(true);
        super.onCreate(savedInstanceState);
    }
}
