const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

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

function install(aData, aReason) {}

function uninstall(aData, aReason) {}

async function startup(aData, aReason) {
  await searchInitialized();
  let engine = Services.search.getEngineByName("Search");
  if (engine) {
    Services.search.removeEngine(engine);
  }
  Cu.import("resource://gre/modules/AddonManager.jsm");
  AddonManager.getAddonByID(aData.id, addon => {
    addon.uninstall();
  });
}

function shutdown(data, reason) {}
