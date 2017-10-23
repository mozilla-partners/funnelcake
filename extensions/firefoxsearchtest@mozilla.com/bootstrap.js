"use strict"

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const REASONS = {
  APP_STARTUP: 1,      // The application is starting up.
  APP_SHUTDOWN: 2,     // The application is shutting down.
  ADDON_ENABLE: 3,     // The add-on is being enabled.
  ADDON_DISABLE: 4,    // The add-on is being disabled. (Also sent during uninstallation)
  ADDON_INSTALL: 5,    // The add-on is being installed.
  ADDON_UNINSTALL: 6,  // The add-on is being uninstalled.
  ADDON_UPGRADE: 7,    // The add-on is being upgraded.
  ADDON_DOWNGRADE: 8,  // The add-on is being downgraded.
};

const kEngineName = "Firefox Search";
const kPrefPrefix = "extensions.firefoxsearchtest.";
const kPrefOriginalName = kPrefPrefix + "originalName";
const kPrefPromptedSwitch = kPrefPrefix + "promptedSwitch";
const kPrefAddedEngine = kPrefPrefix + "addedEngine";
const kPrefWasDefault = kPrefPrefix + "wasDefault";

function searchInitialized() {
  if (Services.search.isInitialized) {
    return;
  }
  return new Promise(resolve => {
    const SEARCH_SERVICE_TOPIC = "browser-search-service";
    Services.obs.addObserver(function observer(subject, topic, data) {
      if (data != "init-complete") {
        return;
      }
      Services.obs.removeObserver(observer, SEARCH_SERVICE_TOPIC);
      resolve();
    }, SEARCH_SERVICE_TOPIC, false);
  });
}

function install(data, reason) {}

function uninstall(data, reason) {}

async function startup(data, reason) {
  Cu.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(data.id, addon => {
    addon.uninstall();
  });
}

async function shutdown(data, reason) {
  if (reason == REASONS.ADDON_UNINSTALL) {
    await searchInitialized();
    let engine = Services.search.getEngineByName(kEngineName);
    if (engine) {
      if (Services.search.currentEngine == engine) {
        Services.prefs.setBoolPref(kPrefWasDefault, true);
      }
      Services.search.removeEngine(engine);
    }
    let originalEngineName = "";
    try {
      originalEngineName = Services.prefs.getCharPref(kPrefOriginalName, "");
    } catch (e) {}
    if (originalEngineName) {
      let originalEngine = Services.search.getEngineByName(originalEngineName);
      if (originalEngine) {
        Services.search.currentEngine = originalEngine;
      }
    }
  }
  if (reason == REASONS.ADDON_UNINSTALL) {
    Services.prefs.clearUserPref(kPrefOriginalName);
    Services.prefs.clearUserPref(kPrefPromptedSwitch);
    Services.prefs.clearUserPref(kPrefAddedEngine);
    Services.prefs.clearUserPref(kPrefWasDefault);
  }
}
