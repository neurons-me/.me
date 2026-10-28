/*! live-tests version bar · the shared this.me version selector for pages with their own UI (docs/Tests security panels)
 * Reads ?v= (or ?npm=), lists versions from jsDelivr, reloads with ?v=x.y.z. Same parameter as /.me/tests/ live suites. MIT · neurons.me */
(function () {
  var q = new URLSearchParams(location.search), cur = q.get("v") || q.get("npm") || "";
  var bar = document.createElement("div");
  bar.setAttribute("style", "position:sticky;top:0;z-index:50;display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:6px 14px;font:13px/1.4 Inter,system-ui,sans-serif;background:rgba(11,17,20,.92);color:#e8eded;border-bottom:1px solid rgba(232,237,237,.12)");
  bar.innerHTML = '<a href="/.me/tests/security/" style="color:#4fb3bf;margin-right:auto">← Security tests</a><label for="lt-ver">this.me</label>';
  var sel = document.createElement("select"); sel.id = "lt-ver";
  sel.setAttribute("style", "font:inherit;background:#132026;color:inherit;border:1px solid rgba(232,237,237,.25);border-radius:6px;padding:2px 6px");
  sel.innerHTML = '<option value="">latest</option>';
  bar.appendChild(sel); document.body.insertBefore(bar, document.body.firstChild);
  fetch("https://data.jsdelivr.com/v1/packages/npm/this.me").then(function (r) { return r.json(); }).then(function (d) {
    var t = d.tags || {}; sel.options[0].textContent = "latest (" + t.latest + ")";
    (d.versions || []).map(function (v) { return v.version || v; }).filter(function (v) { return /^\d+\.\d+\.\d+$/.test(v) && v >= "4"; }).forEach(function (v) {
      var o = document.createElement("option"); o.value = v; o.textContent = v + (v === "4.0.2" ? " (hash-pinned)" : ""); sel.appendChild(o);
    });
    sel.value = cur === t.latest ? "" : cur;
  }).catch(function () {});
  sel.addEventListener("change", function () { var u = new URL(location.href); u.searchParams.delete("npm"); if (sel.value) u.searchParams.set("v", sel.value); else u.searchParams.delete("v"); location.href = u.toString(); });
})();
