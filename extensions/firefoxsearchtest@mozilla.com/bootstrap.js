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

const variations = {
  // FBS with 2 North Ads offered as default search
  "mozilla115": {
    "searchURL": "chrome://firefoxbrandedsearch/content/firefox115.xml",
    "searchDefault": true,
    "searchSwitch": false
  },
  // FBS with 2 North Ads offered during DSS switch
  "mozilla116": {
    "searchURL": "chrome://firefoxbrandedsearch/content/firefox116.xml",
    "searchDefault": false,
    "searchSwitch": true,
  },
  // FBS with 3 North Ads offered as default search
  "mozilla117": {
    "searchURL": "chrome://firefoxbrandedsearch/content/firefox117.xml",
    "searchDefault": true,
    "searchSwitch": false
  },
  // FBS with 3 North Ads offered during DSS switch
  "mozilla118": {
    "searchURL": "chrome://firefoxbrandedsearch/content/firefox118.xml",
    "searchDefault": false,
    "searchSwitch": true
  }
}

const kEngineName = "Firefox Search";
const kPrefPrefix = "extensions.firefoxsearchtest.";
const kPrefOriginalName = kPrefPrefix + "originalName";
const kPrefPromptedSwitch = kPrefPrefix + "promptedSwitch";
const kPrefAddedEngine = kPrefPrefix + "addedEngine";
const kPrefWasDefault = kPrefPrefix + "wasDefault";

function searchInitialized() {
  return new Promise(resolve => {
    try {
      if (Services.search.isInitialized) {
        resolve();
      }
      const SEARCH_SERVICE_TOPIC = "browser-search-service";
      Services.obs.addObserver(function observer(subject, topic, data) {
        if (data != "init-complete") {
          return;
        }
        Services.obs.removeObserver(observer, SEARCH_SERVICE_TOPIC);
        resolve();
      }, SEARCH_SERVICE_TOPIC, false);
    } catch (e) {
      Components.utils.reportError(e);
    }
  });
}

var gDistroID;

function distributionInitialized() {
  return new Promise(resolve => {
    try {
      try {
        gDistroID = Services.prefs.getCharPref("distribution.id", "");
      } catch (e) {}
      if (gDistroID) {
        resolve();
      }
      const DISTRIBUTION_COMPLETE_TOPIC = "distribution-customization-complete";
      Services.obs.addObserver(function observer(subject, topic, data) {
        Services.obs.removeObserver(observer, DISTRIBUTION_COMPLETE_TOPIC);
        try {
          gDistroID = Services.prefs.getCharPref("distribution.id", "");
        } catch (e) {}
        resolve();
      }, DISTRIBUTION_COMPLETE_TOPIC, false);
    } catch (e) {
      Components.utils.reportError(e);
    }
  });
}

function addEngine(makeDefault) {
  Services.search.addEngine(variations[gDistroID].searchURL, Ci.nsISearchEngine.DATA_XML, null, false, {
    onSuccess: function(engine) {
      Services.prefs.setBoolPref(kPrefAddedEngine, true);
      if (makeDefault) {
        Services.prefs.setCharPref(kPrefOriginalName, Services.search.currentEngine.name);
        Services.search.currentEngine = engine;
      }
    },
    onError: function(aCode) {
      Components.utils.reportError(aCode);
    }
  });
}

function install(data, reason) {
}

function uninstall(data, reason) {
}

async function startup(data, reason) {
  await distributionInitialized();
  if (!gDistroID || !variations[gDistroID]) {
    return;
  }
  if (variations[gDistroID].searchSwitch) {
    Services.obs.addObserver(observer, "chrome-document-global-created", false);
  }
  if (reason == REASONS.ADDON_ENABLE ||
      reason == REASONS.ADDON_INSTALL) {
    await searchInitialized();
    let addedEngine = false;
    try {
      addedEngine = Services.prefs.getBoolPref(kPrefAddedEngine);
    } catch (e) {}
    if (variations[gDistroID].searchDefault || addedEngine) {
      let wasDefault = false;
      try {
        wasDefault = Services.prefs.getBoolPref(kPrefWasDefault);
      } catch (e) {}
      addEngine(variations[gDistroID].searchDefault || wasDefault);
      Services.prefs.clearUserPref(kPrefWasDefault);
    }
  }
}

function shutdown(data, reason) {
  try {
    Services.obs.removeObserver(observer, "chrome-document-global-created", false);
  } catch (e) {
    // Might not have been added
  }
  if (reason == REASONS.ADDON_DISABLE ||
      reason == REASONS.ADDON_UNINSTALL) {
    let searchPromise = searchInitialized();
    searchPromise.then(() => {
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
    });
  }
  if (reason == REASONS.ADDON_UNINSTALL) {
    Services.prefs.clearUserPref(kPrefOriginalName);
    Services.prefs.clearUserPref(kPrefPromptedSwitch);
    Services.prefs.clearUserPref(kPrefAddedEngine);
    Services.prefs.clearUserPref(kPrefWasDefault);
  }

}

var observer = {
  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "chrome-document-global-created":
        let win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        win.addEventListener("load", function listener(event) {
          win.removeEventListener("load", listener, false);
          let doc = event.target;
          let url = doc.location.href.split("?")[0].split("#")[0];
          switch (url) {
            case "about:preferences":
            case "chrome://browser/content/preferences/in-content/preferences.xul":
              if (Services.search.currentEngine.name == kEngineName) {
                return;
              }
              let defaultEngine = doc.getElementById("defaultEngine");
              defaultEngine.addEventListener("popupshowing", function(event) {
                let alreadyPrompted = false;
                try {
                  alreadyPrompted = Services.prefs.getBoolPref(kPrefPromptedSwitch, false);
                } catch (e) {}
                if (!alreadyPrompted) {
                  Services.prefs.setBoolPref(kPrefPromptedSwitch, true);
                  var params = {addEngine: false};
                  win.gSubDialog.open("chrome://firefoxbrandedsearch/content/ask.xul",
                                      "resizable=no, modal=yes", params, function() {
                                        if (params.addEngine) {
                                          addEngine(true);
                                        }
                                      });
                  event.preventDefault();
                }
              }, false);
              break;
          }
        }, false);
        break;
    }
  }
}
