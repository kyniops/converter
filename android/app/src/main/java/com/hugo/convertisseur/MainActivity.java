package com.hugo.convertisseur;

import android.os.Bundle;
import android.webkit.WebSettings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().clearCache(true);
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        }
    }
}
