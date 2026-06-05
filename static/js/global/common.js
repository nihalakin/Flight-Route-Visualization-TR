/**
 * Ortak frontend yardımcıları: API base, token, fetch with auth.
 * Tüm sayfalarda tutarlı kullanım için tek merkez.
 */
(function (global) {
    'use strict';

    function getApiBase() {
        return window.location.origin;
    }

    function getToken() {
        return localStorage.getItem('access_token');
    }

    function setToken(token) {
        if (token) localStorage.setItem('access_token', token);
        else localStorage.removeItem('access_token');
    }

    function fetchWithAuth(url, options) {
        options = options || {};
        options.headers = options.headers || {};
        var token = getToken();
        if (token) options.headers['Authorization'] = 'Bearer ' + token;
        return fetch(url.indexOf('http') === 0 ? url : getApiBase() + url, options);
    }

    function redirectToLogin(nextPath) {
        nextPath = nextPath || (window.location.pathname || '/');
        window.location.href = '/login?next=' + encodeURIComponent(nextPath);
    }

    function logout() {
        setToken(null);
        window.location.href = '/login';
    }

    global.NodiaApp = global.NodiaApp || {};
    global.NodiaApp.getApiBase = getApiBase;
    global.NodiaApp.getToken = getToken;
    global.NodiaApp.setToken = setToken;
    global.NodiaApp.fetchWithAuth = fetchWithAuth;
    global.NodiaApp.redirectToLogin = redirectToLogin;
    global.NodiaApp.logout = logout;
})(typeof window !== 'undefined' ? window : this);
