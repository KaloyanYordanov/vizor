/**
 * Vizor Embed SDK v1.0
 * 
 * Production-ready JavaScript SDK for embedding Vizor property viewers.
 * Serves as standalone file from /vizor-embed.js
 *
 * Usage:
 *   <script src="https://your-vizor.com/vizor-embed.js"></script>
 *   <div id="vizor-widget"></div>
 *   <script>
 *     Vizor.init({
 *       target: "vizor-widget",
 *       company: "horizon",
 *       project: "sunrise-residences",
 *       // ... full config overrides
 *     });
 *   </script>
 *
 * Or declarative with data attributes:
 *   <div id="vizor-widget"
 *        data-vizor-company="horizon"
 *        data-vizor-project="sunrise-residences"
 *        data-vizor-height="600px"
 *        data-vizor-theme-primary="#e11d48">
 *   </div>
 *   <script src="https://your-vizor.com/vizor-embed.js" data-vizor-auto></script>
 */
(function (root, factory) {
  if (typeof root.Vizor !== "undefined") return; // prevent double-init
  root.Vizor = factory();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this, function () {
  "use strict";

  // ── Helpers ──────────────────────────────────────────────────────
  function deepMerge(target, source) {
    if (!source) return target;
    var result = {};
    for (var key in target) {
      if (target.hasOwnProperty(key)) {
        if (
          typeof target[key] === "object" &&
          target[key] !== null &&
          !Array.isArray(target[key]) &&
          typeof source[key] === "object" &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = deepMerge(target[key], source[key]);
        } else if (source.hasOwnProperty(key)) {
          result[key] = source[key];
        } else {
          result[key] = target[key];
        }
      }
    }
    // Also copy keys from source that are not in target
    for (var skey in source) {
      if (source.hasOwnProperty(skey) && !target.hasOwnProperty(skey)) {
        result[skey] = source[skey];
      }
    }
    return result;
  }

  function toBase64Url(str) {
    try {
      var encoded = btoa(unescape(encodeURIComponent(str)));
      return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    } catch (e) {
      return "";
    }
  }

  // Parse data-vizor-* attributes from a container element
  function parseDataAttributes(el) {
    var config = {};
    var attrs = el.attributes;
    for (var i = 0; i < attrs.length; i++) {
      var attr = attrs[i];
      if (attr.name.indexOf("data-vizor-") !== 0) continue;
      var path = attr.name.replace("data-vizor-", "").split("-");
      var value = attr.value;

      // Convert booleans and numbers
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value !== "" && !isNaN(Number(value))) value = Number(value);

      // Build nested object from path
      var obj = config;
      for (var j = 0; j < path.length - 1; j++) {
        if (!obj[path[j]]) obj[path[j]] = {};
        obj = obj[path[j]];
      }
      obj[path[path.length - 1]] = value;
    }
    return config;
  }

  // Detect host origin from <script> tag src
  function detectOrigin() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("vizor-embed") !== -1) {
        var a = document.createElement("a");
        a.href = src;
        return a.protocol + "//" + a.host;
      }
    }
    return "";
  }

  // ── Instance tracking ────────────────────────────────────────────
  var instances = {};
  var instanceCounter = 0;

  // ── Public API ───────────────────────────────────────────────────
  var Vizor = {
    version: "1.0.0",
    _origin: null,

    /**
     * Initialize a Vizor embed widget.
     *
     * @param {Object} options
     * @param {string} options.target        - Container element ID (required)
     * @param {string} options.company       - Company slug (required)
     * @param {string} options.project       - Project slug (required)
     * @param {string} [options.origin]      - Vizor server origin (auto-detected)
     * @param {Object} [options.layout]      - Layout overrides
     * @param {Object} [options.header]      - Header overrides
     * @param {Object} [options.theme]       - Theme overrides
     * @param {Object} [options.filters]     - Filter overrides
     * @param {Object} [options.floorPlan]   - Floor plan overrides
     * @param {Object} [options.apartment]   - Apartment detail overrides
     * @param {Object} [options.listView]    - List view overrides
     * @param {Object} [options.navigation]  - Navigation overrides
     * @param {Object} [options.branding]    - Branding overrides
     * @param {string} [options.locale]      - Default locale ("en", "bg", etc.)
     * @param {Function} [options.onReady]           - Callback when embed loads
     * @param {Function} [options.onApartmentClick]  - Callback for apartment clicks
     * @param {Function} [options.onRequestSubmit]   - Callback for request form submissions
     * @returns {Object} Widget instance with destroy() method
     */
    init: function (options) {
      if (!options) {
        console.error("Vizor: options required");
        return null;
      }

      var target = options.target;
      var company = options.company;
      var project = options.project;

      if (!target || !company || !project) {
        console.error("Vizor: target, company, and project are required");
        return null;
      }

      var container = typeof target === "string" ? document.getElementById(target) : target;
      if (!container) {
        console.error("Vizor: Container element '" + target + "' not found");
        return null;
      }

      var origin = options.origin || Vizor._origin || detectOrigin();
      if (!origin) {
        console.error("Vizor: Unable to detect server origin. Pass 'origin' option.");
        return null;
      }

      // Build config (exclude non-config keys)
      var configKeys = [
        "layout", "header", "theme", "filters", "floorPlan",
        "apartment", "listView", "navigation", "branding", "locale"
      ];
      var config = {};
      for (var i = 0; i < configKeys.length; i++) {
        var key = configKeys[i];
        if (options[key] !== undefined) {
          config[key] = options[key];
        }
      }

      // Instance ID — generated early so we can include it in the URL
      var instanceId = "vizor_" + (++instanceCounter);

      // Merge with data-attributes on container
      var dataConfig = parseDataAttributes(container);
      config = deepMerge(config, dataConfig);

      // Build viewer URL
      var viewerUrl = origin + "/view/" + encodeURIComponent(company) + "/" + encodeURIComponent(project);
      var params = ["embed=1", "_vizorId=" + encodeURIComponent(instanceId)];

      // Encode config as compact base64url parameter if there are overrides
      if (Object.keys(config).length > 0) {
        var configStr = toBase64Url(JSON.stringify(config));
        if (configStr) {
          params.push("ec=" + configStr);
        }
      }

      viewerUrl += "?" + params.join("&");

      // Layout config
      var layout = options.layout || {};
      var width = layout.width || "100%";
      var height = layout.height || "800px";
      var maxWidth = layout.maxWidth || "none";
      var borderRadius = layout.borderRadius || "12px";
      var boxShadow = layout.boxShadow !== undefined ? layout.boxShadow : "0 1px 3px rgba(0,0,0,0.1)";
      var padding = layout.padding || "0";

      // Create iframe
      var iframe = document.createElement("iframe");
      iframe.src = viewerUrl;
      iframe.style.width = width;
      iframe.style.height = height;
      iframe.style.maxWidth = maxWidth;
      iframe.style.border = "none";
      iframe.style.borderRadius = borderRadius;
      iframe.style.boxShadow = boxShadow;
      iframe.style.padding = padding;
      iframe.style.display = "block";
      iframe.style.margin = "0 auto";
      iframe.style.colorScheme = "light";
      iframe.setAttribute("allowfullscreen", "true");
      iframe.setAttribute("loading", "lazy");
      iframe.setAttribute("allow", "clipboard-write");
      iframe.title = "Vizor Property Viewer";

      iframe.dataset.vizorInstance = instanceId;

      // Clear container and insert
      container.innerHTML = "";
      container.appendChild(iframe);

      // PostMessage listener for callbacks
      var callbacks = {
        onReady: options.onReady || null,
        onApartmentClick: options.onApartmentClick || null,
        onRequestSubmit: options.onRequestSubmit || null,
      };

      function messageHandler(event) {
        if (event.origin !== origin) return;
        if (event.source !== iframe.contentWindow) return;
        var data = event.data;
        if (!data || typeof data.type !== "string" || data.type.indexOf("vizor:") !== 0) return;
        if (data._vizor !== instanceId) return;

        switch (data.type) {
          case "vizor:ready":
            if (callbacks.onReady) callbacks.onReady({ instanceId: instanceId });
            break;
          case "vizor:apartment-click":
            if (callbacks.onApartmentClick) callbacks.onApartmentClick(data.apartment);
            break;
          case "vizor:request-submit":
            if (callbacks.onRequestSubmit) callbacks.onRequestSubmit(data.formData);
            break;
          case "vizor:resize":
            if (data.height && layout.height === "auto") {
              iframe.style.height = data.height + "px";
            }
            break;
        }
      }

      window.addEventListener("message", messageHandler);

      // Instance object
      var instance = {
        id: instanceId,
        iframe: iframe,
        container: container,

        /** Remove the widget and clean up listeners */
        destroy: function () {
          window.removeEventListener("message", messageHandler);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          delete instances[instanceId];
        },

        /** Send a message to the embedded viewer */
        postMessage: function (type, payload) {
          if (iframe.contentWindow) {
            iframe.contentWindow.postMessage(
              Object.assign({ _vizor: instanceId, type: type }, payload || {}),
              origin
            );
          }
        },

        /** Navigate to a specific apartment */
        showApartment: function (apartmentId) {
          this.postMessage("vizor:show-apartment", { apartmentId: apartmentId });
        },

        /** Update filters programmatically */
        setFilters: function (filters) {
          this.postMessage("vizor:set-filters", { filters: filters });
        },

        /** Change the active view */
        setView: function (view) {
          this.postMessage("vizor:set-view", { view: view });
        },

        /** Update config at runtime (theme, visibility, etc.) */
        updateConfig: function (partialConfig) {
          this.postMessage("vizor:update-config", { config: partialConfig });
        },
      };

      instances[instanceId] = instance;
      return instance;
    },

    /** Get all active widget instances */
    getInstances: function () {
      return instances;
    },

    /** Destroy all widgets */
    destroyAll: function () {
      for (var id in instances) {
        if (instances.hasOwnProperty(id)) {
          instances[id].destroy();
        }
      }
    },
  };

  // ── Auto-init from data attributes ───────────────────────────────
  function autoInit() {
    var containers = document.querySelectorAll("[data-vizor-company][data-vizor-project]");
    for (var i = 0; i < containers.length; i++) {
      var el = containers[i];
      if (el.dataset.vizorInitialized) continue;
      el.dataset.vizorInitialized = "true";

      var company = el.dataset.vizorCompany;
      var project = el.dataset.vizorProject;
      if (!company || !project) continue;

      var dataConfig = parseDataAttributes(el);
      Vizor.init(Object.assign({
        target: el.id || el,
        company: company,
        project: project,
      }, dataConfig));
    }
  }

  // Check for data-vizor-auto on the script tag itself
  var scripts = document.getElementsByTagName("script");
  for (var i = scripts.length - 1; i >= 0; i--) {
    if (scripts[i].hasAttribute("data-vizor-auto")) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoInit);
      } else {
        autoInit();
      }
      break;
    }
  }

  return Vizor;
});
