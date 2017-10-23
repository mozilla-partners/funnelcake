const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://gre/modules/Services.jsm");

const kAddonID = "nonavbarsearch@mozilla.com";

function install(aData, aReason) {}

function uninstall(aData, aReason) {}

var observer = {
  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "chrome-document-global-created":
        var win = subject.QueryInterface(Components.interfaces.nsIDOMWindow);
        win.addEventListener("load", function(event) {
          win.removeEventListener("load", arguments.callee, false);
          var doc = event.target;
          var url = doc.location.href.split("?")[0].split("#")[0];
          switch (url) {
            case "chrome://browser/content/browser.xul":
              Services.prefs.setBoolPref("browser.search.widget.inNavBar", false);
              Services.obs.removeObserver(observer, "chrome-document-global-created", false);
              Cu.import("resource://gre/modules/AddonManager.jsm");
              AddonManager.getAddonByID("nonavbarsearch@mozilla.com", addon => {
                addon.uninstall();
              });
              break;
          }
        }, false);
        break;
    }
  }
}

function startup(aData, aReason) {
  if (aReason == 5) {
    Services.obs.addObserver(observer, "chrome-document-global-created", false);
  }
}

function shutdown(data, reason) {}
