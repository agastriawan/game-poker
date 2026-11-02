package com.pokerbarudak.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        makeFullScreen();
        handleDeepLink(getIntent());
    }

    @Override
    protected void onResume() {
        super.onResume();
        makeFullScreen();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void makeFullScreen() {
        try {
            Window window = getWindow();
            if (window != null) {
                View decorView = window.getDecorView();
                if (decorView != null) {
                    decorView.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                    );
                }
            }
        } catch (Exception e) {
            // ignore
        }
    }

    private void handleDeepLink(Intent intent) {
        if (intent == null || intent.getData() == null) return;
        Uri data = intent.getData();
        String roomCode = null;

        if ("pokerbarudak".equalsIgnoreCase(data.getScheme())) {
            // pokerbarudak://room/CODE or pokerbarudak://CODE
            if ("room".equalsIgnoreCase(data.getHost())) {
                roomCode = data.getLastPathSegment();
            } else if (data.getHost() != null && !data.getHost().isEmpty()) {
                roomCode = data.getHost();
            }
        } else if ("https".equalsIgnoreCase(data.getScheme()) || "http".equalsIgnoreCase(data.getScheme())) {
            roomCode = data.getQueryParameter("room");
            if (roomCode == null) roomCode = data.getQueryParameter("join");
        }

        if (roomCode != null && !roomCode.trim().isEmpty()) {
            final String cleanCode = roomCode.trim().toUpperCase();
            final String targetUrl = "https://poker-barudak.vercel.app/?room=" + cleanCode;
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().post(new Runnable() {
                    @Override
                    public void run() {
                        bridge.getWebView().loadUrl(targetUrl);
                    }
                });
            }
        }
    }
}
